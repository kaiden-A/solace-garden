import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base
from .users import utcnow


class MusicTrack(Base):
    """One row per video ever looked up, so repeat lookups cost no quota."""

    __tablename__ = "music_tracks"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    video_id: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(300), default="", nullable=False)
    author: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    thumb: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    # YouTube's terms allow caching API data for 30 days; the services refresh
    # anything older than MUSIC_TRACK_TTL_DAYS on next use.
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class MusicSearch(Base):
    """Normalized query -> result video ids. search.list is the scarce call."""

    __tablename__ = "music_searches"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    query: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    result_ids: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    hits: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class MusicPlay(Base):
    """One row per (user, track): recents and popularity both read from here."""

    __tablename__ = "music_plays"
    __table_args__ = (UniqueConstraint("user_id", "video_id", name="uq_music_plays_user_video"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    video_id: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    plays: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    last_played_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class MusicPlaylist(Base):
    """A member's own list of songs; the items point at the track cache."""

    __tablename__ = "music_playlists"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class MusicPlaylistItem(Base):
    """One row per (playlist, video); `position` is the play order."""

    __tablename__ = "music_playlist_items"
    __table_args__ = (
        UniqueConstraint("playlist_id", "video_id", name="uq_music_playlist_items_video"),
        Index("ix_music_playlist_items_order", "playlist_id", "position"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    playlist_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("music_playlists.id", ondelete="CASCADE"), nullable=False
    )
    video_id: Mapped[str] = mapped_column(String(20), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
