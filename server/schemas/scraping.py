from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field

from schemas.base import TimestampRead


class SourceScrapeRunRead(TimestampRead):
    id: str
    scrape_run_id: str
    source_id: str
    status: str
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_ms: int | None = None
    http_status: int | None = None
    raw_count: int
    inserted_count: int
    updated_count: int
    duplicate_count: int
    error_count: int
    error_message: str | None = None


class ScrapeRunRead(TimestampRead):
    id: str
    run_date: date
    status: str
    started_at: datetime | None = None
    finished_at: datetime | None = None
    triggered_by: str
    external_batch_id: str | None = None
    run_reference: str | None = None
    scraped_at: datetime | None = None
    total_raw: int
    total_inserted: int
    total_updated: int
    total_duplicates: int
    total_errors: int
    notes: str | None = None
    source_runs: list[SourceScrapeRunRead] = []


class ScrapingTrigger(BaseModel):
    source_code: str | None = Field(
        default=None,
        description="Code de la source à scraper. Si None, toutes les sources actives sont scrapées.",
        max_length=80,
    )
    notes: str | None = Field(default=None, max_length=1000)


class ScrapingStatusRead(BaseModel):
    source_code: str
    source_name: str
    last_run_at: datetime | None = None
    last_status: str | None = None
    last_duration_ms: int | None = None
    last_error: str | None = None
    total_runs: int
