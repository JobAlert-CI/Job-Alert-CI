"""Taches de maintenance periodique (audit 2, F1/N12, F3).

1. Purge des `AdminRefreshToken` expires/revokes depuis plus de 30 jours.
2. Flush des compteurs view/save bufferises dans Redis vers la base.
"""
from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete

from celery_app import celery_app

logger = logging.getLogger(__name__)

# On garde un historique de 30 jours pour debug/audit, puis on purge.
REFRESH_TOKEN_RETENTION_DAYS = 30


@celery_app.task(name="tasks.maintenance.purge_expired_refresh_tokens")
def purge_expired_refresh_tokens() -> dict:
    """Supprime les refresh tokens expires/revokes de plus de 30 jours.

    Idempotent et sur: la condition `expires_at < now - retention` ne peut
    jamais toucher un token encore utilisable.
    """
    from db.session import session_scope
    from models.admin import AdminRefreshToken

    cutoff = datetime.now(UTC) - timedelta(days=REFRESH_TOKEN_RETENTION_DAYS)
    deleted = 0
    try:
        with session_scope() as db:
            result = db.execute(
                delete(AdminRefreshToken).where(
                    AdminRefreshToken.expires_at.isnot(None),
                    AdminRefreshToken.expires_at < cutoff,
                )
            )
            deleted = result.rowcount or 0
        logger.info("Purge refresh tokens: %s lignes supprimees", deleted)
    except Exception:
        logger.exception("Purge des refresh tokens impossible")
        return {"deleted": 0, "error": True}
    return {"deleted": deleted}


@celery_app.task(name="tasks.maintenance.flush_offer_metrics")
def flush_offer_metrics() -> dict:
    """Applique les compteurs view/save bufferises en Redis vers la base.

    Tourne toutes les minutes (beat): le widget public affiche la valeur
    Redis (immediate), la base rattrape en une requete par offre modifiee
    au lieu d'un commit par vue.
    """
    from db.session import session_scope
    from services.offer_metrics import apply_metric_deltas, collect_metric_deltas

    try:
        deltas = collect_metric_deltas()
        if not deltas:
            return {"applied": 0}
        with session_scope() as db:
            applied = apply_metric_deltas(db, deltas)
        logger.info("Flush metriques offres: %s mises a jour", applied)
        return {"applied": applied}
    except Exception:
        logger.exception("Flush des metriques offres impossible")
        return {"applied": 0, "error": True}


__all__ = ["REFRESH_TOKEN_RETENTION_DAYS", "flush_offer_metrics", "purge_expired_refresh_tokens"]
