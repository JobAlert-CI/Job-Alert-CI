"""CRUD Companies + fusion + top-recruiters (document 8 — 2.1, 2.5)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import get_current_admin, get_db, require_roles
from models.admin import AdminAction, Administrator
from models.jobs import Company
from schemas.companies import CompanyAdminRead, CompanyCreate, CompanyUpdate
from services.audit import log_admin_action
from services.companies import (
    CompanyServiceError,
    create_company,
    merge_companies,
    soft_delete_company,
    top_recruiters,
)
from services.search_utils import safe_ilike

# Les entreprises impactent directement les offres exposees publiquement:
# on reserve la gestion au super_admin (defense en profondeur, cf. audit P0 #1).
router = APIRouter(
    prefix="/api/admin/companies",
    tags=["admin-companies"],
    dependencies=[Depends(require_roles("super_admin"))],
)


@router.get("", response_model=list[CompanyAdminRead])
def list_companies(
    db: Session = Depends(get_db),
    _: Administrator = Depends(get_current_admin),
    q: str | None = Query(None, max_length=120),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Liste paginee des entreprises avec recherche LIKE echappee (cf. audit P0 #4)."""
    stmt = select(Company)
    if q:
        stmt = stmt.where(safe_ilike(Company.name, q))
    stmt = stmt.order_by(Company.name.asc()).limit(limit).offset(offset)
    return list(db.scalars(stmt).unique())


@router.get("/top-recruiters", response_model=list[CompanyAdminRead])
def top_recruiters_route(
    db: Session = Depends(get_db),
    _: Administrator = Depends(get_current_admin),
    limit: int = Query(10, ge=1, le=50),
):
    """Entreprises qui recrutent le plus (tri par nombre d'offres actives).

    Une seule requete agregee (vs l'ancien code qui faisait 2 requetes + filtre Python, cf. audit P1 #15).
    """
    rows = top_recruiters(db, limit=limit)
    payload = []
    for company, active_count in rows:
        payload.append(
            CompanyAdminRead(
                id=company.id,
                name=company.name,
                normalized_name=company.normalized_name,
                slug=company.slug,
                website_url=company.website_url,
                logo_url=company.logo_url,
                description=company.description,
                primary_filiere_id=company.primary_filiere_id,
                created_at=company.created_at,
                updated_at=company.updated_at,
                active_offers_count=active_count,
            )
        )
    return payload


@router.post("", status_code=201, response_model=CompanyAdminRead)
def create_company_route(
    payload: CompanyCreate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    company = create_company(db, **payload.model_dump())
    log_admin_action(
        db,
        admin_id=admin.id,
        action=AdminAction.CREATE,
        target_table="companies",
        target_id=company.id,
        details={"name": company.name},
    )
    db.commit()
    return company


@router.put("/{company_id}", response_model=CompanyAdminRead)
def update_company_route(
    company_id: str,
    payload: CompanyUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Entreprise non trouvee")
    data = payload.model_dump(exclude_unset=True)
    for field_name, value in data.items():
        setattr(company, field_name, value)
    log_admin_action(
        db,
        admin_id=admin.id,
        action=AdminAction.UPDATE,
        target_table="companies",
        target_id=company.id,
        details={"updated_fields": sorted(data.keys())},
    )
    db.commit()
    db.refresh(company)
    return company


@router.delete("/{company_id}", status_code=204)
def delete_company_route(
    company_id: str,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    try:
        soft_delete_company(db, company_id)
    except CompanyServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    log_admin_action(
        db,
        admin_id=admin.id,
        action=AdminAction.DELETE,
        target_table="companies",
        target_id=company_id,
    )
    db.commit()


@router.post("/{target_id}/merge/{source_id}")
def merge_company_route(
    target_id: str,
    source_id: str,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Fusionne `source` dans `target` (reattribution des offres + soft-delete).

    Audit obligatoire: la fusion modifie silencieusement la propriete de toutes
    les offres liees, donc l'operation est tracee avec les compteurs avant commit.
    """
    try:
        result = merge_companies(db, target_id=target_id, source_id=source_id, admin_id=admin.id)
    except CompanyServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    log_admin_action(
        db,
        admin_id=admin.id,
        action=AdminAction.UPDATE,
        target_table="companies",
        target_id=source_id,
        details={
            "merged_into": target_id,
            "offers_reassigned": result["offers_reassigned"],
        },
    )
    db.commit()
    return result
