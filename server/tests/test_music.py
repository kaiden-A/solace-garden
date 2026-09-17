from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session as DbSession

from app.models import MusicSearch, MusicTrack
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
