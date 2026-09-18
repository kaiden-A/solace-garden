# The MCP endpoint

`/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server
that exposes the garden to AI clients: an agent can list plants, write
feelings, tend letters, or search music on behalf of the signed-in gardener.
It is built with the official `mcp` Python SDK (v2, `MCPServer`) and mounted on
the same FastAPI app as the rest of the API.

This document covers how it works today (phase 1: a static owner key, plus
Zitadel token validation) and how it will serve Elpis once Elpis exists
(phase 2: per-user OAuth).

## Shape of the thing

| | |
| --- | --- |
| Dev URL | `http://localhost:8000/mcp` |
| Deployed URL | `${API_BASE_URL}/mcp` |
| Transport | Streamable HTTP, stateless (`stateless_http=True`), JSON responses (`json_response=True`) |
| Metadata | `GET /.well-known/oauth-protected-resource/mcp` (RFC 9728) |
| Code | `server/app/mcp_server.py` (server, auth, identity), `server/app/mcp_tools.py` (tools) |

Every request is a plain JSON-RPC POST. Because the server is stateless there
is no session id to carry, no SSE stream held open, and every request must
carry its own `Authorization` header. That makes it boring to scale on Cloud
Run and easy to call from a script.

## Authentication

### Phase 1: the static owner key

`MCP_API_KEY` in `server/.env` is a bearer token that acts as the member whose
email is `MCP_OWNER_EMAIL`. Generate one with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

```dotenv
MCP_API_KEY=<generated value>
MCP_OWNER_EMAIL=you@example.com
```

Treat it like a password: anyone who holds it can read and change that
garden. It must live in the MCP client's configuration on your machine, never
in browser code or a public repository.

Requests without a valid token get:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer error="invalid_token",
  error_description="Authentication required",
  resource_metadata="http://localhost:8000/.well-known/oauth-protected-resource/mcp"
```

Clients that understand OAuth follow that metadata URL; clients configured
with a header simply send the key and never look at it.

### Phase 2 groundwork: Zitadel access tokens

The same verifier already accepts Zitadel-issued JWT access tokens:

1. Signature validated against the Zitadel JWKS
   (`MCP_JWKS_URL`, default `{ZITADEL_ISSUER}/oauth/v2/keys`).
2. `iss` must equal `ZITADEL_ISSUER`, `exp` must be in the future.
3. If `MCP_AUDIENCE` is set, the token's `aud` must include it.
4. The `sub` claim is looked up against `users.(idp_issuer, zitadel_sub)`, and
   the row must be an active member.

If all four pass, the request acts as that member. No OAuth client has been
configured in Zitadel yet, so today this path is effectively dormant: it is the
seam that phase 2 (Elpis) plugs into. Guests cannot use it; they have no
Zitadel identity.

### Why the owner must not be a guest

Guest rows have no email and expire. The static key requires a member account;
Zitadel tokens likewise resolve only to `kind=member` rows.

## Configuration reference

All settings live in `server/.env` (documented in `server/.env.example`).

| Variable | Default | Purpose |
| --- | --- | --- |
| `MCP_ENABLED` | `true` | Mount `/mcp` at all. When false the route 404s. |
| `MCP_API_KEY` | empty | Static bearer key. Empty disables key auth (fail closed: JWT or nothing). |
| `MCP_OWNER_EMAIL` | empty | Which member the static key acts as. |
| `MCP_ALLOWED_HOSTS` | `localhost,127.0.0.1,[::1],testserver` | Host header allowlist for the transport, DNS-rebinding protection. Each entry also matches `host:<port>`. |
| `MCP_ALLOWED_ORIGINS` | empty | Browser `Origin` allowlist. Empty rejects browser origins; non-browser MCP clients send no `Origin`. |
| `MCP_AUDIENCE` | empty | Require this `aud` on Zitadel tokens. Set to the project id in phase 2. |
| `MCP_JWKS_URL` | derived | Override the JWKS endpoint. |

When deployed, add the public hostname or every request gets
`421 Misdirected Request` before the MCP app is even consulted:

```dotenv
MCP_ALLOWED_HOSTS=localhost,127.0.0.1,api.example.com
```

## The tools

| Tool | Kind | What it does |
| --- | --- | --- |
| `list_plants` | read | Every growing plant with its events, posts and stage. |
| `get_plant` | read | One plant by id. |
| `create_plant` | write | Plant a feeling, or write a letter when `for_whom_name` is set. |
| `tend_plant` | write | Tend a letter so it grows. |
| `write_post` | write | Add a feeling to a plant; a full plant spawns a seedling. |
| `write_feeling` | write | Write into the newest plant of a category, planting the first if none exists. |
| `give_plant` | destructive | Mint the public gift link and mark the plant given. Cannot be undone. |
| `release_plant` | destructive | Remove a plant from the garden. Cannot be undone. |
| `search_music` | read | YouTube search, cached server-side to protect the quota. |
| `list_recents` | read | The gardener's recently played songs. |
| `list_popular` | read | The most played songs across the garden. |
| `add_play` | write | Record a song as played. |

Tools run on a worker thread (sync SQLAlchemy services from
`app/services/*` are called directly, no HTTP hop), and every tool resolves
the caller fresh from the request's access token, so ownership scoping is
enforced per call. Destructive/readonly hints are sent to clients so they can
ask for confirmation before `release_plant` or `give_plant`.

## Connecting a client

### MCP Inspector (quickest sanity check)

```bash
npx @modelcontextprotocol/inspector
```

Choose transport **Streamable HTTP**, URL `http://localhost:8000/mcp`, add
header `Authorization: Bearer <MCP_API_KEY>`, connect, then run `list_plants`.

### Header-capable hosts

Most desktop/IDE hosts (Cursor, VS Code, Claude Code, OpenCode, and similar)
accept an HTTP server entry with a URL and headers. The exact key names differ
per host; the shape is:

```json
{
  "mcpServers": {
    "solace-garden": {
      "url": "http://localhost:8000/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_API_KEY>"
      }
    }
  }
}
```

Check the host's own documentation for the exact file location and schema.

### Raw JSON-RPC

Useful for debugging without any client:

```bash
KEY=$(grep '^MCP_API_KEY=' server/.env | cut -d= -f2)

# Handshake
curl -sS http://localhost:8000/mcp \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2026-07-28","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'

# List tools
curl -sS http://localhost:8000/mcp \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# Call a tool
curl -sS http://localhost:8000/mcp \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_plants","arguments":{}}}'
```

Tool results arrive both as human-readable text and as `structuredContent`
with the garden's camelCase JSON (the same shapes the web client uses).

## Deployment and transport security

- The MCP app is mounted at `/` **after** every `/api/*` route, so API routes
  always win; the MCP app only sees the remainder.
- The SDK session manager can only `run()` once per instance, so
  `app/mcp_server.py` rebuilds the streamable app per lifespan behind a stable
  mount proxy. Uvicorn starts and restarts both work; tests can create a fresh
  `TestClient` per test.
- `MCP_ALLOWED_HOSTS` is checked before anything else. Forgetting the deployed
  hostname produces `421 Misdirected Request` with no hint in the MCP layer.
- Keep `API_BASE_URL` correct in production: it is the RFC 8707 resource
  identifier advertised to OAuth clients (`.../mcp`).

## Tests

`server/tests/test_mcp.py` runs against the mounted route through
`TestClient`, so the transport, auth middleware and identity mapping are all
exercised. The `mcp_client` fixture (in `server/tests/conftest.py`) points the
tools' session factory at the throwaway test schema and installs a test key.
Covered: 401 challenge and metadata, wrong-token rejection, initialize and
`tools/list` with all 12 tools, owner-scoped `tools/call`, protected resource
metadata, and both verifier paths (static key and a faked Zitadel subject).

## How Elpis will use it

Elpis is not a garden client, it is an AI agent. MCP is the transport between
the two, and the SDK's `Client` is the whole integration.

### Connecting

```python
import httpx2
from mcp import Client
from mcp.client.streamable_http import streamable_http_client

async def call_garden(user_token: str, tool: str, arguments: dict):
    async with httpx2.AsyncClient(
        headers={"Authorization": f"Bearer {user_token}"},
        timeout=httpx2.Timeout(30.0, read=300.0),
    ) as http:
        transport = streamable_http_client(
            "https://api.example.com/mcp", http_client=http
        )
        async with Client(transport) as client:
            result = await client.call_tool(tool, arguments)
            return result.structured_content
```

The agent loop around it: `list_tools()` once at startup, convert the tool
schemas to the LLM's tool format, call `call_tool` when the model asks,
append results (or `is_error` messages) to the conversation. The garden tools
return `ToolError` messages the model can read and recover from, e.g. an
unknown plant id.

### Signed in as user A

When user A signs into Elpis, Elpis needs a token that Solace will accept on
A's behalf. The static key is server-wide and belongs to the owner, so it is
the wrong tool for this; the flow becomes:

```
User A                Elpis                         Zitadel              Solace API
  |  sign in to Elpis -->|                             |                    |
  |                      |-- OAuth authorize+PKCE --->|                    |
  |                      |   resource=<API_BASE_URL>/mcp                    |
  |  <--- consent screen -----"Elpis can access your Solace Garden"         |
  |                      |<-- code --------------------|                    |
  |                      |-- token request ---------->|                    |
  |                      |<-- access + refresh token (aud includes Solace)  |
  |                      |   store tokens for user A in Elpis's DB          |
  |  "show my garden" -->|                                                  |
  |                      |-- POST /mcp  Authorization: Bearer <A's token> ->|
  |                      |    signature via JWKS, iss, exp, aud              |
  |                      |    sub -> users.(idp_issuer, zitadel_sub) -> A    |
  |                      |<-- A's plants only ------------------------------|
  |                      |   (access token expires -> refresh silently)     |
```

Key properties:

- **The token is per user.** Elpis stores access/refresh tokens keyed to its
  own user table. Every MCP call carries the token of the user who is talking,
  so Solace scopes tools to that garden with no extra plumbing.
- **No token passthrough.** Elpis must not forward its own session tokens to
  Solace, and Solace only accepts tokens issued by its authorization server
  (Zitadel) for itself. The MCP spec calls this out explicitly; the consent
  flow above is the compliant way to get the right token.
- **Stateless on the Solace side.** There is no MCP session to keep alive:
  Elpis holds tokens, not sessions.
- **Guests stay out.** Only members with a Zitadel identity can be resolved,
  which is exactly right: Elpis users get a garden by having a Solace account.

### What has to change before Elpis connects

Only configuration, no code:

1. **Zitadel**: register Elpis as an OIDC application (or let MCP clients
   self-register through dynamic client registration, which Zitadel supports
   specifically for MCP hosts such as Claude Desktop and claude.ai), and make
   sure access tokens are verifiable — JWTs signed by the instance, or the
   verifier switched to token introspection if the app issues opaque tokens.
2. **Audience**: give the Solace project a scope/audience and set
   `MCP_AUDIENCE` to it, so tokens minted for other resources are refused.
3. **Scopes**: optionally advertise `required_scopes` in `AuthSettings` once a
   real Solace scope exists; today it is unset so no scope check runs.
4. **Hosts**: add the deployed API hostname to `MCP_ALLOWED_HOSTS`.

If Elpis ever grows its own account system instead of using Zitadel for login,
add a one-time "Connect Solace" linking step (Elpis user ↔ `zitadel_sub`) or
federate Elpis's JWTs into Zitadel. Using Zitadel for both is the path that
avoids a linking table entirely.
