"""One-off import of the pre-backend JSON data in client/data/.

Only needed once, to bring the old shared guest garden into Postgres:

    uv run python -m scripts.import_json            # report what would happen
    uv run python -m scripts.import_json --force    # import, replacing old rows
"""

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Gift, Plant, PlantEvent, User
from app.models.enums import EventType, PlantStatus, UserKind, as_category, as_species

CLIENT_DATA = Path(__file__).resolve().parent.parent.parent / "client" / "data"
GUEST_EMAIL = "guest@solace.garden"


def load(name: str) -> list[dict]:
    path = CLIENT_DATA / name
    if not path.exists():
        print(f"! {path} not found - nothing to import for it")
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def when(ms: float | int | None) -> datetime:
    return datetime.fromtimestamp((ms or 0) / 1000, tz=UTC)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="replace existing imported rows")
    args = parser.parse_args()

    users = load("users.json")
    plants = load("plants.json")
    if not users and not plants:
        return 1

    with SessionLocal() as db:
        existing = db.scalar(select(Plant.id).limit(1))
        if existing is not None and not args.force:
            print("! plants already exist - re-run with --force to replace them")
            return 1

        owner_ids: dict[str, User] = {}
        for row in users:
            email = (row.get("email") or "").lower() or None
            user = db.scalar(select(User).where(User.email == email)) if email else None
            if user is None:
                user = User(
                    kind=UserKind.guest if row.get("guest") else UserKind.member,
                    email=email,
                    display_name=row.get("name") or "Gardener",
                    created_at=when(row.get("createdAt")),
                    # archived rows never expire; they are not sign-in targets
                    guest_expires_at=None,
                )
                db.add(user)
                db.flush()
            owner_ids[str(row.get("id"))] = user
            print(f"+ user {user.display_name} <{user.email}> -> {user.id}")

        if args.force:
            for user in owner_ids.values():
                for plant in db.scalars(select(Plant).where(Plant.owner_id == user.id)):
                    db.delete(plant)
            db.commit()

        default_owner = next(iter(owner_ids.values()), None)
        imported = 0
        for row in plants:
            owner = owner_ids.get(str(row.get("ownerId"))) or default_owner
            if owner is None:
                print("! no owner for plant, skipping:", row.get("title"))
                continue

            plant = Plant(
                owner_id=owner.id,
                title=row.get("title") or "",
                body=row.get("body") or "",
                category=as_category(row.get("category")),
                species=as_species(row.get("species")),
                status=PlantStatus(row.get("status", "growing")),
                x=float(row.get("x", 0.5)),
                y=float(row.get("y", 0.5)),
                scale=float(row.get("scale", 1.0)),
                seed=int(row.get("seed", 0)),
                created_at=when(row.get("createdAt")),
            )
            whom = row.get("forWhom") or None
            if whom:
                plant.for_whom_name = whom.get("name")
                plant.for_whom_email = whom.get("email")
                plant.for_whom_give_on = when(whom.get("giveOn")) if whom.get("giveOn") else None

            for event in row.get("events") or []:
                plant.events.append(
                    PlantEvent(
                        type=EventType(event.get("type", "tended")),
                        note=event.get("note"),
                        at=when(event.get("at")),
                    )
                )

            gift = row.get("gift") or None
            if gift:
                plant.gift = Gift(
                    to_name=gift.get("to") or "Someone",
                    note=gift.get("note") or "",
                    token=gift.get("token") or "",
                    given_at=when(gift.get("givenAt")),
                )

            db.add(plant)
            imported += 1

        db.commit()
        print(f"imported {imported} plants for {len(owner_ids)} users")
        print("note: new guests get a fresh copy of the seed garden, not this one")
    return 0


if __name__ == "__main__":
    sys.exit(main())
