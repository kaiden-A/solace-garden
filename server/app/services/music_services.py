"""Cache-first music lookups.

The YouTube search bucket is ~100 calls/day for the whole project, so every
query normalizes to one row in music_searches and every video to one row in
music_tracks. Cache hits cost nothing; when the bucket is spent we serve the
stale row instead of failing the listener.
"""

import re
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session as DbSession

from ..models import MusicPlay, MusicSearch, MusicTrack, User
from ..models.users import utcnow
from ..schemas.music import SearchOut, TrackOut
from .youtube import YouTubeClient, YouTubeQuotaError

SPACE = re.compile(r"\s+")
RECENTS_LIMIT = 5
POPULAR_LIMIT = 5


def normalize_query(query: str) -> str:
    return SPACE.sub(" ", query.strip()).lower()


def track_out(track: MusicTrack) -> TrackOut:
    return TrackOut(
        id=track.video_id,
        title=track.title,
        author=track.author,
        thumb=track.thumb,
    )


def _fresh(stamp: datetime | None, ttl_days: int) -> bool:
    if stamp is None or ttl_days <= 0:
        return False
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=UTC)
    return datetime.now(UTC) - stamp < timedelta(days=ttl_days)


def upsert_track(
    db: DbSession,
    *,
    video_id: str,
    title: str,
    author: str,
    thumb: str,
) -> MusicTrack:
    """One row per video, refreshed whenever the caller has newer metadata."""
    track = db.scalar(select(MusicTrack).where(MusicTrack.video_id == video_id))
    if track is None:
        track = MusicTrack(video_id=video_id, title=title, author=author, thumb=thumb)
        db.add(track)
        return track
    if title:
        track.title = title
    if author:
        track.author = author
    if thumb:
        track.thumb = thumb
    track.fetched_at = utcnow()
    return track


def tracks_by_ids(db: DbSession, video_ids: list[str]) -> list[MusicTrack]:
    if not video_ids:
        return []
    rows = db.scalars(select(MusicTrack).where(MusicTrack.video_id.in_(video_ids))).all()
    by_id = {row.video_id: row for row in rows}
    return [by_id[video_id] for video_id in video_ids if video_id in by_id]


def _resolve_cached(db: DbSession, cached: MusicSearch | None) -> list[MusicTrack] | None:
    """Reads a cached row back. None means "ids we can no longer resolve"."""
    if cached is None:
        return None
    if not cached.result_ids:
        # A genuinely empty result set is a valid, cacheable answer.
        return []
    return tracks_by_ids(db, list(cached.result_ids)) or None


def search_tracks(
    db: DbSession,
    youtube: YouTubeClient,
    query: str,
    *,
    ttl_days: int,
    limit: int = 10,
) -> SearchOut:
    normalized = normalize_query(query)
    if not normalized:
        return SearchOut()

    cached = db.scalar(select(MusicSearch).where(MusicSearch.query == normalized))
    if cached is not None and _fresh(cached.fetched_at, ttl_days):
        tracks = _resolve_cached(db, cached)
        if tracks is not None:
            cached.hits += 1
            db.commit()
            return SearchOut(results=[track_out(track) for track in tracks], cached=True)

    try:
        found = youtube.search(normalized, limit=limit)
    except YouTubeQuotaError:
        stale = _resolve_cached(db, cached)
        if stale is not None:
            return SearchOut(
                results=[track_out(track) for track in stale], cached=True, stale=True
            )
        raise

    tracks = [
        upsert_track(
            db,
            video_id=item.video_id,
            title=item.title,
            author=item.author,
            thumb=item.thumb,
        )
        for item in found
    ]
    video_ids = [track.video_id for track in tracks]
    if cached is None:
        db.add(MusicSearch(query=normalized, result_ids=video_ids))
    else:
        cached.result_ids = video_ids
        cached.fetched_at = utcnow()
    db.commit()
    return SearchOut(results=[track_out(track) for track in tracks], cached=False)


def resolve_track(
    db: DbSession,
    youtube: YouTubeClient,
    video_id: str,
    *,
    ttl_days: int,
) -> MusicTrack | None:
    """Pasted links: cached row when fresh, else free oEmbed, else stale row."""
    track = db.scalar(select(MusicTrack).where(MusicTrack.video_id == video_id))
    if track is not None and _fresh(track.fetched_at, ttl_days):
        return track

    found = youtube.oembed(video_id)
    if found is None:
        return track

    track = upsert_track(
        db,
        video_id=found.video_id,
        title=found.title,
        author=found.author,
        thumb=found.thumb,
    )
    db.commit()
    return track


def record_play(
    db: DbSession,
    *,
    user: User,
    video_id: str,
    title: str,
    author: str,
    thumb: str,
    limit: int = RECENTS_LIMIT,
) -> list[MusicTrack]:
    """Remembers the play and returns the user's up-to-date recents."""
    upsert_track(db, video_id=video_id, title=title, author=author, thumb=thumb)

    play = db.scalar(
        select(MusicPlay).where(MusicPlay.user_id == user.id, MusicPlay.video_id == video_id)
    )
    if play is None:
        db.add(MusicPlay(user_id=user.id, video_id=video_id))
    else:
        play.plays += 1
        play.last_played_at = utcnow()
    db.commit()
    return recents_for(db, user.id, limit=limit)


def recents_for(db: DbSession, user_id, *, limit: int = RECENTS_LIMIT) -> list[MusicTrack]:
    return list(
        db.scalars(
            select(MusicTrack)
            .join(MusicPlay, MusicPlay.video_id == MusicTrack.video_id)
            .where(MusicPlay.user_id == user_id)
            .order_by(MusicPlay.last_played_at.desc())
            .limit(limit)
        )
    )


def popular_tracks(db: DbSession, *, limit: int = POPULAR_LIMIT) -> list[MusicTrack]:
    total = func.sum(MusicPlay.plays)
    rows = db.execute(
        select(MusicTrack, total.label("plays"))
        .join(MusicPlay, MusicPlay.video_id == MusicTrack.video_id)
        .group_by(MusicTrack.id)
        .order_by(total.desc())
        .limit(limit)
    ).all()
    return [row[0] for row in rows]
