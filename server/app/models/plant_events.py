import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from .enums import EventType
from .users import utcnow

if TYPE_CHECKING:
    from .plants import Plant


class PlantEvent(Base):
    __tablename__ = "plant_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    plant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("plants.id", ondelete="CASCADE"), index=True, nullable=False
    )

    type: Mapped[EventType] = mapped_column(
        Enum(EventType, name="plant_event_type", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    note: Mapped[str | None] = mapped_column(Text)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    plant: Mapped["Plant"] = relationship(back_populates="events")
