from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import get_current_admin, get_db
from core.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from models.admin import Administrator
from schemas.admin import AdminChangePassword, AdminLogin, AdminRead, RefreshTokenRequest, TokenRead

router = APIRouter(prefix="/api/admin/auth", tags=["admin-auth"])


def _issue_tokens(admin: Administrator) -> TokenRead:
    role = admin.role.value
    return TokenRead(
        access_token=create_access_token(admin.id, role),
        refresh_token=create_refresh_token(admin.id, role),
        admin_id=admin.id,
        role=role,
    )


@router.post("/login", response_model=TokenRead)
async def admin_login(payload: AdminLogin, db: Session = Depends(get_db)):
    """Connexion email + mot de passe -> couple access/refresh token (JWT)."""
    admin = db.scalar(select(Administrator).where(Administrator.email == payload.email.strip().lower()))
    if not admin or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou mot de passe incorrect")

    if not admin.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Compte inactif")

    admin.last_login_at = datetime.now(timezone.utc)
    db.commit()

    return _issue_tokens(admin)


@router.post("/refresh", response_model=TokenRead)
async def refresh_token(payload: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Echange un refresh token valide contre un nouveau couple access/refresh token."""
    try:
        decoded = decode_token(payload.refresh_token, expected_type="refresh")
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    admin = db.scalar(select(Administrator).where(Administrator.id == decoded.admin_id))
    if admin is None or not admin.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Compte administrateur invalide")

    return _issue_tokens(admin)


@router.post("/logout")
async def admin_logout(_: Administrator = Depends(get_current_admin)):
    """Les JWT etant sans etat, la deconnexion se fait cote client (suppression du token)."""
    return {"message": "Deconnexion reussie"}


@router.get("/me", response_model=AdminRead)
async def get_my_profile(admin: Administrator = Depends(get_current_admin)):
    """Profil de l'admin actuellement authentifie (resolu depuis le token, pas depuis la base au hasard)."""
    return admin


@router.put("/me/password")
async def change_password(
    payload: AdminChangePassword,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Changement de mot de passe de l'admin actuellement authentifie."""
    if not verify_password(payload.current_password, admin.password_hash):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")

    admin.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "Mot de passe modifie"}
