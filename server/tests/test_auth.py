import base64
import hashlib
import uuid

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


def test_guest_garden_is_discarded_when_they_sign_up(
    idp_client: TestClient, fake_idp: FakeZitadel, db: DbSession
) -> None:
    guest = idp_client.post("/api/auth/guest")
    assert guest.status_code == 201
    guest_id = uuid.UUID(guest.json()["id"])
    assert len(idp_client.get("/api/plants").json()) == 17

    fake_idp.claims = {"sub": "zitadel-guest", "email": "guest@example.com", "name": "Was A Guest"}
    idp_client.get("/api/auth/login")
    payload = oauth_payload(idp_client)
    response = idp_client.get(f"/api/auth/callback?code=abc&state={payload['state']}")

    assert response.status_code == 302
    assert response.headers["location"] == "/garden"
    member = idp_client.get("/api/auth/me").json()
    assert member["id"] != str(guest_id), "a guest row must never become the account"
    assert member["kind"] == "member"
    assert idp_client.get("/api/plants").json() == [], "guest plants must not carry over"
    assert db.query(User).filter(User.id == guest_id).count() == 0
    assert db.query(User).filter(User.zitadel_sub == "zitadel-guest").count() == 1


def test_guest_with_an_existing_identity_signs_into_that_member(
    idp_client: TestClient, fake_idp: FakeZitadel, db: DbSession, make_user
) -> None:
    member = make_user(db, name="Ada", zitadel_sub="zitadel-1")
    member.idp_issuer = settings.zitadel_issuer.rstrip("/")
    db.commit()
    guest = idp_client.post("/api/auth/guest")
    assert guest.status_code == 201
    guest_id = uuid.UUID(guest.json()["id"])

    fake_idp.claims = {"sub": "zitadel-1", "email": "ada@example.com", "name": "Ada"}
    idp_client.get("/api/auth/login")
    payload = oauth_payload(idp_client)
    response = idp_client.get(f"/api/auth/callback?code=abc&state={payload['state']}")

    assert response.status_code == 302
    assert idp_client.get("/api/auth/me").json()["id"] == str(member.id)
    assert db.query(User).filter(User.id == guest_id).count() == 0
    assert db.query(User).filter(User.zitadel_sub == "zitadel-1").count() == 1


def test_logout_revokes_the_session(
    client: TestClient, db: DbSession, make_user, sign_in
) -> None:
    sign_in(make_user(db))

    assert client.get("/api/auth/me").status_code == 200
    assert client.post("/api/auth/logout").json() == {"ok": True, "logoutUrl": None}
    assert client.get("/api/auth/me").status_code == 401


def test_logout_sends_linked_members_through_the_idp_end_session(
    idp_client: TestClient, fake_idp: FakeZitadel, db: DbSession, make_user, sign_in
) -> None:
    sign_in(make_user(db, zitadel_sub="zitadel-1"))

    assert idp_client.post("/api/auth/logout").json() == {
        "ok": True,
        "logoutUrl": "https://idp.test/end_session",
    }
    assert fake_idp.end_session_calls == [
        {"id_token_hint": None, "post_logout_redirect_uri": settings.zitadel_post_logout_uri}
    ]
    assert idp_client.get("/api/auth/me").status_code == 401
