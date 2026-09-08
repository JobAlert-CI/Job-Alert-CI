from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from schemas.base import ORMModel


class SiteSettingRead(ORMModel):
    key: str
    value: str
    description: str | None = None
    # Cycle 18 : auteur de la derniere modification (nullable — le seed
    # n'en pose pas). Expose pour que la page Parametres affiche QUI a
    # change chaque valeur sans croisement client.
    # ORMModel obligatoire : les routes renvoient l'objet SiteSetting brut,
    # un BaseModel pur ignorerait ce champ (piege « champ calcule = ORM
    # brut », cycle 6).
    updated_by_admin_id: str | None = None
    updated_at: datetime


class SettingUpdate(BaseModel):
    value: str = Field(min_length=0, max_length=10000)
    description: str | None = Field(default=None, max_length=500)


class SettingsBulkUpdate(BaseModel):
    settings: dict[str, str] = Field(
        min_length=1,
        description="Dictionnaire clé → valeur des paramètres à mettre à jour.",
    )
