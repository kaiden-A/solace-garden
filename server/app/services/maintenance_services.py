from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session as DbSession

from ..models import Plant, Session, User
from ..models.enums import UserKind

REVOKED_GRACE = timedelta(days=1)


def purge_expired(
    db: DbSession, *, now: datetime | None = None, dry_run: bool = False
) -> dict[str, int]:
    """Deletes expired guests (their gardens cascade) and dead sessions.

    Shared by the CLI script and the scheduled Cloud Scheduler endpoint.
    """
    now = now or datetime.now(UTC)
    stale_guests = db.scalars(
        select(User).where(
            User.kind == UserKind.guest,
            User.guest_expires_at.is_not(None),
            User.guest_expires_at < now,
        )
    ).all()
    guest_ids = [guest.id for guest in stale_guests]
    plants = (
        db.scalar(select(func.count()).select_from(Plant).where(Plant.owner_id.in_(guest_ids)))
        if guest_ids
        else 0
    )
    dead_sessions = (Session.expires_at < now) | (Session.revoked_at < now - REVOKED_GRACE)
    sessions = db.scalar(select(func.count()).select_from(Session).where(dead_sessions))

    if not dry_run:
        if guest_ids:
            db.execute(delete(User).where(User.id.in_(guest_ids)))
        db.execute(delete(Session).where(dead_sessions))
        db.commit()

    return {"guests": len(guest_ids), "plants": plants or 0, "sessions": sessions or 0}
