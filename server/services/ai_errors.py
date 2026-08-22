from __future__ import annotations

from dataclasses import dataclass

from models.enums import AIErrorType


class AIProviderError(Exception):
    """Erreur normalisee d'un fournisseur IA."""

    def __init__(
        self,
        message: str,
        *,
        error_type: AIErrorType = AIErrorType.UNKNOWN_ERROR,
        retryable: bool = True,
        fallback_immediately: bool = False,
        status_code: int | None = None,
    ) -> None:
        super().__init__(message)
        self.error_type = error_type
        self.retryable = retryable
        self.fallback_immediately = fallback_immediately
        self.status_code = status_code


class AIConfigurationError(AIProviderError):
    """Erreur locale de configuration, sans retry fournisseur."""

    def __init__(self, message: str) -> None:
        super().__init__(message, retryable=False, fallback_immediately=True)


class AIResponseValidationError(AIProviderError):
    """La reponse fournisseur ne correspond pas au contrat JSON attendu."""

    def __init__(self, message: str) -> None:
        super().__init__(
            message,
            error_type=AIErrorType.INVALID_JSON_RESPONSE,
            retryable=True,
            fallback_immediately=False,
        )


@dataclass(frozen=True)
class AIFallbackFailure:
    api_key_id: str | None
    provider_type: str | None
    error_type: AIErrorType
    message: str
    attempt_number: int


class AINoAvailableKeyError(AIConfigurationError):
    pass


class AIAllProvidersFailedError(AIProviderError):
    def __init__(self, failures: list[AIFallbackFailure]) -> None:
        super().__init__(
            "all configured AI providers failed",
            error_type=failures[-1].error_type if failures else AIErrorType.UNKNOWN_ERROR,
            retryable=False,
            fallback_immediately=False,
        )
        self.failures = failures
