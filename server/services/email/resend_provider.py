from __future__ import annotations

import logging
from typing import Any

import httpx

from core.config import Settings, get_settings
from services.email.email_provider import EmailMessage, EmailProviderProtocol, EmailSendResult

"""Implementation Resend de EmailProviderProtocol.

Un appel HTTP simple via `httpx` suffit (pas de SDK Resend obligatoire). La
tache Celery de la Phase 2 gere le retry/backoff a partir du flag
`EmailSendResult.retryable`; ce module se contente d'un appel unique et
classe l'erreur.

Regles de securite:
- la cle API n'est jamais loguee, jamais mise dans `raw_response` ou
  `error_message` (Resend ne la renvoie pas dans ses reponses d'erreur);
- aucune reponse API de ce module n'expose la cle API.
"""

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


class ResendEmailProvider:
    """Envoie un `EmailMessage` via l'API HTTP de Resend."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        from_address: str | None = None,
        from_name: str | None = None,
        timeout_seconds: float | None = None,
        settings: Settings | None = None,
    ) -> None:
        resolved_settings = settings or get_settings()
        self._api_key = api_key if api_key is not None else resolved_settings.resend_api_key
        self._from_address = from_address or resolved_settings.email_from_address
        self._from_name = from_name or resolved_settings.email_from_name
        self._timeout_seconds = (
            timeout_seconds if timeout_seconds is not None else resolved_settings.resend_timeout_seconds
        )

    @property
    def _from_header(self) -> str:
        return f"{self._from_name} <{self._from_address}>"

    def send(self, message: EmailMessage) -> EmailSendResult:
        if not self._api_key:
            logger.error("Resend: cle API absente, envoi annule (to=%s)", message.to_email)
            return EmailSendResult(
                success=False,
                provider="resend",
                error_message="Cle API Resend non configuree",
                retryable=False,
            )

        payload: dict[str, Any] = {
            "from": self._from_header,
            "to": [message.to_email],
            "subject": message.subject,
            "html": message.html,
            "text": message.text,
        }
        if message.headers:
            payload["headers"] = message.headers

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

        try:
            response = httpx.post(RESEND_API_URL, json=payload, headers=headers, timeout=self._timeout_seconds)
        except httpx.TimeoutException:
            logger.warning("Resend: timeout reseau (to=%s)", message.to_email)
            return EmailSendResult(
                success=False, provider="resend", error_message="Timeout reseau vers Resend", retryable=True
            )
        except httpx.RequestError as exc:
            logger.warning("Resend: erreur reseau %s (to=%s)", type(exc).__name__, message.to_email)
            return EmailSendResult(
                success=False, provider="resend", error_message="Erreur reseau vers Resend", retryable=True
            )

        return self._build_result(response, message)

    def _build_result(self, response: httpx.Response, message: EmailMessage) -> EmailSendResult:
        body: dict[str, Any] | None
        try:
            parsed = response.json()
            body = parsed if isinstance(parsed, dict) else None
        except ValueError:
            body = None

        if response.status_code in (200, 201):
            provider_email_id = body.get("id") if body else None
            return EmailSendResult(
                success=True,
                provider="resend",
                provider_email_id=provider_email_id,
                raw_response=body,
                status_code=response.status_code,
            )

        # 401 (cle invalide) et 403 (domaine non verifie): pas de retry.
        # 429 (rate limit) et 5xx (erreur serveur Resend): retry avec backoff.
        retryable = response.status_code == 429 or response.status_code >= 500
        error_message = self._extract_error_message(body, response)

        log_fn = logger.warning if retryable else logger.error
        log_fn("Resend: envoi echoue status=%s (to=%s)", response.status_code, message.to_email)

        return EmailSendResult(
            success=False,
            provider="resend",
            error_message=error_message,
            raw_response=body,
            status_code=response.status_code,
            retryable=retryable,
        )

    @staticmethod
    def _extract_error_message(body: dict[str, Any] | None, response: httpx.Response) -> str:
        if body:
            message = body.get("message") or body.get("error")
            if message:
                return str(message)
        return f"Resend a repondu avec le statut {response.status_code}"


def get_email_provider() -> EmailProviderProtocol:
    """Dependance FastAPI: fournit le provider email configure.

    Utilisation: `provider: EmailProviderProtocol = Depends(get_email_provider)`.
    Facilement remplacable par un mock via `app.dependency_overrides` dans les
    tests (Phase 2), sans jamais appeler la vraie API Resend.
    """

    settings = get_settings()
    if settings.email_provider != "resend":
        raise RuntimeError(f"Fournisseur email non supporte: {settings.email_provider}")
    return ResendEmailProvider(settings=settings)
