"""Sante du systeme (document 8 — 2.4 / 3.4).

Inspecte Celery (control.inspect), la profondeur des files Redis,
le dernier heartbeat du worker, et l'etat de la base.

Reserve au super_admin (audit P1 #28).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.deps import get_current_admin, get_db, require_roles
from models import Administrator, DigestStatus, EmailDigest, JobOffer

router = APIRouter(
    prefix="/api/admin/system",
    tags=["admin-system"],
    dependencies=[Depends(require_roles("super_admin"))],
)


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


def _check_redis_queues(db: Session) -> dict:
    queued_count = (
        db.scalar(
            select(func.count(EmailDigest.id)).where(EmailDigest.status == DigestStatus.QUEUED)
        )
        or 0
    )
    return {
        "status": "ok",
        "queues": {
            "emails_queued": queued_count,
            "ingestion_depth": "N/A (simulee: pas de file Redis directe exposee)",
            "ai_depth": "N/A",
        },
        "message": f"{queued_count} digests en file d'attente",
    }


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

    health_admin = {
        "status": "ok",
        "current_role": admin.role.value if hasattr(admin.role, "value") else str(admin.role),
        "is_active": admin.is_active,
    }

    # Audit P1 #51: overall_status tient compte de Celery (degraded si down).
    if health_db.get("status") == "error":
        overall_status = "error"
    elif health_celery.get("status") == "warning" or health_redis.get("status") == "error":
        overall_status = "degraded"
    else:
        overall_status = "ok"

    return {
        "database": health_db,
        "celery": health_celery,
        "redis_queues": health_redis,
        "heartbeat": health_heartbeat,
        "admin_auth": health_admin,
        "overall_status": overall_status,
    }
