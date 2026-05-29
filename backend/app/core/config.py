from functools import lru_cache

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Algorithm Learn API"
    environment: str = "development"
    database_url: str = Field(default="postgresql+asyncpg://algolearn:algolearn@localhost:5432/algolearn")
    redis_url: str = "redis://localhost:6379/0"
    frontend_origin: str = "http://localhost:3000"
    sentry_dsn: str | None = None
    piston_url: AnyHttpUrl = "https://emkc.org/api/v2/piston/execute"
    execution_timeout_seconds: int = 5


@lru_cache
def get_settings() -> Settings:
    return Settings()
