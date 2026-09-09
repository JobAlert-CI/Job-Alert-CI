from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from api.deps import get_current_admin, get_db, require_roles
from core.dates import today_local
from models.admin import AdminAction, Administrator
from models.enums import IngestionAction, ScrapeRunStatus, SourceStatus
from models.jobs import OfferIngestionEvent
from models.referentials import Source
from models.scraping import ScrapeRun, SourceScrapeRun
from schemas.logs import INGESTION_LEVEL_BY_ACTION, EventLogRead
from schemas.scraping import (
    ScrapeRunNotesUpdate,
    ScrapeRunRead,
    ScrapingStatusRead,
    ScrapingSummaryRead,
    ScrapingTrigger,
)
from services.audit import log_admin_action
from services.scrape_runs import finish_source_run, record_run_event

# Le pilotage du scraping reste une operation sensible: super_admin uniquement.
router = APIRouter(
    prefix="/api/admin/scraping",
    tags=["admin-scraping"],
    dependencies=[Depends(require_roles("super_admin"))],
)


@router.get("/status", response_model=list[ScrapingStatusRead])
async def get_scraping_status(db: Session = Depends(get_db)) -> None:
    """État des 4 sources : dernier passage, durée, erreurs.

    Audit 4, K.2 : les totaux par source sont calcules en SQL (COUNT groupe)
    au lieu de charger tous les IDs pour les compter en Python ; le dernier
    run par source est resolu par une requete indexee LIMIT 1.
    """
    sources = list(db.scalars(select(Source).order_by(Source.priority)))
    if not sources:
        return []

    # Audit 4, K.2 : le total par source est calcule en SQL (une requete
    # COUNT groupee) au lieu de charger tous les IDs pour les compter en
    # Python (`len(list(...))` — le marqueur d'un COUNT manque).
    totals = {
        source_id: int(total or 0)
        for source_id, total in db.execute(
            select(SourceScrapeRun.source_id, func.count(SourceScrapeRun.id)).group_by(SourceScrapeRun.source_id)
        )
    }

    results = []
    for source in sources:
        # Dernier sous-run par source: requete indexee LIMIT 1 (peu de
        # sources, le cout marginal par source reste negligeable).
        last_run = db.scalar(
            select(SourceScrapeRun)
            .where(SourceScrapeRun.source_id == source.id)
            .order_by(SourceScrapeRun.started_at.desc().nullslast(), SourceScrapeRun.created_at.desc())
            .limit(1)
        )
        results.append(
            ScrapingStatusRead(
                source_code=source.code,
                source_name=source.name,
                last_run_at=last_run.started_at if last_run else None,
                last_status=last_run.status.value if last_run and last_run.status else None,
                last_duration_ms=last_run.duration_ms if last_run else None,
                last_error=last_run.error_message if last_run else None,
                total_runs=totals.get(source.id, 0),
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

    Audit 4, C.1/C.3 : le run cree n'est plus un fantome PENDING — la route
    dispatche reellement `run_source_scraper` pour CHAQUE source du run
    (queue `ingestion`) et journalise l'id de task Celery dans `run_reference`.
    Si le broker est injoignable, le run cree passe FAILED immediatement
    (pas de ligne mensongere « en attente ») et un 503 explicite remonte.
    """
    sources_query = select(Source).where(Source.status == SourceStatus.ACTIVE, Source.supports_scraping.is_(True))
    if payload.source_code:
        sources_query = sources_query.where(Source.code == payload.source_code)
    sources = list(db.scalars(sources_query))
    if not sources:
        raise HTTPException(status_code=404, detail="Aucune source active correspondante")

    run_date = today_local()
    triggered_by = f"admin:{admin.id}"
    # Audit 4, C.2 : pre-check (run_date, triggered_by) pour un 409 metier
    # propre ; la contrainte UNIQUE reste le garde-fou de dernier recours.
    existing_run = db.scalar(select(ScrapeRun.id).where(ScrapeRun.run_date == run_date, ScrapeRun.triggered_by == triggered_by))
    if existing_run is not None:
        raise HTTPException(
            status_code=409,
            detail=f"Un run a deja ete declenche aujourd'hui par cet administrateur (run {existing_run}). Attendez demain ou utilisez le bouton par source.",
        )

    run = ScrapeRun(
        run_date=run_date,
        status=ScrapeRunStatus.PENDING,
        triggered_by=triggered_by,
        notes=payload.notes,
        # C.3 : le run admin vit dans le meme univers que le pipeline reel —
        # `run_reference` fait le lien avec les tasks Celery dispatchees.
        run_reference=f"admin-trigger:{run_date.isoformat()}:{admin.id}",
    )
    for source in sources:
        run.source_runs.append(SourceScrapeRun(source_id=source.id, status=ScrapeRunStatus.PENDING))

    db.add(run)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Un run existe deja pour aujourd'hui et ce declencheur.") from exc

    # C.1 : le run est persisté AVANT le dispatch pour que les tasks Celery
    # puissent adopter leurs lignes de supervision via run_reference. Si le
    # broker est injoignable, on annule proprement le run (pas de ligne
    # mensongere « en attente » pour toujours) et un 503 explicite remonte.
    db.commit()

    from tasks.scrapers import run_source_scraper

    dispatched: dict[str, str] = {}
    broker_error: Exception | None = None
    for source in sources:
        try:
            async_result = run_source_scraper.apply_async(
                args=(source.code,),
                kwargs={"run_reference": f"admin-trigger:{run_date.isoformat()}:{admin.id}"},
                queue="ingestion",
            )
            dispatched[source.code] = str(async_result.id)
        except Exception as exc:  # Broker down : note et on continue par source.
            broker_error = broker_error or exc

    if not dispatched:
        # Aucun dispatch possible : on conclut chaque sous-run en echec et le
        # run passe FAILED — trace honnete, verifiable, sans zombie PENDING.
        db.rollback()
        run = db.scalar(select(ScrapeRun).where(ScrapeRun.id == run.id))
        for source_run in run.source_runs:
            finish_source_run(source_run, ScrapeRunStatus.FAILED, error_message="broker_injoignable")
        record_run_event(
            db, source_run=None, action=IngestionAction.FAILED, reason=f"broker_celery_injoignable: {broker_error}"[:255]
        )
        db.commit()
        raise HTTPException(status_code=503, detail="Broker Celery injoignable, run marque failed.") from broker_error

    if broker_error is not None:
        # Echec PARTIEL : les sources dispatchees vivent leur vie ; seules
        # les non-dispatchees sont conclues FAILED maintenant (sinon des
        # tasks vivantes ecriraient sur un run deja marque FAILED).
        db.rollback()
        run = db.scalar(select(ScrapeRun).where(ScrapeRun.id == run.id))
        for source_run in run.source_runs:
            dispatched_source = next((s for s in sources if s.id == source_run.source_id), None)
            if dispatched_source is not None and dispatched_source.code not in dispatched:
                finish_source_run(source_run, ScrapeRunStatus.FAILED, error_message="broker_injoignable")
        record_run_event(
            db, source_run=None, action=IngestionAction.FAILED,
            reason=f"broker_partiellement_injoignable: {broker_error}"[:255],
        )

    log_admin_action(
        db, admin_id=admin.id, action=AdminAction.SCRAPE, target_table="scrape_runs", target_id=run.id,
        details={
            "source_code": payload.source_code,
            "sources": [s.code for s in sources],
            "task_ids": dispatched,
            "run_reference": run.run_reference,
        },
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


@router.get("/stats/summary", response_model=ScrapingSummaryRead)
async def scraping_stats_summary(db: Session = Depends(get_db)) -> None:
    """Agrégats all-time sur les runs (compteurs du haut de la page Scraping).

    Une seule requête GROUP BY virtuel (SUM + COUNT en une passe) :
    - total_runs : tous les runs, y compris pending/running ;
    - success_rate : success / runs TERMINÉS (success, partial_failure,
      failed) — pending/running exclus du dénominateur, sinon le taux
      serait artificiellement basé sur des runs non conclus ;
    - total_raw/inserted_all_time : cumul des volumes collectés.
    """
    finished = (ScrapeRunStatus.SUCCESS, ScrapeRunStatus.PARTIAL_FAILURE, ScrapeRunStatus.FAILED)
    row = db.execute(
        select(
            func.count(ScrapeRun.id),
            func.sum(case((ScrapeRun.status == ScrapeRunStatus.SUCCESS, 1), else_=0)),
            func.sum(case((ScrapeRun.status.in_(finished), 1), else_=0)),
            func.coalesce(func.sum(ScrapeRun.total_raw), 0),
            func.coalesce(func.sum(ScrapeRun.total_inserted), 0),
        )
    ).one()

    total_runs, successes, finished_runs, total_raw, total_inserted = (
        int(v) if v is not None else 0 for v in row
    )
    return ScrapingSummaryRead(
        total_runs=total_runs,
        success_rate=round(100.0 * successes / finished_runs, 1) if finished_runs else None,
        total_raw_all_time=total_raw,
        total_inserted_all_time=total_inserted,
    )


@router.get("/runs/{run_id}", response_model=ScrapeRunRead)
async def get_scraping_run(run_id: str, db: Session = Depends(get_db)) -> None:
    run = db.scalar(select(ScrapeRun).options(selectinload(ScrapeRun.source_runs)).where(ScrapeRun.id == run_id))
    if not run:
        raise HTTPException(status_code=404, detail="Run introuvable")
    return run


@router.patch("/runs/{run_id}", response_model=ScrapeRunRead)
async def update_scraping_run_notes(
    run_id: str,
    payload: ScrapeRunNotesUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Annote un run après coup (notes libres, usage forensique).

    Audit 4, C.4 : `ScrapeRun.notes` n'etait ecrite qu'a la creation par la
    route de declenchement — impossible d'annoter « source down, on relancera
    demain » apres un echec. PATCH notes uniquement, journalise.
    """
    run = db.scalar(select(ScrapeRun).where(ScrapeRun.id == run_id))
    if not run:
        raise HTTPException(status_code=404, detail="Run introuvable")
    old_notes = run.notes
    run.notes = payload.notes
    log_admin_action(
        db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="scrape_runs", target_id=run.id,
        details={"action": "notes", "ancien": old_notes, "nouveau": payload.notes},
    )
    db.commit()
    db.refresh(run)
    return run


@router.get("/runs/{run_id}/logs", response_model=list[EventLogRead])
async def get_scraping_run_logs(
    run_id: str,
    db: Session = Depends(get_db),
    limit: int = Query(200, ge=1, le=200),
    offset: int = Query(0, ge=0),
    level: str | None = Query(None, description="info, warning ou error (mapping partage INGESTION_LEVEL_BY_ACTION)"),
):
    """Logs associés à un run (un événement par offre traitée sur chaque source du run).

    Audit 4, C.6 : reponse bornee (limit/offset) + filtre niveau applique
    SQL via le mapping partage — plus de liste non bornee sur les gros runs.
    """
    run = db.scalar(select(ScrapeRun).options(selectinload(ScrapeRun.source_runs)).where(ScrapeRun.id == run_id))
    if not run:
        raise HTTPException(status_code=404, detail="Run introuvable")

    source_run_ids = [sr.id for sr in run.source_runs]
    if not source_run_ids:
        return []

    # Mapping inverse: level -> liste d'actions correspondantes (partage avec
    # /admin/logs — Audit 4, A.6 : plus de copie locale divergente).
    if level is None:
        allowed_actions = None
    else:
        allowed_actions = [action for action, lvl in INGESTION_LEVEL_BY_ACTION.items() if lvl == level]
        if not allowed_actions:
            return []

    stmt = (
        select(OfferIngestionEvent)
        .where(OfferIngestionEvent.source_scrape_run_id.in_(source_run_ids))
        .order_by(OfferIngestionEvent.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if allowed_actions is not None:
        stmt = stmt.where(OfferIngestionEvent.action.in_(allowed_actions))
    return [
        EventLogRead(
            id=event.id,
            created_at=event.created_at,
            updated_at=event.created_at,
            module="scraping",
            niveau=INGESTION_LEVEL_BY_ACTION.get(event.action, "info"),
            action=event.action.value,
            offer_id=event.offer_id,
            source_scrape_run_id=event.source_scrape_run_id,
            hash_unique=event.hash_unique,
            raw_url=event.raw_url,
            message=event.reason,
        )
        for event in db.scalars(stmt)
    ]
