from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from core.config import Settings, get_settings
from models import (
    DigestStatus,
    EmailAttemptStatus,
    EmailDigest,
    EmailDeliveryAttempt,
    Subscriber,
    SubscriberStatus,
    TokenPurpose,
)
from services.digest_builder_service import is_subscriber_eligible
from services.digest_template import (
    DigestEmailContext,
    DigestOfferView,
    render_digest_email,
)
from services.email.email_provider import EmailMessage, EmailProviderProtocol
from services.token_service import issue_token

"""Phase 2 du digest quotidien : envoi unitaire d'un EmailDigest.

Regles cles (prompt_send_offres_email.md):
- dernier controle d'eligibilite: abonne inactif => digest `cancelled`;
- le digest passe en `sending` avant l'appel provider;
- chaque tentative est tracee dans EmailDeliveryAttempt (attempt_no 1..3);
- retry UNIQUEMENT sur erreurs retentables (timeout, 429, 5xx): la decision
  de relance Celery appartient a la tache, ce service ne fait qu'un essai
  par appel et renvoie un resultat exploitable;
- succes => status=sent + sent_at + Subscriber.last_email_sent_at;
- echec definitif (3 tentatives consommees ou erreur non retentable) => failed.
"""

logger = logging.getLogger(__name__)

CANCEL_REASON_UNSUBSCRIBED = "subscriber_unsubscribed"
CANCEL_REASON_INELIGIBLE = "subscriber_ineligible"


@dataclass(slots=True)
class DigestSendOutcome:
    """Resultat normalise d'une tentative d'envoi unitaire."""

    digest_id: str
    success: bool
    status: str
    attempt_no: int
    retryable: bool = False
    error_message: str | None = None


def _next_attempt_no(db: Session, digest_id: str) -> int:
    last_attempt_no = db.scalar(
        select(EmailDeliveryAttempt.attempt_no)
        .where(EmailDeliveryAttempt.digest_id == digest_id)
        .order_by(EmailDeliveryAttempt.attempt_no.desc())
        .limit(1)
    )
    return (last_attempt_no or 0) + 1


def _build_offer_view(digest_offer_link: object, *, public_base_url: str) -> DigestOfferView:
    offer = digest_offer_link.offer
    base_url = public_base_url.rstrip("/")
    company = getattr(offer, "company", None)
    location = getattr(offer, "location", None)
    contract = getattr(offer, "contract_type", None)
    experience = getattr(offer, "experience_level", None)
    filiere = getattr(offer, "primary_filiere", None)
    published_at = getattr(offer, "published_at", None)
    offer_id = str(getattr(offer, "id", ""))
    source_url = getattr(offer, "source_url", None)
    return DigestOfferView(
        title=getattr(offer, "title", "") or "",
        company_name=getattr(company, "name", "") if company else "",
        location_label=getattr(location, "label", None) if location else None,
        contract_label=getattr(contract, "label", None) if contract else None,
        experience_label=getattr(experience, "label", None) if experience else None,
        filiere_label=getattr(filiere, "label", None) if filiere else None,
        published_at_str=published_at.strftime("%d/%m/%Y") if published_at else None,
        # Lien canonique vers la fiche publique; fallback vers la source.
        offer_url=f"{base_url}/offres/{offer_id}",
        source_url=source_url,
        # Tracabilite cascade T0-T5 (cf. tranche 4.2).
        match_kind=getattr(digest_offer_link, "match_kind", "primary") or "primary",
    )


def _cancel_digest(db: Session, digest: EmailDigest, reason: str) -> DigestSendOutcome:
    digest.status = DigestStatus.CANCELLED
    digest.skipped_reason = reason
    db.flush()
    return DigestSendOutcome(
        digest_id=digest.id,
        success=False,
        status=DigestStatus.CANCELLED.value,
        attempt_no=0,
        retryable=False,
        error_message=reason,
    )


def send_digest_now(
    db: Session,
    *,
    digest_id: str,
    provider: EmailProviderProtocol,
    settings: Settings | None = None,
    now: datetime | None = None,
) -> "DigestSendOutcome":
    """Une tentative d'envoi du digest. Ne decide pas du retry elle-meme.

    La tache Celery appelle cette fonction jusqu'a EMAIL_MAX_RETRIES fois en
    cas d'echec `retryable`, avec backoff; chaque appel trace une ligne
    EmailDeliveryAttempt (attempt_no strictement croissant).
    """

    resolved_settings = settings or get_settings()
    effective_now = now or datetime.now(timezone.utc)

    digest = db.scalar(
        select(EmailDigest)
        .options(
            selectinload(EmailDigest.offer_links).selectinload("*"),
            selectinload(EmailDigest.subscriber),
        )
        .where(EmailDigest.id == digest_id)
    )
    if digest is None:
        return DigestSendOutcome(
            digest_id=digest_id,
            success=False,
            status="missing",
            attempt_no=0,
            error_message="digest introuvable",
        )
    if digest.status != DigestStatus.QUEUED:
        return DigestSendOutcome(
            digest_id=digest.id,
            success=False,
            status=digest.status.value,
            attempt_no=0,
            error_message=f"statut {digest.status.value} != queued",
        )

    subscriber: Subscriber | None = digest.subscriber
    if (
        subscriber is None
        or subscriber.status == SubscriberStatus.UNSUBSCRIBED
        or not is_subscriber_eligible(subscriber, now=effective_now)
    ):
        reason = (
            CANCEL_REASON_UNSUBSCRIBED
            if subscriber is not None and subscriber.status == SubscriberStatus.UNSUBSCRIBED
            else CANCEL_REASON_INELIGIBLE
        )
        logger.info("Digest annule (digest_id=%s, raison=%s)", digest.id, reason)
        return _cancel_digest(db, digest, reason)

    attempt_no = _next_attempt_no(db, digest.id)
    if attempt_no > resolved_settings.email_max_retries:
        digest.status = DigestStatus.FAILED
        db.flush()
        return DigestSendOutcome(
            digest_id=digest.id,
            success=False,
            status=DigestStatus.FAILED.value,
            attempt_no=attempt_no - 1,
            retryable=False,
            error_message="nombre maximum de tentatives atteint",
        )

    attempt = EmailDeliveryAttempt(
        digest_id=digest.id,
        attempt_no=attempt_no,
        status=EmailAttemptStatus.PENDING,
        provider=resolved_settings.email_provider,
        started_at=effective_now,
    )
    db.add(attempt)

    digest.status = DigestStatus.SENDING
    db.flush()

    offers = [
        _build_offer_view(link, public_base_url=resolved_settings.public_base_url)
        for link in digest.offer_links
    ]

    # Split primary / secondary pour le template 2 sections (tranche 4.2).
    # Le scoring canonique a deja classe les offres par pertinence, donc on
    # preserve l'ordre dans chaque split. Si tout est primary (T0 strict),
    # la liste secondary est vide et la section "Pourrait aussi vous
    # interesser" n'est pas affichee (cf. digest_template.render_digest_email).
    primary_offers = [v for v in offers if v.match_kind == "primary"]
    secondary_offers = [v for v in offers if v.match_kind != "primary"]

    # Liens signes: tokens generes/haches via services.token_service (jamais
    # stockes en clair). manage_alert reste reutilisable tant qu'il n'est pas
    # revoque; unsubscribe est a usage unique (marque used a la desinscription).
    _, manage_raw_token = issue_token(
        db,
        subscriber=subscriber,
        purpose=TokenPurpose.MANAGE_ALERT,
        ttl_hours=None,
        revoke_existing=False,
    )
    _, unsubscribe_raw_token = issue_token(
        db,
        subscriber=subscriber,
        purpose=TokenPurpose.UNSUBSCRIBE,
        ttl_hours=None,
        revoke_existing=True,
    )
    manage_base = resolved_settings.public_base_url.rstrip("/")
    context = DigestEmailContext(
        full_name=subscriber.full_name,
        email=subscriber.email,
        digest_date_str=digest.digest_date.strftime("%d/%m/%Y"),
        offers=offers,  # retrocompat: liste complete
        primary_offers=primary_offers,
        secondary_offers=secondary_offers,
        manage_preferences_url=f"{manage_base}/preferences/{manage_raw_token}",
        unsubscribe_url=f"{manage_base}/desinscription/{unsubscribe_raw_token}",
        support_email=resolved_settings.support_email,
        daily_tip=(
            "Postulez dans les 48h : les recruteurs traitent d'abord les candidatures recentes."
            if subscriber.wants_career_tips
            else None
        ),
    )
    subject, html, text = render_digest_email(context)

    message = EmailMessage(
        to_email=subscriber.email,
        subject=subject,
        html=html,
        text=text,
    )
    result = provider.send(message)

    finished_at = datetime.now(timezone.utc)
    attempt.status = EmailAttemptStatus.SUCCESS if result.success else EmailAttemptStatus.FAILED
    attempt.provider_message_id = result.provider_email_id
    attempt.finished_at = finished_at
    attempt.error_message = result.error_message

    if result.success:
        digest.status = DigestStatus.SENT
        digest.sent_at = finished_at
        subscriber.last_email_sent_at = finished_at
        db.flush()
        logger.info("Digest envoye (digest_id=%s, tentative=%s)", digest.id, attempt_no)
        return DigestSendOutcome(
            digest_id=digest.id,
            success=True,
            status=DigestStatus.SENT.value,
            attempt_no=attempt_no,
        )

    attempts_exhausted = attempt_no >= resolved_settings.email_max_retries
    retryable = bool(result.retryable) and not attempts_exhausted
    if not result.retryable or attempts_exhausted:
        digest.status = DigestStatus.FAILED
    else:
        # Retour en queued pour permettre la relance par la tache Celery.
        digest.status = DigestStatus.QUEUED
    db.flush()
    logger.warning(
        "Echec envoi digest (digest_id=%s, tentative=%s/%s, retentable=%s): %s",
        digest.id,
        attempt_no,
        resolved_settings.email_max_retries,
        result.retryable,
        result.error_message,
    )
    return DigestSendOutcome(
        digest_id=digest.id,
        success=False,
        status=digest.status.value,
        attempt_no=attempt_no,
        retryable=retryable,
        error_message=result.error_message,
    )


__all__ = [
    "CANCEL_REASON_INELIGIBLE",
    "CANCEL_REASON_UNSUBSCRIBED",
    "DigestSendOutcome",
    "send_digest_now",
]
