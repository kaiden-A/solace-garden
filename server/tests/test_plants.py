import json
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session as DbSession

from app.models import Plant, PlantPost
from app.services.plants_services import PLACEMENTS

SEED_GARDEN = json.loads(
    (Path(__file__).resolve().parent.parent / "app" / "data" / "seed_garden.json").read_text(
        encoding="utf-8"
    )
)


def test_requires_sign_in(client: TestClient) -> None:
    assert client.get("/api/plants").status_code == 401
    assert client.post("/api/plants", json={"body": "hi"}).status_code == 401
    assert client.get("/api/auth/me").status_code == 401


def test_create_lists_and_shapes_a_plant(client: TestClient, db, make_user, sign_in) -> None:
    sign_in(make_user(db))

    created = client.post("/api/plants", json={"body": "  A small win  ", "category": "gratitude"})
    assert created.status_code == 201
    plant = created.json()

    assert plant["body"] == ""
    assert plant["category"] == "gratitude"
    assert plant["species"] is None
    assert plant["status"] == "growing"
    assert plant["stage"] == "seed"
    assert plant["forWhom"] is None
    assert plant["gift"] is None
    # A feeling is just its posts: no title, no planted event.
    assert [post["body"] for post in plant["posts"]] == ["A small win"]
    assert plant["posts"][0]["at"] > 0
    assert plant["events"] == []

    slot = PLACEMENTS["gratitude"][0]
    assert (plant["x"], plant["y"], plant["scale"]) == (slot["x"], slot["y"], slot["scale"])

    assert [p["id"] for p in client.get("/api/plants").json()] == [plant["id"]]


def test_validation_matches_the_old_route_messages(client: TestClient, db, make_user, sign_in) -> None:
    sign_in(make_user(db))

    blank = client.post("/api/plants", json={"body": "   ", "category": "hope"})
    assert blank.status_code == 400
    assert blank.json()["error"] == "Write something first."

    no_theme = client.post("/api/plants", json={"body": "something"})
    assert no_theme.status_code == 400
    assert no_theme.json()["error"] == "Choose a theme for your plant."

    letter_without_species = client.post(
        "/api/plants", json={"body": "for you", "forWhom": {"name": "Mom"}}
    )
    assert letter_without_species.status_code == 400
    assert letter_without_species.json()["error"] == "Choose a plant type."


def test_letters_use_letter_slots_and_a_species(client: TestClient, db, make_user, sign_in) -> None:
    sign_in(make_user(db))

    created = client.post(
        "/api/plants",
        json={
            "title": "For mom",
            "body": "Thank you",
            "species": "forget-me-not",
            "forWhom": {"name": "Mom", "email": "mom@example.com", "giveOn": "2026-10-01"},
        },
    )
    assert created.status_code == 201
    plant = created.json()

    assert plant["category"] is None
    assert plant["species"] == "forget-me-not"
    assert plant["forWhom"]["name"] == "Mom"
    assert plant["forWhom"]["email"] == "mom@example.com"
    assert plant["forWhom"]["giveOn"] > 0
    slot = PLACEMENTS["letter"][0]
    assert (plant["x"], plant["y"]) == (slot["x"], slot["y"])

    # an unknown species is rejected, exactly like the old route
    rejected = client.post(
        "/api/plants",
        json={"body": "no species given", "species": "nonsense", "forWhom": {"name": "Sam"}},
    )
    assert rejected.status_code == 400
    assert rejected.json()["error"] == "Choose a plant type."


def test_posts_grow_a_feeling(client: TestClient, db, make_user, sign_in) -> None:
    sign_in(make_user(db))
    plant_id = client.post("/api/plants", json={"body": "hi", "category": "hope"}).json()["id"]

    grown = client.post(f"/api/plants/{plant_id}/posts", json={"body": "again"}).json()
    assert [post["body"] for post in grown["plant"]["posts"]] == ["hi", "again"]
    assert grown["plant"]["stage"] == "sprout"
    assert grown["spawned"] is None

    flowered = client.post(f"/api/plants/{plant_id}/posts", json={"body": "and again"}).json()
    assert [post["body"] for post in flowered["plant"]["posts"]] == ["hi", "again", "and again"]
    assert flowered["plant"]["stage"] == "flower"

    blank = client.post(f"/api/plants/{plant_id}/posts", json={"body": "   "})
    assert blank.status_code == 400
    assert blank.json()["error"] == "Write something first."


def test_a_fruit_feeling_starts_a_new_seedling(client: TestClient, db, make_user, sign_in) -> None:
    sign_in(make_user(db, name="Ada"))
    plant_id = client.post("/api/plants", json={"body": "one", "category": "gratitude"}).json()["id"]
    for text in ("two", "three", "four", "five"):
        client.post(f"/api/plants/{plant_id}/posts", json={"body": text})

    # fruit also needs the plant to have a little age on it
    earlier = datetime.now(UTC) - timedelta(days=3)
    db.execute(update(Plant).where(Plant.id == uuid.UUID(plant_id)).values(created_at=earlier))
    db.execute(update(PlantPost).where(PlantPost.plant_id == uuid.UUID(plant_id)).values(at=earlier))
    db.commit()
    assert client.get(f"/api/plants/{plant_id}").json()["stage"] == "fruit"

    result = client.post(f"/api/plants/{plant_id}/posts", json={"body": "six"}).json()
    assert [post["body"] for post in result["plant"]["posts"]] == [
        "one",
        "two",
        "three",
        "four",
        "five",
    ]
    spawned = result["spawned"]
    assert spawned is not None
    assert spawned["id"] != plant_id
    assert spawned["category"] == "gratitude"
    assert spawned["stage"] == "seed"
    assert spawned["title"] == ""
    assert [post["body"] for post in spawned["posts"]] == ["six"]

    # both live in the garden, and the seedling got its own spot
    plants = client.get("/api/plants").json()
    assert {plant["id"] for plant in plants} == {plant_id, spawned["id"]}
    assert (spawned["x"], spawned["y"]) != (result["plant"]["x"], result["plant"]["y"])


def test_letters_and_feelings_use_their_own_growth(client: TestClient, db, make_user, sign_in) -> None:
    sign_in(make_user(db))

    letter_id = client.post(
        "/api/plants",
        json={"title": "For mom", "body": "hello", "species": "foxglove", "forWhom": {"name": "Mom"}},
    ).json()["id"]
    rejected = client.post(f"/api/plants/{letter_id}/posts", json={"body": "hi"})
    assert rejected.status_code == 400
    assert rejected.json()["error"] == "Letters grow through tending."

    feeling_id = client.post("/api/plants", json={"body": "hi", "category": "hope"}).json()["id"]
    rejected = client.post(f"/api/plants/{feeling_id}/tend", json={"note": "hi"})
    assert rejected.status_code == 400
    assert rejected.json()["error"] == "Write a post instead."


def test_watering_plants_the_first_seed_then_feeds_it(
    client: TestClient, db, make_user, sign_in
) -> None:
    sign_in(make_user(db))

    first = client.post("/api/feelings/gratitude/posts", json={"body": "  one  "})
    assert first.status_code == 200
    plant = first.json()["plant"]
    assert plant["category"] == "gratitude"
    assert plant["stage"] == "seed"
    assert [post["body"] for post in plant["posts"]] == ["one"]
    assert first.json()["spawned"] is None

    second = client.post("/api/feelings/gratitude/posts", json={"body": "two"})
    assert [post["body"] for post in second.json()["plant"]["posts"]] == ["one", "two"]
    assert second.json()["plant"]["id"] == plant["id"]
    assert second.json()["plant"]["stage"] == "sprout"

    # a different feeling gets its own plant
    hope = client.post("/api/feelings/hope/posts", json={"body": "hopefully"}).json()["plant"]
    assert hope["id"] != plant["id"]
    assert len(client.get("/api/plants").json()) == 2


def test_watering_a_full_feeling_spawns_a_seedling(
    client: TestClient, db, make_user, sign_in
) -> None:
    sign_in(make_user(db))
    plant_id = client.post("/api/feelings/memory/posts", json={"body": "one"}).json()["plant"]["id"]
    for text in ("two", "three", "four", "five"):
        client.post("/api/feelings/memory/posts", json={"body": text})

    earlier = datetime.now(UTC) - timedelta(days=3)
    db.execute(update(Plant).where(Plant.id == uuid.UUID(plant_id)).values(created_at=earlier))
    db.execute(update(PlantPost).where(PlantPost.plant_id == uuid.UUID(plant_id)).values(at=earlier))
    db.commit()
    assert client.get(f"/api/plants/{plant_id}").json()["stage"] == "fruit"

    # the newest plant is the full one, so the next post starts a seedling
    result = client.post("/api/feelings/memory/posts", json={"body": "six"}).json()
    assert result["spawned"] is not None
    assert [post["body"] for post in result["spawned"]["posts"]] == ["six"]

    # and that seedling is now the newest, so the next post feeds it
    followed = client.post("/api/feelings/memory/posts", json={"body": "seven"}).json()
    assert followed["spawned"] is None
    assert followed["plant"]["id"] == result["spawned"]["id"]
    assert [post["body"] for post in followed["plant"]["posts"]] == ["six", "seven"]


def test_watering_ignores_hidden_and_other_gardens(
    client: TestClient, db, make_user, sign_in
) -> None:
    sign_in(make_user(db, name="Ada"))
    released = client.post(
        "/api/plants", json={"body": "let go", "category": "anger", "release": True}
    ).json()
    assert released["status"] == "released"

    # the released plant is invisible, so watering anger plants a fresh one
    watered = client.post("/api/feelings/anger/posts", json={"body": "still angry"}).json()["plant"]
    assert watered["id"] != released["id"]
    assert watered["status"] == "growing"

    sign_in(make_user(db, name="Grace", email="grace@example.com"))
    assert client.post("/api/feelings/anger/posts", json={"body": "mine"}).json()["plant"][
        "id"
    ] != watered["id"]
    assert len(client.get("/api/plants").json()) == 1

    assert client.post("/api/feelings/nonsense/posts", json={"body": "hi"}).status_code == 400
    assert client.post("/api/feelings/anger/posts", json={"body": "  "}).status_code == 400
    assert client.post("/api/feelings/anger/posts", json={"body": "x"}).status_code == 200


def test_release_hides_it_from_the_garden(client: TestClient, db, make_user, sign_in) -> None:
    sign_in(make_user(db))
    plant_id = client.post("/api/plants", json={"body": "let go", "category": "anger"}).json()["id"]

    assert client.post(f"/api/plants/{plant_id}/release").json() == {"ok": True}
    assert client.get("/api/plants").json() == []
    assert client.get(f"/api/plants/{plant_id}").status_code == 404
    # releasing twice stays quiet, exactly like the old route
    assert client.post(f"/api/plants/{plant_id}/release").status_code == 200


def test_giving_makes_a_public_link(client: TestClient, db, make_user, sign_in) -> None:
    sign_in(make_user(db))
    plant_id = client.post(
        "/api/plants",
        json={
            "title": "For you",
            "body": "for you",
            "species": "foxglove",
            "forWhom": {"name": "Sam"},
        },
    ).json()["id"]
    client.post(f"/api/plants/{plant_id}/tend", json={"note": "one more thought"})

    given = client.post(f"/api/plants/{plant_id}/give", json={"note": "with love"}).json()
    assert given["status"] == "given"
    assert given["gift"]["to"] == "Someone"
    token = given["gift"]["token"]
    assert token.startswith("g_")

    payload = client.get(f"/api/gifts/{token}").json()
    assert payload["title"] == "For you"
    assert payload["body"] == "for you"
    assert payload["species"] == "foxglove"
    assert payload["to"] == "Someone"
    assert payload["note"] == "with love"
    assert [letter["note"] for letter in payload["letters"]] == ["one more thought"]

    assert client.get("/api/gifts/g_nope").status_code == 404


def test_gifting_a_feeling_carries_its_posts(client: TestClient, db, make_user, sign_in) -> None:
    sign_in(make_user(db))
    plant_id = client.post("/api/plants", json={"body": "first", "category": "memory"}).json()["id"]
    client.post(f"/api/plants/{plant_id}/posts", json={"body": "second"})

    given = client.post(f"/api/plants/{plant_id}/give", json={}).json()
    payload = client.get(f"/api/gifts/{given['gift']['token']}").json()

    assert payload["title"] == ""
    assert payload["body"] == ""
    assert [letter["note"] for letter in payload["letters"]] == ["first", "second"]


def test_other_people_cannot_touch_your_garden(client: TestClient, db, make_user, sign_in) -> None:
    sign_in(make_user(db, name="Ada"))
    plant_id = client.post("/api/plants", json={"body": "mine", "category": "feeling"}).json()["id"]

    sign_in(make_user(db, name="Grace", email="grace@example.com"))

    assert client.get(f"/api/plants/{plant_id}").status_code == 404
    assert client.post(f"/api/plants/{plant_id}/tend", json={}).status_code == 404
    assert client.post(f"/api/plants/{plant_id}/posts", json={"body": "mine"}).status_code == 404
    assert client.post(f"/api/plants/{plant_id}/give", json={}).status_code == 404
    assert client.post(f"/api/plants/{plant_id}/release").status_code == 404
    assert client.get("/api/plants").json() == []
    assert client.get("/api/plants/not-a-uuid").status_code == 404


def test_seeded_garden_matches_the_old_demo_content(db: DbSession, client: TestClient) -> None:
    client.post("/api/auth/guest")
    plants = client.get("/api/plants").json()

    assert len(plants) == len(SEED_GARDEN)

    feelings = [plant for plant in plants if not plant["forWhom"]]
    assert len(feelings) == len([entry for entry in SEED_GARDEN if not entry.get("for")])
    for entry in SEED_GARDEN:
        if entry.get("for"):
            continue
        seeded = next(p for p in feelings if [post["body"] for post in p["posts"]] == entry["posts"])
        count = len(seeded["posts"])
        idle_days = min(entry["offsets"])  # days since the newest post
        if idle_days >= 14:
            assert seeded["stage"] == "withered"
        elif count >= 5:
            assert seeded["stage"] == "fruit"
        elif count == 1:
            assert seeded["stage"] == "seed"
        else:
            assert seeded["stage"] in {"sprout", "flower"}

    letters = [plant for plant in plants if plant["forWhom"]]
    assert {letter["forWhom"]["name"] for letter in letters} == {"Mom", "Brother"}
    assert all(letter["species"] == "foxglove" for letter in letters)
    assert {letter["title"] for letter in letters} == {
        "For mom, when she's ready",
        "For my brother, when he graduates",
    }
    assert all(letter["posts"] == [] for letter in letters)
