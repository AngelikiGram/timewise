from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import Engine, create_engine

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    database_url: str = ""
    admin_token: str = ""


def database_url() -> str:
    url = Settings().database_url
    if not url:
        raise RuntimeError("DATABASE_URL is not set. See .env.example.")
    # Hosted providers hand out postgres:// URLs; SQLAlchemy needs the driver named.
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


@lru_cache
def engine() -> Engine:
    # Short pool: hosted free tiers limit connections, and the pooler handles the rest.
    # Supabase's session pooler allows 15 clients in total, shared by the API, scripts and tests.
    # A small pool that drops idle connections leaves room for the rest.
    return create_engine(database_url(), pool_size=2, max_overflow=1, pool_recycle=300, pool_pre_ping=True, connect_args={"connect_timeout": 10})
