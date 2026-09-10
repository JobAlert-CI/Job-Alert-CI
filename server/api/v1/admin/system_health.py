"""Sante du systeme (document 8 — 2.4 / 3.4).

Inspecte Celery (control.inspect), la profondeur REELLE des files Redis
(H.3 — LLEN sur le broker), le dernier heartbeat du worker, l'etat de la
base, et la sante DERIVEE des providers externes email/IA (O.4 — sans
ping, calculee depuis les derniers echecs en base).

Reserve au super_admin (audit P1 #28).
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.deps import get_current_admin, get_db, require_roles
from core.config import get_settings
from models import Administrator, DigestStatus, EmailDigest, JobOffer
from models.ai import AIApiKey
from models.emails import EmailAttemptStatus, EmailDeliveryAttempt

router = APIRouter(
    prefix="/api/admin/system",
    tags=["admin-system"],
    dependencies=[Depends(require_roles("super_admin"))],
)

# O.4 : fenetre de fraicheur d'une erreur provider. Une erreur d'envoi de
# moins de 15 minutes signale une panne EN COURS ; au-dela, on considere
# le provider retabli (les retries marqueraient de nouvelles erreurs).
PROVIDER_ERROR_WINDOW_MINUTES = 15


def _check_database(db: Session) -> dict:
    health_db = {"status": "ok", "message": "Base de donnees accessible"}
    try:
        db.execute(select(func.count()).select_from(JobOffer))
    except Exception as exc:
        health_db = {"status": "error", "message": str(exc)}
    return health_db


async def _check_celery() -> dict:
    """Inspection Celery via control.inspect avec timeout global."""
    try:
        # Import local au module pour eviter cycle au boot.
        from celery_app import celery_app

        inspect = celery_app.control.inspect(timeout=2.0)
        active = inspect.active() or {}
        workers_count = len(active) if active else 0
        return {
            "status": "ok" if workers_count > 0 else "warning",
            "workers_active": workers_count,
            "message": "Workers actifs detectes" if workers_count > 0 else "Aucun worker actif",
        }
    except Exception as exc:
        return {"status": "warning", "message": f"Erreur inspection Celery: {exc}"}


def _redis_queue_depths() -> dict[str, int | str]:
    """H.3 : vraies profondeurs des queues via LLEN sur le broker Redis.

    Le broker etant Redis, chaque queue est une liste du meme nom. Un
    engorgement (sweep IA + jobs scraping, digest 08:00) devient enfin
    visible depuis la sante systeme. Fallback "N/A" si le broker est
    injoignable — la sante ne doit jamais planter sur un Redis down.
    """
    try:
        from redis import Redis

        client = Redis.from_url(get_settings().celery_broker_url, socket_timeout=2)
        return {queue: int(client.llen(queue)) for queue in ("celery", "ai", "ingestion", "emails")}
    except Exception:
        return {queue: "N/A" for queue in ("celery", "ai", "ingestion", "emails")}


def _check_redis_queues(db: Session) -> dict:
    queued_count = (
        db.scalar(
            select(func.count(EmailDigest.id)).where(EmailDigest.status == DigestStatus.QUEUED)
        )
        or 0
    )
    depths = _redis_queue_depths()
    redis_available = not all(depth == "N/A" for depth in depths.values())
    return {
        "status": "ok" if redis_available else "warning",
        "queues": {
            "emails_queued": queued_count,
            "ingestion_depth": depths["ingestion"],
            "ai_depth": depths["ai"],
            "emails_depth": depths["emails"],
            "default_depth": depths["celery"],
        },
        "message": (
            f"{queued_count} digests en file d'attente ; profondeurs broker LLEN "
            f"(ai={depths['ai']}, ingestion={depths['ingestion']}, emails={depths['emails']})"
            if redis_available
            else f"{queued_count} digests en file d'attente ; broker Redis injoignable, profondeurs indisponibles"
        ),
    }


def _aware(value: datetime | None) -> datetime | None:
    """Re-awareifie un datetime relu de SQLite (le dialecte perd la tz)."""
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=UTC)


def _check_email_provider(db: Session) -> dict:
    """O.4 : sante Resend DERIVEE des derniers echecs — jamais de ping.

    Raison d'etre : pinger Resend a chaque health check couterait des
    quotas et fausserait son rate-limit. On regarde plutot si une tentative
    d'envoi a echoue dans la fenetre PROVIDER_ERROR_WINDOW_MINUTES :
    erreur recente -> degraded, rien -> ok. Zero appel reseau.
    """
    cutoff = datetime.now(UTC) - timedelta(minutes=PROVIDER_ERROR_WINDOW_MINUTES)
    candidates = list(
        db.scalars(
            select(EmailDeliveryAttempt.finished_at)
            .where(
                EmailDeliveryAttempt.status == EmailAttemptStatus.FAILED,
                EmailDeliveryAttempt.finished_at.isnot(None),
            )
            .order_by(EmailDeliveryAttempt.finished_at.desc())
            .limit(50)
        )
    )
    for raw in candidates:
        finished = _aware(raw)
        if finished is not None and finished >= cutoff:
            return {
                "status": "degraded",
                "message": f"Echec d'envoi dans les {PROVIDER_ERROR_WINDOW_MINUTES} dernieres minutes",
                "last_error_at": finished.isoformat(),
            }
    return {"status": "ok", "message": "Aucun echec d'envoi recent"}


def _check_ai_provider(db: Session) -> dict:
    """O.4 : sante IA derivee des cles API — jamais de ping.

    Deux signaux en base, sans appel reseau :
    - AIApiKey.last_error_at recent (< 15 min) -> degraded ;
    - toutes les cles actives en cooldown (disabled_until > now) ->
      degraded (plus aucune cle disponible pour le sweep).
    AI_ENABLED=false (NoopAIProcessor) -> "disabled", pas degraded.
    """
    settings = get_settings()
    if not settings.ai_enabled:
        return {"status": "disabled", "message": "IA desactivee (AI_ENABLED=false — NoopAIProcessor)"}

    now = datetime.now(UTC)
    cutoff = now - timedelta(minutes=PROVIDER_ERROR_WINDOW_MINUTES)

    recent_error = db.scalar(
        select(AIApiKey.last_error_at)
        .where(AIApiKey.last_error_at.isnot(None), AIApiKey.is_active.is_(True))
        .order_by(AIApiKey.last_error_at.desc())
        .limit(1)
    )
    recent_error = _aware(recent_error)
    if recent_error is not None and recent_error >= cutoff:
        return {
            "status": "degraded",
            "message": f"Erreur de cle IA dans les {PROVIDER_ERROR_WINDOW_MINUTES} dernieres minutes",
            "last_error_at": recent_error.isoformat(),
        }

    active_keys = list(db.scalars(select(AIApiKey).where(AIApiKey.is_active.is_(True))))
    disabled_values = [(_aware(key.disabled_until)) for key in active_keys]
    if active_keys and all(value is not None and value > now for value in disabled_values):
        soonest = min(value for value in disabled_values if value is not None)
        return {
            "status": "degraded",
            "message": "Toutes les cles IA actives sont en cooldown",
            "disabled_until": soonest.isoformat(),
        }
    if not active_keys:
        return {"status": "warning", "message": "Aucune cle IA active configuree"}

    return {"status": "ok", "message": f"{len(active_keys)} cle(s) IA active(s), aucune erreur recente"}


def _check_heartbeat(db: Session) -> dict:
    last_offer = db.scalar(select(JobOffer.created_at).order_by(JobOffer.created_at.desc()).limit(1))
    return {
        "status": "ok" if last_offer else "warning",
        "last_heartbeat_at": last_offer.isoformat() if last_offer else None,
        "message": "Derniere offre creee" if last_offer else "Aucune offre trouvee",
    }


@router.get("/health")
async def system_health(
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Point de sante global du back-office (supervision technique)."""
    health_db = _check_database(db)
    health_celery = await _check_celery()
    health_redis = _check_redis_queues(db)
    health_heartbeat = _check_heartbeat(db)
    health_email_provider = _check_email_provider(db)
    health_ai_provider = _check_ai_provider(db)

    health_admin = {
        "status": "ok",
        "current_role": admin.role.value if hasattr(admin.role, "value") else str(admin.role),
        "is_active": admin.is_active,
    }

    # Audit P1 #51: overall_status tient compte de Celery (degraded si down).
    # O.4 : les providers externes derives comptent aussi dans le statut
    # global (une panne Resend ou IA doit sortir du vert).
    if health_db.get("status") == "error":
        overall_status = "error"
    elif (
        health_celery.get("status") == "warning"
        or health_redis.get("status") == "warning"
        or health_email_provider.get("status") == "degraded"
        or health_ai_provider.get("status") == "degraded"
    ):
        overall_status = "degraded"
    else:
        overall_status = "ok"

    return {
        "database": health_db,
        "celery": health_celery,
        "redis_queues": health_redis,
        "heartbeat": health_heartbeat,
        "email_provider": health_email_provider,
        "ai_provider": health_ai_provider,
        "admin_auth": health_admin,
        "overall_status": overall_status,
    }
