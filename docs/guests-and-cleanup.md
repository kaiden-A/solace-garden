# Guests and the cleanup cronjob

Solace Garden lets people walk into a garden without an account. That garden is
real database state, not a browser cache, so it needs a lifecycle: creation,
expiry, and eventual deletion. This document covers how guest mode behaves and
how to schedule the cleanup job that removes expired guests.

## How guest mode works

`POST /api/auth/guest` does three things in one request
(`app/routers/auth_router.py`):

1. Creates a `users` row with `kind=guest`, a random display name, and
   `guest_expires_at = now + GUEST_TTL_DAYS` (default **7 days**,
   `app/services/auth_services.py`).
2. Clones the 17-plant demo garden into that account
   (`app/services/guest_seed.py`), so the visitor immediately has something
   plausible to explore.
3. Creates a server-side session and sets the `solace_session` cookie
   (HttpOnly, SameSite=Lax). The cookie holds a random token; the database
   only stores its SHA-256 hash.

A few invariants follow from that:

- **Guests are rows, not localStorage.** Closing the browser and reopening the
  page loses nothing as long as the cookie survives; a different device is a
  different garden.
- **No IdP involved.** Guest mode never talks to Zitadel.
- **Sessions cannot outlive the guest.** `create_session` clamps the session
  expiry to `guest_expires_at`, and `session_user` refuses an expired guest on
  every request, so an expired guest is effectively signed out even before the
  cleanup job runs.
- **Signing in discards the guest.** During `/api/auth/callback`, if the
  request carried a guest session, the guest row is deleted and the database
  cascades its plants, posts, events, gifts and sessions. The member is then
  provisioned from the IdP identity (`find_or_create_member`). Guest data is
  never linked to an account.
- **Expiry is silent.** Once `guest_expires_at` passes, API calls resolve to
  401 `{"error": "Not signed in."}`. The row itself stays until cleanup.

## What cleanup deletes

`purge_expired` in `app/services/maintenance_services.py` is the single source
of truth, shared by the CLI and the HTTP endpoint. It removes:

- **Expired guests**: users with `kind=guest` and `guest_expires_at < now`.
  Their whole garden cascades away with the row.
- **Dead sessions**: sessions whose `expires_at` is in the past, or whose
  `revoked_at` is older than a one-day grace period.

It returns counts, which is useful for logs:

```json
{"guests": 3, "plants": 51, "sessions": 12}
```

## Running it by hand

The CLI is the fastest way to inspect what would happen. It uses
`DATABASE_URL` from `server/.env` directly:

```bash
# Count only, deletes nothing
uv run --directory server python -m scripts.cleanup_guests --dry-run

# Actually delete
uv run --directory server python -m scripts.cleanup_guests
```

## The HTTP endpoint

For scheduled runs (Cloud Scheduler, cron on any box, a CI job), use:

```
POST /api/maintenance/cleanup-guests
X-Cleanup-Secret: <CLEANUP_SECRET>
```

Implementation notes from `app/routers/maintenance_router.py`:

- The header is compared with `hmac.compare_digest`.
- If `CLEANUP_SECRET` is empty **or** the header does not match, the response
  is `403 {"error": "Cleanup is not authorized."}`.
- A successful call returns the same counts as the CLI, as JSON.

```bash
curl -sS -X POST "${API_BASE_URL}/api/maintenance/cleanup-guests" \
  -H "X-Cleanup-Secret: ${CLEANUP_SECRET}"
```

## Setting up the cronjob

### 1. Prepare the server

Generate a secret and set it wherever the API runs (locally in `server/.env`,
in production as an environment variable on the service):

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

```dotenv
CLEANUP_SECRET=<generated value>
```

`API_BASE_URL` should already point at the public API origin (it is also used
to build the MCP resource URL, so it must be the real public URL in
production).

### 2. Cloud Scheduler (Cloud Run deployment)

The project deploys to Cloud Run in `asia-southeast1`, so Cloud Scheduler is
the natural fit: it can call the public endpoint on a schedule and retry on
failure.

```bash
gcloud scheduler jobs create http solace-cleanup-guests \
  --location=asia-southeast1 \
  --schedule="0 3 * * *" \
  --time-zone="Asia/Kuala_Lumpur" \
  --uri="${API_BASE_URL}/api/maintenance/cleanup-guests" \
  --http-method=POST \
  --headers="X-Cleanup-Secret=${CLEANUP_SECRET}"
```

- `--schedule` uses standard cron syntax; 03:00 local time is a quiet hour.
- Adjust `--time-zone` to your operating timezone, or drop the flag for UTC.
- HTTP targets must be HTTPS, so this is for the deployed service, not
  `http://localhost`.
- If the endpoint is not public, additionally configure OIDC auth on the job
  (`--oidc-service-account-email`, `--oidc-token-audience`).

Verify the wiring immediately instead of waiting for 03:00:

```bash
gcloud scheduler jobs run solace-cleanup-guests --location=asia-southeast1
```

Then inspect the job history:

```bash
gcloud scheduler jobs describe solace-cleanup-guests --location=asia-southeast1
```

### 3. Plain cron alternative

Any scheduler that can POST with a header works. A crontab line on a server
that holds the secret (remember cron does not load your shell profile, so
define the variables at the top of the crontab or inline the values):

```cron
CLEANUP_SECRET=...
API_BASE_URL=https://api.example.com

0 3 * * * curl -fsS -X POST -H "X-Cleanup-Secret: ${CLEANUP_SECRET}" "${API_BASE_URL}/api/maintenance/cleanup-guests" >/dev/null
```

### 4. Rotating the secret

Rotate in this order so cleanup never returns 403:

1. Set the new `CLEANUP_SECRET` on the API service and redeploy/restart.
2. Update the scheduler job:

```bash
gcloud scheduler jobs update http solace-cleanup-guests \
  --location=asia-southeast1 \
  --headers="X-Cleanup-Secret=${NEW_SECRET}"
```

3. Trigger a run to confirm it still returns 200.

### 5. A deployment caveat

The repository's CD workflow (`.github/workflows/cd.yml`) only fires on pushes
to `master`, while the repo's only branch is `main`. Until that is fixed, the
deployed service is not necessarily up to date with `main`; stand up or verify
the Cloud Run service before pointing a scheduler job at it. Locally, the CLI
dry run is the safest way to confirm the logic against the live database.

## Operational notes

- Cleanup is idempotent: running it twice in a row deletes nothing the second
  time.
- The 7-day guest window is `GUEST_TTL_DAYS`; changing it affects only new
  guests, since the expiry is stamped on the row at creation.
- There is no audit trail; the endpoint logs only through the normal access
  log. Use the returned counts (or a dry run) when you need to know what a run
  would touch.
