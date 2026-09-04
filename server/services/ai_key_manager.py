from __future__ import annotations

import random
import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import nullsfirst, or_, select
from sqlalchemy.orm import Session

from models import AIAlert, AIApiKey
from models.enums import AIAlertSeverity, AIErrorType, AIProviderType
from services.ai_crypto import decrypt_api_key
from services.ai_errors import (
    AIAllProvidersFailedError,
    AIConfigurationError,
    AIFallbackFailure,
    AINoAvailableKeyError,
    AIProviderError,
)
from services.ai_providers import AIProviderFactory


@dataclass(frozen=True)
class AIProviderExecutionResult:
    data: dict[str, Any]
    api_key_id: str
    provider_type: str
    provider_name: str
    attempts: int
    fallback_count: int
    model: str | None = None


def utc_now() -> datetime:
    return datetime.now(UTC)


def select_available_api_keys(db: Session, *, now: datetime | None = None, limit: int | None = None) -> list[AIApiKey]:
    current_time = now or utc_now()
    stmt = (
        select(AIApiKey)
        .where(
            AIApiKey.is_active.is_(True),
            AIApiKey.deleted_at.is_(None),
            or_(AIApiKey.disabled_until.is_(None), AIApiKey.disabled_until <= current_time),
        )
        .order_by(
            AIApiKey.priority.asc(),
            nullsfirst(AIApiKey.last_error_at.asc()),
            AIApiKey.created_at.asc(),
        )
    )
    if limit is not None:
        stmt = stmt.limit(limit)
    return list(db.scalars(stmt))


def _plain_api_key(api_key_config: AIApiKey) -> str:
    if api_key_config.provider_type == AIProviderType.MOCK:
        return ""
    return decrypt_api_key(api_key_config.api_key_encrypted)


def _should_temporarily_disable(error: AIProviderError) -> bool:
    return error.error_type in {
        AIErrorType.AUTHENTICATION_ERROR,
        AIErrorType.QUOTA_EXCEEDED,
        AIErrorType.MODEL_NOT_FOUND,
        AIErrorType.RATE_LIMIT,
    }


def _record_provider_failure(
    db: Session,
    api_key_config: AIApiKey,
    error: AIProviderError,
    *,
    circuit_breaker_minutes: int,
) -> None:
    api_key_config.last_error_at = utc_now()
    if _should_temporarily_disable(error):
        api_key_config.disabled_until = utc_now() + timedelta(minutes=circuit_breaker_minutes)
    db.flush()


def _create_alert(
    db: Session,
    *,
    job_id: str | None,
    type_: str,
    severity: AIAlertSeverity,
    message: str,
    payload: dict[str, Any] | None = None,
) -> AIAlert:
    alert = AIAlert(
        job_id=job_id,
        type=type_,
        severity=severity,
        message=message,
        payload=payload,
    )
    db.add(alert)
    db.flush()
    return alert


def _sleep_before_retry(api_key_config: AIApiKey, attempt_index: int) -> None:
    base_delay = api_key_config.retry_backoff_seconds * (2 ** max(attempt_index - 1, 0))
    jitter = random.uniform(0, min(1.0, max(base_delay * 0.25, 0.0)))
    time.sleep(base_delay + jitter)


def generate_structured_with_fallback(
    db: Session,
    *,
    prompt: str,
    schema_hint: dict | None = None,
    job_id: str | None = None,
    circuit_breaker_minutes: int = 15,
) -> AIProviderExecutionResult:
    api_keys = select_available_api_keys(db)
    if not api_keys:
        _create_alert(
            db,
            job_id=job_id,
            type_="no_ai_api_key_available",
            severity=AIAlertSeverity.ERROR,
            message="Aucune cle IA active et disponible pour traiter le batch.",
        )
        raise AINoAvailableKeyError("no active AI API key is available")

    failures: list[AIFallbackFailure] = []
    fallback_count = 0

    for api_key_index, api_key_config in enumerate(api_keys):
        if api_key_index > 0:
            fallback_count += 1

        try:
            plain_key = _plain_api_key(api_key_config)
            provider = AIProviderFactory.build(api_key_config, plain_key)
        except AIConfigurationError as exc:
            failure = AIFallbackFailure(
                api_key_id=api_key_config.id,
                provider_type=str(api_key_config.provider_type),
                error_type=exc.error_type,
                message=str(exc),
                attempt_number=1,
            )
            failures.append(failure)
            _record_provider_failure(db, api_key_config, exc, circuit_breaker_minutes=circuit_breaker_minutes)
            continue

        max_attempts = api_key_config.max_retries + 1
        for attempt_number in range(1, max_attempts + 1):
            try:
                data = provider.generate_structured(prompt, schema_hint=schema_hint)
                api_key_config.last_used_at = utc_now()
                db.flush()
                return AIProviderExecutionResult(
                    data=data,
                    api_key_id=api_key_config.id,
                    provider_type=api_key_config.provider_type.value,
                    provider_name=provider.name,
                    attempts=attempt_number,
                    fallback_count=fallback_count,
                    model=getattr(provider, "model", None),
                )
            except AIProviderError as exc:
                failures.append(
                    AIFallbackFailure(
                        api_key_id=api_key_config.id,
                        provider_type=api_key_config.provider_type.value,
                        error_type=exc.error_type,
                        message=str(exc),
                        attempt_number=attempt_number,
                    )
                )
                _record_provider_failure(db, api_key_config, exc, circuit_breaker_minutes=circuit_breaker_minutes)
                if exc.fallback_immediately or not exc.retryable or attempt_number >= max_attempts:
                    break
                _sleep_before_retry(api_key_config, attempt_number)

    _create_alert(
        db,
        job_id=job_id,
        type_="all_ai_providers_failed",
        severity=AIAlertSeverity.ERROR,
        message="Toutes les cles IA disponibles ont echoue pendant le traitement.",
        payload={
            "failures": [
                {
                    "api_key_id": failure.api_key_id,
                    "provider_type": failure.provider_type,
                    "error_type": failure.error_type.value,
                    "message": failure.message[:500],
                    "attempt_number": failure.attempt_number,
                }
                for failure in failures
            ]
        },
    )
    raise AIAllProvidersFailedError(failures)
