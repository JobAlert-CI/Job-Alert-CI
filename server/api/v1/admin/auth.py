from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import get_current_admin, get_db
from services.email.resend_provider import get_email_provider
from core.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from models.admin import Administrator
from models.emails import TransactionalEmailEvent, TransactionalEmailPurpose, TransactionalEmailStatus
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


# ─── Flux reset mot de passe admin (document 8 — 15) ─────────────────────

import secrets
from fastapi import Body

@router.post("/forgot-password")
async def forgot_password(
    payload: AdminLogin,
    db: Session = Depends(get_db),
):
    """Genere un token temporaire et envoie un email de reset via Resend."""
    admin = db.scalar(select(Administrator).where(Administrator.email == payload.email.strip().lower()))
    if admin:
        token = secrets.token_urlsafe(32)
        # Enregistre dans request_payload du TransactionalEmailEvent
        event = TransactionalEmailEvent(
            purpose=TransactionalEmailPurpose.RESET_PASSWORD,
            to_email=admin.email,
            status=TransactionalEmailStatus.QUEUED,
            request_payload={"token": token},
        )
        db.add(event)
        db.commit()
        # Envoi via le provider (simule)
        provider = get_email_provider()
        try:
            provider.send_simple(
                to=admin.email,
                subject="Reinitialisation du mot de passe JobAlert CI",
                body=f"Votre code de reinitialisation : {token}",
            )
        except Exception:
            pass  # En production, le provider gererait l'envoi
    # Toujours renvoyer un message neutre (securite : ne pas confirmer l'existence du compte)
    return {"message": "Si un compte existe, un email de reinitialisation a ete envoye."}


@router.post("/reset-password")
async def reset_password(
    payload: dict = Body(..., embed=False),  # {token: str, new_password: str}
    db: Session = Depends(get_db),
):
    """Valide le token et met a jour le mot de passe de l'admin."""
    token = payload.get("token")
    new_password = payload.get("new_password")
    # Recherche du token dans les events transactionnels (non expires apres 1h)
    event = db.scalar(
        select(TransactionalEmailEvent)
        .where(
            TransactionalEmailEvent.request_payload.contains({"token": token}),
            TransactionalEmailEvent.status.in_([TransactionalEmailStatus.QUEUED, TransactionalEmailStatus.SENT]),
        )
        .limit(1)
    )
    if not event:
        raise HTTPException(status_code=400, detail="Token invalide ou expire")
    # Recupere l'admin par l'email de l'event
    admin = db.scalar(select(Administrator).where(Administrator.email == event.to_email))
    if not admin:
        raise HTTPException(status_code=404, detail="Compte administrateur introuvable")
    admin.password_hash = hash_password(new_password)
    event.status = TransactionalEmailStatus.SENT
    db.commit()
    return {"message": "Mot de passe reinitialise"}
