from __future__ import annotations

import logging

from celery_app import celery_app
from core.config import get_settings
from db.session import session_scope
from models import TransactionalEmailPurpose
from services.email.resend_provider import get_email_provider
from services.email_confirmation_service import send_confirmation_email_now

"""Envoi asynchrone des emails transactionnels de confirmation.

L'envoi ne bloque jamais la reponse HTTP: la route emet le token, journalise un
evenement `queued` puis publie cette tache.

Retry: 3 tentatives max (`EMAIL_MAX_RETRIES`), backoff exponentiel
(`EMAIL_RETRY_BACKOFF_SECONDS` * 2**tentative) avec jitter Celery, uniquement
quand le provider signale une erreur retentable (timeout, 429, 5xx, erreur
reseau). Les erreurs definitives (cle API invalide, domaine non verifie, payload
invalide, abonne bounced/supprime) ne sont jamais retentees: l'evenement est
marque `failed` avec son `last_error`.
"""

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="tasks.emails.send_confirmation_email_task",
    acks_late=True,
    max_retries=None,  # borne reelle geree ci-dessous via EMAIL_MAX_RETRIES
)
def send_confirmation_email_task(
    self,
    subscriber_id: str,
    raw_token: str,
    event_id: str | None = None,
    purpose: str = str(TransactionalEmailPurpose.CONFIRM_EMAIL),
) -> dict[str, object]:
    """Envoie l'email de confirmation a un abonne.

    `raw_token` n'est jamais journalise: il ne sert qu'a construire l'URL.
    """

    settings = get_settings()
    provider = get_email_provider()

    try:
        resolved_purpose = TransactionalEmailPurpose(purpose)
    except ValueError:
        resolved_purpose = TransactionalEmailPurpose.CONFIRM_EMAIL

    with session_scope() as db:
        result = send_confirmation_email_now(
            db,
            subscriber_id=subscriber_id,
            raw_token=raw_token,
            provider=provider,
            event_id=event_id,
            purpose=resolved_purpose,
            settings=settings,
        )

    if result.success:
        logger.info("Email de confirmation envoye (subscriber_id=%s)", subscriber_id)
        return {"success": True, "provider_email_id": result.provider_email_id}

    attempts_done = self.request.retries + 1
    max_attempts = max(settings.email_max_retries, 1)

    if result.retryable and attempts_done < max_attempts:
        countdown = settings.email_retry_backoff_seconds * (2**self.request.retries)
        logger.warning(
            "Email de confirmation en echec retentable (subscriber_id=%s, tentative=%s/%s), retry dans %ss",
            subscriber_id,
            attempts_done,
            max_attempts,
            countdown,
        )
        raise self.retry(countdown=countdown)

    logger.error(
        "Email de confirmation abandonne (subscriber_id=%s, tentatives=%s): %s",
        subscriber_id,
        attempts_done,
        result.error_message,
    )
    return {"success": False, "error": result.error_message, "attempts": attempts_done}


__all__ = ["send_confirmation_email_task"]
