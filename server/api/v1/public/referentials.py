from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from api.deps import get_db
from models import (
    ContractType,
    EducationLevel,
    ExperienceLevel,
    Filiere,
    FiliereSpecialty,
    Location,
    Source,
    SourceStatus,
)
from schemas.referentials import (
    ContractTypeRead,
    EducationLevelRead,
    ExperienceLevelRead,
    FiliereRead,
    FiliereSpecialtyRead,
    LocationRead,
    SourceRead,
)

router = APIRouter(prefix="/api/referentials", tags=["referentials"])

@router.get("/sources", response_model=list[SourceRead])
def list_sources(db: Session = Depends(get_db)) -> list[Source]:
    stmt = select(Source).where(Source.status != SourceStatus.DISABLED).order_by(Source.priority, Source.name)
    return list(db.scalars(stmt))

@router.get("/filieres", response_model=list[FiliereRead])
def list_filieres(db: Session = Depends(get_db)) -> list[Filiere]:
    stmt = (select(Filiere).options(selectinload(Filiere.specialties)).where(Filiere.is_active.is_(True)).order_by(Filiere.sort_order, Filiere.label))
    return list(db.scalars(stmt))

@router.get("/filieres/{slug}", response_model=FiliereRead)
def get_filiere(slug: str, db: Session = Depends(get_db)):
    stmt = (select(Filiere).options(selectinload(Filiere.specialties)).where((Filiere.slug == slug) | (Filiere.code == slug), Filiere.is_active.is_(True)))
    filiere = db.scalar(stmt)
    if filiere is None:
        raise HTTPException(status_code=404, detail="Filière introuvable")
    return filiere

@router.get("/filieres/{slug}/specialites", response_model=list[FiliereSpecialtyRead])
def list_filiere_specialites(slug: str, db: Session = Depends(get_db)):
    filiere = db.scalar(select(Filiere).where((Filiere.slug == slug) | (Filiere.code == slug), Filiere.is_active.is_(True)))
    if filiere is None:
        raise HTTPException(status_code=404, detail="Filière introuvable")
    stmt = select(FiliereSpecialty).where(FiliereSpecialty.filiere_id == filiere.id, FiliereSpecialty.is_active.is_(True)).order_by(FiliereSpecialty.sort_order)
    return list(db.scalars(stmt))

@router.get("/contract-types", response_model=list[ContractTypeRead])
def list_contract_types(db: Session = Depends(get_db)) -> list[ContractType]:
    stmt = select(ContractType).where(ContractType.is_active.is_(True)).order_by(ContractType.sort_order, ContractType.label)
    return list(db.scalars(stmt))

@router.get("/experience-levels", response_model=list[ExperienceLevelRead])
def list_experience_levels(db: Session = Depends(get_db)) -> list[ExperienceLevel]:
    stmt = select(ExperienceLevel).where(ExperienceLevel.is_active.is_(True)).order_by(ExperienceLevel.sort_order)
    return list(db.scalars(stmt))

@router.get("/education-levels", response_model=list[EducationLevelRead])
def list_education_levels(db: Session = Depends(get_db)) -> list[EducationLevel]:
    stmt = select(EducationLevel).where(EducationLevel.is_active.is_(True)).order_by(EducationLevel.sort_order)
    return list(db.scalars(stmt))

@router.get("/locations", response_model=list[LocationRead])
def list_locations(db: Session = Depends(get_db)) -> list[Location]:
    stmt = select(Location).where(Location.is_active.is_(True)).order_by(Location.label)
    return list(db.scalars(stmt))
