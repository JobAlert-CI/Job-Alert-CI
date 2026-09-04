from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from api.deps import get_db
from core.config import get_settings

routerSys = APIRouter(tags=["system"])

logger = logging.getLogger(__name__)


def _ping_redis() -> bool:
    """Ping Redis. Renvoie False si Redis est down (mode degrade, pas d'erreur 5xx)."""
    try:
        from redis import Redis

        client = Redis.from_url(get_settings().redis_url, socket_timeout=2)
        return bool(client.ping())
    except Exception as exc:
        logger.warning("Redis ping failed: %s", exc)
        return False


def _ping_celery() -> bool:
    """Ping Celery via control.inspect (timeout court)."""
    try:
        from celery_app import celery_app

        # timeout=1.0 pour eviter de bloquer le healthcheck.
        active = celery_app.control.inspect(timeout=1.0).active() or {}
        return len(active) > 0
    except Exception as exc:
        logger.warning("Celery ping failed: %s", exc)
        return False


@routerSys.get("/health")
def healthcheck(response: Response, db: Session = Depends(get_db)) -> dict[str, str]:
    """Sante applicative et disponibilite de la base/redis/celery (audit P1 #33)."""
    settings = get_settings()
    overall_status = "ok"

    try:
        db.execute(text("SELECT 1"))
        database = "ready"
    except (SQLAlchemyError, Exception):
        database = "unavailable"
        overall_status = "degraded"

    redis_ok = _ping_redis()
    celery_ok = _ping_celery()

    if not redis_ok or not celery_ok:
        overall_status = "degraded"

    if overall_status == "degraded":
        # LB/uptime-robot : 503 = probleme ; 200 = ok. Choix conservateur :
        # 200 + champ "status: degraded" pour eviter les retraits inutiles
        # d'instance quand Redis est temporairement down.
        pass

    return {
        "status": overall_status,
        "database": database,
        "redis": "ready" if redis_ok else "unavailable",
        "celery": "ready" if celery_ok else "unavailable",
        "environment": settings.environment,
    }


@routerSys.get("/")
def root() -> dict[str, str]:
    settings = get_settings()
    return {"message": "JobAlert CI API", "environment": settings.environment}


@routerSys.head("/")
def health_head() -> Response:
    """Reponse valide sans body pour les pings HEAD (UptimeRobot, etc.)."""
    return Response(status_code=200)
