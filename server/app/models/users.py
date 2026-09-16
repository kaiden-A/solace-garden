import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, Enum, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base
from .enums import UserKind


def utcnow() -> datetime:
    return datetime.now(UTC)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("idp_issuer", "zitadel_sub", name="uq_users_idp_subject"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    kind: Mapped[UserKind] = mapped_column(
        Enum(UserKind, name="user_kind", values_callable=lambda e: [m.value for m in e]),
        default=UserKind.member,
        nullable=False,
    )
    # Source of truth for authentication is Zitadel; this is the local link to it.
    zitadel_sub: Mapped[str | None] = mapped_column(String(64), index=True)
    idp_issuer: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(320))
    display_name: Mapped[str] = mapped_column(String(120), default="", nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    guest_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    @property
    def is_guest(self) -> bool:
        return self.kind is UserKind.guest

    def touch(self) -> None:
        self.last_seen_at = utcnow()
