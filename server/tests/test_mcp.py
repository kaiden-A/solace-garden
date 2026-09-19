"""End-to-end tests for the /mcp endpoint.

The MCP tools open their own sessions through mcp_server._session_factory,
which the mcp_env fixture points at the throwaway test schema. Requests go
through TestClient so the mounted transport, auth middleware and identity
mapping are all exercised.
"""

import json
from datetime import UTC, datetime

import jwt
import pytest
from fastapi.testclient import TestClient

from app import mcp_tools  # noqa: F401  (import registers the tools)
from app.config import get_settings
from app.mcp_server import SolaceTokenVerifier
from app.models import User
from app.services.plants_services import create_plant

settings = get_settings()
PROTOCOL = "2026-07-28"
JSON_HEADERS = {
    "Accept": "application/json, text/event-stream",
    "Content-Type": "application/json",
}


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def rpc(
    client: TestClient,
    method: str,
    params: dict | None = None,
    *,
    token: str | None = None,
    rpc_id: int = 1,
):
    headers = dict(JSON_HEADERS)
    if token is not None:
        headers["Authorization"] = f"Bearer {token}"
    return client.post(
        "/mcp",
        headers=headers,
        content=json.dumps(
            {"jsonrpc": "2.0", "id": rpc_id, "method": method, "params": params or {}}
        ),
    )


def initialize(client: TestClient, *, token: str):
    return rpc(
        client,
        "initialize",
        {
            "protocolVersion": PROTOCOL,
            "capabilities": {},
            "clientInfo": {"name": "pytest", "version": "0.0"},
        },
        token=token,
    )


def tool_payload(result: dict):
    structured = result.get("structuredContent")
    if structured is not None:
        return structured.get("result", structured)
    return json.loads(result["content"][0]["text"])


def call_tool(client: TestClient, name: str, arguments: dict, *, rpc_id: int = 10) -> dict:
    response = rpc(
        client,
        "tools/call",
        {"name": name, "arguments": arguments},
        token=settings.mcp_api_key,
        rpc_id=rpc_id,
    )
    assert response.status_code == 200
    result = response.json()["result"]
    assert not result.get("isError"), result
    return result


def test_requires_bearer(mcp_client):
    response = rpc(mcp_client, "initialize")
    assert response.status_code == 401
    challenge = response.headers["www-authenticate"]
    assert "resource_metadata=" in challenge
    assert "/.well-known/oauth-protected-resource/mcp" in challenge


def test_rejects_unknown_token(mcp_client, monkeypatch):
    import app.mcp_server as mcp_server

    class NoKeys:
        def get_signing_key_from_jwt(self, _token: str):
            raise jwt.InvalidTokenError("unknown token")

    monkeypatch.setattr(mcp_server, "_jwks", lambda: NoKeys())
    assert rpc(mcp_client, "initialize", token="not-the-key").status_code == 401


def test_get_mcp_stream_is_refused(mcp_client):
    """An idle GET must not hold an SSE request (and a Cloud Run instance) open."""
    response = mcp_client.get(
        "/mcp",
        headers={
            "Accept": "text/event-stream",
            "Authorization": f"Bearer {settings.mcp_api_key}",
        },
    )
    assert response.status_code == 405


def test_initialize_lists_all_tools(mcp_client):
    response = initialize(mcp_client, token=settings.mcp_api_key)
    assert response.status_code == 200
    assert response.json()["result"]["serverInfo"]["name"] == "solace-garden"

    listed = rpc(mcp_client, "tools/list", token=settings.mcp_api_key, rpc_id=2)
    assert listed.status_code == 200
    names = {tool["name"] for tool in listed.json()["result"]["tools"]}
    assert names == {
        "list_plants",
        "get_plant",
        "create_plant",
        "tend_plant",
        "write_post",
        "write_feeling",
        "give_plant",
        "release_plant",
        "search_music",
        "list_recents",
        "list_popular",
        "add_play",
        "list_playlists",
        "get_playlist",
        "create_playlist",
        "add_to_playlist",
        "remove_from_playlist",
        "reorder_playlist",
        "delete_playlist",
    }


def test_tools_call_is_scoped_to_the_owner(mcp_client, mcp_owner, db, make_user):
    create_plant(
        db,
        owner=mcp_owner,
        title=None,
        body="my memory",
        category="memory",
        species=None,
        release=False,
        for_whom=None,
    )
    other = make_user(db, name="Other", email="other@example.com")
    create_plant(
        db,
        owner=other,
        title=None,
        body="not mine",
        category="hope",
        species=None,
        release=False,
        for_whom=None,
    )

    plants = tool_payload(call_tool(mcp_client, "list_plants", {}))
    assert [plant["posts"][0]["body"] for plant in plants] == ["my memory"]


def test_write_feeling_plants_and_writes(mcp_client):
    payload = tool_payload(
        call_tool(mcp_client, "write_feeling", {"category": "hope", "body": "maybe tomorrow"})
    )
    assert payload["plant"]["category"] == "hope"
    assert payload["plant"]["posts"][0]["body"] == "maybe tomorrow"


def test_create_letter_stores_the_give_on_date(mcp_client):
    payload = tool_payload(
        call_tool(
            mcp_client,
            "create_plant",
            {
                "body": "aku tanam pokok ni untuk hari lahir kau",
                "title": "Untuk Amirah",
                "species": "wisteria",
                "for_whom_name": "Amirah",
                "give_on": "2027-07-11",
            },
        )
    )
    assert payload["plant"]["species"] == "wisteria"
    assert payload["plant"]["forWhom"]["name"] == "Amirah"
    assert payload["plant"]["forWhom"]["giveOn"] == int(
        datetime(2027, 7, 11, tzinfo=UTC).timestamp() * 1000
    )


def test_protected_resource_metadata(mcp_client):
    response = mcp_client.get("/.well-known/oauth-protected-resource/mcp")
    assert response.status_code == 200
    metadata = response.json()
    assert metadata["resource"].rstrip("/") == settings.mcp_resource_url.rstrip("/")
    assert metadata["authorization_servers"][0].rstrip("/") == settings.zitadel_issuer.rstrip("/")


@pytest.mark.anyio
async def test_verifier_resolves_the_static_key(mcp_env: User):
    access = await SolaceTokenVerifier().verify_token(settings.mcp_api_key)
    assert access is not None
    assert access.subject == str(mcp_env.id)
    assert access.resource == settings.mcp_resource_url


@pytest.mark.anyio
async def test_verifier_maps_a_zitadel_subject(mcp_env: User, db, monkeypatch):
    import app.mcp_server as mcp_server

    mcp_env.idp_issuer = settings.zitadel_issuer.rstrip("/")
    mcp_env.zitadel_sub = "zitadel-user-1"
    db.commit()

    class FakeKey:
        key = "unused"

    class FakeKeys:
        def get_signing_key_from_jwt(self, _token: str):
            return FakeKey()

    def fake_decode(_token, _key, **_kwargs):
        return {"sub": "zitadel-user-1", "exp": 2**31}

    monkeypatch.setattr(mcp_server, "_jwks", FakeKeys)
    monkeypatch.setattr(mcp_server.jwt, "decode", fake_decode)
    access = await SolaceTokenVerifier().verify_token("a.zitadel.jwt")
    assert access is not None
    assert access.subject == str(mcp_env.id)


def test_playlist_tools(mcp_client):
    created = tool_payload(
        call_tool(
            mcp_client,
            "create_playlist",
            {"name": "Evening", "video_ids": ["dQw4w9WgXcQ", "https://youtu.be/9bZkp7q19f0"]},
        )
    )
    assert created["name"] == "Evening"
    assert [track["id"] for track in created["tracks"]] == ["dQw4w9WgXcQ", "9bZkp7q19f0"]
    playlist_id = created["id"]

    listed = tool_payload(call_tool(mcp_client, "list_playlists", {}))
    assert [(item["name"], item["count"]) for item in listed] == [("Evening", 2)]

    added = tool_payload(
        call_tool(
            mcp_client,
            "add_to_playlist",
            {"playlist_id": playlist_id, "video_id": "kJQP7kiw5Fk", "title": "Third"},
        )
    )
    assert [track["id"] for track in added["tracks"]] == [
        "dQw4w9WgXcQ",
        "9bZkp7q19f0",
        "kJQP7kiw5Fk",
    ]

    reordered = tool_payload(
        call_tool(
            mcp_client,
            "reorder_playlist",
            {"playlist_id": playlist_id, "video_ids": ["kJQP7kiw5Fk", "dQw4w9WgXcQ", "9bZkp7q19f0"]},
        )
    )
    assert [track["id"] for track in reordered["tracks"]] == [
        "kJQP7kiw5Fk",
        "dQw4w9WgXcQ",
        "9bZkp7q19f0",
    ]

    fetched = tool_payload(call_tool(mcp_client, "get_playlist", {"playlist_id": playlist_id}))
    assert [track["id"] for track in fetched["tracks"]] == [
        "kJQP7kiw5Fk",
        "dQw4w9WgXcQ",
        "9bZkp7q19f0",
    ]

    removed = tool_payload(
        call_tool(
            mcp_client,
            "remove_from_playlist",
            {"playlist_id": playlist_id, "video_id": "dQw4w9WgXcQ"},
        )
    )
    assert [track["id"] for track in removed["tracks"]] == ["kJQP7kiw5Fk", "9bZkp7q19f0"]

    deleted = tool_payload(call_tool(mcp_client, "delete_playlist", {"playlist_id": playlist_id}))
    assert deleted["ok"] is True
    assert tool_payload(call_tool(mcp_client, "list_playlists", {})) == []
