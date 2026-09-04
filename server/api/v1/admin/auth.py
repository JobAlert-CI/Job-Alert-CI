"""Authentification admin: login JWT, rotation refresh, reset mot de passe.

Corrections audit 2 appliquees ici:
- N2/N3/N4/N5/N6: flux forgot/reset-password reecrit via
  `services/admin_password_reset.py` (token hashe, TTL 60 min, usage unique,
  provider.send() reel, schema Pydantic avec new_password >= 8 chars).
- N7: rate-limit par IP sur /login, /refresh et /forgot-password.
- N8: `revoked_at` verifie dans /refresh (un token revoque est refuse).
- N10: logout revoque la famille de refresh cote serveur.
- F1: `expires_at` renseigne a l'emission du refresh token.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import get_current_admin, get_db
from core.config import get_settings
from core.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from models.admin import Administrator, AdminRefreshToken
from schemas.admin import (
    AdminChangePassword,
    AdminLogin,
    AdminRead,
    AdminResetPasswordRequest,
    RefreshTokenRequest,
    TokenRead,
)
from services.admin_password_reset import (
    AdminResetPasswordError,
    consume_reset_token,
    request_password_reset,
)
from services.email.resend_provider import get_email_provider
from services.normalization import token_hash
from services.rate_limit import check_ip_rate_limit

router = APIRouter(prefix="/api/admin/auth", tags=["admin-auth"])


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _guard_rate_limit(request: Request, scope: str, *, limit_per_minute: int, cooldown: int = 0) -> None:
    """Rate-limit par IP (audit 2, N7). Leve 429 avec Retry-After."""
    decision = check_ip_rate_limit(
        scope=scope,
        client_ip=_client_ip(request),
        limit_per_minute=limit_per_minute,
        cooldown_seconds=cooldown,
    )
    if not decision.allowed:
        raise HTTPException(
            status_code=429,
            detail="Trop de tentatives. Merci de patienter.",
            headers={"Retry-After": str(decision.retry_after_seconds or 60)},
        )


def _issue_tokens(db: Session, admin: Administrator) -> TokenRead:
    """Emet access+refresh et persiste le hash du refresh (audit #13: rotation)."""
    settings = get_settings()
    role = admin.role.value
    access_token = create_access_token(admin.id, role)
    refresh_token = create_refresh_token(admin.id, role)
    db.add(
        AdminRefreshToken(
            id=str(uuid.uuid4()),
            admin_id=admin.id,
            token_hash=token_hash(refresh_token),
            # Audit 2, F1: borne explicite en base (purge possible + semantique).
            expires_at=datetime.now(UTC) + timedelta(minutes=settings.admin_jwt_refresh_minutes),
        )
    )
    db.commit()
    return TokenRead(
        access_token=access_token,
        refresh_token=refresh_token,
        admin_id=admin.id,
        role=role,
    )


@router.post("/login", response_model=TokenRead)
async def admin_login(payload: AdminLogin, request: Request, db: Session = Depends(get_db)):
    """Connexion email + mot de passe -> couple access/refresh token (JWT).

    Rate-limit 10 essais/min/IP (audit 2, N7) contre le brute-force.
    """
    _guard_rate_limit(request, "admin-login", limit_per_minute=10, cooldown=2)
    admin = db.scalar(select(Administrator).where(Administrator.email == payload.email.strip().lower()))
    if not admin or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou mot de passe incorrect")

    if not admin.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Compte inactif")

    admin.last_login_at = datetime.now(UTC)
    db.commit()

    return _issue_tokens(db, admin)


@router.post("/refresh", response_model=TokenRead)
async def refresh_token(payload: RefreshTokenRequest, request: Request, db: Session = Depends(get_db)):
    """Echange un refresh token valide contre un nouveau couple access/refresh.

    Rotation effective (audit #13 + audit 2, N8):
    - un refresh revoque est refuse (`revoked_at` verifie AVANT `used_at`) ;
    - l'ancien refresh est marque `used_at` (usage unique) ;
    - si l'ancien etait deja consomme -> reuse detecte, toute la famille
      de refresh de cet admin est revoquee (defense en profondeur).
    """
    _guard_rate_limit(request, "admin-refresh", limit_per_minute=30)
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

    old_token = db.scalar(
        select(AdminRefreshToken).where(AdminRefreshToken.token_hash == token_hash(payload.refresh_token))
    )
    if old_token is not None:
        # Audit 2, N8: token explicitement revoque -> refus immediat.
        if old_token.revoked_at is not None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token revoque",
            )
        if old_token.used_at is not None:
            # Reuse detecte -> revocation de toute la famille.
            for tok in db.scalars(
                select(AdminRefreshToken).where(
                    AdminRefreshToken.admin_id == admin.id,
                    AdminRefreshToken.used_at.is_(None),
                    AdminRefreshToken.revoked_at.is_(None),
                )
            ).all():
                tok.revoked_at = datetime.now(UTC)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token reuse detecte, famille revoquee",
            )
        old_token.used_at = datetime.now(UTC)
        db.commit()

    return _issue_tokens(db, admin)


@router.post("/logout")
async def admin_logout(
    request: Request,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Deconnexion serveur (audit 2, N10): revoque la famille de refresh.

    L'access token reste valide jusqu'a expiration (JWT sans etat), mais
    aucun refresh ne pourra plus etre presente.
    """
    _guard_rate_limit(request, "admin-logout", limit_per_minute=30)
    for tok in db.scalars(
        select(AdminRefreshToken).where(
            AdminRefreshToken.admin_id == admin.id,
            AdminRefreshToken.revoked_at.is_(None),
        )
    ).all():
        tok.revoked_at = datetime.now(UTC)
    db.commit()
    return {"message": "Deconnexion reussie"}


@router.get("/me", response_model=AdminRead)
async def get_my_profile(admin: Administrator = Depends(get_current_admin)):
    """Profil de l'admin actuellement authentifie."""
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
    # Invalider toutes les sessions existantes (defense en profondeur).
    for tok in db.scalars(
        select(AdminRefreshToken).where(
            AdminRefreshToken.admin_id == admin.id,
            AdminRefreshToken.revoked_at.is_(None),
        )
    ).all():
        tok.revoked_at = datetime.now(UTC)
    db.commit()
    return {"message": "Mot de passe modifie"}


# ─── Flux reset mot de passe admin (audit 2, N2-N6) ────────────────────


@router.post("/forgot-password")
async def forgot_password(payload: AdminLogin, request: Request, db: Session = Depends(get_db)):
    """Genere un token temporaire (hashe en base, TTL 60 min) et envoie l'email.

    Reponse neutre que l'email existe ou non (anti-enumeration).
    Le service `admin_password_reset` ne leve jamais pour un email inconnu.
    """
    _guard_rate_limit(request, "admin-forgot", limit_per_minute=3, cooldown=30)
    provider = get_email_provider()
    request_password_reset(db, email=payload.email, provider=provider)
    return {"message": "Si un compte existe, un email de reinitialisation a ete envoye."}


@router.post("/reset-password")
async def reset_password(payload: AdminResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    """Valide le token (hash SHA-256, TTL 60 min, usage unique) et applique le mot de passe.

    Schema Pydantic: token >= 20 chars, new_password entre 8 et 128 chars
    (audit 2, N6 — plus de payload dict non valide).
    """
    _guard_rate_limit(request, "admin-reset", limit_per_minute=5, cooldown=5)
    try:
        consume_reset_token(db, raw_token=payload.token, new_password_hash=hash_password(payload.new_password))
    except AdminResetPasswordError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return {"message": "Mot de passe reinitialise"}
