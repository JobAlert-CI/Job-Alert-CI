from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.deps import get_current_admin, get_db, require_roles
from core.security import hash_password
from models.admin import AdminAction, Administrator, AdminRole
from schemas.admin import AdminCreate, AdminRead, AdminRoleUpdate, AdminUpdate
from services.audit import log_admin_action

# Gestion des comptes admin: reservee au super_admin.
router = APIRouter(
    prefix="/api/admin/admins",
    tags=["admin-admins"],
    dependencies=[Depends(require_roles("super_admin"))],
)


def _require_admin_record(db: Session, admin_id: str) -> Administrator:
    admin = db.scalar(select(Administrator).where(Administrator.id == admin_id))
    if not admin:
        raise HTTPException(status_code=404, detail="Administrateur introuvable")
    return admin


@router.get("", response_model=list[AdminRead])
async def list_admins(
    db: Session = Depends(get_db),
    role: str | None = None,
    is_active: bool | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    stmt = select(Administrator)
    if role:
        stmt = stmt.where(Administrator.role == role)
    if is_active is not None:
        stmt = stmt.where(Administrator.is_active == is_active)
    stmt = stmt.order_by(Administrator.full_name).limit(limit).offset(offset)
    return list(db.scalars(stmt))


@router.post("", status_code=201, response_model=AdminRead)
async def create_admin(
    payload: AdminCreate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    new_admin = Administrator(
        email=payload.email.strip().lower(),
        password_hash=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        role=AdminRole(payload.role),
        is_active=True,
    )
    db.add(new_admin)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Cet email est déjà utilisé") from exc

    log_admin_action(db, admin_id=admin.id, action=AdminAction.CREATE, target_table="administrators", target_id=new_admin.id)
    db.commit()
    db.refresh(new_admin)
    return new_admin


@router.get("/{admin_id}", response_model=AdminRead)
async def get_admin(admin_id: str, db: Session = Depends(get_db)):
    return _require_admin_record(db, admin_id)


@router.put("/{admin_id}", response_model=AdminRead)
async def update_admin(
    admin_id: str,
    payload: AdminUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    target = _require_admin_record(db, admin_id)
    data = payload.model_dump(exclude_unset=True)

    if "email" in data and data["email"] is not None:
        target.email = data["email"].strip().lower()
    if "full_name" in data and data["full_name"] is not None:
        target.full_name = data["full_name"].strip()
    if "is_active" in data and data["is_active"] is not None:
        if target.id == admin.id and data["is_active"] is False:
            raise HTTPException(status_code=400, detail="Vous ne pouvez pas désactiver votre propre compte")
        target.is_active = data["is_active"]

    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Cet email est déjà utilisé") from exc

    log_admin_action(db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="administrators", target_id=target.id)
    db.commit()
    db.refresh(target)
    return target


@router.patch("/{admin_id}/role", response_model=AdminRead)
async def update_admin_role(
    admin_id: str,
    payload: AdminRoleUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    target = _require_admin_record(db, admin_id)
    if target.id == admin.id and payload.role != "super_admin":
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas retirer votre propre rôle super_admin")
    target.role = AdminRole(payload.role)
    log_admin_action(
        db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="administrators", target_id=target.id,
        details={"role": payload.role},
    )
    db.commit()
    db.refresh(target)
    return target


@router.patch("/{admin_id}/status", response_model=AdminRead)
async def toggle_admin_status(
    admin_id: str,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    target = _require_admin_record(db, admin_id)
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas changer le statut de votre propre compte")
    target.is_active = not target.is_active
    log_admin_action(
        db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="administrators", target_id=target.id,
        details={"is_active": target.is_active},
    )
    db.commit()
    db.refresh(target)
    return target


@router.delete("/{admin_id}", status_code=204)
async def delete_admin(
    admin_id: str,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    target = _require_admin_record(db, admin_id)
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas supprimer votre propre compte")
    db.delete(target)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.DELETE, target_table="administrators", target_id=admin_id)
    db.commit()
