from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from api.deps import get_db
from models import ContractType, EducationLevel, ExperienceLevel, Filiere, JobOffer, JobOfferStatus, Source
from schemas.offers import JobOfferRead
from services.normalization import normalize_text
from services.offer_metrics import record_metric
from services.rate_limit import check_ip_rate_limit
from services.search_utils import safe_like_lower

router = APIRouter(prefix="/api/offers", tags=["offers"])


def _load_offer_relations():
    return (
        joinedload(JobOffer.company),
        joinedload(JobOffer.source),
        joinedload(JobOffer.location),
        joinedload(JobOffer.primary_filiere),
        joinedload(JobOffer.specialty),
        joinedload(JobOffer.contract_type),
        joinedload(JobOffer.experience_level),
        joinedload(JobOffer.education_level),
        joinedload(JobOffer.detail),
    )


def _codes(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def _public_filters() -> list:
    return [
        JobOffer.visible_site.is_(True),
        JobOffer.status == JobOfferStatus.ACTIVE,
        JobOffer.deleted_at.is_(None),
    ]


def _apply_offer_filters(
    stmt,
    *,
    filiere_id: str | None,
    specialite_id: str | None,
    source_id: str | None,
    contract_type_id: str | None,
    experience_level_id: str | None,
    education_level_id: str | None,
    location_id: str | None,
    filieres: str | None,
    sources: str | None,
    contrats: str | None,
    experiences: str | None,
    niveaux: str | None,
    q: str | None,
    published_since: datetime | None,
    published_until: datetime | None,
):
    if filiere_id:
        stmt = stmt.where(JobOffer.primary_filiere_id == filiere_id)
    if specialite_id:
        stmt = stmt.where(JobOffer.specialty_id == specialite_id)
    if source_id:
        stmt = stmt.where(JobOffer.source_id == source_id)
    if contract_type_id:
        stmt = stmt.where(JobOffer.contract_type_id == contract_type_id)
    if experience_level_id:
        stmt = stmt.where(JobOffer.experience_level_id == experience_level_id)
    if education_level_id:
        stmt = stmt.where(JobOffer.education_level_id == education_level_id)
    if location_id:
        stmt = stmt.where(JobOffer.location_id == location_id)
    if _codes(filieres):
        stmt = stmt.where(JobOffer.primary_filiere.has(Filiere.code.in_(_codes(filieres))))
    if _codes(sources):
        stmt = stmt.where(JobOffer.source.has(Source.code.in_(_codes(sources))))
    if _codes(contrats):
        stmt = stmt.where(JobOffer.contract_type.has(ContractType.code.in_(_codes(contrats))))
    if _codes(experiences):
        stmt = stmt.where(JobOffer.experience_level.has(ExperienceLevel.code.in_(_codes(experiences))))
    if _codes(niveaux):
        stmt = stmt.where(JobOffer.education_level.has(EducationLevel.code.in_(_codes(niveaux))))
    if q:
            # `normalized_title` est case-insensitive en base (normalise en lowercase).
            # On utilise LIKE avec ESCAPE pour eviter l'injection de wildcards.
            stmt = stmt.where(safe_like_lower(JobOffer.normalized_title, normalize_text(q)))
    if published_since:
        stmt = stmt.where(JobOffer.published_at >= published_since)
    if published_until:
        stmt = stmt.where(JobOffer.published_at <= published_until)
    return stmt


@router.get("", response_model=list[JobOfferRead])
def list_offers(
    db: Session = Depends(get_db),
    filiere_id: str | None = Query(None, description="Filtrer par ID de filière"),
    specialite_id: str | None = Query(None, description="Filtrer par ID de spécialité"),
    source_id: str | None = Query(None, description="Filtrer par ID de source"),
    contract_type_id: str | None = Query(None, description="Filtrer par ID de contrat"),
    experience_level_id: str | None = Query(None, description="Filtrer par ID d'expérience"),
    education_level_id: str | None = Query(None, description="Filtrer par ID de niveau d'études"),
    location_id: str | None = Query(None, description="Filtrer par ID de localisation"),
    filieres: str | None = Query(None, description="Codes de filieres separes par virgule"),
    sources: str | None = Query(None, description="Codes de sources separes par virgule"),
    contrats: str | None = Query(None, description="Codes de contrats separes par virgule"),
    experiences: str | None = Query(None, description="Codes d'experience separes par virgule"),
    niveaux: str | None = Query(None, description="Codes de niveaux d'etudes separes par virgule"),
    q: str | None = Query(None, min_length=2),
    published_since: datetime | None = None,
    published_until: datetime | None = None,
    sort: Literal["recent", "old", "az", "ent"] = "recent",
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> list[JobOffer]:
    """Flux public des offres, filtre des le SQL."""

    stmt = select(JobOffer).options(*_load_offer_relations()).where(*_public_filters())
    stmt = _apply_offer_filters(
        stmt,
        filiere_id=filiere_id,
        specialite_id=specialite_id,
        source_id=source_id,
        contract_type_id=contract_type_id,
        experience_level_id=experience_level_id,
        education_level_id=education_level_id,
        location_id=location_id,
        filieres=filieres,
        sources=sources,
        contrats=contrats,
        experiences=experiences,
        niveaux=niveaux,
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


@router.get("/{offer_id}", response_model=JobOfferRead)
def get_offer(offer_id: str, db: Session = Depends(get_db)):
    stmt = (
        select(JobOffer)
        .options(*_load_offer_relations())
        .where((JobOffer.id == offer_id) | (JobOffer.slug == offer_id), *_public_filters())
    )
    offer = db.scalar(stmt)
    if offer is None:
        raise HTTPException(status_code=404, detail="Offre introuvable")
    return offer


@router.get("/{offer_id}/similar", response_model=list[JobOfferRead])
def get_similar_offers(offer_id: str, db: Session = Depends(get_db), limit: int = Query(3, ge=1, le=10)):
    offer = db.scalar(select(JobOffer).where((JobOffer.id == offer_id) | (JobOffer.slug == offer_id), *_public_filters()))
    if offer is None:
        raise HTTPException(status_code=404, detail="Offre introuvable")
    stmt = (
        select(JobOffer)
        .options(*_load_offer_relations())
        .where(
            JobOffer.id != offer.id,
            JobOffer.primary_filiere_id == offer.primary_filiere_id,
            *_public_filters(),
        )
        .order_by(JobOffer.published_at.desc().nullslast())
        .limit(limit)
    )
    return list(db.scalars(stmt).unique())


@router.post("/{offer_id}/view")
def register_offer_view(
    offer_id: str,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, int]:
    """Incremente `view_count` (audit S7 + audit 2, F3: bufferise Redis).

    Le compteur affiche vient de Redis (valeur base + buffer) quand Redis
    est disponible; sinon fallback synchrone direct.
    """
    _enforce_metric_rate_limit(request, scope="offer-view")
    offer = db.scalar(
        select(JobOffer).where(
            (JobOffer.id == offer_id) | (JobOffer.slug == offer_id),
            *_public_filters(),
        )
    )
    if offer is None:
        raise HTTPException(status_code=404, detail="Offre introuvable")
    counted = record_metric(db, offer, "view")
    if counted is None:
        # Redis indisponible: increment direct en base.
        offer.view_count += 1
        db.commit()
        counted = offer.view_count
    return {"view_count": counted}


@router.post("/{offer_id}/save")
def save_offer(
    offer_id: str,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, int]:
    """Incremente `save_count` (audit S7 + audit 2, F3: bufferise Redis)."""
    _enforce_metric_rate_limit(request, scope="offer-save")
    offer = db.scalar(
        select(JobOffer).where(
            (JobOffer.id == offer_id) | (JobOffer.slug == offer_id),
            *_public_filters(),
        )
    )
    if offer is None:
        raise HTTPException(status_code=404, detail="Offre introuvable")
    counted = record_metric(db, offer, "save")
    if counted is None:
        # Redis indisponible: increment direct en base.
        offer.save_count += 1
        db.commit()
        counted = offer.save_count
    return {"save_count": counted}


def _enforce_metric_rate_limit(request: Request, *, scope: str) -> None:
    """Rate-limit anti-gonflement (audit S7). 60 hits/min par IP."""
    ip = _client_ip(request) or "unknown"
    decision = check_ip_rate_limit(scope=scope, client_ip=ip, limit_per_minute=60)
    if not decision.allowed:
        raise HTTPException(
            status_code=429,
            detail="Trop de requetes",
            headers={"Retry-After": str(decision.retry_after_seconds or 60)},
        )


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None
