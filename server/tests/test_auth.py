import base64
import hashlib

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session as DbSession

from app.models import User
from app.services.security import OAUTH_COOKIE, unsign_payload

from .conftest import FakeZitadel, settings


def oauth_payload(client: TestClient) -> dict:
    raw = client.cookies.get(OAUTH_COOKIE)
    payload = unsign_payload(raw, settings.app_secret, max_age=600)
    assert payload is not None, "expected a signed OAuth cookie"
    return payload


def test_login_uses_pkce_and_carries_no_secret(
    idp_client: TestClient, fake_idp: FakeZitadel
) -> None:
    response = idp_client.get("/api/auth/login?next=/garden")

    assert response.status_code == 302
    assert response.headers["location"].startswith("https://idp.test/authorize")

    payload = oauth_payload(idp_client)
    sent = fake_idp.authorize_requests[0]
    expected_challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(payload["code_verifier"].encode()).digest())
        .decode()
        .rstrip("=")
    )
    assert sent["code_challenge"] == expected_challenge
    assert sent["nonce"] == payload["nonce"]
    assert sent["redirect_uri"] == settings.zitadel_redirect_uri
    assert "client_secret" not in response.headers["location"]
    assert "://" not in sent["code_challenge"]


def test_only_local_next_targets_survive(idp_client: TestClient, fake_idp: FakeZitadel) -> None:
    idp_client.get("/api/auth/login?next=https://evil.example/steal")
    assert oauth_payload(idp_client)["next"] == "/garden"


def test_callback_rejects_a_tampered_state(idp_client: TestClient, fake_idp: FakeZitadel) -> None:
    idp_client.get("/api/auth/login")

    response = idp_client.get("/api/auth/callback?code=abc&state=not-the-state")

    assert response.status_code == 400
    assert response.json()["error"]


def test_callback_provisions_a_local_user_and_links_the_subject(
    idp_client: TestClient, fake_idp: FakeZitadel, db: DbSession
) -> None:
    fake_idp.claims = {"sub": "zitadel-1", "email": "ADA@Example.com", "name": "Ada Lovelace"}

    idp_client.get("/api/auth/login?next=/seeds")
    payload = oauth_payload(idp_client)
    response = idp_client.get(f"/api/auth/callback?code=abc&state={payload['state']}")

    assert response.status_code == 302
    assert response.headers["location"] == "/seeds"
    assert fake_idp.token_requests == [
        {
            "code": "abc",
            "code_verifier": payload["code_verifier"],
            "redirect_uri": settings.zitadel_redirect_uri,
        }
    ]
    assert "client_secret" not in fake_idp.token_requests[0]

    me = idp_client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["name"] == "Ada Lovelace"
    assert me.json()["email"] == "ada@example.com"
    assert me.json()["kind"] == "member"
    local_id = me.json()["id"]

    # Signing in again (new browser session) reuses the same local row.
    idp_client.cookies.delete(settings.session_cookie_name)
    idp_client.get("/api/auth/login")
    payload = oauth_payload(idp_client)
    idp_client.get(f"/api/auth/callback?code=abc&state={payload['state']}")

    assert idp_client.get("/api/auth/me").json()["id"] == local_id
    assert db.query(User).filter(User.zitadel_sub == "zitadel-1").count() == 1


def test_guest_gets_a_seeded_garden_and_becomes_a_member_without_losing_it(
    idp_client: TestClient, fake_idp: FakeZitadel
) -> None:
    guest = idp_client.post("/api/auth/guest")
    assert guest.status_code == 201
    assert guest.json()["kind"] == "guest"
    assert guest.json()["email"] == ""
    guest_id = guest.json()["id"]

    me = idp_client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["name"] == "Guest Gardener"

    plants = idp_client.get("/api/plants").json()
    assert len(plants) == 17
    assert {plant["stage"] for plant in plants} <= {"seed", "sprout", "flower", "fruit", "withered"}

    fake_idp.claims = {"sub": "zitadel-guest", "email": "guest@example.com", "name": "Was A Guest"}
    idp_client.get("/api/auth/login")
    payload = oauth_payload(idp_client)
    response = idp_client.get(f"/api/auth/callback?code=abc&state={payload['state']}")

    assert response.status_code == 302
    assert response.headers["location"] == "/garden"
    upgraded = idp_client.get("/api/auth/me").json()
    assert upgraded["id"] == guest_id, "the guest row must survive the upgrade"
    assert upgraded["kind"] == "member"
    assert len(idp_client.get("/api/plants").json()) == 17


def test_logout_revokes_the_session(
    client: TestClient, db: DbSession, make_user, sign_in
) -> None:
    sign_in(make_user(db))

    assert client.get("/api/auth/me").status_code == 200
    assert client.post("/api/auth/logout").json() == {"ok": True, "logoutUrl": None}
    assert client.get("/api/auth/me").status_code == 401
