from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from models.enums import ScrapeRunStatus
from models.types import enum_column

"""Suivi de collecte.

Les runs globaux et par source donnent une base fiable pour les retries, les
alertes et le tableau de bord admin.
"""

if TYPE_CHECKING:
    from models.ai import AiProcessingJob
    from models.emails import EmailDigest
    from models.jobs import JobOffer, OfferIngestionEvent
    from models.referentials import Source


class ScrapeRun(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "scrape_runs"

    run_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    status: Mapped[ScrapeRunStatus] = mapped_column(
        enum_column(ScrapeRunStatus), default=ScrapeRunStatus.PENDING, index=True, nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    triggered_by: Mapped[str] = mapped_column(String(160), default="scheduler", nullable=False)
    external_batch_id: Mapped[str | None] = mapped_column(String(36), unique=True, index=True, nullable=True)
    run_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    scraped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total_raw: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_inserted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_updated: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_duplicates: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_errors: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    source_runs: Mapped[list["SourceScrapeRun"]] = relationship(
        back_populates="scrape_run", cascade="all, delete-orphan", order_by="SourceScrapeRun.started_at"
    )
    digests: Mapped[list["EmailDigest"]] = relationship(back_populates="scrape_run")
    ai_jobs: Mapped[list["AiProcessingJob"]] = relationship(back_populates="scrape_run")

    __table_args__ = (
        UniqueConstraint("run_date", "triggered_by", name="uq_scrape_runs_date_triggered_by"),
        CheckConstraint("total_raw >= 0", name="scrape_run_total_raw_positive"),
        CheckConstraint("total_inserted >= 0", name="scrape_run_total_inserted_positive"),
        CheckConstraint("total_updated >= 0", name="scrape_run_total_updated_positive"),
        CheckConstraint("total_duplicates >= 0", name="scrape_run_total_duplicates_positive"),
        CheckConstraint("total_errors >= 0", name="scrape_run_total_errors_positive"),
    )


class SourceScrapeRun(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "source_scrape_runs"

    scrape_run_id: Mapped[str] = mapped_column(ForeignKey("scrape_runs.id", ondelete="CASCADE"), index=True, nullable=False)
    source_id: Mapped[str] = mapped_column(ForeignKey("sources.id", ondelete="RESTRICT"), index=True, nullable=False)
    status: Mapped[ScrapeRunStatus] = mapped_column(
        enum_column(ScrapeRunStatus), default=ScrapeRunStatus.PENDING, index=True, nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    http_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    raw_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    inserted_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    duplicate_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    scrape_run: Mapped["ScrapeRun"] = relationship(back_populates="source_runs")
    source: Mapped["Source"] = relationship(back_populates="scrape_runs")
    ingestion_events: Mapped[list["OfferIngestionEvent"]] = relationship(back_populates="source_scrape_run")
    offers: Mapped[list["JobOffer"]] = relationship(back_populates="source_scrape_run")

    __table_args__ = (
        UniqueConstraint("scrape_run_id", "source_id", name="uq_source_scrape_runs_run_source"),
        CheckConstraint("duration_ms IS NULL OR duration_ms >= 0", name="source_scrape_run_duration_positive"),
        CheckConstraint("raw_count >= 0", name="source_scrape_run_raw_count_positive"),
        CheckConstraint("inserted_count >= 0", name="source_scrape_run_inserted_count_positive"),
        CheckConstraint("updated_count >= 0", name="source_scrape_run_updated_count_positive"),
        CheckConstraint("duplicate_count >= 0", name="source_scrape_run_duplicate_count_positive"),
        CheckConstraint("error_count >= 0", name="source_scrape_run_error_count_positive"),
    )
