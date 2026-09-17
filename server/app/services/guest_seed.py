import json
import random
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy.orm import Session as DbSession

from ..models import Plant, PlantEvent, PlantPost, User
from ..models.enums import Category, EventType, PlantStatus, Species
from .plants_services import PLACEMENTS

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SEED_GARDEN: list[dict] = json.loads((DATA_DIR / "seed_garden.json").read_text(encoding="utf-8"))

DAY = timedelta(days=1)


def clone_seed_garden(db: DbSession, owner: User) -> list[Plant]:
    """Gives a brand new guest a full, plausible garden to walk around in.

    Mirrors client/scripts/seed.mjs so the demo content is identical to what the
    original shared guest account was seeded with.
    """
    now = datetime.now(UTC)
    counts: dict[str, int] = {}
    plants: list[Plant] = []

    for entry in SEED_GARDEN:
        category = entry.get("category")
        recipient = entry.get("for") or None
        key = category or "letter"

        index = counts.get(key, 0)
        counts[key] = index + 1
        slots = PLACEMENTS.get(key) or PLACEMENTS["feeling"]
        slot = slots[index % len(slots)]

        offsets: list[float] = entry["offsets"]
        give_on_days = entry.get("giveOnDays")
        plant = Plant(
            owner_id=owner.id,
            title=entry.get("title") or "",
            body=entry.get("body") or "",
            category=Category(category) if category else None,
            species=Species(entry["species"]) if entry.get("species") else None,
            status=PlantStatus.growing,
            x=slot["x"],
            y=slot["y"],
            scale=slot["scale"],
            seed=random.randrange(997),
            created_at=now - max(offsets) * DAY,
            for_whom_name=(recipient or {}).get("name") or None,
            for_whom_email=(recipient or {}).get("email") or None,
            for_whom_give_on=(now + give_on_days * DAY) if give_on_days is not None else None,
        )
        if recipient:
            plant.events = [
                PlantEvent(
                    type=EventType.planted if i == 0 else EventType.tended,
                    note=(
                        "Planted the seed"
                        if i == 0
                        else ("Added a little more" if i % 2 else "Tended it again")
                    ),
                    at=now - days * DAY,
                )
                for i, days in enumerate(offsets)
            ]
        else:
            # A feeling grows by its posts, so the demo seed is a real thread.
            posts: list[str] = entry["posts"]
            plant.posts = [
                PlantPost(body=text, at=now - days * DAY)
                for text, days in zip(posts, offsets, strict=True)
            ]
        db.add(plant)
        plants.append(plant)

    db.commit()
    return plants
