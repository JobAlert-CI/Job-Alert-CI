"""Taches de maintenance periodique (audit 2, F1/N12, F3 ; audit 4, M.1).

1. Purge des `AdminRefreshToken` expires/revokes depuis plus de 30 jours.
2. Flush des compteurs view/save bufferises dans Redis vers la base.
3. Requalification des runs de scraping zombies (audit 4, M.1).
"""
from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select

from celery_app import celery_app

logger = logging.getLogger(__name__)

# On garde un historique de 30 jours pour debug/audit, puis on purge.
REFRESH_TOKEN_RETENTION_DAYS = 30

# Audit 4, M.1 : au-dela de ce delai, un run RUNNING/PENDING est considere
# comme zombie (worker crashe, broker perdu, OOM kill du subprocess...).
# 6 h couvre largement le timeout subprocess (1 h) + retries Celery.
STALE_RUN_HOURS = 6


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


@celery_app.task(name="tasks.maintenance.requalify_stale_runs")
def requalify_stale_runs() -> dict:
    """Requalifie les runs de scraping zombies (audit 4, M.1).

    Un run PENDING/RUNNING dont le dernier avancement date de plus de
    STALE_RUN_HOURS est un zombie : worker crashe pendant le subprocess,
    broker perdu avant le retour du chord, OOM kill... Ces lignes mentent sur
    l'etat du systeme (le /admin/scraping montre « en cours » pour toujours)
    et polluent le denominator du success_rate.

    Action : statut -> FAILED, error_message explicite, event FAILED en base
    (visible /admin/logs), recompute du parent. Idempotent : les runs
    terminaux ne sont jamais retouches.
    """
    from db.session import session_scope
    from models import IngestionAction, ScrapeRun, ScrapeRunStatus, SourceScrapeRun
    from services.scrape_runs import finish_source_run, now_utc, record_run_event

    cutoff = now_utc() - timedelta(hours=STALE_RUN_HOURS)
    requalified = 0
    try:
        with session_scope() as db:
            # Sous-runs zombies : RUNNING/PENDING non conclus depuis cutoff.
            # `started_at` NULL sur un PENDING jamais demarre : on retombe sur
            # created_at (TimestampMixin) pour dater l'abandon.
            stale_stmt = select(SourceScrapeRun).where(
                SourceScrapeRun.status.in_([ScrapeRunStatus.PENDING, ScrapeRunStatus.RUNNING]),
                func.coalesce(SourceScrapeRun.started_at, SourceScrapeRun.created_at) < cutoff,
            )
            for source_run in db.scalars(stale_stmt):
                finish_source_run(source_run, ScrapeRunStatus.FAILED, error_message="zombie_requalifie_par_maintenance")
                record_run_event(
                    db,
                    source_run=source_run,
                    action=IngestionAction.FAILED,
                    reason="run_zombie_requalifie_automatiquement",
                )
                requalified += 1
            # Runs parents zombies SANS sous-run (orphelins PENDING) : meme
            # traitement, directement au niveau run.
            parent_stmt = select(ScrapeRun).where(
                ScrapeRun.status.in_([ScrapeRunStatus.PENDING, ScrapeRunStatus.RUNNING]),
                ~ScrapeRun.source_runs.any(),
                func.coalesce(ScrapeRun.started_at, ScrapeRun.created_at) < cutoff,
            )
            for run in db.scalars(parent_stmt):
                run.status = ScrapeRunStatus.FAILED
                run.finished_at = now_utc()
                record_run_event(
                    db,
                    source_run=None,
                    action=IngestionAction.FAILED,
                    reason="run_zombie_requalifie_automatiquement",
                )
                requalified += 1
        if requalified:
            logger.info("Requalification zombies: %s runs passes FAILED", requalified)
    except Exception:
        logger.exception("Requalification des runs zombies impossible")
        return {"requalified": 0, "error": True}
    return {"requalified": requalified}


__all__ = [
    "REFRESH_TOKEN_RETENTION_DAYS",
    "STALE_RUN_HOURS",
    "flush_offer_metrics",
    "purge_expired_refresh_tokens",
    "requalify_stale_runs",
]
