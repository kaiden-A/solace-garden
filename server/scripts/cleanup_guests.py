"""Deletes expired guests and their gardens, plus dead sessions.

Run it from cron (or a scheduled GitHub Action) once a day:

    uv run python -m scripts.cleanup_guests
"""

import argparse
import sys
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select

from app.database import SessionLocal
from app.models import Plant, Session, User
from app.models.enums import UserKind


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="count without deleting")
    args = parser.parse_args()

    now = datetime.now(UTC)

    with SessionLocal() as db:
        stale_guests = (
            db.scalars(
                select(User).where(
                    User.kind == UserKind.guest,
                    User.guest_expires_at.is_not(None),
                    User.guest_expires_at < now,
                )
            )
            .unique()
            .all()
        )
        plant_count = (
            db.scalar(
                select(func.count())
                .select_from(Plant)
                .where(Plant.owner_id.in_([guest.id for guest in stale_guests]))
            )
            if stale_guests
            else 0
        )
        dead_sessions = db.scalar(
            select(func.count()).select_from(Session).where(Session.expires_at < now)
        )

        print(
            f"guests to delete: {len(stale_guests)} (with {plant_count} plants), "
            f"sessions expired/revoked: {dead_sessions}"
        )
        if args.dry_run:
            return 0

        if stale_guests:
            db.execute(delete(User).where(User.id.in_([guest.id for guest in stale_guests])))
        db.execute(
            delete(Session).where(
                (Session.expires_at < now) | (Session.revoked_at < now - timedelta(days=1))
            )
        )
        db.commit()
        print("done")

    return 0


if __name__ == "__main__":
    sys.exit(main())
