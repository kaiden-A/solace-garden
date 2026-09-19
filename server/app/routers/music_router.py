from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as DbSession

from ..config import Settings, get_settings
from ..database import get_db
from ..dependencies import current_user, get_youtube, require_user
from ..models import MusicPlaylist, User
from ..schemas.music import (
    PlayIn,
    PlaylistIn,
    PlaylistOrderIn,
    PlaylistOut,
    PlaylistPatch,
    PlaylistSummaryOut,
    PlaylistTrackIn,
    RecentsOut,
    SearchOut,
    TrackOut,
)
from ..services import music_services
from ..services.youtube import YouTubeClient, YouTubeError, YouTubeQuotaError, parse_video_id

router = APIRouter(prefix="/api/music", tags=["music"])

QUOTA_MESSAGE = "Search is resting for today — paste a link instead."
BAD_VIDEO = "That doesn't look like a YouTube video."


def _clean_tracks(tracks: list[PlaylistTrackIn]) -> list[PlaylistTrackIn]:
    """Normalized, deduped video ids; anything unplayable is rejected."""
    cleaned: list[PlaylistTrackIn] = []
    for track in tracks:
        video_id = parse_video_id(track.videoId)
        if video_id is None:
            raise HTTPException(status_code=400, detail=BAD_VIDEO)
        if any(item.videoId == video_id for item in cleaned):
            continue
        cleaned.append(
            PlaylistTrackIn(
                videoId=video_id,
                title=track.title.strip(),
                author=track.author.strip(),
                thumb=track.thumb.strip(),
            )
        )
    return cleaned


def _owned(db: DbSession, user: User, playlist_id: str) -> MusicPlaylist:
    playlist = music_services.owned_playlist(db, user.id, playlist_id)
    if playlist is None:
        raise HTTPException(status_code=404, detail="Playlist not found.")
    return playlist


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
    limit: int = Query(music_services.RECENTS_LIMIT, ge=1, le=100),
    user: User | None = Depends(current_user),
    db: DbSession = Depends(get_db),
) -> RecentsOut:
    if user is None:
        return RecentsOut(signedIn=False)
    tracks = music_services.recents_for(db, user.id, limit=limit)
    return RecentsOut(signedIn=True, results=[music_services.track_out(track) for track in tracks])


@router.get("/popular", response_model=list[TrackOut])
def popular(
    limit: int = Query(music_services.POPULAR_LIMIT, ge=1, le=100),
    db: DbSession = Depends(get_db),
) -> list[TrackOut]:
    return [music_services.track_out(track) for track in music_services.popular_tracks(db, limit=limit)]


@router.post("/plays", response_model=list[TrackOut])
def play(
    payload: PlayIn,
    user: User = Depends(require_user),
    db: DbSession = Depends(get_db),
) -> list[TrackOut]:
    video_id = parse_video_id(payload.videoId)
    if video_id is None:
        raise HTTPException(status_code=400, detail=BAD_VIDEO)
    tracks = music_services.record_play(
        db,
        user=user,
        video_id=video_id,
        title=payload.title.strip(),
        author=payload.author.strip(),
        thumb=payload.thumb.strip(),
    )
    return [music_services.track_out(track) for track in tracks]


@router.get("/playlists", response_model=list[PlaylistSummaryOut])
def list_playlists(
    user: User = Depends(require_user),
    db: DbSession = Depends(get_db),
) -> list[PlaylistSummaryOut]:
    return music_services.list_playlists(db, user.id)


@router.post("/playlists", response_model=PlaylistOut, status_code=201)
def create_playlist(
    payload: PlaylistIn,
    user: User = Depends(require_user),
    db: DbSession = Depends(get_db),
) -> PlaylistOut:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Give this playlist a name.")
    try:
        return music_services.create_playlist(
            db, user_id=user.id, name=name, tracks=_clean_tracks(payload.tracks)
        )
    except music_services.PlaylistLimitError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/playlists/{playlist_id}", response_model=PlaylistOut)
def get_playlist(
    playlist_id: str,
    user: User = Depends(require_user),
    db: DbSession = Depends(get_db),
) -> PlaylistOut:
    playlist = _owned(db, user, playlist_id)
    return music_services.playlist_out(db, playlist)


@router.patch("/playlists/{playlist_id}", response_model=PlaylistSummaryOut)
def rename_playlist(
    playlist_id: str,
    payload: PlaylistPatch,
    user: User = Depends(require_user),
    db: DbSession = Depends(get_db),
) -> PlaylistSummaryOut:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Give this playlist a name.")
    playlist = _owned(db, user, playlist_id)
    return music_services.rename_playlist(db, playlist, name)


@router.delete("/playlists/{playlist_id}")
def delete_playlist(
    playlist_id: str,
    user: User = Depends(require_user),
    db: DbSession = Depends(get_db),
) -> dict[str, bool]:
    playlist = _owned(db, user, playlist_id)
    music_services.delete_playlist(db, playlist)
    return {"ok": True}


@router.post("/playlists/{playlist_id}/tracks", response_model=PlaylistOut)
def add_playlist_track(
    playlist_id: str,
    payload: PlaylistTrackIn,
    user: User = Depends(require_user),
    db: DbSession = Depends(get_db),
) -> PlaylistOut:
    video_id = parse_video_id(payload.videoId)
    if video_id is None:
        raise HTTPException(status_code=400, detail=BAD_VIDEO)
    playlist = _owned(db, user, playlist_id)
    track = PlaylistTrackIn(
        videoId=video_id,
        title=payload.title.strip(),
        author=payload.author.strip(),
        thumb=payload.thumb.strip(),
    )
    try:
        return music_services.add_playlist_track(db, playlist, track)
    except music_services.PlaylistLimitError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/playlists/{playlist_id}/tracks/{video_id}", response_model=PlaylistOut)
def remove_playlist_track(
    playlist_id: str,
    video_id: str,
    user: User = Depends(require_user),
    db: DbSession = Depends(get_db),
) -> PlaylistOut:
    playlist = _owned(db, user, playlist_id)
    return music_services.remove_playlist_track(db, playlist, video_id)


@router.put("/playlists/{playlist_id}/order", response_model=PlaylistOut)
def reorder_playlist(
    playlist_id: str,
    payload: PlaylistOrderIn,
    user: User = Depends(require_user),
    db: DbSession = Depends(get_db),
) -> PlaylistOut:
    playlist = _owned(db, user, playlist_id)
    return music_services.reorder_playlist(db, playlist, payload.videoIds)
