"""Deletes expired guests and their gardens, plus dead sessions.

Run it from cron (or a scheduled GitHub Action) once a day:

    uv run python -m scripts.cleanup_guests

On Cloud Run, Cloud Scheduler can call POST /api/maintenance/cleanup-guests
instead; both paths share maintenance_services.purge_expired.
"""

import argparse
import sys

from app.database import SessionLocal
from app.services.maintenance_services import purge_expired


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="count without deleting")
    args = parser.parse_args()

    with SessionLocal() as db:
        counts = purge_expired(db, dry_run=args.dry_run)

    print(
        f"guests to delete: {counts['guests']} (with {counts['plants']} plants), "
        f"sessions expired/revoked: {counts['sessions']}"
    )
    if args.dry_run:
        return 0
    print("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
