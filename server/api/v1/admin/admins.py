from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.deps import get_current_admin, get_db, require_roles
from core.security import generate_temporary_password, hash_password
from models.admin import AdminAction, AdminActionLog, Administrator, AdminRole
from schemas.admin import (
    AdminCreate,
    AdminCreatedRead,
    AdminRead,
    AdminRoleUpdate,
    AdminUpdate,
)
from services.admin_welcome_email import send_admin_welcome
from services.audit import log_admin_action
from services.email.resend_provider import get_email_provider

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
    q: str | None = Query(None, max_length=100, description="Recherche email/nom (ilike)"),
    role: str | None = None,
    is_active: bool | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    stmt = select(Administrator)
    if q:
        # Cycle 15: recherche partielle insensible a la casse sur email et nom.
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Administrator.email.ilike(pattern),
                Administrator.full_name.ilike(pattern),
            )
        )
    if role:
        stmt = stmt.where(Administrator.role == role)
    if is_active is not None:
        stmt = stmt.where(Administrator.is_active == is_active)
    stmt = stmt.order_by(Administrator.full_name).limit(limit).offset(offset)
    return list(db.scalars(stmt))


@router.post("", status_code=201, response_model=AdminCreatedRead)
async def create_admin(
    payload: AdminCreate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    # Cycle 15: password absent => mot de passe TEMPORAIRE genere par le
    # serveur, renvoye une seule fois, changement obligatoire a la premiere
    # connexion (must_change_password=True).
    temporary_password: str | None = None
    if payload.password is None:
        temporary_password = generate_temporary_password()
        password_hash = hash_password(temporary_password)
        must_change_password = True
    else:
        password_hash = hash_password(payload.password)
        must_change_password = False

    new_admin = Administrator(
        email=payload.email.strip().lower(),
        password_hash=password_hash,
        full_name=payload.full_name.strip(),
        role=AdminRole(payload.role),
        is_active=True,
        must_change_password=must_change_password,
    )
    db.add(new_admin)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Cet email est déjà utilisé") from exc

    log_admin_action(
        db,
        admin_id=admin.id,
        action=AdminAction.CREATE,
        target_table="administrators",
        target_id=new_admin.id,
        details={
            "role": payload.role,
            "mot_de_passe_temporaire": temporary_password is not None,
        },
    )
    db.commit()
    db.refresh(new_admin)

    # Cycle 15 (option B validee) : email de bienvenue automatique AVEC le
    # temporaire quand il a ete genere. Apres le commit de creation : un
    # echec d'envoi (Resend absent/domaine non verifie) ne fait JAMAIS
    # echouer la creation — le temporaire reste dans la reponse 201.
    welcome_email_sent = False
    if temporary_password is not None:
        provider = get_email_provider()
        welcome = send_admin_welcome(
            db, admin=new_admin, temporary_password=temporary_password, provider=provider
        )
        welcome_email_sent = welcome.sent

    # Le temporaire n'est expose QUE dans cette reponse 201, jamais relu.
    return AdminCreatedRead(
        **AdminRead.model_validate(new_admin).model_dump(),
        temporary_password=temporary_password,
        welcome_email_sent=welcome_email_sent,
    )


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
    # Cycle 15: la FK admin_action_logs.admin_id est desormais SET NULL —
    # les entrees du journal de cet admin sont PRESERVEES (admin_id NULL).
    # Double protection: la FK Postgres fait le travail en prod, et on
    # applique aussi le SET NULL cote applicatif (SQLite de test n'active
    # pas PRAGMA foreign_keys, et on ne depend pas du moteur pour un
    # engagement aussi fort).
    admin_db_update = (
        update(AdminActionLog)
        .where(AdminActionLog.admin_id == target.id)
        .values(admin_id=None)
    )
    db.execute(admin_db_update)
    # On consigne l'identite dans details pour garder une trace lisible
    # (l'auteur des lignes orphelines reste identifiable apres coup).
    log_admin_action(
        db,
        admin_id=admin.id,
        action=AdminAction.DELETE,
        target_table="administrators",
        target_id=admin_id,
        details={
            "admin_supprime_email": target.email,
            "admin_supprime_nom": target.full_name,
            "admin_supprime_role": target.role.value,
        },
    )
    db.delete(target)
    db.commit()
