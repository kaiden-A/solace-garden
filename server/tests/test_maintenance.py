from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session as DbSession

from app.models import Plant, User
from app.models.enums import UserKind
from app.services.auth_services import create_session

from .conftest import settings

SECRET = "test-cleanup-secret"


def cleanup(client: TestClient, secret: str | None = None):
    headers = {"X-Cleanup-Secret": secret} if secret else {}
    return client.post("/api/maintenance/cleanup-guests", headers=headers)


def test_cleanup_is_disabled_without_a_configured_secret(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(settings, "cleanup_secret", "")
    assert cleanup(client).status_code == 403
    assert cleanup(client, "anything").status_code == 403


def test_cleanup_rejects_a_wrong_secret(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(settings, "cleanup_secret", SECRET)
    assert cleanup(client).status_code == 403
    assert cleanup(client, "nope").status_code == 403


def test_cleanup_purges_expired_guests_and_dead_sessions(
    client: TestClient, db: DbSession, monkeypatch, make_user, sign_in
) -> None:
    monkeypatch.setattr(settings, "cleanup_secret", SECRET)

    stale_guest = make_user(db, kind=UserKind.guest, name="Old Guest", email=None)
    stale_guest.guest_expires_at = datetime.now(UTC) - timedelta(minutes=1)
    active_guest = make_user(db, kind=UserKind.guest, name="Fresh Guest", email=None)
    active_guest.guest_expires_at = datetime.now(UTC) + timedelta(days=7)
    member = make_user(db, name="Ada")
    db.commit()

    plant = Plant(
        owner_id=stale_guest.id, title="", body="A memory", x=0.5, y=0.5, scale=1.0, seed=3
    )
    db.add(plant)
    db.commit()
    plant_id = plant.id

    # The stale guest's session is capped at guest_expires_at, so it is born dead.
    create_session(db, stale_guest, settings=settings)
    sign_in(member)

    response = cleanup(client, SECRET)

    assert response.status_code == 200
    assert response.json() == {"guests": 1, "plants": 1, "sessions": 1}
    assert db.query(User).filter(User.id == stale_guest.id).count() == 0
    assert db.query(Plant).filter(Plant.id == plant_id).count() == 0
    assert db.query(User).filter(User.id == active_guest.id).count() == 1
    assert client.get("/api/auth/me").json()["id"] == str(member.id)
