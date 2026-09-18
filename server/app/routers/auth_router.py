import hmac
import time
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse, Response
from sqlalchemy.orm import Session as DbSession

from ..config import Settings, get_settings
from ..database import get_db
from ..dependencies import current_user, get_zitadel, require_user
from ..models import User
from ..models.enums import UserKind
from ..schemas.auth import LogoutResponse
from ..schemas.users import PublicUser
from ..services import auth_services
from ..services.guest_seed import clone_seed_garden
from ..services.security import (
    OAUTH_COOKIE,
    OAUTH_COOKIE_MAX_AGE,
    clear_cookie,
    create_pkce_pair,
    new_state_nonce,
    set_cookie,
    sign_payload,
    unsign_payload,
)
from ..services.zitadel import ZitadelClient, ZitadelError
from ..utils import local_path

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _start_login(request: Request, settings: Settings, zitadel: ZitadelClient) -> RedirectResponse:
    verifier, challenge = create_pkce_pair()
    state, nonce = new_state_nonce()
    payload = {
        "state": state,
        "nonce": nonce,
        "code_verifier": verifier,
        "next": local_path(request.query_params.get("next")),
        "iat": int(time.time()),
    }
    authorize_url = zitadel.authorize_url(
        state=state,
        nonce=nonce,
        code_challenge=challenge,
        redirect_uri=settings.zitadel_redirect_uri,
    )
    response = RedirectResponse(authorize_url, status_code=302)
    set_cookie(
        response,
        OAUTH_COOKIE,
        sign_payload(payload, settings.app_secret),
        settings=settings,
        max_age=OAUTH_COOKIE_MAX_AGE,
    )
    return response


@router.get("/login")
def login_get(
    request: Request,
    settings: Settings = Depends(get_settings),
    zitadel: ZitadelClient = Depends(get_zitadel),
) -> RedirectResponse:
    """Sends the browser to Zitadel (Elysiaa SSO)."""
    return _start_login(request, settings, zitadel)


@router.post("/login")
def login_post(
    request: Request,
    settings: Settings = Depends(get_settings),
    zitadel: ZitadelClient = Depends(get_zitadel),
) -> RedirectResponse:
    return _start_login(request, settings, zitadel)


@router.post("/signup")
def signup(
    request: Request,
    settings: Settings = Depends(get_settings),
    zitadel: ZitadelClient = Depends(get_zitadel),
) -> RedirectResponse:
    """Signup happens inside the hosted Zitadel login."""
    return _start_login(request, settings, zitadel)


@router.get("/callback")
def callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    zitadel: ZitadelClient = Depends(get_zitadel),
    guest: User | None = Depends(current_user),
) -> RedirectResponse:
    failure = f"{settings.public_base_url}/login"
    payload = unsign_payload(
        request.cookies.get(OAUTH_COOKIE), settings.app_secret, max_age=OAUTH_COOKIE_MAX_AGE
    )

    if error:
        query = urlencode({"error": "Signing in was cancelled."})
        return RedirectResponse(f"{failure}?{query}", status_code=302)
    if (
        payload is None
        or not code
        or not state
        or not hmac.compare_digest(str(payload.get("state", "")), state)
    ):
        raise HTTPException(status_code=400, detail="Could not finish signing in. Please try again.")

    try:
        tokens = zitadel.exchange_code(
            code=code,
            code_verifier=payload["code_verifier"],
            redirect_uri=settings.zitadel_redirect_uri,
        )
        id_token = tokens.get("id_token")
        if not id_token:
            raise ZitadelError("token response had no id_token")
        claims = zitadel.verify_id_token(id_token, nonce=payload["nonce"])
    except ZitadelError as exc:
        raise HTTPException(status_code=502, detail=f"Sign-in failed: {exc}") from exc

    subject = str(claims["sub"])
    issuer = settings.zitadel_issuer.rstrip("/")
    email = claims.get("email")
    name = claims.get("name") or claims.get("preferred_username")

    if guest is not None and guest.kind is UserKind.guest:
        # A guest garden is a throwaway, never an account: drop the row and
        # let the database cascade its plants, posts, gifts and sessions.
        db.delete(guest)
        db.flush()
    user = auth_services.find_or_create_member(
        db, issuer=issuer, subject=subject, email=email, name=name
    )

    token = auth_services.create_session(
        db,
        user,
        settings=settings,
        user_agent=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
    )
    response = RedirectResponse(local_path(str(payload.get("next"))), status_code=302)
    set_cookie(
        response,
        settings.session_cookie_name,
        token,
        settings=settings,
        max_age=settings.session_ttl_days * 24 * 3600,
    )
    clear_cookie(response, OAUTH_COOKIE, settings=settings)
    return response


@router.get("/me", response_model=PublicUser)
def me(user: User = Depends(require_user)) -> PublicUser:
    return auth_services.public_user(user)


@router.post("/logout")
def logout(
    request: Request,
    user: User | None = Depends(current_user),
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    zitadel: ZitadelClient = Depends(get_zitadel),
) -> Response:
    """Ends the local session and, for SSO members, the IdP session too.

    Without the IdP round-trip the Zitadel cookie survives, so the next
    "Continue with Elysiaa SSO" silently signs the user back in.
    """
    token = request.cookies.get(settings.session_cookie_name)
    auth_services.revoke_session(db, token)
    logout_url = None
    if user is not None and user.zitadel_sub is not None:
        try:
            logout_url = zitadel.end_session_url(
                post_logout_redirect_uri=settings.zitadel_post_logout_uri
            )
        except (httpx.HTTPError, KeyError):
            # Never trap someone in the app because discovery is down.
            logout_url = None
    response = JSONResponse(LogoutResponse(logoutUrl=logout_url).model_dump())
    clear_cookie(response, settings.session_cookie_name, settings=settings)
    return response


@router.post("/guest")
def guest(
    request: Request,
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Response:
    """Creates a throwaway garden: a guest row, a seeded copy of the demo
    garden, and a session. Nothing about it needs Zitadel."""
    user = auth_services.create_guest(db, settings=settings)
    clone_seed_garden(db, user)
    token = auth_services.create_session(
        db,
        user,
        settings=settings,
        user_agent=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
    )
    response = JSONResponse(auth_services.public_user(user).model_dump(mode="json"), status_code=201)
    set_cookie(
        response,
        settings.session_cookie_name,
        token,
        settings=settings,
        max_age=settings.guest_ttl_days * 24 * 3600,
    )
    return response

