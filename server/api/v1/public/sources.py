from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from pydantic import BaseModel

from api.deps import get_db
from models import JobOffer, Source, SourceScrapeRun
from schemas.offers import JobOfferRead
from schemas.referentials import SourceRead
from api.v1.public.offers import _public_filters, _load_offer_relations

router = APIRouter(prefix="/api/sources", tags=["sources"])


class SourceStatsRead(BaseModel):
    active_offers: int
    new_offers: int
    last_scrape_status: str | None = None
    last_scrape_duration: int | None = None


class SourceWithStats(SourceRead):
    stats: SourceStatsRead


@router.get("", response_model=list[SourceWithStats])
def list_sources_page(db: Session = Depends(get_db)):
    """Page /sources — 4 sources avec stats (total, nouveaux, passage, durée)."""
    sources = db.scalars(
        select(Source)
        .where(Source.status == "active")
        .order_by(Source.priority.asc())
    ).all()
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    results = []
    for s in sources:
        active_offers = db.scalar(
            select(func.count(JobOffer.id))
            .where(JobOffer.source_id == s.id, *_public_filters())
        ) or 0
        new_offers = db.scalar(
            select(func.count(JobOffer.id))
            .where(JobOffer.source_id == s.id, JobOffer.first_seen_at >= today, *_public_filters())
        ) or 0
        
        last_run = db.scalar(
            select(SourceScrapeRun)
            .where(SourceScrapeRun.source_id == s.id)
            .order_by(SourceScrapeRun.started_at.desc().nullslast())
            .limit(1)
        )
        
        last_scrape_status = last_run.status.value if last_run and last_run.status else None
        last_scrape_duration = last_run.duration_ms if last_run else None
        
        results.append(
            SourceWithStats(
                **s.__dict__,
                stats=SourceStatsRead(
                    active_offers=active_offers,
                    new_offers=new_offers,
                    last_scrape_status=last_scrape_status,
                    last_scrape_duration=last_scrape_duration
                )
            )
        )
        
    return results


@router.get("/{slug}", response_model=SourceWithStats)
def get_source_detail(slug: str, db: Session = Depends(get_db)):
    """Détail d'une source (description, note, tags, stats)."""
    s = db.scalar(
        select(Source)
        .where(Source.slug == slug)
    )
    if not s:
        raise HTTPException(status_code=404, detail="Source introuvable")

    since = datetime.utcnow().replace(tzinfo=None) - timedelta(days=7)
    active_offers = db.scalar(
        select(func.count(JobOffer.id))
        .where(JobOffer.source_id == s.id, *_public_filters())
    ) or 0
    new_offers = db.scalar(
        select(func.count(JobOffer.id))
        .where(JobOffer.source_id == s.id, JobOffer.first_seen_at >= since, *_public_filters())
    ) or 0
    
    last_run = db.scalar(
        select(SourceScrapeRun)
        .where(SourceScrapeRun.source_id == s.id)
        .order_by(SourceScrapeRun.started_at.desc().nullslast())
        .limit(1)
    )
    
    last_scrape_status = last_run.status.value if last_run and last_run.status else None
    last_scrape_duration = last_run.duration_ms if last_run else None
    
    return SourceWithStats(
        **s.__dict__,
        stats=SourceStatsRead(
            active_offers=active_offers,
            new_offers=new_offers,
            last_scrape_status=last_scrape_status,
            last_scrape_duration=last_scrape_duration
        )
    )


@router.get("/{slug}/offers", response_model=list[JobOfferRead])
def list_source_offers(
    slug: str, 
    db: Session = Depends(get_db), 
    limit: int = Query(20, ge=1, le=100), 
    offset: int = Query(0, ge=0)
):
    """Offres d'une source (lien 'Voir les offres' sur Sources.jsx)."""
    s = db.scalar(
        select(Source)
        .where(Source.slug == slug)
    )
    if not s:
        raise HTTPException(status_code=404, detail="Source introuvable")

    stmt = (
        select(JobOffer)
        .options(*_load_offer_relations())
        .where(JobOffer.source_id == s.id, *_public_filters())
        .order_by(JobOffer.published_at.desc().nullslast())
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(stmt).unique())