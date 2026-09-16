from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DbSession

from ..database import get_db
from ..schemas.gifts import GiftPayload
from ..services.gifts_services import gift_payload

router = APIRouter(prefix="/api/gifts", tags=["gifts"])


@router.get("/{token}", response_model=GiftPayload)
def read_gift(token: str, db: DbSession = Depends(get_db)) -> GiftPayload:
    """Public: whoever holds the link can open the gift."""
    payload = gift_payload(db, token)
    if payload is None:
        raise HTTPException(status_code=404, detail="Not found.")
    return payload
