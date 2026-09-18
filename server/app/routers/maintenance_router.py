import hmac

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session as DbSession

from ..config import Settings, get_settings
from ..database import get_db
from ..services.maintenance_services import purge_expired

router = APIRouter(prefix="/api/maintenance", tags=["maintenance"])


@router.post("/cleanup-guests")
def cleanup_guests(
    x_cleanup_secret: str | None = Header(default=None),
    db: DbSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict[str, int]:
    """Cron target: deletes expired guests and dead sessions."""
    if not settings.cleanup_secret or not hmac.compare_digest(
        x_cleanup_secret or "", settings.cleanup_secret
    ):
        raise HTTPException(status_code=403, detail="Cleanup is not authorized.")
    return purge_expired(db)
