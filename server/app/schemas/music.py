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
