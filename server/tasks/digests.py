from __future__ import annotations

import json
import logging
from datetime import datetime

from celery import group
from sqlalchemy import select

from celery_app import celery_app
from core.config import get_settings
from db.session import session_scope
from models import DigestStatus, EmailDeliveryAttempt, EmailDigest
from services.digest_builder_service import (
    digest_date_for,
    get_eligible_subscriber_ids,
)
from services.email.resend_provider import get_email_provider
from tasks.locks import redis_lock

"""Taches Celery du digest quotidien en deux phases.

Phase 1 (07h30) : prepare_daily_digests -> fan-out build_and_queue_digest
Phase 2 (08h00) : send_daily_digests   -> fan-out send_digest

Verrous Redis separes avec TTL explicite:
- lock:digest:prepare:{digest_date} (DIGEST_PREPARE_LOCK_TTL_SECONDS)
- lock:digest:send:{digest_date}    (DIGEST_SEND_LOCK_TTL_SECONDS)
Marqueurs d'etat (TTL 48h):
- digest:prepare:{date}:status | :stats
- digest:send:{date}:status    | :stats

Un echec sur un abonne ne bloque jamais les autres: chaque digest est traite
dans sa propre tache et sa propre transaction.
"""

logger = logging.getLogger(__name__)

PREPARE_STATUS_KEY = "digest:prepare:{day}:status"
PREPARE_STATS_KEY = "digest:prepare:{day}:stats"
SEND_STATUS_KEY = "digest:send:{day}:status"
SEND_STATS_KEY = "digest:send:{day}:stats"
LOCK_PREPARE_KEY = "lock:digest:prepare:{day}"
LOCK_SEND_KEY = "lock:digest:send:{day}"

MARKER_TTL_SECONDS = 48 * 3600


def _today(tz_name: str | None = None):
    return digest_date_for(None, tz_name=tz_name)


def _resolve_digest_day(date_override: str | None):
    """Jour cible du digest : override explicite (format YYYY-MM-DD) ou aujourd'hui.

    Factorise les 4 occurrences identiques du pattern (SIM108, audit 3 Q1).
    """
    # SIM108 : ternaire au lieu du bloc if/else.
    return datetime.strptime(date_override, "%Y-%m-%d").date() if date_override else _today()


def _redis():
    from redis import Redis

    return Redis.from_url(get_settings().redis_url, decode_responses=True)


def _set_marker(client, key: str, value: str) -> None:
    """Ecrit un marqueur d'etat. Sans Redis, on degrade sans planter le run."""

    try:
        client.set(key, value, ex=MARKER_TTL_SECONDS)
    except Exception:
        logger.warning("Marqueur Redis inaccessible (key=%s)", key)


def _get_marker(client, key: str) -> str | None:
    try:
        return client.get(key)
    except Exception:
        logger.warning("Marqueur Redis illisible (key=%s)", key)
        return None


# ─── Phase 1 : preparation ────────────────────────────────────────────────


@celery_app.task(bind=True, name="tasks.digests.prepare_daily_digests")
def prepare_daily_digests(
    self,
    date_override: str | None = None,
    force: bool = False,
) -> dict:
    """Orchestrateur de la phase 1: fan-out vers build_and_queue_digest."""

    settings = get_settings()

    digest_day = _resolve_digest_day(date_override)

    day_key = digest_day.isoformat()
    client = _redis()

    with redis_lock(LOCK_PREPARE_KEY.format(day=day_key), ttl_seconds=settings.digest_prepare_lock_ttl_seconds) as acquired:
        if not acquired:
            logger.warning("Preparation deja en cours pour %s (verrou actif)", day_key)
            return {"status": "already_running", "digest_date": day_key}

        _set_marker(client, PREPARE_STATUS_KEY.format(day=day_key), "running")

        try:
            with session_scope() as db:
                subscriber_ids = get_eligible_subscriber_ids(db)
            total = len(subscriber_ids)
            logger.info("Preparation digests %s: %s abonnes eligibles", day_key, total)

            if total == 0:
                _set_marker(client, PREPARE_STATUS_KEY.format(day=day_key), "completed")
                _set_marker(
                    client,
                    PREPARE_STATS_KEY.format(day=day_key),
                    json.dumps({"total": 0, "queued": 0, "skipped_empty": 0, "errors": 0}),
                )
                return {"status": "completed", "digest_date": day_key, "total": 0}

            # Fan-out: une tache par abonne, erreurs isolees par abonne.
            # Le chord agrege les resultats dans mark_preparation_completed,
            # qui pose le marqueur final completed/partial_failure/failed.
            from celery import chord

            header = group(
                build_and_queue_digest.s(subscriber_id, day_key, force)
                for subscriber_id in subscriber_ids
            )
            chord(header)(mark_preparation_completed.s(day_key))
            # On renvoie ici un accus de dispatch sans attendre la fin.
            return {"status": "dispatched", "digest_date": day_key, "total": total}
        except Exception:
            logger.exception("Preparation des digests echouee pour %s", day_key)
            _set_marker(client, PREPARE_STATUS_KEY.format(day=day_key), "failed")
            raise


@celery_app.task(bind=True, name="tasks.digests.build_and_queue_digest")
def build_and_queue_digest(self, subscriber_id: str, digest_date: str, force: bool = False) -> dict:
    """Tache unitaire phase 1: construit le digest d'un seul abonne."""

    from services.digest_builder_service import build_and_queue_digest_sync

    digest_day = datetime.strptime(digest_date, "%Y-%m-%d").date()
    try:
        with session_scope() as db:
            result = build_and_queue_digest_sync(
                db,
                subscriber_id=subscriber_id,
                digest_day=digest_day,
                force=force,
            )
            return {
                "subscriber_id": result.subscriber_id,
                "digest_id": result.digest_id,
                "status": result.status,
                "offer_count": result.offer_count,
                "detail": result.detail,
            }
    except Exception as exc:
        # Un abonne en erreur ne doit jamais bloquer les autres.
        logger.exception("build_and_queue_digest echoue (subscriber_id=%s)", subscriber_id)
        return {
            "subscriber_id": subscriber_id,
            "digest_id": None,
            "status": "error",
            "offer_count": 0,
            "detail": type(exc).__name__,
        }


@celery_app.task(name="tasks.digests.mark_preparation_completed")
def mark_preparation_completed(results, digest_date: str) -> dict:
    """Cloture de la phase 1: agrege, stocke les stats, positionne le marqueur."""

    client = _redis()
    results = results if isinstance(results, list) else []
    queued = sum(1 for item in results if isinstance(item, dict) and item.get("status") == "queued")
    skipped = sum(1 for item in results if isinstance(item, dict) and item.get("status") == "skipped_empty")
    errors = sum(1 for item in results if isinstance(item, dict) and item.get("status") == "error")
    processed = len(results)
    status = "completed" if errors == 0 else ("partial_failure" if queued + skipped > 0 else "failed")
    _set_marker(client, PREPARE_STATUS_KEY.format(day=digest_date), status)
    _set_marker(
        client,
        PREPARE_STATS_KEY.format(day=digest_date),
        json.dumps({"total": processed, "queued": queued, "skipped_empty": skipped, "errors": errors}),
    )
    logger.info(
        "Preparation digests terminee (%s): queued=%s skipped_empty=%s erreurs=%s",
        digest_date,
        queued,
        skipped,
        errors,
    )
    return {
        "status": status,
        "digest_date": digest_date,
        "total": processed,
        "queued": queued,
        "skipped_empty": skipped,
        "errors": errors,
    }


# ─── Phase 2 : envoi ──────────────────────────────────────────────────────


@celery_app.task(bind=True, name="tasks.digests.send_daily_digests")
def send_daily_digests(self, date_override: str | None = None) -> dict:
    """Orchestrateur de la phase 2: fan-out vers send_digest."""

    settings = get_settings()
    digest_day = _resolve_digest_day(date_override)

    day_key = digest_day.isoformat()
    client = _redis()

    with redis_lock(LOCK_SEND_KEY.format(day=day_key), ttl_seconds=settings.digest_send_lock_ttl_seconds) as acquired:
        if not acquired:
            logger.warning("Envoi deja en cours pour %s (verrou actif)", day_key)
            return {"status": "already_running", "digest_date": day_key}

        preparation_status = _get_marker(client, PREPARE_STATUS_KEY.format(day=day_key))

        # Garde-fou: preparation absente ou failed.
        if preparation_status in (None, "failed"):
            if settings.send_if_preparation_incomplete and preparation_status is None:
                logger.warning(
                    "Marqueur de preparation absent pour %s: envoi autorise (SEND_IF_PREPARATION_INCOMPLETE=true)",
                    day_key,
                )
            elif preparation_status == "failed":
                logger.error("Preparation FAILED pour %s: envoi bloque par defaut", day_key)
                if not settings.send_if_preparation_incomplete:
                    return {
                        "status": "blocked_preparation_failed",
                        "digest_date": day_key,
                        "preparation_status": preparation_status,
                    }
            else:
                logger.error("Marqueur de preparation absent pour %s: envoi bloque par defaut", day_key)
                return {
                    "status": "blocked_no_preparation",
                    "digest_date": day_key,
                    "preparation_status": None,
                }

        _set_marker(client, SEND_STATUS_KEY.format(day=day_key), "running")

        with session_scope() as db:
            digest_ids = list(
                db.scalars(
                    select(EmailDigest.id).where(
                        EmailDigest.digest_date == digest_day,
                        EmailDigest.status == DigestStatus.QUEUED,
                    )
                )
            )

        logger.info("Envoi digests %s: %s digests queued", day_key, len(digest_ids))
        if not digest_ids:
            _set_marker(client, SEND_STATUS_KEY.format(day=day_key), "completed")
            _set_marker(
                client,
                SEND_STATS_KEY.format(day=day_key),
                json.dumps({"total": 0, "sent": 0, "failed": 0, "cancelled": 0}),
            )
            return {"status": "completed", "digest_date": day_key, "total": 0}

        from celery import chord

        header = group(send_digest.s(digest_id) for digest_id in digest_ids)
        chord(header)(mark_sending_completed.s(day_key))
        return {"status": "dispatched", "digest_date": day_key, "total": len(digest_ids)}


@celery_app.task(
    bind=True,
    name="tasks.digests.send_digest",
    max_retries=None,  # borne reelle geree via EMAIL_MAX_RETRIES + attempt_no
)
def send_digest(self, digest_id: str) -> dict:
    """Tache unitaire phase 2: une tentative d'envoi par appel.

    Le retry Celery est borne par EMAIL_MAX_RETRIES et par la contrainte
    attempt_no <= 3 d'EmailDeliveryAttempt; seules les erreurs retentables
    (timeout, 429, 5xx) declenchent un retry avec backoff.
    """

    settings = get_settings()

    try:
        outcome = _attempt_send(digest_id, settings)
    except Exception as exc:
        # Erreur technique (DB/Redis temporaire): retentable dans la limite 3.
        attempts_done = self.request.retries + 1
        if attempts_done < settings.email_max_retries:
            raise self.retry(countdown=settings.email_retry_backoff_seconds * (2**self.request.retries)) from exc
        logger.exception("send_digest abandonne (digest_id=%s)", digest_id)
        return {"digest_id": digest_id, "success": False, "status": "error", "error": type(exc).__name__}

    if outcome.success:
        return {
            "digest_id": outcome.digest_id,
            "success": True,
            "status": outcome.status,
            "attempt_no": outcome.attempt_no,
        }

    if outcome.retryable:
        raise self.retry(countdown=settings.email_retry_backoff_seconds * (2**(outcome.attempt_no - 1)))

    if outcome.status == "cancelled":
        return {
            "digest_id": outcome.digest_id,
            "success": False,
            "status": outcome.status,
            "reason": outcome.error_message,
        }

    return {
        "digest_id": outcome.digest_id,
        "success": False,
        "status": outcome.status,
        "attempt_no": outcome.attempt_no,
        "error": outcome.error_message,
    }


def _attempt_send(digest_id: str, settings):
    """Exécute une tentative d'envoi dans sa propre transaction."""

    from services.digest_sender_service import send_digest_now

    provider = get_email_provider()
    with session_scope() as db:
        return send_digest_now(db, digest_id=digest_id, provider=provider, settings=settings)


@celery_app.task(name="tasks.digests.mark_sending_completed")
def mark_sending_completed(results, digest_date: str) -> dict:
    """Cloture de la phase 2: bilan d'envoi + marqueurs Redis."""

    client = _redis()
    results = results if isinstance(results, list) else []
    sent = sum(1 for item in results if isinstance(item, dict) and item.get("success"))
    cancelled = sum(1 for item in results if isinstance(item, dict) and item.get("status") == "cancelled")
    failed = sum(1 for item in results if not isinstance(item, dict) or not item.get("success")) - cancelled
    status = "completed" if failed == 0 else "partial_failure"
    _set_marker(client, SEND_STATUS_KEY.format(day=digest_date), status)
    _set_marker(
        client,
        SEND_STATS_KEY.format(day=digest_date),
        json.dumps({"total": len(results), "sent": sent, "failed": max(failed, 0), "cancelled": cancelled}),
    )
    logger.info(
        "Envoi digests termine (%s): sent=%s failed=%s cancelled=%s",
        digest_date,
        sent,
        max(failed, 0),
        cancelled,
    )
    return {
        "status": status,
        "digest_date": digest_date,
        "total": len(results),
        "sent": sent,
        "failed": max(failed, 0),
        "cancelled": cancelled,
    }


# ─── Phase 2.5 — envoi des emails 'no offer' pour les skipped_empty ────


@celery_app.task(name="tasks.digests.send_no_offer_emails")
def send_no_offer_emails(date_override: str | None = None) -> dict:
    """Orchestrateur de la phase 2.5: envoie les emails 'no offer' pour
    les EmailDigest skipped_empty du jour.

    Tourne apres `send_daily_digests` (phase 2 principale) pour eviter
    de melanger les retries: les digests queued partent d'abord, puis
    les no-offer partent en fin de phase.

    Verrou Redis separe (lock:digest:no_offer:{date}) pour ne pas
    interferer avec la phase 2 en cas de reexecution.
    """
    settings = get_settings()
    digest_day = _resolve_digest_day(date_override)

    day_key = digest_day.isoformat()

    with redis_lock(
        f"lock:digest:no_offer:{day_key}",
        ttl_seconds=settings.digest_prepare_lock_ttl_seconds,
    ) as acquired:
        if not acquired:
            logger.warning("Envoi no-offer deja en cours pour %s (verrou actif)", day_key)
            return {"status": "already_running", "digest_date": day_key}

        try:
            provider = get_email_provider()
            with session_scope() as db:
                from services.no_offer_email_service import dispatch_no_offer_emails

                summary = dispatch_no_offer_emails(
                    db, digest_day=digest_day, provider=provider, settings=settings
                )
            logger.info(
                "Envoi no-offer termine (%s): total=%s sent=%s skipped=%s failed=%s",
                day_key,
                summary["total"],
                summary["sent"],
                summary["skipped"],
                summary["failed"],
            )
            return {
                "status": "completed",
                "digest_date": day_key,
                **summary,
            }
        except Exception:
            logger.exception("Envoi no-offer echoue pour %s", day_key)
            return {"status": "failed", "digest_date": day_key}


# ─── Rattrapage encadre (desactive par defaut) ────────────────────────────


@celery_app.task(name="tasks.digests.retry_failed_digests")
def retry_failed_digests(date_override: str | None = None) -> dict:
    """Retente UNIQUEMENT les digests failed dont les tentatives ne sont pas
    epuisees (attempt_no < EMAIL_MAX_RETRIES). Ne duplique jamais le mecanisme
    de retry automatique de send_digest: desactive par defaut
    (RETRY_FAILED_DIGESTS_ENABLED=false), declenchement manuel sinon."""

    settings = get_settings()
    if not settings.retry_failed_digests_enabled:
        logger.info("retry_failed_digests desactive (RETRY_FAILED_DIGESTS_ENABLED=false)")
        return {"status": "disabled"}

    digest_day = _resolve_digest_day(date_override)

    from sqlalchemy import func

    with session_scope() as db:
        attempt_counts = (
            select(
                EmailDeliveryAttempt.digest_id,
                func.max(EmailDeliveryAttempt.attempt_no).label("max_attempt"),
            )
            .group_by(EmailDeliveryAttempt.digest_id)
            .subquery()
        )
        retryable_ids = list(
            db.scalars(
                select(EmailDigest.id)
                .outerjoin(attempt_counts, attempt_counts.c.digest_id == EmailDigest.id)
                .where(
                    EmailDigest.digest_date == digest_day,
                    EmailDigest.status == DigestStatus.FAILED,
                    func.coalesce(attempt_counts.c.max_attempt, 0) < settings.email_max_retries,
                )
            )
        )
        # Retour en queued avant republication.
        for digest_id in retryable_ids:
            digest = db.get(EmailDigest, digest_id)
            digest.status = DigestStatus.QUEUED

    for digest_id in retryable_ids:
        send_digest.delay(digest_id)

    logger.info("retry_failed_digests: %s digests republies pour %s", len(retryable_ids), digest_day.isoformat())
    return {"status": "requeued", "digest_date": digest_day.isoformat(), "total": len(retryable_ids)}


__all__ = [
    "build_and_queue_digest",
    "mark_preparation_completed",
    "mark_sending_completed",
    "prepare_daily_digests",
    "retry_failed_digests",
    "send_daily_digests",
    "send_digest",
    "send_no_offer_emails",
]
