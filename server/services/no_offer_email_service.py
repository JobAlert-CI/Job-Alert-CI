"""Service d'envoi de l'email 'no offer' aux abonnes sans digest eligible.

Quand la cascade T0-T5 ne produit aucune offre pour un abonne, on peut
lui envoyer un email transactionnel pour le prevenir et eviter le
silence radio. Cet email est distinct du digest quotidien (pas
d'EmailDigest, pas d'EmailDigestOffer): c'est un message simple
annoncant qu'aucune offre n'a ete trouvee et invitant a elargir les
criteres.

Rate limit: on n'envoie pas plus d'un email 'no offer' tous les
NO_OFFER_EMAIL_MIN_INTERVAL_DAYS (defaut 7) jours glissants par abonne.
La trace est dans la table `no_offer_email_logs` (cf. migration 0008).

Envoi: `send_no_offer_email_now` prend un `EmailDigest` `skipped_empty`
comme "support" pour la tracabilite (un EmailDeliveryAttempt par envoi,
meme logique que le digest). Le provider est appele une seule fois
(pas de retry auto: un email no-offer qui rate est un email no-offer
qui rate, ce n'est pas critique).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from html import escape
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from core.config import Settings, get_settings
from models import (
    DigestStatus,
    EmailAttemptStatus,
    EmailDeliveryAttempt,
    EmailDigest,
    NoOfferEmailLog,
    Subscriber,
    TokenPurpose,
)
from services.digest_builder_service import is_subscriber_eligible
from services.email.email_provider import EmailMessage, EmailProviderProtocol
from services.token_service import issue_token

logger = logging.getLogger(__name__)


def should_send_no_offer_email(
    db: Session,
    *,
    subscriber_id: str,
    min_interval_days: int = 7,
    now: datetime | None = None,
) -> bool:
    """Retourne True si on peut envoyer un email 'no offer' a cet abonne.

    Regle: aucun envoi 'no offer' dans les `min_interval_days` derniers
    jours. Si pas de log precedent, on peut envoyer.
    """
    effective_now = now or datetime.now(timezone.utc)
    threshold = effective_now - timedelta(days=min_interval_days)
    last_log = db.scalar(
        select(NoOfferEmailLog)
        .where(
            NoOfferEmailLog.subscriber_id == subscriber_id,
            NoOfferEmailLog.sent_at >= threshold,
        )
        .order_by(NoOfferEmailLog.sent_at.desc())
        .limit(1)
    )
    return last_log is None


def record_no_offer_email_sent(
    db: Session,
    *,
    subscriber_id: str,
    digest_date: date,
    sent_at: datetime | None = None,
) -> NoOfferEmailLog:
    """Enregistre l'envoi d'un email 'no offer' pour le rate limit futur."""
    log = NoOfferEmailLog(
        subscriber_id=subscriber_id,
        digest_date=digest_date,
        sent_at=sent_at or datetime.now(timezone.utc),
    )
    db.add(log)
    db.flush()
    return log


def collect_skipped_empty_digest_ids(db: Session, *, digest_day: date) -> list[str]:
    """Liste les ids des EmailDigest skipped_empty pour une date donnee.

    Utilise par l'orchestrateur de la phase 2 pour declencher l'envoi
    des emails 'no offer' en fin de phase d'envoi.
    """
    rows = db.scalars(
        select(EmailDigest.id)
        .where(
            EmailDigest.digest_date == digest_day,
            EmailDigest.status == DigestStatus.SKIPPED_EMPTY,
        )
        .order_by(EmailDigest.id)
    ).all()
    return list(rows)


def dispatch_no_offer_emails(
    db: Session,
    *,
    digest_day: date,
    provider: EmailProviderProtocol,
    settings: Settings | None = None,
) -> dict[str, int]:
    """Declenche l'envoi des emails no-offer pour tous les skipped_empty du jour.

    Appele en fin de phase 2 (apres l'envoi des digests queued) par
    l'orchestrateur `send_daily_digests`. Chaque digest skipped_empty
    est envoye via `send_no_offer_email_now` qui gere le rate limit.

    Retourne un bilan `{total, sent, skipped, failed}` pour les logs/Redis.
    Chaque digest est traite dans sa propre transaction logique (le
    service interne fait un flush par digest), donc un echec sur un
    abonne ne bloque pas les autres.
    """
    resolved = settings or get_settings()
    digest_ids = collect_skipped_empty_digest_ids(db, digest_day=digest_day)
    sent = 0
    skipped = 0
    failed = 0
    for digest_id in digest_ids:
        outcome = send_no_offer_email_now(
            db,
            digest_id=digest_id,
            provider=provider,
            settings=resolved,
        )
        if outcome.success:
            sent += 1
        elif outcome.skipped_reason in {"rate_limited", "feature_disabled"}:
            skipped += 1
        else:
            failed += 1
    return {"total": len(digest_ids), "sent": sent, "skipped": skipped, "failed": failed}


@dataclass(slots=True)
class NoOfferSendOutcome:
    """Resultat d'une tentative d'envoi d'email no-offer."""

    digest_id: str
    success: bool
    provider_message_id: str | None = None
    skipped_reason: str | None = None
    error_message: str | None = None


def render_no_offer_email(
    *,
    full_name: str | None,
    digest_date_str: str,
    manage_preferences_url: str,
    unsubscribe_url: str,
    site_name: str = "JobAlert CI",
    support_email: str = "support@jobalert.ci",
) -> tuple[str, str, str]:
    """Rend (subject, html, text) pour l'email no-offer.

    Meme approche que `digest_template.render_digest_email`: pas de
    dependance externe, echappement HTML systematique des valeurs
    dynamiques. Le token brut n'apparait que dans les URLs signees,
    il n'est jamais journalise.
    """
    subject = f"Aucune offre ne correspond a vos preferences aujourd'hui - {digest_date_str}"
    greeting_name = escape(full_name) if full_name else ""
    # Texte brut: on garde le nom tel quel (lisible, pas d'HTML a echapper).
    text_greeting = (full_name or "").strip()

    html = (
        '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">'
        f'<h1 style="font-size:20px;color:#111827;">Bonjour {greeting_name},</h1>'
        f'<p style="color:#374151;font-size:14px;">'
        f"Nous n'avons pas trouve d'offre correspondant a vos preferences "
        f"pour la veille du <strong>{escape(digest_date_str)}</strong>.</p>"
        '<p style="color:#374151;font-size:14px;">'
        "Vous restez abonne et recevrez automatiquement le prochain digest des qu'une "
        "offre correspondante sera publiee.</p>"
        '<p style="color:#374151;font-size:14px;">'
        "En attendant, vous pouvez <strong>elargir vos criteres</strong> "
        "(filieres, type de contrat, ville) pour augmenter vos chances de recevoir "
        "des offres pertinentes.</p>"
        '<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:13px;">'
        f'<a href="{escape(manage_preferences_url)}" style="color:#2563eb;">'
        "Gerer mes preferences</a>"
        f'&nbsp;&middot;&nbsp;<a href="{escape(unsubscribe_url)}" style="color:#6b7280;">'
        "Se desinscrire</a>"
        "</div>"
        f'<p style="color:#9ca3af;font-size:12px;margin-top:16px;">{escape(site_name)} - '
        f"Besoin d'aide ? Ecrivez a {escape(support_email)}</p>"
        "</div>"
    )

    lines_text = [f"Bonjour {text_greeting},"]
    lines_text.append("")
    lines_text.append(
        f"Nous n'avons pas trouve d'offre correspondant a vos preferences "
        f"pour la veille du {digest_date_str}."
    )
    lines_text.append("")
    lines_text.append(
        "Vous restez abonne et recevrez automatiquement le prochain digest des "
        "qu'une offre correspondante sera publiee."
    )
    lines_text.append("")
    lines_text.append(
        "En attendant, vous pouvez elargir vos criteres (filieres, type de "
        "contrat, ville) pour augmenter vos chances de recevoir des offres "
        "pertinentes."
    )
    lines_text.append("")
    lines_text.append(f"Gerer mes preferences : {manage_preferences_url}")
    lines_text.append(f"Se desinscrire : {unsubscribe_url}")
    lines_text.append("")
    lines_text.append(f"{site_name} - support : {support_email}")
    text = "\n".join(lines_text)

    return subject, html, text


def send_no_offer_email_now(
    db: Session,
    *,
    digest_id: str,
    provider: EmailProviderProtocol,
    settings: Settings | None = None,
    send_no_offer_email: bool | None = None,
) -> NoOfferSendOutcome:
    """Envoie (ou skip) un email no-offer pour un digest skipped_empty.

    Regles (dans l'ordre):
    1. Si `SEND_NO_OFFER_EMAIL=false` (override possible via kwarg) -> skip.
    2. Si le digest n'est pas `skipped_empty` -> skip.
    3. Si l'abonne n'est pas eligible (desabonne, etc.) -> skip.
    4. Si un email no-offer a ete envoye dans la fenetre
       `NO_OFFER_EMAIL_MIN_INTERVAL_DAYS` -> skip (rate limit).
    5. Sinon: envoie via provider, trace un `EmailDeliveryAttempt` +
       un `NoOfferEmailLog`, retourne l'issue.

    Le digest reste en `skipped_empty`: on ne le bascule pas en `sent`
    (sinon les marqueurs Redis de la phase 2 considereraient qu'un
    digest a ete envoye et le taux d'envoi daily serait fausse).
    """
    resolved = settings or get_settings()
    effective_send = (
        send_no_offer_email
        if send_no_offer_email is not None
        else resolved.send_no_offer_email
    )
    if not effective_send:
        return NoOfferSendOutcome(
            digest_id=digest_id, success=False, skipped_reason="feature_disabled"
        )

    digest = db.scalar(
        select(EmailDigest)
        .options(selectinload(EmailDigest.subscriber))
        .where(EmailDigest.id == digest_id)
    )
    if digest is None:
        return NoOfferSendOutcome(
            digest_id=digest_id, success=False, skipped_reason="digest_missing"
        )
    if digest.status != DigestStatus.SKIPPED_EMPTY:
        return NoOfferSendOutcome(
            digest_id=digest_id,
            success=False,
            skipped_reason=f"digest_status_{digest.status.value}",
        )

    subscriber: Subscriber | None = digest.subscriber
    if subscriber is None or not is_subscriber_eligible(subscriber):
        return NoOfferSendOutcome(
            digest_id=digest_id, success=False, skipped_reason="subscriber_ineligible"
        )

    # Rate limit 7j glissants.
    if not should_send_no_offer_email(
        db,
        subscriber_id=subscriber.id,
        min_interval_days=resolved.no_offer_email_min_interval_days,
    ):
        return NoOfferSendOutcome(
            digest_id=digest_id, success=False, skipped_reason="rate_limited"
        )

    # Generation des liens tokenises (meme logique que send_digest_now).
    _, manage_raw_token = issue_token(
        db, subscriber=subscriber, purpose=TokenPurpose.MANAGE_ALERT, ttl_hours=None, revoke_existing=False,
    )
    _, unsubscribe_raw_token = issue_token(
        db, subscriber=subscriber, purpose=TokenPurpose.UNSUBSCRIBE, ttl_hours=None, revoke_existing=True,
    )
    manage_base = resolved.public_base_url.rstrip("/")
    subject, html, text = render_no_offer_email(
        full_name=subscriber.full_name,
        digest_date_str=digest.digest_date.strftime("%d/%m/%Y"),
        manage_preferences_url=f"{manage_base}/preferences/{manage_raw_token}",
        unsubscribe_url=f"{manage_base}/desinscription/{unsubscribe_raw_token}",
        site_name="JobAlert CI",
        support_email=resolved.support_email,
    )

    message = EmailMessage(
        to_email=subscriber.email,
        subject=subject,
        html=html,
        text=text,
    )
    result = provider.send(message)

    # Trace l'attempt sur le digest skipped_empty (FK respectee).
    finished_at = datetime.now(timezone.utc)
    attempt = EmailDeliveryAttempt(
        digest_id=digest.id,
        attempt_no=1,  # 1 seule tentative: pas de retry pour les emails transactionnels.
        status=EmailAttemptStatus.SUCCESS if result.success else EmailAttemptStatus.FAILED,
        provider=resolved.email_provider,
        provider_message_id=result.provider_email_id,
        started_at=finished_at,
        finished_at=finished_at,
        error_message=result.error_message,
    )
    db.add(attempt)

    if result.success:
        # Log pour le rate limit futur.
        record_no_offer_email_sent(db, subscriber_id=subscriber.id, digest_date=digest.digest_date)
        # On met a jour last_email_sent_at comme tout envoi reussi (coherence
        # avec le digest envoye: l'abonne a "recu quelque chose" aujourd'hui).
        subscriber.last_email_sent_at = finished_at
        db.flush()
        logger.info("Email no-offer envoye (digest_id=%s, sub=%s)", digest.id, subscriber.id)
        return NoOfferSendOutcome(
            digest_id=digest.id,
            success=True,
            provider_message_id=result.provider_email_id,
        )

    logger.warning(
        "Echec envoi no-offer (digest_id=%s): %s", digest.id, result.error_message
    )
    return NoOfferSendOutcome(
        digest_id=digest.id,
        success=False,
        error_message=result.error_message,
    )


__all__ = [
    "NoOfferSendOutcome",
    "render_no_offer_email",
    "send_no_offer_email_now",
]
