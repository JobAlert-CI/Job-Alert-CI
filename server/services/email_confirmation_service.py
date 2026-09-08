from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import Settings, get_settings
from models import (
    Subscriber,
    SubscriberStatus,
    TokenPurpose,
    TransactionalEmailEvent,
    TransactionalEmailPurpose,
    TransactionalEmailStatus,
)
from schemas.subscriptions import SubscriberCreate
from services.email.email_provider import EmailMessage, EmailProviderProtocol, EmailSendResult
from services.email.rate_limit import RateLimitDecision, check_resend_quota
from services.email.templates import build_confirmation_context, render_confirmation_email
from services.site_settings_service import get_confirmation_subject, resolve_runtime_settings
from services.subscriptions import CreatedToken, create_subscriber
from services.token_service import (
    TokenAlreadyUsedError,
    TokenExpiredError,
    TokenNotFoundError,
    TokenRevokedError,
    issue_confirmation_token,
    mark_token_used,
    validate_token,
)

"""Orchestration du flux de confirmation d'email.

Ce module contient toute la logique metier: les routes FastAPI (api/v1/public/
subscriptions.py) se contentent de traduire les exceptions en codes HTTP et la
tache Celery (tasks/emails.py) de gerer le retry.

Regles retenues par statut d'abonne (cahier des charges, cas 1 a 4):

| statut existant        | comportement de POST /api/subscriptions                        |
|------------------------|----------------------------------------------------------------|
| aucun (nouvel email)   | creation `pending` + token + email de confirmation             |
| `pending`              | pas de doublon, anciens tokens revoques, email renvoye         |
| `active` / `paused`    | pas de doublon, aucun email, reponse "deja confirme"           |
| `unsubscribed`         | re-inscription autorisee, repasse par une confirmation         |
| `bounced`              | refus (409): l'adresse rebondit, une action admin est requise  |
| soft-deleted           | traite comme un nouvel email (le soft delete est annule)       |

Securite:
- le token brut ne circule qu'en memoire et dans l'URL de l'email;
- `request_payload` du journal ne contient ni cle API, ni token, ni HTML;
- aucune reponse API ne permet de savoir si un email est inscrit (renvoi).
"""

logger = logging.getLogger(__name__)

MESSAGE_CONFIRMATION_SENT = "Un email de confirmation vient de vous être envoyé. Vérifiez votre boîte de réception."
MESSAGE_CONFIRMATION_RESENT = "Un email de confirmation a été renvoyé."
MESSAGE_ALREADY_CONFIRMED = "Cette adresse email est déjà confirmée."
MESSAGE_GENERIC_RESEND = (
    "Si votre compte existe et est en attente de confirmation, un email de confirmation vous a été envoyé."
)
MESSAGE_CONFIRMED = "Inscription confirmée"


class EmailConfirmationError(Exception):
    """Erreur metier portant le code HTTP a renvoyer par la route."""

    status_code = 400

    def __init__(self, detail: str, *, status_code: int | None = None) -> None:
        self.detail = detail
        if status_code is not None:
            self.status_code = status_code
        super().__init__(detail)


class InvalidConfirmationTokenError(EmailConfirmationError):
    status_code = 400


class ExpiredConfirmationTokenError(EmailConfirmationError):
    status_code = 410


class SubscriptionRefusedError(EmailConfirmationError):
    status_code = 409


class ResendRateLimitedError(EmailConfirmationError):
    status_code = 429

    def __init__(self, detail: str, *, retry_after_seconds: int | None = None) -> None:
        self.retry_after_seconds = retry_after_seconds
        super().__init__(detail)


@dataclass(slots=True)
class PendingConfirmationEmail:
    """Envoi prepare en base, en attente d'etre pousse dans Celery.

    Cree AVANT le commit de la transaction HTTP; `dispatch_confirmation_email`
    doit etre appele APRES le commit pour que le worker retrouve bien le token
    et l'evenement en base.
    """

    subscriber_id: str
    raw_token: str
    event_id: str
    purpose: TransactionalEmailPurpose


@dataclass(slots=True)
class SubscriptionRegistration:
    subscriber: Subscriber
    requires_confirmation: bool
    message: str | None
    pending: PendingConfirmationEmail | None = None
    # Audit P1 #21: la valeur brute du MANAGE_ALERT est exposee pour que
    # l'appelant puisse batir /preferences/{token}.
    manage_alert_token: CreatedToken | None = None


@dataclass(slots=True)
class ConfirmationOutcome:
    email: str
    message: str = MESSAGE_CONFIRMED
    already_confirmed: bool = False


@dataclass(slots=True)
class ResendOutcome:
    message: str
    email: str | None
    pending: PendingConfirmationEmail | None = None


# ─── Journalisation des envois ───────────────────────────────────────────


def create_queued_event(
    db: Session,
    *,
    subscriber: Subscriber,
    purpose: TransactionalEmailPurpose,
    settings: Settings | None = None,
) -> TransactionalEmailEvent:
    """Cree l'evenement `queued` du journal transactionnel (sans commit)."""

    resolved = settings or get_settings()
    event = TransactionalEmailEvent(
        subscriber_id=subscriber.id,
        purpose=purpose,
        to_email=subscriber.email,
        provider=resolved.email_provider,
        status=TransactionalEmailStatus.QUEUED,
        attempts=0,
        # Jamais de cle API ni de token brut ici: seulement le contexte utile au debug.
        request_payload={"purpose": str(purpose), "from": resolved.email_from_address},
    )
    db.add(event)
    db.flush()
    return event


def _record_attempt(
    db: Session,
    event: TransactionalEmailEvent | None,
    result: EmailSendResult,
) -> None:
    if event is None:
        return
    event.attempts = (event.attempts or 0) + 1
    event.provider = result.provider
    if result.success:
        event.status = TransactionalEmailStatus.SENT
        event.provider_email_id = result.provider_email_id
        event.last_error = None
    else:
        event.status = TransactionalEmailStatus.FAILED
        event.last_error = result.error_message
    event.response_payload = {
        "status_code": result.status_code,
        "retryable": result.retryable,
        "body": result.raw_response,
    }


# ─── Preparation / envoi ─────────────────────────────────────────────────


def prepare_confirmation_email(
    db: Session,
    subscriber: Subscriber,
    *,
    purpose: TransactionalEmailPurpose = TransactionalEmailPurpose.CONFIRM_EMAIL,
    settings: Settings | None = None,
) -> PendingConfirmationEmail:
    """Emet un token de confirmation frais et journalise l'envoi a venir.

    Les anciens tokens `confirm_email` non utilises sont revoques (usage unique
    + un seul lien valide a la fois). Aucun commit: l'appelant reste maitre de
    sa transaction.
    """

    _, raw_token = issue_confirmation_token(db, subscriber, revoke_existing=True)
    event = create_queued_event(db, subscriber=subscriber, purpose=purpose, settings=settings)
    return PendingConfirmationEmail(
        subscriber_id=subscriber.id,
        raw_token=raw_token,
        event_id=event.id,
        purpose=purpose,
    )


def dispatch_confirmation_email(pending: PendingConfirmationEmail) -> None:
    """Pousse l'envoi dans Celery, sans jamais casser la reponse HTTP.

    Si le broker est injoignable, on retombe sur un envoi synchrone best-effort
    (le journal reste la source de verite: l'evenement restera `queued` si rien
    n'aboutit, et l'abonne pourra demander un renvoi).
    """

    from tasks.emails import send_confirmation_email_task

    payload = {
        "subscriber_id": pending.subscriber_id,
        "raw_token": pending.raw_token,
        "event_id": pending.event_id,
        "purpose": str(pending.purpose),
    }
    try:
        send_confirmation_email_task.apply_async(kwargs=payload, queue="emails")
        return
    except Exception:
        logger.warning("Broker Celery injoignable: envoi de confirmation en mode synchrone")

    try:
        send_confirmation_email_task(**payload)
    except Exception:
        logger.exception("Envoi synchrone de l'email de confirmation impossible")


def send_confirmation_email_now(
    db: Session,
    *,
    subscriber_id: str,
    raw_token: str,
    provider: EmailProviderProtocol,
    event_id: str | None = None,
    purpose: TransactionalEmailPurpose = TransactionalEmailPurpose.CONFIRM_EMAIL,
    settings: Settings | None = None,
) -> EmailSendResult:
    """Rend le template, envoie via le provider et journalise le resultat.

    Utilise par la tache Celery (et par le fallback synchrone). Ne commit pas:
    la tache utilise `session_scope()`.
    """

    resolved = settings or get_settings()
    event = db.get(TransactionalEmailEvent, event_id) if event_id else None
    subscriber = db.scalar(select(Subscriber).where(Subscriber.id == subscriber_id))

    if subscriber is None or subscriber.deleted_at is not None:
        result = EmailSendResult(
            success=False,
            provider=resolved.email_provider,
            error_message="Abonné introuvable ou supprimé",
            retryable=False,
        )
        _record_attempt(db, event, result)
        return result

    if subscriber.status in (SubscriberStatus.BOUNCED, SubscriberStatus.DELETED):
        result = EmailSendResult(
            success=False,
            provider=resolved.email_provider,
            error_message=f"Envoi bloqué: abonné en statut {subscriber.status}",
            retryable=False,
        )
        _record_attempt(db, event, result)
        return result

    context = build_confirmation_context(
        email=subscriber.email,
        full_name=subscriber.full_name,
        raw_token=raw_token,
        settings=resolved,
    )
    # Cycle 18 : sujet pilotable depuis /admin/parametres (cle
    # email_confirmation_subject) — fallback constante sinon.
    rendered = render_confirmation_email(context, subject=get_confirmation_subject(db))
    result = provider.send(
        EmailMessage(
            to_email=subscriber.email,
            subject=rendered.subject,
            html=rendered.html,
            text=rendered.text,
            headers={"X-Entity-Ref-ID": str(event.id) if event else subscriber.id},
        )
    )

    if result.success:
        subscriber.last_email_sent_at = datetime.now(UTC)

    _record_attempt(db, event, result)
    return result


# ─── Inscription ─────────────────────────────────────────────────────────


def _is_confirmed(subscriber: Subscriber) -> bool:
    return subscriber.confirmed_at is not None and subscriber.status in (
        SubscriberStatus.ACTIVE,
        SubscriberStatus.PAUSED,
    )


def register_subscriber(
    db: Session,
    payload: SubscriberCreate,
    *,
    settings: Settings | None = None,
) -> SubscriptionRegistration:
    """Inscription (POST /api/subscriptions) avec confirmation d'email.

    Ne cree jamais de doublon: `email_normalized` reste la cle fonctionnelle.
    """
    # Cycle 18 : parametres admin (site_settings) > environnnement — la
    # confirmation requise est pilotable depuis /admin/parametres.
    resolved = settings or resolve_runtime_settings(db)
    email_normalized = payload.email.strip().lower()
    existing = db.scalar(select(Subscriber).where(Subscriber.email_normalized == email_normalized))

    was_soft_deleted = existing is not None and existing.deleted_at is not None
    prior_status = existing.status if existing is not None and not was_soft_deleted else None
    already_confirmed = existing is not None and not was_soft_deleted and _is_confirmed(existing)

    if prior_status == SubscriberStatus.BOUNCED:
        raise SubscriptionRefusedError(
            "Cette adresse email a rebondi lors de précédents envois. Contactez le support pour la réactiver."
        )

    confirmation_required = resolved.email_confirmation_required and not already_confirmed
    subscriber, manage_alert_token = create_subscriber(
        db, payload, confirmation_required=confirmation_required
    )

    if not confirmation_required:
        message = MESSAGE_ALREADY_CONFIRMED if already_confirmed else None
        return SubscriptionRegistration(
            subscriber=subscriber,
            requires_confirmation=False,
            message=message,
            manage_alert_token=manage_alert_token,
        )

    purpose = (
        TransactionalEmailPurpose.RESEND_CONFIRMATION
        if prior_status == SubscriberStatus.PENDING
        else TransactionalEmailPurpose.CONFIRM_EMAIL
    )
    pending = prepare_confirmation_email(db, subscriber, purpose=purpose, settings=resolved)
    db.commit()
    db.refresh(subscriber)

    message = MESSAGE_CONFIRMATION_RESENT if purpose == TransactionalEmailPurpose.RESEND_CONFIRMATION else MESSAGE_CONFIRMATION_SENT
    return SubscriptionRegistration(
        subscriber=subscriber,
        requires_confirmation=True,
        message=message,
        pending=pending,
        manage_alert_token=manage_alert_token,
    )


# ─── Confirmation ────────────────────────────────────────────────────────


def confirm_email(db: Session, raw_token: str) -> ConfirmationOutcome:
    """Consomme un token `confirm_email` et active l'abonne.

    Idempotent: si le token a deja ete utilise (ou revoque) et que l'abonne est
    deja actif, on renvoie un succes plutot qu'une erreur.
    """

    try:
        token = validate_token(db, raw_token, purpose=TokenPurpose.CONFIRM_EMAIL)
    except TokenNotFoundError as exc:
        raise InvalidConfirmationTokenError("Lien de confirmation invalide.") from exc
    except TokenExpiredError as exc:
        raise ExpiredConfirmationTokenError(
            "Le lien de confirmation a expiré. Veuillez demander un nouvel email."
        ) from exc
    except (TokenAlreadyUsedError, TokenRevokedError) as exc:
        subscriber = db.scalar(select(Subscriber).where(Subscriber.id == exc.token.subscriber_id))
        if subscriber is not None and subscriber.deleted_at is None and _is_confirmed(subscriber):
            return ConfirmationOutcome(email=subscriber.email, already_confirmed=True)
        if isinstance(exc, TokenAlreadyUsedError):
            raise InvalidConfirmationTokenError("Ce lien de confirmation a déjà été utilisé.") from exc
        raise InvalidConfirmationTokenError(
            "Ce lien de confirmation n'est plus valide. Un email plus récent vous a été envoyé."
        ) from exc

    subscriber = db.scalar(select(Subscriber).where(Subscriber.id == token.subscriber_id))
    if subscriber is None or subscriber.deleted_at is not None:
        raise InvalidConfirmationTokenError("Abonné introuvable.")
    if subscriber.status in (SubscriberStatus.BOUNCED, SubscriberStatus.DELETED):
        raise SubscriptionRefusedError("Ce compte ne peut pas être confirmé. Contactez le support.")

    now = datetime.now(UTC)
    mark_token_used(db, token, now=now)
    if subscriber.confirmed_at is None:
        subscriber.confirmed_at = now
    if subscriber.status == SubscriberStatus.PENDING:
        subscriber.status = SubscriberStatus.ACTIVE
    db.commit()

    logger.info("Email confirme (subscriber_id=%s)", subscriber.id)
    return ConfirmationOutcome(email=subscriber.email)


# ─── Renvoi ──────────────────────────────────────────────────────────────


def resend_confirmation(
    db: Session,
    email: str,
    *,
    client_ip: str | None = None,
    settings: Settings | None = None,
) -> ResendOutcome:
    """Renvoie l'email de confirmation, sans permettre l'enumeration d'emails.

    La reponse est volontairement identique pour un email inconnu et pour un
    email en attente de confirmation.
    """

    resolved = settings or get_settings()
    email_normalized = email.strip().lower()
    subscriber = db.scalar(
        select(Subscriber).where(Subscriber.email_normalized == email_normalized, Subscriber.deleted_at.is_(None))
    )

    if subscriber is None:
        return ResendOutcome(message=MESSAGE_GENERIC_RESEND, email=email_normalized)

    if _is_confirmed(subscriber):
        return ResendOutcome(message=MESSAGE_ALREADY_CONFIRMED, email=subscriber.email)

    if subscriber.status in (
        SubscriberStatus.BOUNCED,
        SubscriberStatus.DELETED,
        SubscriberStatus.UNSUBSCRIBED,
    ):
        # Regle retenue: aucun envoi automatique. Une re-inscription explicite
        # via POST /api/subscriptions est necessaire (unsubscribed), ou une
        # action admin (bounced / deleted).
        return ResendOutcome(message=MESSAGE_GENERIC_RESEND, email=email_normalized)

    decision: RateLimitDecision = check_resend_quota(
        email_normalized,
        client_ip=client_ip,
        last_email_sent_at=subscriber.last_email_sent_at,
    )
    if not decision.allowed:
        raise ResendRateLimitedError(
            "Trop de demandes de renvoi. Merci de patienter avant de réessayer.",
            retry_after_seconds=decision.retry_after_seconds,
        )

    pending = prepare_confirmation_email(
        db,
        subscriber,
        purpose=TransactionalEmailPurpose.RESEND_CONFIRMATION,
        settings=resolved,
    )
    db.commit()
    return ResendOutcome(message=MESSAGE_GENERIC_RESEND, email=email_normalized, pending=pending)


__all__ = [
    "MESSAGE_ALREADY_CONFIRMED",
    "MESSAGE_CONFIRMATION_RESENT",
    "MESSAGE_CONFIRMATION_SENT",
    "MESSAGE_CONFIRMED",
    "MESSAGE_GENERIC_RESEND",
    "ConfirmationOutcome",
    "EmailConfirmationError",
    "ExpiredConfirmationTokenError",
    "InvalidConfirmationTokenError",
    "PendingConfirmationEmail",
    "ResendOutcome",
    "ResendRateLimitedError",
    "SubscriptionRefusedError",
    "SubscriptionRegistration",
    "confirm_email",
    "create_queued_event",
    "dispatch_confirmation_email",
    "prepare_confirmation_email",
    "register_subscriber",
    "resend_confirmation",
    "send_confirmation_email_now",
]
