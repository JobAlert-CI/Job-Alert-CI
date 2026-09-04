from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from schemas.base import ORMModel, TimestampRead
from schemas.referentials import (
    ContractTypeRead,
    EducationLevelRead,
    ExperienceLevelRead,
    FiliereRead,
    FiliereSpecialtyRead,
    LocationRead,
    SourceRead,
)


class CompanyRead(TimestampRead):
    id: str
    name: str
    normalized_name: str
    slug: str | None = None
    website_url: str | None = None
    logo_url: str | None = None
    description: str | None = None


class JobOfferDetailRead(TimestampRead):
    id: str
    intro: str | None = None
    missions: list[str] | None = None
    profile_requirements: list[str] | None = None
    benefits: list[str] | None = None
    tags: list[str] | None = None
    source_text: str | None = None
    is_manual: bool


class JobOfferRead(TimestampRead):
    id: str
    public_id: int | None = None
    title: str
    normalized_title: str
    slug: str | None = None
    status: str
    origin: str
    visible_site: bool
    source_reference: str | None = None
    source_url: str
    canonical_url: str | None = None
    location_raw: str | None = None
    salary_raw: str | None = None
    published_at: datetime | None = None
    collected_at: datetime
    first_seen_at: datetime
    last_seen_at: datetime | None = None
    expires_at: datetime | None = None
    application_deadline_at: datetime | None = None
    view_count: int
    save_count: int
    company: CompanyRead
    source: SourceRead
    location: LocationRead | None = None
    primary_filiere: FiliereRead | None = None
    specialty: FiliereSpecialtyRead | None = None
    contract_type: ContractTypeRead | None = None
    experience_level: ExperienceLevelRead | None = None
    education_level: EducationLevelRead | None = None
    detail: JobOfferDetailRead | None = None


class OfferCreate(ORMModel):
    title: str = Field(min_length=2, max_length=300)
    company_name: str = Field(min_length=1, max_length=255)
    source_code: str = Field(min_length=1, max_length=80)
    source_url: str = Field(min_length=5, max_length=1000)
    source_reference: str | None = Field(default=None, max_length=255)
    canonical_url: str | None = Field(default=None, max_length=1000)
    filiere_code: str | None = Field(default=None, max_length=120)
    location_label: str | None = Field(default=None, max_length=255)
    contract_type_code: str | None = Field(default=None, max_length=60)
    experience_level_code: str | None = Field(default=None, max_length=60)
    education_level_code: str | None = Field(default=None, max_length=60)
    published_at: datetime | None = None
    expires_at: datetime | None = None
    application_deadline_at: datetime | None = None
    intro: str | None = None
    missions: list[str] | None = None
    profile_requirements: list[str] | None = None
    benefits: list[str] | None = None
    tags: list[str] | None = None


class OfferUpdate(ORMModel):
    """Mise à jour partielle d'une offre (tous les champs sont optionnels)."""
    title: str | None = Field(default=None, min_length=2, max_length=300)
    company_name: str | None = Field(default=None, min_length=1, max_length=255)
    filiere_code: str | None = Field(default=None, max_length=120)
    location_label: str | None = Field(default=None, max_length=255)
    contract_type_code: str | None = Field(default=None, max_length=60)
    experience_level_code: str | None = Field(default=None, max_length=60)
    education_level_code: str | None = Field(default=None, max_length=60)
    source_url: str | None = Field(default=None, min_length=5, max_length=1000)
    canonical_url: str | None = Field(default=None, max_length=1000)
    published_at: datetime | None = None
    expires_at: datetime | None = None
    application_deadline_at: datetime | None = None
    intro: str | None = None
    missions: list[str] | None = None
    profile_requirements: list[str] | None = None
    benefits: list[str] | None = None
    tags: list[str] | None = None
    visible_site: bool | None = None


class OfferVisibilityUpdate(ORMModel):
    visible_site: bool


JobOfferStatusLiteral = Literal[
    "active",
    "expired",
    "filled",
    "archived",
    "en_relecture",
    "duplicate",
    "hidden",
    "brut",
    "ai_processing",
    "pending_review",
    "processing",
    "rejected",
]


class OfferStatusUpdate(ORMModel):
    status: JobOfferStatusLiteral


class OfferBulkStatusUpdate(ORMModel):
    offer_ids: list[str] = Field(min_length=1, description="IDs des offres à modifier.")
    status: JobOfferStatusLiteral


# ─── Doublons proches (document 8 — section 2) ─────────────────────────────

class PotentialDuplicateRead(ORMModel):
    offer_a_id: str
    offer_b_id: str
    offer_a_title: str
    offer_b_title: str
    offer_a_company: str | None = None
    similarity_score: int
    reason: str | None = None


class DuplicateMarkRequest(BaseModel):
    duplicate_of_id: str = Field(..., description="ID de l'offre de reference (A)")
    duplicate_reason: str | None = Field(default=None, max_length=255)


class RejectRequest(BaseModel):
    offer_a_id: str = Field(..., description="ID de l'offre A (reference)")
    offer_b_id: str = Field(..., description="ID de l'offre B (suspecte)")
    reason: str | None = Field(default=None, max_length=255)
