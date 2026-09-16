import json
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session as DbSession

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

    assert plant["body"] == "A small win"
    assert plant["category"] == "gratitude"
    assert plant["species"] is None
    assert plant["status"] == "growing"
    assert plant["stage"] == "seed"
    assert plant["forWhom"] is None
    assert plant["gift"] is None
    assert [event["type"] for event in plant["events"]] == ["planted"]
    assert plant["events"][0]["note"] == "Planted the seed"

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


def test_tending_grows_the_plant(client: TestClient, db, make_user, sign_in) -> None:
    sign_in(make_user(db))
    plant_id = client.post("/api/plants", json={"body": "hi", "category": "hope"}).json()["id"]

    tended = client.post(f"/api/plants/{plant_id}/tend", json={"note": "again"}).json()
    assert [event["note"] for event in tended["events"]] == ["Planted the seed", "again"]
    assert tended["stage"] == "sprout"

    defaulted = client.post(f"/api/plants/{plant_id}/tend", json={}).json()
    assert defaulted["events"][-1]["note"] == "Tended it again"
    assert defaulted["stage"] == "flower"


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
    plant_id = client.post("/api/plants", json={"body": "for you", "category": "memory"}).json()["id"]
    client.post(f"/api/plants/{plant_id}/tend", json={"note": "one more thought"})

    given = client.post(f"/api/plants/{plant_id}/give", json={"note": "with love"}).json()
    assert given["status"] == "given"
    assert given["gift"]["to"] == "Someone"
    token = given["gift"]["token"]
    assert token.startswith("g_")

    payload = client.get(f"/api/gifts/{token}").json()
    assert payload["body"] == "for you"
    assert payload["species"] == "forget-me-not"
    assert payload["to"] == "Someone"
    assert payload["note"] == "with love"
    assert [letter["note"] for letter in payload["letters"]] == ["one more thought"]

    assert client.get("/api/gifts/g_nope").status_code == 404


def test_other_people_cannot_touch_your_garden(client: TestClient, db, make_user, sign_in) -> None:
    sign_in(make_user(db, name="Ada"))
    plant_id = client.post("/api/plants", json={"body": "mine", "category": "feeling"}).json()["id"]

    sign_in(make_user(db, name="Grace", email="grace@example.com"))

    assert client.get(f"/api/plants/{plant_id}").status_code == 404
    assert client.post(f"/api/plants/{plant_id}/tend", json={}).status_code == 404
    assert client.post(f"/api/plants/{plant_id}/give", json={}).status_code == 404
    assert client.post(f"/api/plants/{plant_id}/release").status_code == 404
    assert client.get("/api/plants").json() == []
    assert client.get("/api/plants/not-a-uuid").status_code == 404


def test_seeded_garden_matches_the_old_demo_content(db: DbSession, client: TestClient) -> None:
    client.post("/api/auth/guest")
    plants = client.get("/api/plants").json()

    titles = {plant["title"] for plant in plants}
    assert len(plants) == len(SEED_GARDEN)
    for entry in SEED_GARDEN:
        assert entry["title"] in titles

    letters = [plant for plant in plants if plant["forWhom"]]
    assert {letter["forWhom"]["name"] for letter in letters} == {"Mom", "Brother"}
    assert all(letter["species"] == "foxglove" for letter in letters)
