from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from schemas.base import TimestampRead


class DashboardStatsRead(BaseModel):
    offers_total: int
    offers_active: int
    subscribers_total: int
    subscribers_active: int
    contact_messages_new: int
    sources_active: int


class DashboardOverviewRead(DashboardStatsRead):
    """Vue d'ensemble élargie du tableau de bord."""
    last_scrape_run_at: datetime | None = None
    last_scrape_status: str | None = None
    pending_digests: int = 0


# ─── Auth ────────────────────────────────────────────────

class AdminLogin(BaseModel):
    email: str = Field(min_length=5, max_length=320)
    password: str = Field(min_length=1)


class TokenRead(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    admin_id: str
    role: str
    # Cycle 15: True si le compte porte encore son mot de passe temporaire
    # (creation admin sans mot de passe fourni) — le front doit alors forcer
    # l'ecran de changement de mot de passe avant toute autre navigation.
    must_change_password: bool = False


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(min_length=10)


class AdminResetPasswordRequest(BaseModel):
    """Corps de POST /api/admin/auth/reset-password (audit 2, N2/N6)."""

    token: str = Field(min_length=20, max_length=255)
    new_password: str = Field(min_length=8, max_length=128)


# ─── Administrator ───────────────────────────────────────

class AdminRead(TimestampRead):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    last_login_at: datetime | None = None
    # Cycle 15: True tant que le mot de passe temporaire n'a pas ete change.
    must_change_password: bool = False


AdminRoleLiteral = Literal[
    "super_admin", "gestionnaire_offres", "gestionnaire_utilisateurs", "moderateur"
]


class AdminCreate(BaseModel):
    """Corps de POST /api/admin/admins (cycle 15).

    password absent => le serveur genere un mot de passe TEMPORAIRE
    cryptosecure, le renvoie UNE seule fois dans AdminCreatedRead et marque
    le compte must_change_password=True (changement obligatoire).
    """

    email: str = Field(min_length=5, max_length=320)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=180)
    role: AdminRoleLiteral = "moderateur"


class AdminCreatedRead(AdminRead):
    """Reponse de la creation (201) : expose le mot de passe temporaire.

    Le mot de passe n'apparait QUE la, une seule fois, au super_admin qui
    vient de creer le compte — jamais dans les lectures suivantes.

    Cycle 15 (option B) : `welcome_email_sent` dit si l'email de bienvenue
    (avec le temporaire) est parti via le provider — False si Resend n'est
    pas configure : le super_admin doit alors transmettre le temporaire
    par un autre canal.
    """

    temporary_password: str | None = None
    welcome_email_sent: bool = False


class AdminUpdate(BaseModel):
    email: str | None = Field(default=None, min_length=5, max_length=320)
    full_name: str | None = Field(default=None, min_length=2, max_length=180)
    is_active: bool | None = None


class AdminRoleUpdate(BaseModel):
    role: AdminRoleLiteral


class AdminChangePassword(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)
