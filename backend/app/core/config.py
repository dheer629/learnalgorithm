from functools import lru_cache

from pydantic import AnyHttpUrl, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Algorithm Learn API"
    environment: str = "development"
    database_url: str = Field(default="postgresql+asyncpg://algolearn:algolearn@localhost:5432/algolearn")
    redis_url: str = "redis://localhost:6379/0"
    frontend_origin: str = "http://localhost:3000"
    cors_origins: list[str] = Field(default_factory=list)
    admin_token: str | None = None
    sentry_dsn: str | None = None
    piston_url: AnyHttpUrl = "https://emkc.org/api/v2/piston/execute"
    execution_timeout_seconds: int = 5
    execution_output_limit_bytes: int = 200_000
    visualization_response_limit_bytes: int = 500_000
    local_memory_limit_mb: int = 256
    rate_limit_default: str = "120/minute"
    rate_limit_execute: str = "30/minute"
    rate_limit_admin: str = "12/minute"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str] | None) -> list[str]:
        if value is None or value == "":
            return []
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def allowed_origins(self) -> list[str]:
        origins = self.cors_origins or [self.frontend_origin]
        return sorted(set(origins))


@lru_cache
def get_settings() -> Settings:
    return Settings()
