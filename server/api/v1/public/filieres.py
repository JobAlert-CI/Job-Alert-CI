from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, joinedload

from api.deps import get_db
from api.v1.public.offers import _apply_offer_filters, _load_offer_relations, _public_filters
from models import Filiere, JobOffer, Subscriber, SubscriberFiliere, SubscriberStatus
from schemas.offers import JobOfferRead
from schemas.referentials import FiliereRead
from pydantic import BaseModel

router = APIRouter(prefix="/api/filieres", tags=["filieres"])


class FiliereStatsRead(BaseModel):
    active_offers: int
    new_offers: int
    subscribers: int


class FiliereWithStats(FiliereRead):
    stats: FiliereStatsRead


@router.get("", response_model=list[FiliereWithStats])
def list_filieres_page(
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None, min_length=2),
    sort: str = Query("volume", pattern="^(volume|az)$"),
):
    """Page /filieres — liste avec compteurs (actives, nouvelles, abonnés)."""
    filieres = db.scalars(
        select(Filiere)
        .where(Filiere.is_active.is_(True))
        .order_by(Filiere.label.asc() if sort == "az" else Filiere.sort_order.asc())
    ).all()
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    results = []
    for f in filieres:
        active_offers = db.scalar(
            select(func.count(JobOffer.id))
            .where(JobOffer.primary_filiere_id == f.id, *_public_filters())
        ) or 0
        new_offers = db.scalar(
            select(func.count(JobOffer.id))
            .where(JobOffer.primary_filiere_id == f.id, JobOffer.first_seen_at >= today, *_public_filters())
        ) or 0
        subscribers = db.scalar(
            select(func.count(SubscriberFiliere.id))
            .join(Subscriber, Subscriber.id == SubscriberFiliere.subscriber_id)
            .where(SubscriberFiliere.filiere_id == f.id, Subscriber.status == SubscriberStatus.ACTIVE)
        ) or 0
        
        # Sort based on volume if sort == "volume"
        results.append(
            FiliereWithStats(
                **f.__dict__, 
                specialties=[s for s in f.specialties if s.is_active],
                stats=FiliereStatsRead(
                    active_offers=active_offers,
                    new_offers=new_offers,
                    subscribers=subscribers
                )
            )
        )
    
    if sort == "volume":
        results.sort(key=lambda x: x.stats.active_offers, reverse=True)
        
    return results


@router.get("/{slug}", response_model=FiliereWithStats)
def get_filiere_detail(slug: str, db: Session = Depends(get_db)):
    """Page /filieres/:slug — méta complète + spécialités + stats."""
    f = db.scalar(
        select(Filiere)
        .where((Filiere.slug == slug) | (Filiere.code == slug), Filiere.is_active.is_(True))
    )
    if not f:
        raise HTTPException(status_code=404, detail="Filière introuvable")

    since = datetime.utcnow().replace(tzinfo=None) - timedelta(days=7)
    active_offers = db.scalar(
        select(func.count(JobOffer.id))
        .where(JobOffer.primary_filiere_id == f.id, *_public_filters())
    ) or 0
    new_offers = db.scalar(
        select(func.count(JobOffer.id))
        .where(JobOffer.primary_filiere_id == f.id, JobOffer.first_seen_at >= since, *_public_filters())
    ) or 0
    subscribers = db.scalar(
        select(func.count(SubscriberFiliere.id))
        .join(Subscriber, Subscriber.id == SubscriberFiliere.subscriber_id)
        .where(SubscriberFiliere.filiere_id == f.id, Subscriber.status == SubscriberStatus.ACTIVE)
    ) or 0
    
    return FiliereWithStats(
        **f.__dict__,
        specialties=[s for s in f.specialties if s.is_active],
        stats=FiliereStatsRead(
            active_offers=active_offers,
            new_offers=new_offers,
            subscribers=subscribers
        )
    )


@router.get("/{slug}/offers", response_model=list[JobOfferRead])
def list_filiere_offers(
    slug: str,
    db: Session = Depends(get_db),
    specialite_id: Optional[str] = None,
    source_id: Optional[str] = None,
    contract_type_id: Optional[str] = None,
    experience_level_id: Optional[str] = None,
    education_level_id: Optional[str] = None,
    q: Optional[str] = Query(None, min_length=2),
    published_since: Optional[datetime] = None,
    published_until: Optional[datetime] = None,
    sort: str = Query("recent", pattern="^(recent|old|az|ent)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Offres d'une filière (page DetailsFilière)."""
    filiere = db.scalar(
        select(Filiere).where((Filiere.slug == slug) | (Filiere.code == slug))
    )
    if not filiere:
        raise HTTPException(status_code=404, detail="Filière introuvable")

    stmt = select(JobOffer).options(*_load_offer_relations()).where(*_public_filters())
    stmt = _apply_offer_filters(
        stmt,
        filiere_id=filiere.id,
        specialite_id=specialite_id,
        source_id=source_id,
        contract_type_id=contract_type_id,
        experience_level_id=experience_level_id,
        education_level_id=education_level_id,
        location_id=None,
        filieres=None,
        sources=None,
        contrats=None,
        experiences=None,
        niveaux=None,
        q=q,
        published_since=published_since,
        published_until=published_until,
    )
    if sort == "old":
        stmt = stmt.order_by(JobOffer.published_at.asc().nullslast(), JobOffer.created_at.asc())
    elif sort == "az":
        stmt = stmt.order_by(JobOffer.title.asc())
    elif sort == "ent":
        stmt = stmt.join(JobOffer.company).order_by("companies.name", JobOffer.published_at.desc().nullslast())
    else:
        stmt = stmt.order_by(JobOffer.published_at.desc().nullslast(), JobOffer.created_at.desc())
        
    return list(db.scalars(stmt.limit(limit).offset(offset)).unique())


@router.get("/{slug}/stats", response_model=FiliereStatsRead)
def get_filiere_stats(slug: str, db: Session = Depends(get_db)):
    """Compteurs : actives, nouvelles (7j), abonnés."""
    filiere = db.scalar(
        select(Filiere).where((Filiere.slug == slug) | (Filiere.code == slug))
    )
    if not filiere:
        raise HTTPException(status_code=404, detail="Filière introuvable")
        
    since = datetime.utcnow().replace(tzinfo=None) - timedelta(days=7)
    active_offers = db.scalar(
        select(func.count(JobOffer.id))
        .where(JobOffer.primary_filiere_id == filiere.id, *_public_filters())
    ) or 0
    new_offers = db.scalar(
        select(func.count(JobOffer.id))
        .where(JobOffer.primary_filiere_id == filiere.id, JobOffer.first_seen_at >= since, *_public_filters())
    ) or 0
    subscribers = db.scalar(
        select(func.count(SubscriberFiliere.id))
        .join(Subscriber, Subscriber.id == SubscriberFiliere.subscriber_id)
        .where(SubscriberFiliere.filiere_id == filiere.id, Subscriber.status == SubscriberStatus.ACTIVE)
    ) or 0
    
    return FiliereStatsRead(
        active_offers=active_offers,
        new_offers=new_offers,
        subscribers=subscribers
    )