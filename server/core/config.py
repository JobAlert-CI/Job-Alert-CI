from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
import os
from os import getenv
from pathlib import Path
from urllib.parse import quote_plus

DOTENV_PATH = Path(__file__).resolve().parents[1] / ".env"


def _load_dotenv_file() -> None:
    """Charge server/.env sans imposer une dependance de runtime.

    Les scripts, Alembic et Uvicorn lisent ainsi la meme configuration. Les
    variables deja presentes dans l'environnement gardent la priorite.
    """

    if not DOTENV_PATH.exists():
        return

    for raw_line in DOTENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip().removeprefix("export ").strip()
        if key and key not in os.environ:
            val = value.strip()
            if val.startswith(('"', "'")):
                quote = val[0]
                end_idx = val.find(quote, 1)
                if end_idx != -1:
                    val = val[1:end_idx]
                else:
                    val = val.strip(quote)
            else:
                val = val.split("#", 1)[0].strip()
            os.environ[key] = val


_load_dotenv_file()


def _bool_env(name: str, default: bool = False) -> bool:
    return getenv(name, str(default)).lower() in {"1", "true", "yes", "on"}


def _int_env(name: str, default: int) -> int:
    raw_value = getenv(name)
    if raw_value is None:
        return default
    try:
        return int(raw_value)
    except ValueError as exc:
        raise ValueError(f"{name} doit etre un entier valide") from exc


def _list_env(name: str, default: list[str]) -> list[str]:
    raw_value = getenv(name)
    if not raw_value:
        return default
    return [item.strip().rstrip("/") for item in raw_value.split(",") if item.strip()]


def _str_env(name: str, default: str) -> str:
    return getenv(name, default).strip()


def _database_url() -> str:
    """Construit le DSN PostgreSQL a partir de DATABASE_URL ou DB_*.

    DATABASE_URL reste prioritaire pour les plateformes cloud. Les variables
    DB_* gardent un mode explicite pour Docker Compose et les serveurs bare
    metal. On laisse un fallback SQLite seulement pour tests ponctuels.
    """

    explicit_url = getenv("DATABASE_URL_DEV") if getenv("APP_ENV") == "development"  else getenv("DATABASE_URL")
    if explicit_url:
        return explicit_url

    if getenv("DB_HOST") or getenv("DB_NAME") or getenv("DB_USER"):
        driver = getenv("DB_DRIVER", "postgresql+psycopg")
        user = quote_plus(getenv("DB_USER", "jobalert_app"))
        password = quote_plus(getenv("DB_PASSWORD", ""))
        host = getenv("DB_HOST", "localhost")
        port = getenv("DB_PORT", "5432")
        name = getenv("DB_NAME", "jobalert_ci")
        return f"{driver}://{user}:{password}@{host}:{port}/{name}"

    return "sqlite:///./jobalert_ci.db"


@dataclass(frozen=True)
class Settings:
    """Configuration centrale.

    Regrouper les valeurs ici evite les constantes dispersees dans les routes
    et rend les futurs environnements plus simples a auditer.
    """

    app_name: str = field(default_factory=lambda: getenv("APP_NAME", "JobAlert CI API"))
    app_version: str = field(default_factory=lambda: getenv("APP_VERSION", "1.0.0"))
    environment: str = field(default_factory=lambda: getenv("APP_ENV", "development"))
    timezone: str = field(default_factory=lambda: getenv("APP_TIMEZONE", "Africa/Abidjan"))
    database_url: str = field(default_factory=_database_url)
    database_echo: bool = field(default_factory=lambda: _bool_env("DATABASE_ECHO", False))
    db_pool_size: int = field(default_factory=lambda: _int_env("DB_POOL_SIZE", 10))
    db_max_overflow: int = field(default_factory=lambda: _int_env("DB_MAX_OVERFLOW", 20))
    db_pool_timeout: int = field(default_factory=lambda: _int_env("DB_POOL_TIMEOUT", 30))
    db_pool_recycle: int = field(default_factory=lambda: _int_env("DB_POOL_RECYCLE", 1800))
    db_pool_pre_ping: bool = field(default_factory=lambda: _bool_env("DB_POOL_PRE_PING", True))
    cors_origins: list[str] = field(
        default_factory=lambda: _list_env("CORS_ORIGINS", ["http://localhost:5173"])
    )
    auto_create_tables: bool = field(default_factory=lambda: _bool_env("AUTO_CREATE_TABLES", False))
    email_from: str = field(default_factory=lambda: getenv("EMAIL_FROM", "JobAlert CI <bonjour@jobalert.ci>"))
    daily_collection_hour: int = field(default_factory=lambda: _int_env("DAILY_COLLECTION_HOUR", 6))
    # ─── Confirmation d'email (Resend) ────────────────────────────────
    # Secret: ne jamais logger ni exposer resend_api_key dans une reponse API.
    resend_api_key: str | None = field(default_factory=lambda: getenv("RESEND_API_KEY") or None)
    email_from_address: str = field(default_factory=lambda: _str_env("EMAIL_FROM_ADDRESS", "notifications@jobalert.ci"))
    email_from_name: str = field(default_factory=lambda: _str_env("EMAIL_FROM_NAME", "JobAlert CI"))
    public_base_url: str = field(default_factory=lambda: _str_env("PUBLIC_BASE_URL", "https://jobalert.ci"))
    confirm_email_token_ttl_hours: int = field(default_factory=lambda: _int_env("CONFIRM_EMAIL_TOKEN_TTL_HOURS", 24))
    email_confirmation_required: bool = field(default_factory=lambda: _bool_env("EMAIL_CONFIRMATION_REQUIRED", True))
    email_provider: str = field(default_factory=lambda: _str_env("EMAIL_PROVIDER", "resend"))
    resend_timeout_seconds: int = field(default_factory=lambda: _int_env("RESEND_TIMEOUT_SECONDS", 10))
    email_max_retries: int = field(default_factory=lambda: _int_env("EMAIL_MAX_RETRIES", 3))
    email_retry_backoff_seconds: int = field(default_factory=lambda: _int_env("EMAIL_RETRY_BACKOFF_SECONDS", 5))
    email_rate_limit_resend_per_hour: int = field(default_factory=lambda: _int_env("EMAIL_RATE_LIMIT_RESEND_PER_HOUR", 3))
    support_email: str = field(default_factory=lambda: _str_env("SUPPORT_EMAIL", "support@jobalert.ci"))
    # Secret du webhook Resend (Svix). Optionnel: sans lui le webhook refuse les appels signes.
    resend_webhook_secret: str | None = field(default_factory=lambda: getenv("RESEND_WEBHOOK_SECRET") or None)
    email_bounce_threshold: int = field(default_factory=lambda: _int_env("EMAIL_BOUNCE_THRESHOLD", 2))
    daily_digest_hour: int = field(default_factory=lambda: _int_env("DAILY_DIGEST_HOUR", 8))
    # ─── Digest quotidien en 2 phases (prompt_send_offres_email.md) ──────
    # Phase 1 preparation a 07h30, phase 2 envoi a 08h00, Africa/Abidjan.
    daily_digest_prepare_hour: int = field(default_factory=lambda: _int_env("DAILY_DIGEST_PREPARE_HOUR", 7))
    daily_digest_prepare_minute: int = field(default_factory=lambda: _int_env("DAILY_DIGEST_PREPARE_MINUTE", 30))
    daily_digest_send_hour: int = field(default_factory=lambda: _int_env("DAILY_DIGEST_SEND_HOUR", 8))
    daily_digest_send_minute: int = field(default_factory=lambda: _int_env("DAILY_DIGEST_SEND_MINUTE", 0))
    digest_timezone: str = field(default_factory=lambda: _str_env("DIGEST_TIMEZONE", "Africa/Abidjan"))
    digest_max_offers: int = field(default_factory=lambda: _int_env("DIGEST_MAX_OFFERS", 3))
    digest_min_offers: int = field(default_factory=lambda: _int_env("DIGEST_MIN_OFFERS", 1))
    digest_send_if_below_min: bool = field(default_factory=lambda: _bool_env("DIGEST_SEND_IF_BELOW_MIN", True))
    digest_include_no_contract_offers: bool = field(
        default_factory=lambda: _bool_env("DIGEST_INCLUDE_NO_CONTRACT_OFFERS", False)
    )
    digest_include_no_location_offers: bool = field(
        default_factory=lambda: _bool_env("DIGEST_INCLUDE_NO_LOCATION_OFFERS", True)
    )
    experience_match_mode: str = field(default_factory=lambda: _str_env("EXPERIENCE_MATCH_MODE", "compatible"))
    experience_match_tolerance_years: int = field(
        default_factory=lambda: _int_env("EXPERIENCE_MATCH_TOLERANCE_YEARS", 1)
    )
    city_match_mode: str = field(default_factory=lambda: _str_env("CITY_MATCH_MODE", "normalized_exact"))
    include_remote_offers: bool = field(default_factory=lambda: _bool_env("INCLUDE_REMOTE_OFFERS", True))
    include_remote_offers_for_unmatched_city: bool = field(
        default_factory=lambda: _bool_env("INCLUDE_REMOTE_OFFERS_FOR_UNMATCHED_CITY", True)
    )
    digest_city_mode: str = field(default_factory=lambda: _str_env("DIGEST_CITY_MODE", "prefer_city"))
    digest_prepare_lock_ttl_seconds: int = field(
        default_factory=lambda: _int_env("DIGEST_PREPARE_LOCK_TTL_SECONDS", 7200)
    )
    digest_send_lock_ttl_seconds: int = field(default_factory=lambda: _int_env("DIGEST_SEND_LOCK_TTL_SECONDS", 7200))
    send_if_preparation_incomplete: bool = field(
        default_factory=lambda: _bool_env("SEND_IF_PREPARATION_INCOMPLETE", False)
    )
    retry_failed_digests_enabled: bool = field(default_factory=lambda: _bool_env("RETRY_FAILED_DIGESTS_ENABLED", False))
    scraper_api_token: str | None = field(default_factory=lambda: getenv("SCRAPER_API_TOKEN") or None)
    ingestion_batch_size_max: int = field(default_factory=lambda: _int_env("INGESTION_BATCH_SIZE_MAX", 500))
    ai_enabled: bool = field(default_factory=lambda: _bool_env("AI_ENABLED", False))
    ai_key_encryption_secret: str | None = field(default_factory=lambda: getenv("AI_KEY_ENCRYPTION_SECRET") or None)
    ai_circuit_breaker_minutes: int = field(default_factory=lambda: _int_env("AI_CIRCUIT_BREAKER_MINUTES", 15))
    celery_broker_url: str = field(default_factory=lambda: _str_env("CELERY_BROKER_URL", "redis://localhost:6379/0"))
    celery_result_backend: str = field(default_factory=lambda: _str_env("CELERY_RESULT_BACKEND", "redis://localhost:6379/1"))
    redis_url: str = field(default_factory=lambda: _str_env("REDIS_URL", "redis://localhost:6379/2"))
    api_base_url: str = field(default_factory=lambda: _str_env("API_BASE_URL", "http://localhost:8000"))
    internal_api_token: str | None = field(default_factory=lambda: getenv("INTERNAL_API_TOKEN") or None)
    admin_api_key: str | None = field(default_factory=lambda: getenv("ADMIN_API_KEY") or None)
    admin_jwt_secret: str = field(
        default_factory=lambda: getenv("ADMIN_JWT_SECRET") or "dev-insecure-secret-change-me"
    )
    admin_jwt_access_minutes: int = field(default_factory=lambda: _int_env("ADMIN_JWT_ACCESS_MINUTES", 60))
    admin_jwt_refresh_minutes: int = field(
        default_factory=lambda: _int_env("ADMIN_JWT_REFRESH_MINUTES", 60 * 24 * 7)
    )

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"prod", "production"}


@lru_cache
def get_settings() -> Settings:
    return Settings()