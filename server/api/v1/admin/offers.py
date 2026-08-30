from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from api.deps import get_current_admin, get_db, require_roles
from api.v1.public.offers import _load_offer_relations
from models.admin import AdminAction, Administrator
from models.jobs import JobOffer, JobOfferStatus
from schemas.offers import (
    JobOfferRead,
    OfferBulkStatusUpdate,
    OfferCreate,
    OfferStatusUpdate,
    OfferUpdate,
    OfferVisibilityUpdate,
)
from services.audit import log_admin_action
from services.offers import create_offer as create_offer_service
from services.offers import update_offer as update_offer_service

# gestionnaire_offres gere le quotidien des offres; super_admin garde acces partout.
router = APIRouter(
    prefix="/api/admin/offers",
    tags=["admin-offers"],
    dependencies=[Depends(require_roles("super_admin", "gestionnaire_offres"))],
)


def _require_offer(db: Session, offer_id: str, *, with_relations: bool = False) -> JobOffer:
    stmt = select(JobOffer).where(JobOffer.id == offer_id)
    if with_relations:
        stmt = select(JobOffer).options(*_load_offer_relations()).where(JobOffer.id == offer_id)
    offer = db.scalar(stmt)
    if not offer:
        raise HTTPException(status_code=404, detail="Offre introuvable")
    return offer


@router.get("", response_model=list[JobOfferRead])
async def list_offers_admin(
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None, description="Recherche dans le titre"),
    filiere_id: Optional[str] = Query(None, description="ID de filière"),
    source_id: Optional[str] = Query(None, description="ID de source"),
    status: Optional[str] = Query(None, description="Statut exact de l'offre (active, expired, filled, archived, ...)"),
    visible_site: Optional[bool] = Query(None, description="Visibilité publique"),
    origin: Optional[str] = Query(None, description="Origine (scraping, manuel, import)"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Liste complète (y compris masquées/archivées)."""
    stmt = select(JobOffer).options(*_load_offer_relations())

    if q:
        stmt = stmt.where(JobOffer.title.ilike(f"%{q}%"))
    if filiere_id:
        stmt = stmt.where(JobOffer.primary_filiere_id == filiere_id)
    if source_id:
        stmt = stmt.where(JobOffer.source_id == source_id)
    if status:
        stmt = stmt.where(JobOffer.status == status)
    if visible_site is not None:
        stmt = stmt.where(JobOffer.visible_site == visible_site)
    if origin:
        stmt = stmt.where(JobOffer.origin == origin)

    stmt = stmt.order_by(JobOffer.created_at.desc())
    return list(db.scalars(stmt.limit(limit).offset(offset)).unique())


@router.get("/{offer_id}", response_model=JobOfferRead)
async def get_offer_admin(offer_id: str, db: Session = Depends(get_db)):
    """Détail complet admin (y compris masqué/archivé)."""
    return _require_offer(db, offer_id, with_relations=True)


@router.post("", status_code=201, response_model=JobOfferRead)
async def create_offer(
    payload: OfferCreate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Ajout manuel d'une offre (origin=manuel), avec la même normalisation/dédoublonnage que le scraping."""
    try:
        offer = create_offer_service(db, payload, admin_id=admin.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    log_admin_action(db, admin_id=admin.id, action=AdminAction.CREATE, target_table="job_offers", target_id=offer.id)
    db.commit()
    return _require_offer(db, offer.id, with_relations=True)


@router.put("/{offer_id}", response_model=JobOfferRead)
async def update_offer(
    offer_id: str,
    payload: OfferUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Édition d'une offre (titre, entreprise, filière, contrat, contenu détaillé...)."""
    offer = _require_offer(db, offer_id)
    try:
        update_offer_service(db, offer, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    log_admin_action(db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="job_offers", target_id=offer.id)
    db.commit()
    return _require_offer(db, offer_id, with_relations=True)


@router.patch("/{offer_id}/visibility")
async def toggle_offer_visibility(
    offer_id: str,
    payload: OfferVisibilityUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Active/désactive visible_site (affichage sur le site public)."""
    offer = _require_offer(db, offer_id)
    offer.visible_site = payload.visible_site
    log_admin_action(
        db,
        admin_id=admin.id,
        action=AdminAction.UPDATE,
        target_table="job_offers",
        target_id=offer.id,
        details={"visible_site": payload.visible_site},
    )
    db.commit()
    return {"message": "Visibilité mise à jour", "visible_site": offer.visible_site}


@router.patch("/{offer_id}/status")
async def update_offer_status(
    offer_id: str,
    payload: OfferStatusUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Change le statut (active, expired, filled, archived, duplicate, hidden)."""
    offer = _require_offer(db, offer_id)
    offer.status = JobOfferStatus(payload.status)
    log_admin_action(
        db,
        admin_id=admin.id,
        action=AdminAction.UPDATE,
        target_table="job_offers",
        target_id=offer.id,
        details={"status": payload.status},
    )
    db.commit()
    return {"message": "Statut mis à jour", "status": offer.status.value}


@router.delete("/{offer_id}", status_code=204)
async def delete_offer(
    offer_id: str,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Suppression logique (soft delete)."""
    offer = _require_offer(db, offer_id)
    offer.deleted_at = datetime.now(timezone.utc)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.DELETE, target_table="job_offers", target_id=offer.id)
    db.commit()


@router.post("/bulk-status")
async def bulk_update_status(
    payload: OfferBulkStatusUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Changement de statut en masse (ex: expirer les offres > 30j)."""
    stmt = (
        update(JobOffer)
        .where(JobOffer.id.in_(payload.offer_ids))
        .values(status=JobOfferStatus(payload.status))
    )
    result = db.execute(stmt)
    log_admin_action(
        db,
        admin_id=admin.id,
        action=AdminAction.UPDATE,
        target_table="job_offers",
        details={"offer_ids": payload.offer_ids, "status": payload.status, "count": result.rowcount},
    )
    db.commit()
    return {"message": f"{result.rowcount} offres mises à jour"}