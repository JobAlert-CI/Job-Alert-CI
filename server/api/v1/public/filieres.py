from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.deps import get_db
from api.v1.public.offers import _apply_offer_filters, _load_offer_relations, _public_filters
from models import Filiere, JobOffer, Subscriber, SubscriberFiliere, SubscriberStatus
from schemas.offers import JobOfferRead
from schemas.referentials import FiliereRead

from ._time_utils import today_start_utc

router = APIRouter(prefix="/api/filieres", tags=["filieres"])


class FiliereStatsRead(BaseModel):
    active_offers: int
    new_offers: int
    subscribers: int


class FiliereWithStats(FiliereRead):
    stats: FiliereStatsRead


def _aggregate_filiere_stats(db: Session, today, filiere_ids: list[str]) -> dict[str, FiliereStatsRead]:
    """Calcule les compteurs en 3 requetes GROUP BY (vs N+3 en boucle).

    Audit P1 #12: une seule agregation cote SQL, pas une boucle Python.
    """
    if not filiere_ids:
        return {}

    active_offers_per_filiere = dict(
        db.execute(
            select(JobOffer.primary_filiere_id, func.count(JobOffer.id))
            .where(
                JobOffer.primary_filiere_id.in_(filiere_ids),
                *_public_filters(),
            )
            .group_by(JobOffer.primary_filiere_id)
        ).all()
    )

    new_offers_per_filiere = dict(
        db.execute(
            select(JobOffer.primary_filiere_id, func.count(JobOffer.id))
            .where(
                JobOffer.primary_filiere_id.in_(filiere_ids),
                JobOffer.first_seen_at >= today,
                *_public_filters(),
            )
            .group_by(JobOffer.primary_filiere_id)
        ).all()
    )

    subscribers_per_filiere = dict(
        db.execute(
            select(SubscriberFiliere.filiere_id, func.count(SubscriberFiliere.id))
            .join(Subscriber, Subscriber.id == SubscriberFiliere.subscriber_id)
            .where(
                SubscriberFiliere.filiere_id.in_(filiere_ids),
                Subscriber.status == SubscriberStatus.ACTIVE,
            )
            .group_by(SubscriberFiliere.filiere_id)
        ).all()
    )

    result: dict[str, FiliereStatsRead] = {}
    for fid in filiere_ids:
        result[fid] = FiliereStatsRead(
            active_offers=int(active_offers_per_filiere.get(fid, 0) or 0),
            new_offers=int(new_offers_per_filiere.get(fid, 0) or 0),
            subscribers=int(subscribers_per_filiere.get(fid, 0) or 0),
        )
    return result


@router.get("", response_model=list[FiliereWithStats])
def list_filieres_page(
    db: Session = Depends(get_db),
    q: str | None = Query(None, min_length=2),
    sort: str = Query("volume", pattern="^(volume|az)$"),
):
    """Page /filieres : liste avec compteurs (actives, nouvelles, abonnes).

    Audit P1 #12: agregation en 3 GROUP BY (vs N+3 requetes par filiere avant).
    """
    filieres = db.scalars(
        select(Filiere)
        .where(Filiere.is_active.is_(True))
        .order_by(Filiere.label.asc() if sort == "az" else Filiere.sort_order.asc())
    ).all()

    today = today_start_utc()
    stats_by_id = _aggregate_filiere_stats(db, today, [f.id for f in filieres])

    results = [
        FiliereWithStats(
            **f.__dict__,
            specialties=[s for s in f.specialties if s.is_active],
            stats=stats_by_id.get(f.id, FiliereStatsRead(active_offers=0, new_offers=0, subscribers=0)),
        )
        for f in filieres
    ]

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

    today = today_start_utc()
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
    specialite_id: str | None = None,
    source_id: str | None = None,
    contract_type_id: str | None = None,
    experience_level_id: str | None = None,
    education_level_id: str | None = None,
    q: str | None = Query(None, min_length=2),
    published_since: datetime | None = None,
    published_until: datetime | None = None,
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
    """Compteurs : actives, nouvelles (aujourd'hui), abonnés."""
    filiere = db.scalar(
        select(Filiere).where((Filiere.slug == slug) | (Filiere.code == slug))
    )
    if not filiere:
        raise HTTPException(status_code=404, detail="Filière introuvable")

    today = today_start_utc()
    active_offers = db.scalar(
        select(func.count(JobOffer.id))
        .where(JobOffer.primary_filiere_id == filiere.id, *_public_filters())
    ) or 0
    new_offers = db.scalar(
        select(func.count(JobOffer.id))
        .where(JobOffer.primary_filiere_id == filiere.id, JobOffer.first_seen_at >= today, *_public_filters())
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
