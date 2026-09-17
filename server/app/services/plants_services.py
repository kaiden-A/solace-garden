import json
import random
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session as DbSession

from ..models import Plant, PlantEvent, PlantPost, User
from ..models.enums import (
    Category,
    EventType,
    PlantStatus,
    Species,
    Stage,
    as_category,
    as_species,
)
from ..schemas.plants import ForWhomIn, ForWhomOut, GiftOut, PlantEventOut, PlantPublic, PostOut
from ..utils import to_ms
from . import security
from .growth import derive_stage

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
PLACEMENTS: dict[str, list[dict[str, float]]] = json.loads(
    (DATA_DIR / "placements.json").read_text(encoding="utf-8")
)
JITTER = 0.035


def _place(key: str, count: int) -> dict[str, float]:
    slots = PLACEMENTS.get(key) or PLACEMENTS["feeling"]
    slot = slots[count % len(slots)]
    jitter = JITTER if count >= len(slots) else 0.0
    return {
        "x": round(slot["x"] + (random.random() - 0.5) * jitter, 3),
        "y": round(slot["y"] + (random.random() - 0.5) * jitter, 3),
        "scale": slot["scale"],
    }


def _placement_count(db: DbSession, owner_id, key: str) -> int:
    stmt = select(func.count()).select_from(Plant).where(Plant.owner_id == owner_id)
    if key == "letter":
        stmt = stmt.where(Plant.for_whom_name.is_not(None))
    else:
        stmt = stmt.where(Plant.category == Category(key))
    return db.scalar(stmt) or 0


def list_plants(db: DbSession, owner_id) -> list[Plant]:
    return list(
        db.scalars(
            select(Plant)
            .where(Plant.owner_id == owner_id, Plant.status != PlantStatus.released)
            .order_by(Plant.created_at)
        )
    )


def get_plant(db: DbSession, plant_id: str, owner_id) -> Plant | None:
    try:
        import uuid

        key = uuid.UUID(str(plant_id))
    except (ValueError, AttributeError):
        return None
    plant = db.get(Plant, key)
    if plant is None or plant.owner_id != owner_id:
        return None
    return plant


def create_plant(
    db: DbSession,
    *,
    owner: User,
    title: str | None,
    body: str,
    category: str | None,
    species: str | None,
    release: bool,
    for_whom: ForWhomIn | None,
) -> Plant:
    from ..utils import from_ms

    name = (for_whom.name or "").strip() if for_whom else ""
    email = (for_whom.email or "").strip() if for_whom else ""
    give_on = from_ms(for_whom.giveOn) if for_whom else None
    is_person = bool(name)

    chosen_category: Category | None = None
    chosen_species: Species | None = None
    if is_person:
        chosen_species = as_species(species) or Species.foxglove
        key = "letter"
    else:
        chosen_category = as_category(category) or Category.feeling
        key = chosen_category.value

    placement = _place(key, _placement_count(db, owner.id, key))

    plant = Plant(
        owner_id=owner.id,
        # Letters carry a title and one body; feelings are all posts.
        title=(title or "").strip() if is_person else "",
        body=body.strip() if is_person else "",
        category=chosen_category,
        species=chosen_species,
        status=PlantStatus.released if release else PlantStatus.growing,
        seed=random.randrange(997),
        for_whom_name=name or None,
        for_whom_email=email or None,
        for_whom_give_on=give_on,
        **placement,
    )
    if is_person:
        plant.events.append(PlantEvent(type=EventType.planted, note="Planted the seed"))
    else:
        plant.posts.append(PlantPost(body=body.strip()))
    db.add(plant)
    db.commit()
    return plant


def tend_plant(db: DbSession, plant: Plant, note: str | None) -> Plant:
    plant.events.append(
        PlantEvent(type=EventType.tended, note=(note or "").strip() or "Tended it again")
    )
    db.commit()
    return plant


def add_post(db: DbSession, plant: Plant, body: str) -> tuple[Plant, Plant | None]:
    """Writes a feeling into the plant and returns (plant, spawned).

    A plant that has already grown to fruit is full: the post starts a new
    plant of the same feeling next to it, and the garden keeps growing.
    """
    text = body.strip()
    if stage_of(plant) is Stage.fruit:
        spawned = _spawn_plant(db, plant)
        spawned.posts.append(PlantPost(body=text))
        db.commit()
        return plant, spawned

    plant.posts.append(PlantPost(body=text))
    db.commit()
    return plant, None


def _spawn_plant(db: DbSession, parent: Plant) -> Plant:
    key = parent.category.value if parent.category else "feeling"
    spawned = Plant(
        owner_id=parent.owner_id,
        title="",
        body="",
        category=parent.category,
        status=PlantStatus.growing,
        seed=random.randrange(997),
        **_place(key, _placement_count(db, parent.owner_id, key)),
    )
    db.add(spawned)
    return spawned


def latest_feeling(db: DbSession, owner_id, category: Category) -> Plant | None:
    """The plant a new post should feed: the newest visible one of that feeling."""
    return db.scalar(
        select(Plant)
        .where(
            Plant.owner_id == owner_id,
            Plant.category == category,
            Plant.for_whom_name.is_(None),
            Plant.status != PlantStatus.released,
        )
        .order_by(Plant.created_at.desc())
        .limit(1)
    )


def water_feeling(
    db: DbSession,
    *,
    owner: User,
    category: Category,
    body: str,
) -> tuple[Plant, Plant | None]:
    """Writes into the newest plant of a feeling, planting the first one when
    the garden has none yet. Growing and spawning are add_post's business."""
    plant = latest_feeling(db, owner.id, category)
    if plant is None:
        plant = create_plant(
            db,
            owner=owner,
            title=None,
            body=body,
            category=category.value,
            species=None,
            release=False,
            for_whom=None,
        )
        return plant, None
    return add_post(db, plant, body)


def release_plant(db: DbSession, plant: Plant) -> Plant:
    plant.status = PlantStatus.released
    db.commit()
    return plant


def give_plant(db: DbSession, plant: Plant, to: str | None, note: str | None) -> Plant:
    from ..models import Gift

    recipient = (to or "").strip() or "Someone"
    plant.status = PlantStatus.given
    plant.gift = Gift(
        to_name=recipient,
        note=(note or "").strip(),
        token=_unique_gift_token(db),
    )
    plant.events.append(PlantEvent(type=EventType.given, note=f"Given to {recipient}"))
    db.commit()
    return plant


def _unique_gift_token(db: DbSession, attempts: int = 5) -> str:
    from ..models import Gift

    for _ in range(attempts):
        token = security.new_gift_token()
        if db.scalar(select(Gift.id).where(Gift.token == token)) is None:
            return token
    raise RuntimeError("could not allocate a unique gift token")


def stage_of(plant: Plant) -> Stage:
    """Letters grow through tending events; feelings grow through posts."""
    if plant.is_letter:
        times = [event.at for event in plant.events]
    else:
        times = [post.at for post in plant.posts]
    return derive_stage(event_times=times, created_at=plant.created_at)


def plant_public(plant: Plant) -> PlantPublic:
    for_whom = None
    if plant.for_whom_name:
        for_whom = ForWhomOut(
            name=plant.for_whom_name,
            email=plant.for_whom_email,
            giveOn=to_ms(plant.for_whom_give_on),
        )
    gift = None
    if plant.gift is not None:
        gift = GiftOut(
            to=plant.gift.to_name,
            note=plant.gift.note,
            token=plant.gift.token,
            givenAt=to_ms(plant.gift.given_at) or 0,
        )
    return PlantPublic(
        id=str(plant.id),
        ownerId=str(plant.owner_id),
        title=plant.title,
        body=plant.body,
        category=plant.category,
        species=plant.species,
        status=plant.status,
        x=plant.x,
        y=plant.y,
        scale=plant.scale,
        seed=plant.seed,
        createdAt=to_ms(plant.created_at) or 0,
        events=[
            PlantEventOut(type=event.type.value, note=event.note, at=to_ms(event.at) or 0)
            for event in plant.events
        ],
        posts=[PostOut(body=post.body, at=to_ms(post.at) or 0) for post in plant.posts],
        gift=gift,
        forWhom=for_whom,
        stage=stage_of(plant),
    )
