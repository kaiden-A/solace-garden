import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from ..config import Settings
from ..models import Session as SessionRow
from ..models import User
from ..models.enums import UserKind
from ..schemas.users import PublicUser
from . import security

LAST_SEEN_THROTTLE = timedelta(minutes=5)


def _now() -> datetime:
    return datetime.now(UTC)


def create_session(
    db: DbSession,
    user: User,
    *,
    settings: Settings,
    user_agent: str | None = None,
    ip: str | None = None,
) -> str:
    """Creates a server-side session and returns the raw cookie token."""
    token = security.new_session_token()
    expires = _now() + timedelta(days=settings.session_ttl_days)
    if user.guest_expires_at is not None:
        expires = min(expires, user.guest_expires_at)
    db.add(
        SessionRow(
            token_hash=security.hash_token(token),
            user_id=user.id,
            expires_at=expires,
            user_agent=(user_agent or "")[:400] or None,
            ip=(ip or "")[:64] or None,
        )
    )
    db.commit()
    return token


def session_user(db: DbSession, token: str | None, *, settings: Settings) -> User | None:
    if not token:
        return None
    now = _now()
    row = db.get(SessionRow, security.hash_token(token))
    if row is None or row.revoked_at is not None or row.expires_at <= now:
        return None

    user = db.get(User, row.user_id)
    if user is None or user.deleted_at is not None:
        return None
    if user.is_guest and user.guest_expires_at is not None and user.guest_expires_at <= now:
        return None

    # Rolling refresh: sessions stay alive while they are being used, but a
    # guest session can never outlive the guest row itself.
    dirty = False
    ttl = timedelta(days=settings.session_ttl_days)
    if row.expires_at - now < ttl / 2:
        row.expires_at = now + ttl
        if user.guest_expires_at is not None:
            row.expires_at = min(row.expires_at, user.guest_expires_at)
        dirty = True
    if user.last_seen_at < now - LAST_SEEN_THROTTLE:
        user.touch()
        dirty = True
    if dirty:
        db.commit()

    return user


def revoke_session(db: DbSession, token: str | None) -> None:
    if not token:
        return
    row = db.get(SessionRow, security.hash_token(token))
    if row is not None and row.revoked_at is None:
        row.revoked_at = _now()
        db.commit()


def find_member(db: DbSession, *, issuer: str, subject: str) -> User | None:
    return db.scalar(
        select(User).where(User.idp_issuer == issuer, User.zitadel_sub == subject)
    )


def find_or_create_member(
    db: DbSession,
    *,
    issuer: str,
    subject: str,
    email: str | None,
    name: str | None,
) -> User:
    """Just-in-time provisioning: the local row is a projection of the IdP user."""
    user = find_member(db, issuer=issuer, subject=subject)
    if user is not None:
        changed = False
        if email and user.email != email.strip().lower():
            user.email = email.strip().lower()
            changed = True
        if name and user.display_name != name.strip():
            user.display_name = name.strip()
            changed = True
        if changed:
            db.commit()
        return user

    user = User(
        kind=UserKind.member,
        idp_issuer=issuer,
        zitadel_sub=subject,
        email=email.strip().lower() if email else None,
        display_name=(name or email or "Gardener").strip(),
    )
    db.add(user)
    db.commit()
    return user


def create_guest(db: DbSession, *, settings: Settings, name: str | None = None) -> User:
    user = User(
        kind=UserKind.guest,
        display_name=(name or "").strip() or "Guest Gardener",
        guest_expires_at=_now() + timedelta(days=settings.guest_ttl_days),
    )
    db.add(user)
    db.commit()
    return user


def public_user(user: User) -> PublicUser:
    return PublicUser(
        id=str(user.id),
        name=user.display_name or "Gardener",
        email=user.email or "",
        kind=user.kind,
    )


def new_guest_name() -> str:
    return f"Guest {secrets.token_hex(2)}"
