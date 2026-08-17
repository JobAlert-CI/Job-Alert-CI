from __future__ import annotations

import secrets

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import get_settings
from core.security import TokenError, decode_token
from db.session import get_db
from models.admin import Administrator

"""Dependances d'authentification/autorisation du back-office.

`require_admin_api_key` reste disponible pour compatibilite (scripts internes,
health checks) mais les routes `/api/admin/*` utilisent desormais
`get_current_admin` (JWT) et, quand un role precis est requis, `require_roles`.
"""


def require_admin_api_key(x_admin_api_key: str | None = Header(default=None)) -> None:
    """Protection simple par cle partagee, utile pour des scripts hors navigateur."""

    settings = get_settings()
    if not settings.admin_api_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Admin API non configuree")
    if x_admin_api_key != settings.admin_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Cle admin invalide")


def require_scraper_token(x_scraper_token: str | None = Header(default=None)) -> None:
    settings = get_settings()
    if not settings.scraper_api_token:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Ingestion non configuree")
    if not x_scraper_token or not secrets.compare_digest(x_scraper_token, settings.scraper_api_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token scraper invalide")


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentification requise",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return authorization.split(" ", 1)[1].strip()


def get_current_admin(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Administrator:
    """Resout l'administrateur courant a partir d'un access token JWT."""

    raw_token = _extract_bearer_token(authorization)
    try:
        payload = decode_token(raw_token, expected_type="access")
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    admin = db.scalar(select(Administrator).where(Administrator.id == payload.admin_id))
    if admin is None or not admin.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Compte administrateur invalide")
    return admin


def require_roles(*roles: str):
    """Fabrique une dependance qui verifie que l'admin courant a l'un des roles donnes.

    Sans argument, exige seulement une authentification valide (tous roles).
    """

    def _check(admin: Administrator = Depends(get_current_admin)) -> Administrator:
        if roles and admin.role.value not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse pour ce role")
        return admin

    return _check


__all__ = ["get_db", "require_admin_api_key", "require_scraper_token", "get_current_admin", "require_roles"]
