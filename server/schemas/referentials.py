from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from schemas.base import TimestampRead


class SourceRead(TimestampRead):
    id: str
    code: str
    name: str
    slug: str
    base_url: str
    jobs_url: str | None = None
    logo_path: str | None = None
    color_hex: str | None = None
    short_code: str | None = None
    status: str
    priority: int
    supports_scraping: bool
    anti_scraping_level: int
    default_scan_time: str | None = None
    description: str | None = None
    notes: str | None = None
    is_primary: bool


class FiliereKeywordRead(TimestampRead):
    id: str
    keyword: str
    weight: int
    is_active: bool


class FiliereSpecialtyRead(TimestampRead):
    id: str
    code: str
    label: str
    sort_order: int
    is_active: bool


class FiliereRead(TimestampRead):
    id: str
    code: str
    label: str
    slug: str
    color_hex: str | None = None
    tagline: str | None = None
    description: str | None = None
    sort_order: int
    is_active: bool
    specialties: list[FiliereSpecialtyRead] = []


class ContractTypeRead(TimestampRead):
    id: str
    code: str
    label: str
    sort_order: int
    is_active: bool


class ExperienceLevelRead(TimestampRead):
    id: str
    code: str
    label: str
    min_years: int | None = None
    max_years: int | None = None
    sort_order: int
    is_active: bool


class EducationLevelRead(TimestampRead):
    id: str
    code: str
    label: str
    rank: int | None = None
    sort_order: int
    is_active: bool


class LocationRead(TimestampRead):
    id: str
    country_code: str
    city: str
    district: str | None = None
    label: str
    normalized_label: str
    is_remote: bool
    is_active: bool


# ─── Create / Update schemas (admin) ────────────────────

class FiliereCreate(BaseModel):
    code: str = Field(min_length=2, max_length=120)
    label: str = Field(min_length=2, max_length=160)
    slug: str = Field(min_length=2, max_length=180)
    color_hex: str | None = Field(default=None, max_length=16)
    tagline: str | None = Field(default=None, max_length=255)
    description: str | None = None
    sort_order: int = Field(default=100, ge=0)
    is_active: bool = True


class FiliereUpdate(BaseModel):
    label: str | None = Field(default=None, max_length=160)
    slug: str | None = Field(default=None, max_length=180)
    color_hex: str | None = Field(default=None, max_length=16)
    tagline: str | None = Field(default=None, max_length=255)
    description: str | None = None
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class FiliereKeywordsUpdate(BaseModel):
    """Remplace la liste des mots-clés d'une filière."""
    keywords: list[dict] = Field(
        description="Liste de {keyword: str, weight: int} (1-100).",
        min_length=0,
    )


class SpecialiteCreate(BaseModel):
    code: str = Field(min_length=2, max_length=120)
    label: str = Field(min_length=2, max_length=160)
    sort_order: int = Field(default=100, ge=0)
    is_active: bool = True


class SpecialiteUpdate(BaseModel):
    label: str | None = Field(default=None, max_length=160)
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class SourceCreate(BaseModel):
    code: str = Field(min_length=2, max_length=80)
    name: str = Field(min_length=2, max_length=120)
    slug: str = Field(min_length=2, max_length=140)
    base_url: str = Field(min_length=5, max_length=500)
    jobs_url: str | None = Field(default=None, max_length=500)
    color_hex: str | None = Field(default=None, max_length=16)
    short_code: str | None = Field(default=None, max_length=8)
    priority: int = Field(default=100, ge=0)
    supports_scraping: bool = True
    anti_scraping_level: int = Field(default=0, ge=0, le=5)
    description: str | None = None
    notes: str | None = None
    is_primary: bool = False


class SourceUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    base_url: str | None = Field(default=None, max_length=500)
    jobs_url: str | None = Field(default=None, max_length=500)
    color_hex: str | None = Field(default=None, max_length=16)
    short_code: str | None = Field(default=None, max_length=8)
    priority: int | None = Field(default=None, ge=0)
    supports_scraping: bool | None = None
    anti_scraping_level: int | None = Field(default=None, ge=0, le=5)
    description: str | None = None
    notes: str | None = None
    is_primary: bool | None = None


class SourceStatusUpdate(BaseModel):
    status: Literal["active", "paused", "disabled"]


class ContractTypeCreate(BaseModel):
    code: str = Field(min_length=2, max_length=60)
    label: str = Field(min_length=2, max_length=80)
    sort_order: int = Field(default=100, ge=0)
    is_active: bool = True


class ContractTypeUpdate(BaseModel):
    label: str | None = Field(default=None, max_length=80)
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class ExperienceLevelCreate(BaseModel):
    code: str = Field(min_length=2, max_length=60)
    label: str = Field(min_length=2, max_length=80)
    min_years: int | None = Field(default=None, ge=0)
    max_years: int | None = Field(default=None, ge=0)
    sort_order: int = Field(default=100, ge=0)
    is_active: bool = True


class ExperienceLevelUpdate(BaseModel):
    label: str | None = Field(default=None, max_length=80)
    min_years: int | None = Field(default=None, ge=0)
    max_years: int | None = Field(default=None, ge=0)
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class EducationLevelCreate(BaseModel):
    code: str = Field(min_length=2, max_length=60)
    label: str = Field(min_length=2, max_length=80)
    rank: int | None = Field(default=None, ge=0)
    sort_order: int = Field(default=100, ge=0)
    is_active: bool = True


class EducationLevelUpdate(BaseModel):
    label: str | None = Field(default=None, max_length=80)
    rank: int | None = Field(default=None, ge=0)
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class LocationCreate(BaseModel):
    country_code: str = Field(default="CI", max_length=2)
    city: str = Field(min_length=1, max_length=120)
    district: str | None = Field(default=None, max_length=120)
    label: str = Field(min_length=1, max_length=255)
    is_remote: bool = False
    is_active: bool = True


class LocationUpdate(BaseModel):
    city: str | None = Field(default=None, max_length=120)
    district: str | None = Field(default=None, max_length=120)
    label: str | None = Field(default=None, max_length=255)
    is_remote: bool | None = None
    is_active: bool | None = None

class FiliereSimulationInput(BaseModel):
    filiere_code: str = Field(..., max_length=120)
    keywords: list[dict] = Field(
        description="Liste de {keyword: str, weight: int} (1-100)", min_length=1
    )


class FiliereSimulationResult(BaseModel):
    filiere_code: str
    current_keyword_count: int
    proposed_keyword_count: int
    offers_affected_7_days: int
    message: str

