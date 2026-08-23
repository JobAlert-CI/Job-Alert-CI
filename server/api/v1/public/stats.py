from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session
from pydantic import BaseModel
from api.deps import get_db
from models import ContractType, Filiere, JobOffer, JobOfferStatus, Source, ScrapeRun, Subscriber, SubscriberStatus
from api.v1.public.offers import _public_filters
from schemas.offer_stats import OfferStatsBucketRead, OfferStatsSummaryRead
from ._time_utils import today_start_utc

router = APIRouter(prefix="/api/stats", tags=["stats"])

# Alias conservé pour compatibilité (ancien nom utilisé ailleurs dans le code) :
# la logique réelle vit maintenant dans _time_utils.today_start_utc, partagée
# avec filieres.py et sources.py pour éviter toute divergence future.
_get_today_start = today_start_utc

@router.get("/offers", response_model=OfferStatsSummaryRead)
def get_offer_stats(
    db: Session = Depends(get_db),
    filiere_id: Optional[str] = None,
    source_id: Optional[str] = None,
    visible_only: bool = True,
    active_only: bool = True,
):
    """Compteurs rapides : total_offers, new_offers (Aujourd'hui)."""
    today_start = _get_today_start()
    # new_offers = offres vues pour la première fois aujourd'hui (depuis minuit)
    new_expr = func.coalesce(func.sum(case((JobOffer.first_seen_at >= today_start, 1), else_=0)), 0)
    
    filters = []
    if visible_only:
        filters.append(JobOffer.visible_site.is_(True))
    if active_only:
        filters.append(JobOffer.status == JobOfferStatus.ACTIVE)
        filters.append(JobOffer.deleted_at.is_(None))
    if filiere_id:
        filters.append(JobOffer.primary_filiere_id == filiere_id)
    if source_id:
        filters.append(JobOffer.source_id == source_id)
        
    stmt = select(func.count(JobOffer.id), new_expr).where(*filters)
    total_offers, new_offers = db.execute(stmt).one()
    
    return OfferStatsSummaryRead(total_offers=total_offers, new_offers=new_offers)

@router.get("/offers/by-filiere", response_model=list[OfferStatsBucketRead])
def get_offer_stats_by_filiere(
    db: Session = Depends(get_db),
    source_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
):
    """Répartition par filière : total + nouvelles (Aujourd'hui)."""
    today_start = _get_today_start()
    new_expr = func.coalesce(func.sum(case((JobOffer.first_seen_at >= today_start, 1), else_=0)), 0)
    
    filters = list(_public_filters())
    if source_id:
        filters.append(JobOffer.source_id == source_id)
        
    stmt = (
        select(Filiere.id, Filiere.code, Filiere.label, func.count(JobOffer.id), new_expr)
        .join(JobOffer, JobOffer.primary_filiere_id == Filiere.id)
        .where(*filters)
        .group_by(Filiere.id, Filiere.code, Filiere.label, Filiere.sort_order)
        .order_by(func.count(JobOffer.id).desc(), Filiere.sort_order)
        .limit(limit)
    )
    return [
        OfferStatsBucketRead(id=row[0], code=row[1], label=row[2], total_offers=row[3], new_offers=row[4])
        for row in db.execute(stmt)
    ]

@router.get("/offers/by-source", response_model=list[OfferStatsBucketRead])
def get_offer_stats_by_source(
    db: Session = Depends(get_db),
    filiere_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
):
    """Répartition par source : total + nouvelles (Aujourd'hui)."""
    today_start = _get_today_start()
    new_expr = func.coalesce(func.sum(case((JobOffer.first_seen_at >= today_start, 1), else_=0)), 0)
    
    filters = list(_public_filters())
    if filiere_id:
        filters.append(JobOffer.primary_filiere_id == filiere_id)
        
    stmt = (
        select(Source.id, Source.code, Source.name, func.count(JobOffer.id), new_expr)
        .join(JobOffer, JobOffer.source_id == Source.id)
        .where(*filters)
        .group_by(Source.id, Source.code, Source.name, Source.priority)
        .order_by(func.count(JobOffer.id).desc(), Source.priority)
        .limit(limit)
    )
    return [
        OfferStatsBucketRead(id=row[0], code=row[1], label=row[2], total_offers=row[3], new_offers=row[4])
        for row in db.execute(stmt)
    ]

@router.get("/offers/by-contract", response_model=list[OfferStatsBucketRead])
def get_offer_stats_by_contract(db: Session = Depends(get_db)):
    """Répartition par type de contrat."""
    stmt = (
        select(ContractType.id, ContractType.code, ContractType.label, func.count(JobOffer.id), func.count(JobOffer.id))
        .join(JobOffer, JobOffer.contract_type_id == ContractType.id)
        .where(*_public_filters())
        .group_by(ContractType.id, ContractType.code, ContractType.label, ContractType.sort_order)
        .order_by(func.count(JobOffer.id).desc())
    )
    return [
        OfferStatsBucketRead(id=row[0], code=row[1], label=row[2], total_offers=row[3], new_offers=0)
        for row in db.execute(stmt)
    ]

class GlobalStatsRead(BaseModel):
    active_offers: int
    new_today: int
    subscribers: int
    sources: int

@router.get("/global", response_model=GlobalStatsRead)
def get_global_stats(db: Session = Depends(get_db)):
    """Stats homepage : offres actives, nouvelles ce matin, abonnés, sources."""
    active_offers = db.scalar(select(func.count(JobOffer.id)).where(*_public_filters())) or 0
    
    today_start = _get_today_start()
    new_today = db.scalar(
        select(func.count(JobOffer.id))
        .where(JobOffer.first_seen_at >= today_start, *_public_filters())
    ) or 0
    
    subscribers = db.scalar(
        select(func.count(Subscriber.id))
        .where(Subscriber.status == SubscriberStatus.ACTIVE)
    ) or 0
    
    sources = db.scalar(
        select(func.count(Source.id))
        .where(Source.status == "active")
    ) or 0
    
    return GlobalStatsRead(
        active_offers=active_offers,
        new_today=new_today,
        subscribers=subscribers,
        sources=sources
    )

class PipelineStatusRead(BaseModel):
    status: str
    last_run_date: str | None

@router.get("/pipeline", response_model=PipelineStatusRead)
def get_pipeline_status(db: Session = Depends(get_db)):
    """État du pipeline du jour : collecte, dédoublonnage, envoi."""
    last_run = db.scalar(
        select(ScrapeRun)
        .order_by(ScrapeRun.run_date.desc())
        .limit(1)
    )
    if not last_run:
        return PipelineStatusRead(status="No runs yet", last_run_date=None)
    return PipelineStatusRead(
        status=last_run.status.value if last_run.status else "Unknown",
        last_run_date=last_run.run_date.isoformat()
    )