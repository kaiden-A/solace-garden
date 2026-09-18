from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    database_url: str
    # Neon's pooler runs in transaction mode, so session state (search_path)
    # cannot be trusted: every table is addressed with an explicit schema.
    db_schema: str = "public"

    app_secret: str = "dev-only-insecure-secret"
    cleanup_secret: str = ""
    api_base_url: str = "http://localhost:8000"
    public_base_url: str = "http://localhost:3000"

    zitadel_issuer: str = "https://elysiaa-w9dedz.us1.zitadel.cloud"
    zitadel_client_id: str = ""
    zitadel_redirect_uri: str = "http://localhost:3000/api/auth/callback"
    zitadel_post_logout_uri: str = "http://localhost:3000/login"

    session_cookie_name: str = "solace_session"
    session_ttl_days: int = 30
    guest_ttl_days: int = 7
    cookie_secure: bool = False

    # YouTube Data API v3 key (server-side only, never sent to the browser).
    # Empty disables search; pasted links keep working through oEmbed.
    youtube_api_key: str = ""
    # search.list has its own small daily bucket, so cached queries live long.
    music_search_ttl_days: int = 7
    # YouTube's terms cap cached API data at 30 days.
    music_track_ttl_days: int = 30
    # Soft, process-local ceiling below the project's daily search bucket.
    music_search_daily_cap: int = 90

    cors_origins: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def sqlalchemy_url(self) -> str:
        """Normalizes the DATABASE_URL for SQLAlchemy.

        pg8000 is a pure-Python driver: this machine's Application Control
        policy blocks the native psycopg/libpq DLLs, and pg8000 also keeps the
        deployment dependency-free. libpq-only query parameters (sslmode,
        channel_binding) are dropped; SSL is configured via ssl_context in
        database.py instead.
        """
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+pg8000://", 1)
        head, sep, query = url.partition("?")
        if not sep:
            return url
        dropped = ("channel_binding=", "sslmode=", "sslrootcert=", "sslcert=", "sslkey=")
        kept = [part for part in query.split("&") if part and not part.startswith(dropped)]
        return f"{head}?{'&'.join(kept)}" if kept else head

    @property
    def ssl_required(self) -> bool:
        return any(
            part.startswith("sslmode=") and part.split("=", 1)[1] in {"require", "verify-ca", "verify-full"}
            for part in self.database_url.partition("?")[2].split("&")
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # values come from .env
