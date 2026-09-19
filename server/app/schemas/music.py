from pydantic import BaseModel, Field


class TrackOut(BaseModel):
    id: str
    title: str
    author: str
    thumb: str


class SearchOut(BaseModel):
    results: list[TrackOut] = Field(default_factory=list)
    cached: bool = False
    # True when the cache is past its TTL but fresh results are unavailable.
    stale: bool = False


class PlayIn(BaseModel):
    videoId: str
    title: str = ""
    author: str = ""
    thumb: str = ""


class RecentsOut(BaseModel):
    # Anonymous listeners keep their history in the browser; telling them so
    # avoids a 401 on every page load.
    signedIn: bool
    results: list[TrackOut] = Field(default_factory=list)


class PlaylistTrackIn(BaseModel):
    videoId: str
    title: str = ""
    author: str = ""
    thumb: str = ""


class PlaylistIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    tracks: list[PlaylistTrackIn] = Field(default_factory=list)


class PlaylistPatch(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class PlaylistOrderIn(BaseModel):
    videoIds: list[str] = Field(default_factory=list)


class PlaylistSummaryOut(BaseModel):
    id: str
    name: str
    count: int
    # The cover is the first track's thumbnail; empty for an empty playlist.
    thumb: str = ""
    createdAt: int


class PlaylistOut(BaseModel):
    id: str
    name: str
    createdAt: int
    tracks: list[TrackOut] = Field(default_factory=list)
