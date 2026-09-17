import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from .users import utcnow

if TYPE_CHECKING:
    from .plants import Plant


class PlantPost(Base):
    """A feeling written into a plant. Posts are the content and the growth:
    unlike letters, a plant of a feeling grows by accumulating these.
    """

    __tablename__ = "plant_posts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    plant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("plants.id", ondelete="CASCADE"), index=True, nullable=False
    )

    body: Mapped[str] = mapped_column(Text, nullable=False)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    plant: Mapped["Plant"] = relationship(back_populates="posts")
