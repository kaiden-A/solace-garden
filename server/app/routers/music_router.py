from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as DbSession

from ..config import Settings, get_settings
from ..database import get_db
from ..dependencies import current_user, get_youtube, require_user
from ..models import User
from ..schemas.music import PlayIn, RecentsOut, SearchOut, TrackOut
from ..services import music_services
from ..services.youtube import YouTubeClient, YouTubeError, YouTubeQuotaError, parse_video_id

router = APIRouter(prefix="/api/music", tags=["music"])

QUOTA_MESSAGE = "Search is resting for today — paste a link instead."


@router.get("/search", response_model=SearchOut)
def search(
    q: str = Query(min_length=1, max_length=200),
    limit: int = Query(10, ge=1, le=25),
    db: DbSession = Depends(get_db),
    youtube: YouTubeClient = Depends(get_youtube),
    settings: Settings = Depends(get_settings),
) -> SearchOut:
    if not youtube.configured:
        raise HTTPException(status_code=503, detail="Music search is not set up yet.")
    try:
        return music_services.search_tracks(
            db,
            youtube,
            q,
            ttl_days=settings.music_search_ttl_days,
            limit=limit,
        )
    except YouTubeQuotaError as exc:
        raise HTTPException(status_code=429, detail=QUOTA_MESSAGE) from exc
    except YouTubeError as exc:
        raise HTTPException(status_code=502, detail="Could not reach YouTube right now.") from exc


@router.get("/resolve", response_model=TrackOut)
def resolve(
    url: str = Query(min_length=1, max_length=500),
    db: DbSession = Depends(get_db),
    youtube: YouTubeClient = Depends(get_youtube),
    settings: Settings = Depends(get_settings),
) -> TrackOut:
    video_id = parse_video_id(url)
    if video_id is None:
        raise HTTPException(status_code=400, detail="That doesn't look like a YouTube link.")
    track = music_services.resolve_track(
        db, youtube, video_id, ttl_days=settings.music_track_ttl_days
    )
    if track is None:
        raise HTTPException(status_code=404, detail="That video could not be found.")
    return music_services.track_out(track)


@router.get("/recents", response_model=RecentsOut)
def recents(
    user: User | None = Depends(current_user),
    db: DbSession = Depends(get_db),
) -> RecentsOut:
    if user is None:
        return RecentsOut(signedIn=False)
    tracks = music_services.recents_for(db, user.id)
    return RecentsOut(signedIn=True, results=[music_services.track_out(track) for track in tracks])


@router.get("/popular", response_model=list[TrackOut])
def popular(db: DbSession = Depends(get_db)) -> list[TrackOut]:
    return [music_services.track_out(track) for track in music_services.popular_tracks(db)]


@router.post("/plays", response_model=list[TrackOut])
def play(
    payload: PlayIn,
    user: User = Depends(require_user),
    db: DbSession = Depends(get_db),
) -> list[TrackOut]:
    video_id = parse_video_id(payload.videoId)
    if video_id is None:
        raise HTTPException(status_code=400, detail="That doesn't look like a YouTube video.")
    tracks = music_services.record_play(
        db,
        user=user,
        video_id=video_id,
        title=payload.title.strip(),
        author=payload.author.strip(),
        thumb=payload.thumb.strip(),
    )
    return [music_services.track_out(track) for track in tracks]
