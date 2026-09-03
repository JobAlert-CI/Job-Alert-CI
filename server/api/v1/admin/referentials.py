from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from api.deps import get_current_admin, get_db, require_roles
from models.admin import AdminAction, Administrator
from models.enums import SourceStatus
from models.referentials import (
    ContractType,
    EducationLevel,
    ExperienceLevel,
    Filiere,
    FiliereKeyword,
    FiliereSpecialty,
    Location,
    Source,
)
from schemas.referentials import (
    ContractTypeCreate,
    ContractTypeRead,
    ContractTypeUpdate,
    EducationLevelCreate,
    EducationLevelRead,
    EducationLevelUpdate,
    ExperienceLevelCreate,
    ExperienceLevelRead,
    ExperienceLevelUpdate,
    FiliereCreate,
    FiliereKeywordsUpdate,
    FiliereRead,
    FiliereUpdate,
    LocationCreate,
    LocationRead,
    LocationUpdate,
    SourceCreate,
    SourceRead,
    SourceStatusUpdate,
    SourceUpdate,
    SpecialiteCreate,
    SpecialiteUpdate,
    FiliereSpecialtyRead,
)
from services.audit import log_admin_action
from services.normalization import normalize_text

# Referentiels partages par tout le systeme (scraping, filtrage, front public) : super_admin uniquement.
router = APIRouter(
    prefix="/api/admin/referentials",
    tags=["admin-referentials"],
    dependencies=[Depends(require_roles("super_admin"))],
)


def _get_or_404(db: Session, model, item_id: str, label: str):
    item = db.get(model, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"{label} introuvable")
    return item


def _apply_updates(item, payload) -> None:
    for field_name, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field_name, value)


# ─── Filières ───────────────────────────────────────────
@router.get("/filieres", response_model=list[FiliereRead])
async def list_filieres_admin(db: Session = Depends(get_db)):
    stmt = select(Filiere).options(selectinload(Filiere.specialties)).order_by(Filiere.sort_order, Filiere.label)
    return list(db.scalars(stmt))


@router.post("/filieres", status_code=201, response_model=FiliereRead)
async def create_filiere(payload: FiliereCreate, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    filiere = Filiere(**payload.model_dump())
    db.add(filiere)
    db.flush()
    log_admin_action(db, admin_id=admin.id, action=AdminAction.CREATE, target_table="filieres", target_id=filiere.id)
    db.commit()
    db.refresh(filiere)
    return filiere


@router.put("/filieres/{filiere_id}", response_model=FiliereRead)
async def update_filiere(filiere_id: str, payload: FiliereUpdate, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    filiere = _get_or_404(db, Filiere, filiere_id, "Filière")
    _apply_updates(filiere, payload)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="filieres", target_id=filiere.id)
    db.commit()
    db.refresh(filiere)
    return filiere


@router.delete("/filieres/{filiere_id}", status_code=204)
async def delete_filiere(filiere_id: str, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    filiere = _get_or_404(db, Filiere, filiere_id, "Filière")
    db.delete(filiere)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.DELETE, target_table="filieres", target_id=filiere_id)
    db.commit()


@router.put("/filieres/{filiere_id}/keywords")
async def update_filiere_keywords(
    filiere_id: str,
    payload: FiliereKeywordsUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Remplace entièrement les mots-clés de matching automatique d'une filière."""
    filiere = _get_or_404(db, Filiere, filiere_id, "Filière")

    db.query(FiliereKeyword).filter(FiliereKeyword.filiere_id == filiere_id).delete()
    for entry in payload.keywords:
        keyword = str(entry.get("keyword", "")).strip()
        if not keyword:
            continue
        weight = int(entry.get("weight", 1))
        db.add(
            FiliereKeyword(
                filiere_id=filiere_id,
                keyword=keyword,
                normalized_keyword=normalize_text(keyword),
                weight=max(1, min(weight, 100)),
            )
        )

    log_admin_action(
        db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="filiere_keywords", target_id=filiere_id,
        details={"count": len(payload.keywords)},
    )
    db.commit()
    return {"message": "Mots-clés mis à jour", "count": len(payload.keywords)}



# ─── Simulation de filière (document 8 — 1.5) ─────────────────────────────

from schemas.referentials import FiliereSimulationInput, FiliereSimulationResult
from services.filiere_simulator import simulate_filiere_matching


@router.post("/filieres/simulate", response_model=FiliereSimulationResult)
async def simulate_filiere(
    payload: FiliereSimulationInput,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
) -> FiliereSimulationResult:
    """Simule l'impact d'une liste de mots-clés candidats SANS modifier la base."""
    result = simulate_filiere_matching(db, payload.filiere_code, payload.keywords)
    return FiliereSimulationResult(**result)

# ─── Spécialités ────────────────────────────────────────
@router.get("/filieres/{filiere_id}/specialites", response_model=list[FiliereSpecialtyRead])
async def list_specialites(filiere_id: str, db: Session = Depends(get_db)):
    _get_or_404(db, Filiere, filiere_id, "Filière")
    stmt = select(FiliereSpecialty).where(FiliereSpecialty.filiere_id == filiere_id).order_by(FiliereSpecialty.sort_order)
    return list(db.scalars(stmt))


@router.post("/filieres/{filiere_id}/specialites", status_code=201, response_model=FiliereSpecialtyRead)
async def create_specialite(
    filiere_id: str,
    payload: SpecialiteCreate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    _get_or_404(db, Filiere, filiere_id, "Filière")
    specialite = FiliereSpecialty(filiere_id=filiere_id, **payload.model_dump())
    db.add(specialite)
    db.flush()
    log_admin_action(db, admin_id=admin.id, action=AdminAction.CREATE, target_table="filiere_specialties", target_id=specialite.id)
    db.commit()
    db.refresh(specialite)
    return specialite


@router.put("/specialites/{specialite_id}", response_model=FiliereSpecialtyRead)
async def update_specialite(
    specialite_id: str,
    payload: SpecialiteUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    specialite = _get_or_404(db, FiliereSpecialty, specialite_id, "Spécialité")
    _apply_updates(specialite, payload)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="filiere_specialties", target_id=specialite.id)
    db.commit()
    db.refresh(specialite)
    return specialite


@router.delete("/specialites/{specialite_id}", status_code=204)
async def delete_specialite(specialite_id: str, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    specialite = _get_or_404(db, FiliereSpecialty, specialite_id, "Spécialité")
    db.delete(specialite)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.DELETE, target_table="filiere_specialties", target_id=specialite_id)
    db.commit()


# ─── Sources ────────────────────────────────────────────
@router.get("/sources", response_model=list[SourceRead])
async def list_sources_admin(db: Session = Depends(get_db)):
    stmt = select(Source).order_by(Source.priority, Source.name)
    return list(db.scalars(stmt))


@router.post("/sources", status_code=201, response_model=SourceRead)
async def create_source(payload: SourceCreate, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    source = Source(**payload.model_dump())
    db.add(source)
    db.flush()
    log_admin_action(db, admin_id=admin.id, action=AdminAction.CREATE, target_table="sources", target_id=source.id)
    db.commit()
    db.refresh(source)
    return source


@router.put("/sources/{source_id}", response_model=SourceRead)
async def update_source(source_id: str, payload: SourceUpdate, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    source = _get_or_404(db, Source, source_id, "Source")
    _apply_updates(source, payload)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="sources", target_id=source.id)
    db.commit()
    db.refresh(source)
    return source


@router.patch("/sources/{source_id}/status")
async def update_source_status(
    source_id: str,
    payload: SourceStatusUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    source = _get_or_404(db, Source, source_id, "Source")
    source.status = SourceStatus(payload.status)
    log_admin_action(
        db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="sources", target_id=source.id,
        details={"status": payload.status},
    )
    db.commit()
    return {"message": "Statut mis à jour", "status": source.status.value}


@router.delete("/sources/{source_id}", status_code=204)
async def delete_source(source_id: str, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    source = _get_or_404(db, Source, source_id, "Source")
    db.delete(source)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.DELETE, target_table="sources", target_id=source_id)
    db.commit()


# ─── Contrats ───────────────────────────────────────────
@router.get("/contract-types", response_model=list[ContractTypeRead])
async def list_contract_types_admin(db: Session = Depends(get_db)):
    return list(db.scalars(select(ContractType).order_by(ContractType.sort_order)))


@router.post("/contract-types", status_code=201, response_model=ContractTypeRead)
async def create_contract_type(payload: ContractTypeCreate, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    item = ContractType(**payload.model_dump())
    db.add(item)
    db.flush()
    log_admin_action(db, admin_id=admin.id, action=AdminAction.CREATE, target_table="contract_types", target_id=item.id)
    db.commit()
    db.refresh(item)
    return item


@router.put("/contract-types/{id}", response_model=ContractTypeRead)
async def update_contract_type(id: str, payload: ContractTypeUpdate, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    item = _get_or_404(db, ContractType, id, "Type de contrat")
    _apply_updates(item, payload)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="contract_types", target_id=item.id)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/contract-types/{id}", status_code=204)
async def delete_contract_type(id: str, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    item = _get_or_404(db, ContractType, id, "Type de contrat")
    db.delete(item)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.DELETE, target_table="contract_types", target_id=id)
    db.commit()


# ─── Niveaux d'expérience ───────────────────────────────
@router.get("/experience-levels", response_model=list[ExperienceLevelRead])
async def list_experience_levels_admin(db: Session = Depends(get_db)):
    return list(db.scalars(select(ExperienceLevel).order_by(ExperienceLevel.sort_order)))


@router.post("/experience-levels", status_code=201, response_model=ExperienceLevelRead)
async def create_experience_level(payload: ExperienceLevelCreate, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    item = ExperienceLevel(**payload.model_dump())
    db.add(item)
    db.flush()
    log_admin_action(db, admin_id=admin.id, action=AdminAction.CREATE, target_table="experience_levels", target_id=item.id)
    db.commit()
    db.refresh(item)
    return item


@router.put("/experience-levels/{id}", response_model=ExperienceLevelRead)
async def update_experience_level(id: str, payload: ExperienceLevelUpdate, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    item = _get_or_404(db, ExperienceLevel, id, "Niveau d'expérience")
    _apply_updates(item, payload)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="experience_levels", target_id=item.id)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/experience-levels/{id}", status_code=204)
async def delete_experience_level(id: str, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    item = _get_or_404(db, ExperienceLevel, id, "Niveau d'expérience")
    db.delete(item)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.DELETE, target_table="experience_levels", target_id=id)
    db.commit()


# ─── Niveaux d'études ───────────────────────────────────
@router.get("/education-levels", response_model=list[EducationLevelRead])
async def list_education_levels_admin(db: Session = Depends(get_db)):
    return list(db.scalars(select(EducationLevel).order_by(EducationLevel.sort_order)))


@router.post("/education-levels", status_code=201, response_model=EducationLevelRead)
async def create_education_level(payload: EducationLevelCreate, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    item = EducationLevel(**payload.model_dump())
    db.add(item)
    db.flush()
    log_admin_action(db, admin_id=admin.id, action=AdminAction.CREATE, target_table="education_levels", target_id=item.id)
    db.commit()
    db.refresh(item)
    return item


@router.put("/education-levels/{id}", response_model=EducationLevelRead)
async def update_education_level(id: str, payload: EducationLevelUpdate, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    item = _get_or_404(db, EducationLevel, id, "Niveau d'études")
    _apply_updates(item, payload)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="education_levels", target_id=item.id)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/education-levels/{id}", status_code=204)
async def delete_education_level(id: str, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    item = _get_or_404(db, EducationLevel, id, "Niveau d'études")
    db.delete(item)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.DELETE, target_table="education_levels", target_id=id)
    db.commit()


# ─── Localisations ──────────────────────────────────────
@router.get("/locations", response_model=list[LocationRead])
async def list_locations_admin(db: Session = Depends(get_db)):
    return list(db.scalars(select(Location).order_by(Location.label)))


@router.post("/locations", status_code=201, response_model=LocationRead)
async def create_location(payload: LocationCreate, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    data = payload.model_dump()
    location = Location(normalized_label=normalize_text(data["label"]), **data)
    db.add(location)
    db.flush()
    log_admin_action(db, admin_id=admin.id, action=AdminAction.CREATE, target_table="locations", target_id=location.id)
    db.commit()
    db.refresh(location)
    return location


@router.put("/locations/{id}", response_model=LocationRead)
async def update_location(id: str, payload: LocationUpdate, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    location = _get_or_404(db, Location, id, "Localisation")
    _apply_updates(location, payload)
    if payload.label is not None:
        location.normalized_label = normalize_text(payload.label)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="locations", target_id=location.id)
    db.commit()
    db.refresh(location)
    return location


@router.delete("/locations/{id}", status_code=204)
async def delete_location(id: str, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    location = _get_or_404(db, Location, id, "Localisation")
    db.delete(location)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.DELETE, target_table="locations", target_id=id)
    db.commit()