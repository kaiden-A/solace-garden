import re
from datetime import UTC, datetime


def to_ms(value: datetime | None) -> int | None:
    """DB timestamps are timezone-aware; the client speaks millisecond epochs."""
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return int(value.timestamp() * 1000)


def from_ms(value: int | float | str | None) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value / 1000, tz=UTC)
    text = str(value).strip()
    if not text:
        return None
    if re.fullmatch(r"\d+", text):
        return datetime.fromtimestamp(int(text) / 1000, tz=UTC)
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        text = f"{text}T00:00:00"
    parsed = datetime.fromisoformat(text)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def local_path(value: str | None, fallback: str = "/garden") -> str:
    """Only allow same-site redirects after login."""
    if not value or not value.startswith("/") or value.startswith("//"):
        return fallback
    return value
