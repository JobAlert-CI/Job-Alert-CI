"""Taches de maintenance periodique (audit 2, F1/N12, F3 ; audit 4, M.1).

1. Purge des `AdminRefreshToken` expires/revokes depuis plus de 30 jours.
2. Flush des compteurs view/save bufferises dans Redis vers la base.
3. Requalification des runs de scraping zombies (audit 4, M.1).
"""
from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select, update

from celery_app import celery_app

logger = logging.getLogger(__name__)

# On garde un historique de 30 jours pour debug/audit, puis on purge.
REFRESH_TOKEN_RETENTION_DAYS = 30

# Audit 4, B.4 : retention des alertes IA. Avec le cooldown, une panne
# prolongee ne produit plus qu'UNE ligne par type ; 90 jours d'historique
# (acquittees comprises) suffisent largement pour le debug.
AI_ALERT_RETENTION_DAYS = 90

# Audit 4, A.3 : retention des evenements d'ingestion, deux vitesses.
# - Le raw_payload (debug du scraper) ne sert que les 15 premiers jours ;
#   au-dela on le NULLifie mais la ligne RESTE (les compteurs /admin/logs
#   du mois restent exacts).
# - A 90 jours, purge complete : les stats d'ingestion de plus d'un
#   trimestre n'ont pas de valeur metier justifiant le stockage.
INGESTION_EVENT_PAYLOAD_RETENTION_DAYS = 15
INGESTION_EVENT_RETENTION_DAYS = 90
# Purge par lots pour ne pas tenir de verrou long ni saturer le pool de
# connexions (les agrergations /admin/logs tournent en parallele).
INGESTION_EVENT_PURGE_BATCH_SIZE = 5000

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


@celery_app.task(name="tasks.maintenance.purge_ai_alerts")
def purge_ai_alerts() -> dict:
    """Supprime les alertes IA de plus de 90 jours (audit 4, B.4).

    Avant, `ai_alerts` n'avait AUCUNE purge : avec une alerte par sweep
    (5 min), la table grossissait de ~288 lignes/jour par type d'alerte en
    panne prolongee. Le cooldown (services/ai_key_manager) a coupe le flux
    a l'insertion ; cette purge nettoie l'historique froid.

    Idempotent et sur : ne touche QUE les lignes de plus de 90 jours,
    acquittees ou non (les alertes chaudes restent visibles).
    """
    from db.session import session_scope
    from models import AIAlert

    cutoff = datetime.now(UTC) - timedelta(days=AI_ALERT_RETENTION_DAYS)
    try:
        with session_scope() as db:
            result = db.execute(delete(AIAlert).where(AIAlert.created_at < cutoff))
            deleted = result.rowcount or 0
        logger.info("Purge alertes IA: %s lignes supprimees", deleted)
    except Exception:
        logger.exception("Purge des alertes IA impossible")
        return {"deleted": 0, "error": True}
    return {"deleted": deleted}


@celery_app.task(name="tasks.maintenance.purge_ingestion_events")
def purge_ingestion_events() -> dict:
    """Retention des evenements d'ingestion, deux vitesses (audit 4, A.3).

    1. raw_payload NULL au-dela de 15 jours : les erreurs se deboguent dans
       les 2 semaines ; la ligne reste (compteurs /admin/logs exacts), seul
       le JSON lourd part.
    2. DELETE complet au-dela de 90 jours : les stats d'ingestion de plus
       d'un trimestre n'ont pas de valeur metier justifiant le cout base.

    Purge PAR LOTS de INGESTION_EVENT_PURGE_BATCH_SIZE avec commit
    intermediaire : pas de verrou long ni de saturation du pool (les
    agregations /admin/logs tournent en parallele). Idempotent : les deux
    conditions de retention ne peuvent jamais toucher une ligne chaude.

    La table etant la plus grosse du systeme (1-2 lignes par offre scrapee),
    ce verrouillage par lot est la precaution centrale de la purge.
    """
    from db.session import session_scope
    from models.jobs import OfferIngestionEvent

    now = datetime.now(UTC)
    payload_cutoff = now - timedelta(days=INGESTION_EVENT_PAYLOAD_RETENTION_DAYS)
    delete_cutoff = now - timedelta(days=INGESTION_EVENT_RETENTION_DAYS)

    payload_nulled = 0
    deleted = 0

    # Phase 1 : NULLify le raw_payload des events de 15-90 jours. Vrai
    # lot par sous-requete LIMIT (UPDATE/DELETE n'acceptent pas LIMIT en
    # PostgreSQL) : chaque iteration touche au plus BATCH_SIZE lignes puis
    # commit — pas de verrou long ni de saturation du pool.
    try:
        with session_scope() as db:
            while True:
                result = db.execute(
                    update(OfferIngestionEvent)
                    .where(
                        OfferIngestionEvent.id.in_(
                            select(OfferIngestionEvent.id)
                            .where(
                                OfferIngestionEvent.created_at < payload_cutoff,
                                OfferIngestionEvent.raw_payload.isnot(None),
                            )
                            .limit(INGESTION_EVENT_PURGE_BATCH_SIZE)
                        )
                    )
                    .values(raw_payload=None)
                    .execution_options(synchronize_session=False)
                )
                nulled = result.rowcount or 0
                payload_nulled += nulled
                db.commit()
                if nulled < INGESTION_EVENT_PURGE_BATCH_SIZE:
                    break
    except Exception:
        logger.exception("Purge payload ingestion events impossible (phase NULLify)")
        return {"payload_nulled": payload_nulled, "deleted": 0, "error": True}

    # Phase 2 : DELETE des events de plus de 90 jours, meme lotissement.
    try:
        with session_scope() as db:
            while True:
                result = db.execute(
                    delete(OfferIngestionEvent)
                    .where(
                        OfferIngestionEvent.id.in_(
                            select(OfferIngestionEvent.id)
                            .where(OfferIngestionEvent.created_at < delete_cutoff)
                            .limit(INGESTION_EVENT_PURGE_BATCH_SIZE)
                        )
                    )
                    .execution_options(synchronize_session=False)
                )
                removed = result.rowcount or 0
                deleted += removed
                db.commit()
                if removed < INGESTION_EVENT_PURGE_BATCH_SIZE:
                    break
    except Exception:
        logger.exception("Purge ingestion events impossible (phase DELETE)")
        return {"payload_nulled": payload_nulled, "deleted": deleted, "error": True}

    if payload_nulled or deleted:
        logger.info(
            "Purge ingestion events: %s payloads NULL, %s lignes supprimees",
            payload_nulled,
            deleted,
        )
    return {"payload_nulled": payload_nulled, "deleted": deleted}


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
    "AI_ALERT_RETENTION_DAYS",
    "INGESTION_EVENT_PAYLOAD_RETENTION_DAYS",
    "INGESTION_EVENT_PURGE_BATCH_SIZE",
    "INGESTION_EVENT_RETENTION_DAYS",
    "REFRESH_TOKEN_RETENTION_DAYS",
    "STALE_RUN_HOURS",
    "flush_offer_metrics",
    "purge_ai_alerts",
    "purge_expired_refresh_tokens",
    "purge_ingestion_events",
    "requalify_stale_runs",
]
