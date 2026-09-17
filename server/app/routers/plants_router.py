from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DbSession

from ..database import get_db
from ..dependencies import require_user
from ..models import User
from ..models.enums import CATEGORY_VALUES, SPECIES_VALUES
from ..schemas.plants import (
    GiveRequest,
    PlantCreate,
    PlantPublic,
    PostCreate,
    PostResultOut,
    TendRequest,
)
from ..services.plants_services import (
    add_post,
    create_plant,
    get_plant,
    give_plant,
    list_plants,
    plant_public,
    release_plant,
    tend_plant,
)

router = APIRouter(prefix="/api/plants", tags=["plants"])


def _owned(db: DbSession, plant_id: str, user: User, *, allow_released: bool = False):
    plant = get_plant(db, plant_id, user.id)
    if plant is None:
        raise HTTPException(status_code=404, detail="Not found.")
    if not allow_released and plant.status.value == "released":
        raise HTTPException(status_code=404, detail="Not found.")
    return plant


@router.get("", response_model=list[PlantPublic])
def list_all(user: User = Depends(require_user), db: DbSession = Depends(get_db)) -> list[PlantPublic]:
    return [plant_public(plant) for plant in list_plants(db, user.id)]


@router.post("", response_model=PlantPublic, status_code=201)
def create(
    payload: PlantCreate,
    user: User = Depends(require_user),
    db: DbSession = Depends(get_db),
) -> PlantPublic:
    body = (payload.body or "").strip()
    if not body:
        raise HTTPException(status_code=400, detail="Write something first.")

    recipient = (payload.forWhom.name or "").strip() if payload.forWhom else ""
    if recipient:
        if payload.species not in SPECIES_VALUES:
            raise HTTPException(status_code=400, detail="Choose a plant type.")
    elif payload.category not in CATEGORY_VALUES:
        raise HTTPException(status_code=400, detail="Choose a theme for your plant.")

    plant = create_plant(
        db,
        owner=user,
        title=payload.title,
        body=body,
        category=payload.category,
        species=payload.species,
        release=payload.release,
        for_whom=payload.forWhom,
    )
    return plant_public(plant)


@router.get("/{plant_id}", response_model=PlantPublic)
def get_one(
    plant_id: str,
    user: User = Depends(require_user),
    db: DbSession = Depends(get_db),
) -> PlantPublic:
    return plant_public(_owned(db, plant_id, user))


@router.post("/{plant_id}/tend", response_model=PlantPublic)
def tend(
    plant_id: str,
    payload: TendRequest,
    user: User = Depends(require_user),
    db: DbSession = Depends(get_db),
) -> PlantPublic:
    plant = _owned(db, plant_id, user)
    if not plant.is_letter:
        raise HTTPException(status_code=400, detail="Write a post instead.")
    return plant_public(tend_plant(db, plant, payload.note))


@router.post("/{plant_id}/posts", response_model=PostResultOut)
def post(
    plant_id: str,
    payload: PostCreate,
    user: User = Depends(require_user),
    db: DbSession = Depends(get_db),
) -> PostResultOut:
    body = (payload.body or "").strip()
    if not body:
        raise HTTPException(status_code=400, detail="Write something first.")
    plant = _owned(db, plant_id, user)
    if plant.is_letter:
        raise HTTPException(status_code=400, detail="Letters grow through tending.")

    plant, spawned = add_post(db, plant, body)
    return PostResultOut(
        plant=plant_public(plant),
        spawned=plant_public(spawned) if spawned is not None else None,
    )


@router.post("/{plant_id}/release")
def release(
    plant_id: str,
    user: User = Depends(require_user),
    db: DbSession = Depends(get_db),
) -> dict[str, bool]:
    plant = _owned(db, plant_id, user, allow_released=True)
    release_plant(db, plant)
    return {"ok": True}


@router.post("/{plant_id}/give", response_model=PlantPublic)
def give(
    plant_id: str,
    payload: GiveRequest,
    user: User = Depends(require_user),
    db: DbSession = Depends(get_db),
) -> PlantPublic:
    plant = _owned(db, plant_id, user)
    return plant_public(give_plant(db, plant, payload.to, payload.note))
