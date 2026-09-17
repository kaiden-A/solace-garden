import json
import time
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlparse

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm

from app.services.zitadel import ZitadelClient, ZitadelError

ISSUER = "https://idp.test"
CLIENT_ID = "391014016555682309"
DISCOVERY = {
    "issuer": ISSUER,
    "authorization_endpoint": f"{ISSUER}/oauth/v2/authorize",
    "token_endpoint": f"{ISSUER}/oauth/v2/token",
    "jwks_uri": f"{ISSUER}/oauth/v2/keys",
    "end_session_endpoint": f"{ISSUER}/oidc/v1/end_session",
    "id_token_signing_alg_values_supported": ["RS256", "ES256"],
}


def make_keys() -> tuple[rsa.RSAPrivateKey, dict]:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = json.loads(RSAAlgorithm.to_jwk(private_key.public_key()))
    jwk.update({"kid": "test-key", "use": "sig", "alg": "RS256"})
    return private_key, {"keys": [jwk]}


def make_client(handler: httpx.MockTransport | None = None) -> ZitadelClient:
    def default_handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/.well-known/openid-configuration":
            return httpx.Response(200, json=DISCOVERY)
        return httpx.Response(404)

    http = httpx.Client(transport=handler or httpx.MockTransport(default_handler))
    return ZitadelClient(issuer=ISSUER, client_id=CLIENT_ID, http=http)


def test_authorize_url_has_pkce_and_no_secret() -> None:
    client = make_client()

    url = client.authorize_url(
        state="st-1",
        nonce="no-1",
        code_challenge="ch-1",
        redirect_uri="http://localhost:3000/api/auth/callback",
    )
    parsed = urlparse(url)
    query = parse_qs(parsed.query)

    assert parsed.path == "/oauth/v2/authorize"
    assert query["response_type"] == ["code"]
    assert query["code_challenge_method"] == ["S256"]
    assert query["code_challenge"] == ["ch-1"]
    assert query["state"] == ["st-1"]
    assert query["nonce"] == ["no-1"]
    assert query["client_id"] == [CLIENT_ID]
    assert "client_secret" not in url


def test_exchange_code_is_a_public_client_request() -> None:
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/.well-known/openid-configuration":
            return httpx.Response(200, json=DISCOVERY)
        seen["auth_header"] = request.headers.get("authorization")
        seen["body"] = dict(parse_qs(request.content.decode()))
        seen["content_type"] = request.headers.get("content-type")
        return httpx.Response(200, json={"id_token": "x", "access_token": "y"})

    client = make_client(httpx.MockTransport(handler))
    tokens = client.exchange_code(
        code="the-code", code_verifier="the-verifier", redirect_uri="http://localhost:3000/cb"
    )

    assert tokens["id_token"] == "x"
    assert seen["auth_header"] is None
    assert "client_secret" not in seen["body"]
    assert seen["body"] == {
        "grant_type": ["authorization_code"],
        "code": ["the-code"],
        "redirect_uri": ["http://localhost:3000/cb"],
        "client_id": [CLIENT_ID],
        "code_verifier": ["the-verifier"],
    }
    assert seen["content_type"].startswith("application/x-www-form-urlencoded")


def test_id_token_is_verified_against_the_jwks_and_nonce() -> None:
    private_key, jwks = make_keys()
    client = make_client()
    client.jwks = jwks
    now = int(time.time())
    claims = {
        "iss": ISSUER,
        "aud": CLIENT_ID,
        "sub": "zitadel-user-1",
        "email": "ada@example.com",
        "name": "Ada",
        "nonce": "no-1",
        "iat": now,
        "exp": now + 300,
    }
    token = jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": "test-key"})

    assert client.verify_id_token(token, nonce="no-1")["sub"] == "zitadel-user-1"

    with pytest.raises(ZitadelError):
        client.verify_id_token(token, nonce="wrong-nonce")


def test_rejections_become_zitadel_errors() -> None:
    private_key, jwks = make_keys()
    now = datetime.now(UTC)

    def token(**overrides) -> str:
        claims = {
            "iss": ISSUER,
            "aud": CLIENT_ID,
            "sub": "zitadel-user-1",
            "nonce": "no-1",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=5)).timestamp()),
        }
        claims.update(overrides)
        return jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": "test-key"})

    client = make_client()
    client.jwks = jwks

    with pytest.raises(ZitadelError):
        client.verify_id_token(token(aud="someone-else"), nonce="no-1")
    with pytest.raises(ZitadelError):
        client.verify_id_token(token(iss="https://evil.test"), nonce="no-1")
    with pytest.raises(ZitadelError):
        client.verify_id_token(
            token(exp=int((now - timedelta(minutes=5)).timestamp())), nonce="no-1"
        )
    with pytest.raises(ZitadelError):
        client.verify_id_token("not-a-jwt", nonce="no-1")

    unknown_key = jwt.encode(
        {"iss": ISSUER, "aud": CLIENT_ID, "sub": "x", "nonce": "no-1", "iat": 0, "exp": 9_999_999_999},
        private_key,
        algorithm="RS256",
        headers={"kid": "not-in-jwks"},
    )
    with pytest.raises(ZitadelError):
        client.verify_id_token(unknown_key, nonce="no-1")


def test_id_token_tolerates_clock_skew() -> None:
    private_key, jwks = make_keys()
    client = make_client()
    client.jwks = jwks
    now = int(time.time())

    def token(iat_offset: int) -> str:
        return jwt.encode(
            {
                "iss": ISSUER,
                "aud": CLIENT_ID,
                "sub": "zitadel-user-1",
                "nonce": "no-1",
                "iat": now + iat_offset,
                "exp": now + 300,
            },
            private_key,
            algorithm="RS256",
            headers={"kid": "test-key"},
        )

    # The IDP's clock ahead of ours is normal; within the leeway it still works.
    assert client.verify_id_token(token(iat_offset=30), nonce="no-1")["sub"] == "zitadel-user-1"
    with pytest.raises(ZitadelError):
        client.verify_id_token(token(iat_offset=600), nonce="no-1")
