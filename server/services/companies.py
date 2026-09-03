"""Services Company (document 8 — section 2.1 / 2.5)."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models.jobs import Company, JobOffer, JobOfferStatus


def create_company(db: Session, name: str, normalized_name: str, **kwargs) -> Company:
    company = Company(name=name, normalized_name=normalized_name, **kwargs)
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def delete_company(db: Session, company_id: str) -> None:
    company = db.get(Company, company_id)
    if not company:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")
    company.deleted_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    db.commit()


def merge_companies(db: Session, target_id: str, source_id: str) -> dict:
    target = db.get(Company, target_id)
    source = db.get(Company, source_id)
    if not target or not source:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")
    # Réattribuer toutes les offres actives et archivées
    offers = db.scalars(select(JobOffer).where(JobOffer.company_id == source.id)).all()
    for offer in offers:
        offer.company_id = target.id
    # Marquer la source comme supprimée (soft delete)
    source.deleted_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    db.commit()
    return {"message": f"Entreprise {source_id} fusionnée dans {target_id}", "offers_reassigned": len(offers)}
