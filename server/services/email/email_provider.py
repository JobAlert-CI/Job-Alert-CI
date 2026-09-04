from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

"""Interface commune a tous les fournisseurs d'emails transactionnels.

Isoler ce contrat de l'implementation Resend permet d'injecter un mock via
FastAPI `Depends()` dans les tests (voir Phase 2), sans dependre d'un vrai
appel HTTP ni d'une cle API.
"""


@dataclass(slots=True)
class EmailMessage:
    """Message pret a etre envoye, independant du provider."""

    to_email: str
    subject: str
    html: str
    text: str
    headers: dict[str, str] | None = None


@dataclass(slots=True)
class EmailSendResult:
    """Resultat normalise d'une tentative d'envoi, quel que soit le provider.

    `retryable` indique si l'erreur justifie une nouvelle tentative (timeout,
    429, 5xx) ou si elle est definitive (401, domaine non verifie, 4xx non
    retentable) — la tache Celery de la Phase 2 s'appuiera dessus pour
    decider du retry avec backoff exponentiel.
    """

    success: bool
    provider: str
    provider_email_id: str | None = None
    error_message: str | None = None
    raw_response: dict[str, Any] | None = None
    status_code: int | None = None
    retryable: bool = False


class EmailProviderProtocol(Protocol):
    """Contrat minimal: envoyer un message, recevoir un resultat normalise."""

    def send(self, message: EmailMessage) -> EmailSendResult: ...
