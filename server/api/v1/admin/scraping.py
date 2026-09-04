from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from api.deps import get_current_admin, get_db, require_roles
from models.admin import AdminAction, Administrator
from models.enums import ScrapeRunStatus, SourceStatus
from models.jobs import OfferIngestionEvent
from models.referentials import Source
from models.scraping import ScrapeRun, SourceScrapeRun
from schemas.logs import EventLogRead
from schemas.scraping import ScrapeRunRead, ScrapingStatusRead, ScrapingTrigger
from services.audit import log_admin_action

# Le pilotage du scraping reste une operation sensible: super_admin uniquement.
router = APIRouter(
    prefix="/api/admin/scraping",
    tags=["admin-scraping"],
    dependencies=[Depends(require_roles("super_admin"))],
)


@router.get("/status", response_model=list[ScrapingStatusRead])
async def get_scraping_status(db: Session = Depends(get_db)):
    """État des 4 sources : dernier passage, durée, erreurs."""
    sources = list(db.scalars(select(Source).order_by(Source.priority)))
    results = []
    for source in sources:
        last_run = db.scalar(
            select(SourceScrapeRun)
            .where(SourceScrapeRun.source_id == source.id)
            .order_by(SourceScrapeRun.started_at.desc().nullslast(), SourceScrapeRun.created_at.desc())
            .limit(1)
        )
        total_runs_count = len(list(db.scalars(select(SourceScrapeRun.id).where(SourceScrapeRun.source_id == source.id))))
        results.append(
            ScrapingStatusRead(
                source_code=source.code,
                source_name=source.name,
                last_run_at=last_run.started_at if last_run else None,
                last_status=last_run.status.value if last_run and last_run.status else None,
                last_duration_ms=last_run.duration_ms if last_run else None,
                last_error=last_run.error_message if last_run else None,
                total_runs=total_runs_count,
            )
        )
    return results


@router.post("/trigger", status_code=201, response_model=ScrapeRunRead)
async def trigger_scraping(
    payload: ScrapingTrigger,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Déclenche un scraping manuel (toutes sources actives, ou une seule).

    Crée les lignes de suivi (`scrape_runs` / `source_scrape_runs`) en statut
    `pending`; l'exécution effective des scrapers est portée par le worker de
    collecte (hors périmètre de cette API) qui les fera avancer vers
    `running` puis `success`/`failed`.
    """
    sources_query = select(Source).where(Source.status == SourceStatus.ACTIVE)
    if payload.source_code:
        sources_query = sources_query.where(Source.code == payload.source_code)
    sources = list(db.scalars(sources_query))
    if not sources:
        raise HTTPException(status_code=404, detail="Aucune source active correspondante")

    run = ScrapeRun(
        run_date=date.today(),
        status=ScrapeRunStatus.PENDING,
        triggered_by=f"admin:{admin.id}",
        notes=payload.notes,
    )
    for source in sources:
        run.source_runs.append(SourceScrapeRun(source_id=source.id, status=ScrapeRunStatus.PENDING))

    db.add(run)
    db.flush()
    log_admin_action(
        db, admin_id=admin.id, action=AdminAction.SCRAPE, target_table="scrape_runs", target_id=run.id,
        details={"source_code": payload.source_code, "sources": [s.code for s in sources]},
    )
    db.commit()
    db.refresh(run)
    return run


@router.get("/runs", response_model=list[ScrapeRunRead])
async def list_scraping_runs(db: Session = Depends(get_db), limit: int = Query(30, ge=1, le=100), offset: int = Query(0, ge=0)):
    stmt = (
        select(ScrapeRun)
        .order_by(ScrapeRun.run_date.desc(), ScrapeRun.started_at.desc().nullslast())
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(stmt))


@router.get("/runs/{run_id}", response_model=ScrapeRunRead)
async def get_scraping_run(run_id: str, db: Session = Depends(get_db)):
    run = db.scalar(select(ScrapeRun).options(selectinload(ScrapeRun.source_runs)).where(ScrapeRun.id == run_id))
    if not run:
        raise HTTPException(status_code=404, detail="Run introuvable")
    return run


@router.get("/runs/{run_id}/logs", response_model=list[EventLogRead])
async def get_scraping_run_logs(run_id: str, db: Session = Depends(get_db)):
    """Logs associés à un run (un événement par offre traitée sur chaque source du run)."""
    run = db.scalar(select(ScrapeRun).options(selectinload(ScrapeRun.source_runs)).where(ScrapeRun.id == run_id))
    if not run:
        raise HTTPException(status_code=404, detail="Run introuvable")

    source_run_ids = [sr.id for sr in run.source_runs]
    if not source_run_ids:
        return []

    stmt = (
        select(OfferIngestionEvent)
        .where(OfferIngestionEvent.source_scrape_run_id.in_(source_run_ids))
        .order_by(OfferIngestionEvent.created_at.desc())
    )
    level_by_action = {"failed": "error", "skipped": "warning", "duplicate": "info", "updated": "info", "inserted": "info"}
    return [
        EventLogRead(
            id=event.id,
            created_at=event.created_at,
            updated_at=event.created_at,
            module="scraping",
            niveau=level_by_action.get(event.action.value, "info"),
            action=event.action.value,
            offer_id=event.offer_id,
            source_scrape_run_id=event.source_scrape_run_id,
            hash_unique=event.hash_unique,
            raw_url=event.raw_url,
            message=event.reason,
        )
        for event in db.scalars(stmt)
    ]
