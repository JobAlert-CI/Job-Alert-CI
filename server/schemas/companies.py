"""Schemas Pydantic pour les entreprises (Company).

Centralise les definitions qui etaient redclarees dans
`api/v1/admin/companies.py` et `api/v1/public/contact.py`. Le pattern
Create / Update / Read est aligne sur le reste du projet.
"""
from __future__ import annotations

from pydantic import Field

from schemas.base import ORMModel, TimestampRead


class CompanyCreate(ORMModel):
    name: str = Field(min_length=1, max_length=255)
    normalized_name: str = Field(min_length=1, max_length=255)
    slug: str | None = Field(default=None, max_length=280)
    website_url: str | None = None
    logo_url: str | None = None
    description: str | None = None
    primary_filiere_id: str | None = None


class CompanyUpdate(ORMModel):
    """Mise a jour partielle: tous les champs sont optionnels."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    normalized_name: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, max_length=280)
    website_url: str | None = None
    logo_url: str | None = None
    description: str | None = None
    primary_filiere_id: str | None = None


class CompanyAdminRead(TimestampRead):
    id: str
    name: str
    normalized_name: str
    slug: str | None = None
    website_url: str | None = None
    logo_url: str | None = None
    description: str | None = None
    primary_filiere_id: str | None = None
    active_offers_count: int = 0


__all__ = ["CompanyAdminRead", "CompanyCreate", "CompanyUpdate"]
