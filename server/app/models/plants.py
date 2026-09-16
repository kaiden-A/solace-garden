import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from .enums import Category, PlantStatus, Species
from .users import utcnow

if TYPE_CHECKING:
    from .gifts import Gift
    from .plant_events import PlantEvent


class Plant(Base):
    __tablename__ = "plants"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )

    title: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[Category | None] = mapped_column(
        Enum(Category, name="plant_category", values_callable=lambda e: [m.value for m in e])
    )
    species: Mapped[Species | None] = mapped_column(
        Enum(Species, name="plant_species", values_callable=lambda e: [m.value for m in e])
    )
    status: Mapped[PlantStatus] = mapped_column(
        Enum(PlantStatus, name="plant_status", values_callable=lambda e: [m.value for m in e]),
        default=PlantStatus.growing,
        nullable=False,
    )

    x: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    y: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    scale: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    seed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    for_whom_name: Mapped[str | None] = mapped_column(String(120))
    for_whom_email: Mapped[str | None] = mapped_column(String(320))
    for_whom_give_on: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    events: Mapped[list["PlantEvent"]] = relationship(
        back_populates="plant",
        cascade="all, delete-orphan",
        order_by="PlantEvent.at",
        lazy="selectin",
    )
    gift: Mapped["Gift | None"] = relationship(
        back_populates="plant", cascade="all, delete-orphan", uselist=False, lazy="selectin"
    )

    @property
    def has_recipient(self) -> bool:
        return bool(self.for_whom_name)

    def placement_key(self) -> str:
        if self.has_recipient:
            return "letter"
        return self.category.value if self.category else "feeling"
