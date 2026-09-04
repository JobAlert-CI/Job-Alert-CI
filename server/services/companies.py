"""Services Company (document 8 — section 2.1 / 2.5)."""
from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models.jobs import Company, JobOffer, JobOfferStatus


class CompanyServiceError(Exception):
    """Erreur metier portant le code HTTP a renvoyer par la route.

    Le service ne doit pas connaitre FastAPI: la traduction en HTTPException
    se fait dans la couche route.
    """

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def create_company(db: Session, name: str, normalized_name: str, **kwargs) -> Company:
    company = Company(name=name, normalized_name=normalized_name, **kwargs)
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def update_company(db: Session, company_id: str, **fields) -> Company:
    company = db.get(Company, company_id)
    if not company:
        raise CompanyServiceError("Entreprise non trouvee", status_code=404)
    for key, value in fields.items():
        if value is None:
            continue
        setattr(company, key, value)
    db.commit()
    db.refresh(company)
    return company


def soft_delete_company(db: Session, company_id: str) -> None:
    company = db.get(Company, company_id)
    if not company:
        raise CompanyServiceError("Entreprise non trouvee", status_code=404)
    company.deleted_at = datetime.now(UTC)
    db.commit()


def merge_companies(
    db: Session,
    *,
    target_id: str,
    source_id: str,
    admin_id: str | None = None,
) -> dict:
    """Reattribue les offres de `source` vers `target` puis soft-delete `source`.

    Refuse la fusion d'une entreprise avec elle-meme (sinon no-op trompeur).
    Le caller est responsable de l'appel a `log_admin_action` (effectue dans
    la route pour preserver la separation service/route).
    """
    if target_id == source_id:
        raise CompanyServiceError(
            "Impossible de fusionner une entreprise avec elle-meme",
            status_code=400,
        )

    target = db.get(Company, target_id)
    source = db.get(Company, source_id)
    if not target or not source:
        raise CompanyServiceError("Entreprise non trouvee", status_code=404)

    offers = db.scalars(select(JobOffer).where(JobOffer.company_id == source.id)).all()
    for offer in offers:
        offer.company_id = target.id
    source.deleted_at = datetime.now(UTC)
    db.commit()
    return {
        "message": f"Entreprise {source_id} fusionnee dans {target_id}",
        "offers_reassigned": len(offers),
    }


def top_recruiters(db: Session, *, limit: int = 10) -> list[tuple[Company, int]]:
    """Renvoie les entreprises triees par nombre d'offres actives.

    Single SQL query (GROUP BY + JOIN) pour eviter le N+1 signale par l'audit.
    Renvoie une liste de tuples (Company, active_offers_count).
    """
    stmt = (
        select(Company, func.count(JobOffer.id).label("active_offers_count"))
        .join(JobOffer, JobOffer.company_id == Company.id, isouter=True)
        .where(
            Company.deleted_at.is_(None),
            (JobOffer.id.is_(None)) | (JobOffer.status == JobOfferStatus.ACTIVE.value),
        )
        .group_by(Company.id)
        .order_by(func.count(JobOffer.id).desc(), Company.name.asc())
        .limit(limit)
    )
    rows = db.execute(stmt).all()
    return [(row[0], int(row[1] or 0)) for row in rows]


__all__ = [
    "CompanyServiceError",
    "create_company",
    "merge_companies",
    "soft_delete_company",
    "top_recruiters",
    "update_company",
]
