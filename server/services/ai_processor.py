from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class AIProcessingResult:
    data: dict
    status: str
    provider: str | None = None
    model: str | None = None
    confidence: float | None = None
    error: str | None = None


class AIProcessorProtocol(Protocol):
    def process_offer(self, offer_data: dict) -> AIProcessingResult:
        ...


class NoopAIProcessor:
    """Processeur remplaçable qui ne fait aucun appel IA externe."""

    def process_offer(self, offer_data: dict) -> AIProcessingResult:
        return AIProcessingResult(
            data=offer_data,
            status="noop",
            provider=None,
            model=None,
            confidence=None,
            error=None,
        )


def get_ai_processor() -> AIProcessorProtocol:
    return NoopAIProcessor()
