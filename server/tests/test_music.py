from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session as DbSession

from app.models import MusicPlaylist, MusicPlaylistItem, MusicSearch, MusicTrack
from app.services import music_services
from app.services.youtube import parse_video_id
from tests.conftest import FakeYouTube

SONG_A = "dQw4w9WgXcQ"
SONG_B = "9bZkp7q19f0"
SONG_C = "kJQP7kiw5Fk"


def test_parse_video_id_agrees_with_the_client() -> None:
    assert parse_video_id(SONG_A) == SONG_A
    assert parse_video_id(f"  {SONG_A}  ") == SONG_A
    assert parse_video_id(f"https://www.youtube.com/watch?v={SONG_A}&t=42") == SONG_A
    assert parse_video_id(f"https://youtu.be/{SONG_A}?si=abc") == SONG_A
    assert parse_video_id(f"https://m.youtube.com/watch?v={SONG_A}") == SONG_A
    assert parse_video_id(f"https://www.youtube.com/shorts/{SONG_A}") == SONG_A
    assert parse_video_id(f"https://www.youtube.com/embed/{SONG_A}") == SONG_A
    assert parse_video_id(f"youtube.com/watch?v={SONG_A}") == SONG_A
    assert parse_video_id("https://example.com/watch?v=abcdefghijk") is None
    assert parse_video_id("not a link") is None
    assert parse_video_id("") is None
    assert parse_video_id(None) is None


def test_search_caches_by_normalized_query(
    db: DbSession, music_client: TestClient, fake_youtube: FakeYouTube
) -> None:
    fake_youtube.results["lofi beats"] = [
        fake_youtube.track(SONG_A, title="Rainy Window"),
        fake_youtube.track(SONG_B, title="Quiet Room"),
    ]

    first = music_client.get("/api/music/search", params={"q": "  LoFi   Beats "})
    assert first.status_code == 200
    body = first.json()
    assert body["cached"] is False
    assert body["stale"] is False
    assert [track["id"] for track in body["results"]] == [SONG_A, SONG_B]
    assert body["results"][0]["title"] == "Rainy Window"
    assert fake_youtube.search_calls == ["lofi beats"]

    again = music_client.get("/api/music/search", params={"q": "lofi beats"})
    assert again.status_code == 200
    assert again.json() == {**body, "cached": True}
    assert fake_youtube.search_calls == ["lofi beats"]

    cached_row = db.scalar(select(MusicSearch).where(MusicSearch.query == "lofi beats"))
    assert cached_row is not None
    assert cached_row.hits == 1


def test_search_caches_empty_results(music_client: TestClient, fake_youtube: FakeYouTube) -> None:
    first = music_client.get("/api/music/search", params={"q": "nothing matches this"})
    assert first.status_code == 200
    assert first.json()["results"] == []

    again = music_client.get("/api/music/search", params={"q": "nothing matches this"})
    assert again.status_code == 200
    assert again.json()["cached"] is True
    assert fake_youtube.search_calls == ["nothing matches this"]


def test_search_serves_stale_cache_when_quota_is_spent(
    db: DbSession, music_client: TestClient, fake_youtube: FakeYouTube
) -> None:
    fake_youtube.results["rain"] = [fake_youtube.track(SONG_C, title="Storm")]
    assert music_client.get("/api/music/search", params={"q": "rain"}).status_code == 200

    db.execute(
        update(MusicSearch)
        .where(MusicSearch.query == "rain")
        .values(fetched_at=datetime.now(UTC) - timedelta(days=30))
    )
    db.commit()
    fake_youtube.quota = True

    stale = music_client.get("/api/music/search", params={"q": "rain"})
    assert stale.status_code == 200
    body = stale.json()
    assert body["cached"] is True
    assert body["stale"] is True
    assert [track["id"] for track in body["results"]] == [SONG_C]
    # the stale row is refreshed when possible: one call that hit quota
    assert fake_youtube.search_calls == ["rain", "rain"]

    empty = music_client.get("/api/music/search", params={"q": "something new"})
    assert empty.status_code == 429
    assert "paste a link" in empty.json()["error"]


def test_search_reports_missing_configuration(
    music_client: TestClient, fake_youtube: FakeYouTube
) -> None:
    fake_youtube.configured = False
    response = music_client.get("/api/music/search", params={"q": "rain"})
    assert response.status_code == 503
    assert fake_youtube.search_calls == []


def test_resolve_remembers_pasted_links(
    db: DbSession, music_client: TestClient, fake_youtube: FakeYouTube
) -> None:
    fake_youtube.oembed_tracks[SONG_A] = fake_youtube.track(
        SONG_A, title="Pasted Song", author="Chan"
    )

    first = music_client.get("/api/music/resolve", params={"url": f"https://youtu.be/{SONG_A}"})
    assert first.status_code == 200
    assert first.json() == {
        "id": SONG_A,
        "title": "Pasted Song",
        "author": "Chan",
        "thumb": f"https://i.ytimg.com/vi/{SONG_A}/mqdefault.jpg",
    }
    assert fake_youtube.oembed_calls == [SONG_A]

    again = music_client.get("/api/music/resolve", params={"url": SONG_A})
    assert again.status_code == 200
    assert fake_youtube.oembed_calls == [SONG_A]
    assert db.scalar(select(MusicTrack).where(MusicTrack.video_id == SONG_A)) is not None

    assert music_client.get("/api/music/resolve", params={"url": "nope"}).status_code == 400
    missing = music_client.get("/api/music/resolve", params={"url": f"https://youtu.be/{SONG_B}"})
    assert missing.status_code == 404


def test_anonymous_listeners_get_an_empty_library(music_client: TestClient) -> None:
    anonymous = music_client.get("/api/music/recents")
    assert anonymous.status_code == 200
    assert anonymous.json() == {"signedIn": False, "results": []}
    assert music_client.post("/api/music/plays", json={"videoId": SONG_A}).status_code == 401
    assert music_client.get("/api/music/popular").status_code == 200
    assert music_client.get("/api/music/popular").json() == []


def test_plays_fill_recents_and_popular(
    db: DbSession, music_client: TestClient, make_user, sign_in
) -> None:
    sign_in(make_user(db))

    played = music_client.post(
        "/api/music/plays",
        json={"videoId": SONG_A, "title": "First", "author": "Chan", "thumb": "t"},
    )
    assert played.status_code == 200
    assert [track["id"] for track in played.json()] == [SONG_A]

    played = music_client.post("/api/music/plays", json={"videoId": SONG_B, "title": "Second"})
    assert played.status_code == 200
    assert [track["id"] for track in played.json()] == [SONG_B, SONG_A]

    # replaying an old song moves it back to the front
    played = music_client.post("/api/music/plays", json={"videoId": SONG_A})
    assert [track["id"] for track in played.json()] == [SONG_A, SONG_B]

    recents = music_client.get("/api/music/recents").json()
    assert recents["signedIn"] is True
    assert [track["id"] for track in recents["results"]] == [SONG_A, SONG_B]
    assert recents["results"][0]["title"] == "First"

    popular = music_client.get("/api/music/popular").json()
    assert [track["id"] for track in popular] == [SONG_A, SONG_B]

    assert music_client.post("/api/music/plays", json={"videoId": "nope"}).status_code == 400


def test_recents_are_per_user(music_client: TestClient, db, make_user, sign_in) -> None:
    sign_in(make_user(db, name="Ada"))
    music_client.post("/api/music/plays", json={"videoId": SONG_A, "title": "Ada's song"})

    sign_in(make_user(db, name="Grace", email="grace@example.com"))
    assert music_client.get("/api/music/recents").json()["results"] == []
    music_client.post("/api/music/plays", json={"videoId": SONG_B, "title": "Grace's song"})

    grace = music_client.get("/api/music/recents").json()["results"]
    assert [track["id"] for track in grace] == [SONG_B]


def test_unknown_metadata_never_overwrites_a_known_track(
    db: DbSession, music_client: TestClient, make_user, sign_in
) -> None:
    sign_in(make_user(db))
    music_client.post(
        "/api/music/plays", json={"videoId": SONG_A, "title": "Real title", "author": "Real"}
    )
    music_client.post("/api/music/plays", json={"videoId": SONG_A})

    track = db.scalar(select(MusicTrack).where(MusicTrack.video_id == SONG_A))
    assert track is not None
    assert (track.title, track.author) == ("Real title", "Real")


def test_history_limit_is_bounded(music_client: TestClient, db, make_user, sign_in) -> None:
    sign_in(make_user(db))
    for index, video_id in enumerate([SONG_A, SONG_B, SONG_C]):
        music_client.post("/api/music/plays", json={"videoId": video_id, "title": f"t{index}"})

    assert len(music_client.get("/api/music/recents").json()["results"]) == 3
    assert (
        len(music_client.get("/api/music/recents", params={"limit": 2}).json()["results"]) == 2
    )
    assert music_client.get("/api/music/recents", params={"limit": 0}).status_code == 422
    assert music_client.get("/api/music/recents", params={"limit": 101}).status_code == 422


def test_playlists_require_a_listener(music_client: TestClient) -> None:
    assert music_client.get("/api/music/playlists").status_code == 401
    assert (
        music_client.post("/api/music/playlists", json={"name": "Late night"}).status_code == 401
    )


def test_playlist_crud(music_client: TestClient, db, make_user, sign_in) -> None:
    sign_in(make_user(db))

    created = music_client.post("/api/music/playlists", json={"name": "  Quiet   Hours "})
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "Quiet Hours"
    assert body["tracks"] == []
    playlist_id = body["id"]

    listed = music_client.get("/api/music/playlists").json()
    assert [(item["name"], item["count"], item["thumb"]) for item in listed] == [
        ("Quiet Hours", 0, "")
    ]

    renamed = music_client.patch(f"/api/music/playlists/{playlist_id}", json={"name": "Dawn"})
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Dawn"

    assert music_client.patch(f"/api/music/playlists/{playlist_id}", json={"name": "  "}).status_code == 400
    assert music_client.get("/api/music/playlists/not-a-uuid").status_code == 404
    assert music_client.delete(f"/api/music/playlists/{playlist_id}").json() == {"ok": True}
    assert music_client.get("/api/music/playlists").json() == []


def test_playlist_tracks_dedupe_order_and_remove(
    db: DbSession, music_client: TestClient, make_user, sign_in
) -> None:
    sign_in(make_user(db))
    playlist_id = music_client.post("/api/music/playlists", json={"name": "Walk"}).json()["id"]

    added = music_client.post(
        f"/api/music/playlists/{playlist_id}/tracks",
        json={"videoId": SONG_A, "title": "First", "author": "Chan", "thumb": "thumb-a"},
    )
    assert added.status_code == 200
    assert [track["id"] for track in added.json()["tracks"]] == [SONG_A]
    assert added.json()["tracks"][0]["title"] == "First"

    again = music_client.post(
        f"/api/music/playlists/{playlist_id}/tracks", json={"videoId": SONG_A}
    )
    assert [track["id"] for track in again.json()["tracks"]] == [SONG_A]

    music_client.post(
        f"/api/music/playlists/{playlist_id}/tracks", json={"videoId": SONG_B, "title": "Second"}
    )
    music_client.post(
        f"/api/music/playlists/{playlist_id}/tracks", json={"videoId": SONG_C, "title": "Third"}
    )
    ordered = music_client.get(f"/api/music/playlists/{playlist_id}").json()
    assert [track["id"] for track in ordered["tracks"]] == [SONG_A, SONG_B, SONG_C]

    reordered = music_client.put(
        f"/api/music/playlists/{playlist_id}/order",
        json={"videoIds": [SONG_C, SONG_A, SONG_B]},
    )
    assert [track["id"] for track in reordered.json()["tracks"]] == [SONG_C, SONG_A, SONG_B]

    # an id the caller forgot keeps its old place at the end
    partial = music_client.put(
        f"/api/music/playlists/{playlist_id}/order", json={"videoIds": [SONG_B, SONG_A]}
    )
    assert [track["id"] for track in partial.json()["tracks"]] == [SONG_B, SONG_A, SONG_C]

    removed = music_client.delete(f"/api/music/playlists/{playlist_id}/tracks/{SONG_A}")
    assert [track["id"] for track in removed.json()["tracks"]] == [SONG_B, SONG_C]

    assert (
        music_client.post(
            f"/api/music/playlists/{playlist_id}/tracks", json={"videoId": "nope"}
        ).status_code
        == 400
    )
    # the playlist's own metadata cache row was written when the track landed
    assert db.scalar(select(MusicTrack).where(MusicTrack.video_id == SONG_C)) is not None


def test_playlists_belong_to_one_listener(music_client: TestClient, db, make_user, sign_in) -> None:
    sign_in(make_user(db, name="Ada"))
    playlist_id = music_client.post("/api/music/playlists", json={"name": "Mine"}).json()["id"]

    sign_in(make_user(db, name="Grace", email="grace@example.com"))
    assert music_client.get("/api/music/playlists").json() == []
    assert music_client.get(f"/api/music/playlists/{playlist_id}").status_code == 404
    assert (
        music_client.patch(
            f"/api/music/playlists/{playlist_id}", json={"name": "Not mine"}
        ).status_code
        == 404
    )
    assert (
        music_client.post(
            f"/api/music/playlists/{playlist_id}/tracks", json={"videoId": SONG_A}
        ).status_code
        == 404
    )
    assert music_client.delete(f"/api/music/playlists/{playlist_id}").status_code == 404


def test_create_playlist_saves_a_queue_and_caps_apply(
    music_client: TestClient, db, make_user, sign_in, monkeypatch
) -> None:
    sign_in(make_user(db))
    monkeypatch.setattr(music_services, "MAX_PLAYLIST_TRACKS", 2)

    created = music_client.post(
        "/api/music/playlists",
        json={
            "name": "Tonight",
            "tracks": [
                {"videoId": SONG_A, "title": "A"},
                {"videoId": SONG_B, "title": "B"},
                {"videoId": SONG_C, "title": "C"},
                {"videoId": SONG_A, "title": "A again"},
            ],
        },
    )
    assert created.status_code == 201
    assert [track["id"] for track in created.json()["tracks"]] == [SONG_A, SONG_B]

    playlist_id = created.json()["id"]
    full = music_client.post(
        f"/api/music/playlists/{playlist_id}/tracks", json={"videoId": SONG_C}
    )
    assert full.status_code == 400
    assert "full" in full.json()["error"]

    monkeypatch.setattr(music_services, "MAX_PLAYLISTS", 1)
    capped = music_client.post("/api/music/playlists", json={"name": "One too many"})
    assert capped.status_code == 400
    assert "playlists" in capped.json()["error"]


def test_deleting_the_listener_removes_their_playlists(
    db: DbSession, music_client: TestClient, make_user, sign_in
) -> None:
    user = make_user(db)
    sign_in(user)
    playlist_id = music_client.post("/api/music/playlists", json={"name": "Going away"}).json()["id"]
    music_client.post(
        f"/api/music/playlists/{playlist_id}/tracks", json={"videoId": SONG_A, "title": "A"}
    )

    db.delete(user)
    db.commit()

    assert db.scalar(select(MusicPlaylist)) is None
    assert db.scalar(select(MusicPlaylistItem)) is None
