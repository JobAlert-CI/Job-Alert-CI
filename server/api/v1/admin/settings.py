from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import get_current_admin, get_db, require_roles
from models.admin import AdminAction, Administrator, SiteSetting
from schemas.settings import SettingsBulkUpdate, SettingUpdate, SiteSettingRead
from services.audit import log_admin_action

# Configuration generale editable sans deploiement: reservee au super_admin.
router = APIRouter(
    prefix="/api/admin/settings",
    tags=["admin-settings"],
    dependencies=[Depends(require_roles("super_admin"))],
)


def _require_setting(db: Session, key: str) -> SiteSetting:
    setting = db.scalar(select(SiteSetting).where(SiteSetting.key == key))
    if setting is None:
        raise HTTPException(status_code=404, detail="Parametre introuvable")
    return setting


@router.get("", response_model=list[SiteSettingRead])
async def list_settings(db: Session = Depends(get_db)):
    """Tous les parametres du site."""
    stmt = select(SiteSetting).order_by(SiteSetting.key)
    return list(db.scalars(stmt))


@router.get("/{key}", response_model=SiteSettingRead)
async def get_setting(key: str, db: Session = Depends(get_db)):
    return _require_setting(db, key)


@router.put("/{key}", response_model=SiteSettingRead)
async def update_setting(
    key: str,
    payload: SettingUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Cree ou met a jour un parametre (heure d'envoi, textes, coordonnees...).

    Audit 4, G.2c : l'ancienne valeur est journalisee avec la nouvelle —
    sinon un parametre sensible change (ex. support_email) ne peut pas
    etre reconstitue depuis le journal.
    """
    setting = db.scalar(select(SiteSetting).where(SiteSetting.key == key))
    ancienne_valeur = setting.value if setting is not None else None
    if setting is None:
        setting = SiteSetting(key=key, value=payload.value, description=payload.description)
        db.add(setting)
    else:
        setting.value = payload.value
        if payload.description is not None:
            setting.description = payload.description
    setting.updated_by_admin_id = admin.id

    log_admin_action(
        db,
        admin_id=admin.id,
        action=AdminAction.UPDATE,
        target_table="site_settings",
        target_id=key,
        details={"value": payload.value, "ancienne_valeur": ancienne_valeur},
    )
    db.commit()
    db.refresh(setting)
    return setting


@router.post("/bulk", response_model=list[SiteSettingRead])
async def bulk_update_settings(
    payload: SettingsBulkUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Mise a jour de plusieurs parametres en une fois.

    Audit 4, G.2c : l'ancienne valeur de chaque cle est journalisee
    (None pour une creation — le front distingue creation et edition).
    """
    existing = {
        setting.key: setting
        for setting in db.scalars(select(SiteSetting).where(SiteSetting.key.in_(payload.settings.keys())))
    }
    anciennes_valeurs: dict[str, str | None] = {
        key: (existing[key].value if key in existing else None) for key in payload.settings
    }
    updated: list[SiteSetting] = []
    for key, value in payload.settings.items():
        setting = existing.get(key)
        if setting is None:
            setting = SiteSetting(key=key, value=value)
            db.add(setting)
        else:
            setting.value = value
        setting.updated_by_admin_id = admin.id
        updated.append(setting)

    log_admin_action(
        db,
        admin_id=admin.id,
        action=AdminAction.UPDATE,
        target_table="site_settings",
        target_id=None,
        details={"keys": list(payload.settings.keys()), "anciennes_valeurs": anciennes_valeurs},
    )
    db.commit()
    for setting in updated:
        db.refresh(setting)
    return updated
