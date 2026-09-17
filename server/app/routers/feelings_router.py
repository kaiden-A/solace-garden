from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DbSession

from ..database import get_db
from ..dependencies import require_user
from ..models import User
from ..models.enums import as_category
from ..schemas.plants import PostCreate, PostResultOut
from ..services.plants_services import plant_public, water_feeling

router = APIRouter(prefix="/api/feelings", tags=["feelings"])


@router.post("/{category}/posts", response_model=PostResultOut)
def water(
    category: str,
    payload: PostCreate,
    user: User = Depends(require_user),
    db: DbSession = Depends(get_db),
) -> PostResultOut:
    """Writes a feeling into its newest plant (or plants the first one)."""
    body = (payload.body or "").strip()
    if not body:
        raise HTTPException(status_code=400, detail="Write something first.")

    chosen = as_category(category)
    if chosen is None:
        raise HTTPException(status_code=400, detail="Choose a theme for your plant.")

    plant, spawned = water_feeling(db, owner=user, category=chosen, body=body)
    return PostResultOut(
        plant=plant_public(plant),
        spawned=plant_public(spawned) if spawned is not None else None,
    )
