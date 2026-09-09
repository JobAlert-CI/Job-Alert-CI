"""Avancement des runs de scraping (audit 4, C.1/C.3/M.1).

Le trigger admin cree des lignes de supervision (ScrapeRun + SourceScrapeRun)
que la task `run_source_scraper` fait avancer vers running puis un statut
terminal ; l'ingestion peut egalement « adopter » ces lignes quand le batch
arrive (services/ingestion.py). Ce module centralise les transitions, la
recompute du statut parent et l'agregation des compteurs, reutilisee par la
requalification des zombies (tasks/maintenance.py).
"""
from __future__ import annotations

import logging
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from models.enums import IngestionAction, ScrapeRunStatus
from models.jobs import OfferIngestionEvent
from models.scraping import ScrapeRun, SourceScrapeRun

logger = logging.getLogger(__name__)

TERMINAL_RUN_STATUSES = {ScrapeRunStatus.SUCCESS, ScrapeRunStatus.PARTIAL_FAILURE, ScrapeRunStatus.FAILED}


def now_utc() -> datetime:
    return datetime.now(UTC)


def recompute_scrape_run_status(run: ScrapeRun) -> None:
    """Recalcule le statut du run parent a partir de ses sous-runs.

    - Un seul sous-run (chemin ingestion classique, ou trigger admin sur une
      source) : le parent suit le sous-run (comportement historique).
    - Plusieurs sous-runs (trigger admin multi-sources) : le parent ne passe
      terminal QUE quand tous les sous-runs sont terminaux — FAILED si tous
      ont echoue, PARTIAL_FAILURE si melange, SUCCESS sinon.
    """
    source_runs = list(run.source_runs)
    if not source_runs:
        return
    if all(sr.status in TERMINAL_RUN_STATUSES for sr in source_runs):
        statuses = {sr.status for sr in source_runs}
        if statuses == {ScrapeRunStatus.FAILED}:
            run.status = ScrapeRunStatus.FAILED
        elif ScrapeRunStatus.FAILED in statuses or ScrapeRunStatus.PARTIAL_FAILURE in statuses:
            run.status = ScrapeRunStatus.PARTIAL_FAILURE
        else:
            run.status = ScrapeRunStatus.SUCCESS
        if run.finished_at is None:
            run.finished_at = now_utc()
    else:
        # Au moins un sous-run non terminal : le parent est demarre, pas fini.
        run.status = ScrapeRunStatus.RUNNING
        if run.started_at is None:
            run.started_at = now_utc()


def refresh_run_totals(run: ScrapeRun) -> None:
    """Recalcule les compteurs du run parent par somme des sous-runs.

    Chemin classique (un seul sous-run) : identique a l'ecriture directe
    historique. Chemin admin multi-sources : le parent agrege reellement les
    volumes de chaque source au lieu d'etre ecrase par le dernier batch.
    """
    source_runs = list(run.source_runs)
    run.total_raw = sum(sr.raw_count for sr in source_runs)
    run.total_inserted = sum(sr.inserted_count for sr in source_runs)
    run.total_updated = sum(sr.updated_count for sr in source_runs)
    run.total_duplicates = sum(sr.duplicate_count for sr in source_runs)
    run.total_errors = sum(sr.error_count for sr in source_runs)


def mark_source_run_running(source_run: SourceScrapeRun) -> None:
    """PENDING -> RUNNING (idempotent) au demarrage effectif du scraper."""
    now = now_utc()
    source_run.status = ScrapeRunStatus.RUNNING
    source_run.started_at = source_run.started_at or now
    parent = source_run.scrape_run
    if parent is not None:
        if parent.status == ScrapeRunStatus.PENDING:
            parent.status = ScrapeRunStatus.RUNNING
        parent.started_at = parent.started_at or now


def finish_source_run(
    source_run: SourceScrapeRun,
    status: ScrapeRunStatus,
    *,
    error_message: str | None = None,
) -> None:
    """Conclut un sous-run, recalcule statut et compteurs du parent."""
    source_run.status = status
    source_run.finished_at = now_utc()
    if error_message:
        source_run.error_message = error_message
    parent = source_run.scrape_run
    if parent is not None:
        recompute_scrape_run_status(parent)
        refresh_run_totals(parent)


def record_run_event(
    db: Session,
    *,
    source_run: SourceScrapeRun | None,
    action: IngestionAction,
    reason: str | None,
) -> None:
    """Journalise un evenement au niveau run (audit 4, A.1).

    `source_scrape_run_id` peut etre NULL : c'est le cas des abandons du
    chemin beat (aucun run wrapper) — l'event reste visible dans
    /admin/logs/events et compte dans /logs/stats.
    """
    db.add(
        OfferIngestionEvent(
            source_scrape_run_id=source_run.id if source_run is not None else None,
            action=action,
            reason=(reason or "").strip()[:255] or None,
        )
    )


__all__ = [
    "TERMINAL_RUN_STATUSES",
    "finish_source_run",
    "mark_source_run_running",
    "now_utc",
    "recompute_scrape_run_status",
    "record_run_event",
    "refresh_run_totals",
]
