from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import AnyHttpUrl, BaseModel, Field, field_validator, model_validator

from core.config import get_settings
from schemas.base import TimestampRead


class IngestOfferItemCreate(BaseModel):
    source_reference: str | None = Field(default=None, max_length=255)
    title: str = Field(min_length=1, max_length=300)
    company_name: str = Field(min_length=1, max_length=255)
    source_url: AnyHttpUrl
    canonical_url: AnyHttpUrl | None = None
    published_at: datetime | None = None
    location_raw: str | None = Field(default=None, max_length=255)
    salary_raw: str | None = Field(default=None, max_length=255)
    description: str | None = None
    raw_data: dict | None = None
    filiere_code: str | None = Field(default=None, max_length=120)
    contract_type_code: str | None = Field(default=None, max_length=60)
    experience_level_code: str | None = Field(default=None, max_length=60)
    education_level_code: str | None = Field(default=None, max_length=60)

    @field_validator("title", "company_name", mode="before")
    @classmethod
    def _strip_required(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value

    def as_raw_payload(self) -> dict:
        return self.model_dump(mode="json")


class IngestBatchCreate(BaseModel):
    batch_id: UUID
    source_code: str = Field(min_length=1, max_length=80)
    run_reference: str | None = Field(default=None, max_length=255)
    scraped_at: datetime | None = None
    offers: list[IngestOfferItemCreate] = Field(min_length=1)

    @field_validator("source_code", mode="before")
    @classmethod
    def _strip_source_code(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value

    @model_validator(mode="after")
    def _check_batch_size(self):
        max_size = get_settings().ingestion_batch_size_max
        if len(self.offers) > max_size:
            raise ValueError(f"Le batch depasse INGESTION_BATCH_SIZE_MAX={max_size}")
        return self


class IngestBatchSummaryRead(BaseModel):
    batch_id: UUID
    source_code: str
    scrape_run_id: str | None = None
    status: str
    received: int = 0
    valid: int = 0
    new: int = 0
    duplicates: int = 0
    invalid: int = 0
    errors: int = 0
    skipped: int = 0
    ai_job_triggered: bool = False
    ai_job_id: str | None = None
    message: str | None = None


class AiProcessingJobRead(TimestampRead):
    id: str
    scrape_run_id: str | None = None
    source_id: str | None = None
    trigger_type: str
    status: str
    offers_total: int
    offers_processed: int
    offers_activated: int
    offers_rejected: int
    offers_skipped: int
    error_message: str | None = None
    celery_task_id: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
