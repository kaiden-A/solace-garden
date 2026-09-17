"""Thin YouTube client: Data API v3 for search, oEmbed for pasted links.

`search.list` is billed from its own bucket (100 calls/day by default under the
June 2026 quota model, shared by the whole project), so every caller goes
through the music cache in music_services. oEmbed has no documented quota and
is the fallback when search is spent.
"""

import re
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from urllib.parse import parse_qs, urlsplit

import httpx

API_ROOT = "https://www.googleapis.com/youtube/v3"
OEMBED_ROOT = "https://www.youtube.com/oembed"
VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
QUOTA_REASONS = frozenset({"quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"})


class YouTubeError(RuntimeError):
    """The call failed for a reason other than quota."""


class YouTubeQuotaError(YouTubeError):
    """The search bucket (or our soft cap) is spent."""


def _as_id(value: str | None) -> str | None:
    if not value:
        return None
    trimmed = value.strip()
    return trimmed if VIDEO_ID.match(trimmed) else None


def parse_video_id(value: str | None) -> str | None:
    """Mirrors client/lib/youtube.ts so both ends agree on what a link is."""
    if not value:
        return None
    text = value.strip()
    direct = _as_id(text)
    if direct:
        return direct

    candidate = text if text.startswith(("http://", "https://")) else f"https://{text}"
    try:
        url = urlsplit(candidate)
    except ValueError:
        return None

    host = re.sub(r"^(www|m)\.", "", url.hostname or "").lower()
    if host == "youtu.be":
        return _as_id(url.path.lstrip("/").split("/")[0])
    if host.endswith("youtube.com"):
        from_query = _as_id((parse_qs(url.query).get("v") or [None])[0])
        if from_query:
            return from_query
        parts = [part for part in url.path.split("/") if part]
        if parts and parts[0] in {"embed", "shorts", "live"} and len(parts) > 1:
            return _as_id(parts[1])
    return None


def _thumb(snippet: dict) -> str:
    thumbs = snippet.get("thumbnails") or {}
    for key in ("medium", "high", "standard", "default"):
        url = (thumbs.get(key) or {}).get("url")
        if url:
            return str(url)
    return ""


def _fallback_thumb(video_id: str) -> str:
    return f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg"


@dataclass
class YouTubeTrack:
    video_id: str
    title: str
    author: str
    thumb: str


@dataclass
class SearchBudget:
    """Process-local courtesy guard: leave headroom in the daily search bucket.

    Each worker counts for itself, so this is not a hard limit - the API's 403
    is still the authority. Exceeding it just means "serve the cache".
    """

    day: date = field(default_factory=lambda: datetime.now(UTC).date())
    calls: int = 0

    def take(self, daily_cap: int) -> None:
        today = datetime.now(UTC).date()
        if today != self.day:
            self.day, self.calls = today, 0
        if daily_cap > 0 and self.calls >= daily_cap:
            raise YouTubeQuotaError("daily search budget reached")
        self.calls += 1


@dataclass
class YouTubeClient:
    api_key: str
    http: httpx.Client
    search_daily_cap: int = 0
    budget: SearchBudget = field(default_factory=SearchBudget)

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    def search(self, query: str, *, limit: int = 10) -> list[YouTubeTrack]:
        if not self.configured:
            raise YouTubeError("YouTube search is not configured.")
        self.budget.take(self.search_daily_cap)
        response = self.http.get(
            f"{API_ROOT}/search",
            params={
                "key": self.api_key,
                "part": "snippet",
                "q": query,
                "type": "video",
                "maxResults": limit,
                "order": "relevance",
                "safeSearch": "moderate",
                # Only results the IFrame player can actually play.
                "videoEmbeddable": "true",
                "videoSyndicated": "true",
            },
        )
        self._raise_for_error(response)

        tracks: list[YouTubeTrack] = []
        for item in response.json().get("items") or []:
            video_id = (item.get("id") or {}).get("videoId")
            snippet = item.get("snippet") or {}
            if not video_id:
                continue
            tracks.append(
                YouTubeTrack(
                    video_id=str(video_id),
                    title=str(snippet.get("title") or ""),
                    author=str(snippet.get("channelTitle") or ""),
                    thumb=_thumb(snippet) or _fallback_thumb(str(video_id)),
                )
            )
        return tracks

    def oembed(self, video_id: str) -> YouTubeTrack | None:
        """Free metadata for a pasted link; None when the video is gone."""
        response = self.http.get(
            OEMBED_ROOT,
            params={"format": "json", "url": f"https://www.youtube.com/watch?v={video_id}"},
        )
        if response.status_code >= 400:
            return None
        data = response.json()
        return YouTubeTrack(
            video_id=video_id,
            title=str(data.get("title") or ""),
            author=str(data.get("author_name") or ""),
            thumb=str(data.get("thumbnail_url") or "") or _fallback_thumb(video_id),
        )

    def _raise_for_error(self, response: httpx.Response) -> None:
        if response.status_code < 400:
            return
        reason = ""
        try:
            errors = (response.json().get("error") or {}).get("errors") or []
            reason = str(errors[0].get("reason", "")) if errors else ""
        except ValueError:
            pass
        if response.status_code == 403 and reason in QUOTA_REASONS:
            raise YouTubeQuotaError("YouTube search quota is spent.")
        raise YouTubeError(f"YouTube returned {response.status_code}.")
