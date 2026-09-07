from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, EmailStr, Field, field_validator

from schemas.base import TimestampRead


class SubscriberCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    email: str = Field(min_length=5, max_length=320)
    full_name: str | None = Field(default=None, validation_alias=AliasChoices("full_name", "nom"), max_length=180)
    city: str | None = Field(default=None, validation_alias=AliasChoices("city", "ville"), max_length=120)
    filieres: list[str] = Field(default_factory=list, max_length=3)
    experience: str | None = Field(default=None, max_length=80)
    contract_types: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("contract_types", "contrats"),
        max_length=10,
    )
    wants_career_tips: bool = Field(default=True, validation_alias=AliasChoices("wants_career_tips", "conseils"))
    source: str | None = Field(default="site", max_length=120)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        cleaned = value.strip()
        if "@" not in cleaned or "." not in cleaned.rsplit("@", 1)[-1]:
            raise ValueError("Adresse email invalide")
        return cleaned

    @field_validator("filieres", mode="before")
    @classmethod
    def split_filieres(cls, value):
        if value is None:
            return []
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("contract_types", mode="before")
    @classmethod
    def split_contracts(cls, value):
        if value is None:
            return []
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


class SubscriberFiliereRead(TimestampRead):
    id: str
    filiere_id: str
    priority: int


class SubscriberContractPreferenceRead(TimestampRead):
    id: str
    contract_type_id: str


class SubscriberRead(TimestampRead):
    id: str
    email: str
    full_name: str | None = None
    city: str | None = None
    status: str
    timezone: str
    wants_career_tips: bool
    source: str | None = None
    subscribed_at: datetime
    # Champs administratifs (doc v3 section 8) : notes internes et trace
    # de desinscription exposes au back-office — l'edition existe deja
    # (SubscriberAdminUpdate), la lecture manquait.
    admin_notes: str | None = None
    unsubscribe_reason: str | None = None
    unsubscribed_at: datetime | None = None
    filiere_links: list[SubscriberFiliereRead] = []
    contract_preferences: list[SubscriberContractPreferenceRead] = []


class SubscriberPreferencesUpdate(BaseModel):
    """Mise à jour des préférences via token (filières + contrats)."""
    filieres: list[str] = Field(min_length=1, max_length=3, description="1 à 3 codes de filières.")
    contract_types: list[str] = Field(default_factory=list, max_length=10)
    wants_career_tips: bool = True


class SubscriberAdminUpdate(BaseModel):
    """Édition admin d'un abonné (notes, statut, nom)."""
    full_name: str | None = Field(default=None, max_length=180)
    city: str | None = Field(default=None, max_length=120)
    admin_notes: str | None = None
    wants_career_tips: bool | None = None


class SubscriberStatusUpdate(BaseModel):
    status: Literal["active", "unsubscribed", "bouncing", "paused"]
    reason: str | None = Field(default=None, max_length=500)


class SubscriberBulkStatusUpdate(BaseModel):
    """Action groupée de statut (doc v3 section 7 : mini-onglet Actions).

    "deleted" est exclu du Literal : l'anonymisation RGPD ne doit jamais
    être déclenchée en masse (cf. router).
    """

    subscriber_ids: list[str] = Field(min_length=1, max_length=500)
    status: Literal["active", "unsubscribed", "bouncing", "paused"]
    reason: str | None = Field(default=None, max_length=500)


# ─── Confirmation d'email ────────────────────────────────


class SubscriptionCreateResponse(SubscriberRead):
    """Reponse de POST /api/subscriptions.

    Herite de tous les champs de `SubscriberRead` (aucune rupture pour les
    clients existants qui parsent deja ce contrat) et ajoute les informations
    du flux de confirmation d'email en champs optionnels additifs.
    """

    requires_confirmation: bool = False
    confirmation_message: str | None = None
    # Audit P1 #21: valeur brute du token MANAGE_ALERT emis a l'inscription
    # (None si l'abonne avait deja un token actif). Permet de construire
    # /preferences/{manage_alert_token}.
    manage_alert_token: str | None = None


class EmailConfirmationResult(BaseModel):
    """Reponse de GET /api/subscriptions/confirm/{token}."""

    message: str
    email: str


class ResendConfirmationCreate(BaseModel):
    """Corps de POST /api/subscriptions/resend-confirmation."""

    model_config = ConfigDict(populate_by_name=True)

    email: EmailStr


class ResendConfirmationResponse(BaseModel):
    """Reponse generique de renvoi, volontairement peu informative pour ne pas
    permettre l'enumeration des emails inscrits (voir cahier des charges,
    section 'Endpoint de renvoi de confirmation')."""

    message: str
    email: str | None = None
