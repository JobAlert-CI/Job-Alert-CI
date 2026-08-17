from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from models.enums import AiProcessingJobStatus, AiProcessingJobTrigger
from models.types import enum_column

if TYPE_CHECKING:
    from models.jobs import JobOffer
    from models.referentials import Source
    from models.scraping import ScrapeRun


class AiProcessingJob(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ai_processing_jobs"

    scrape_run_id: Mapped[str | None] = mapped_column(ForeignKey("scrape_runs.id", ondelete="SET NULL"), index=True, nullable=True)
    source_id: Mapped[str | None] = mapped_column(ForeignKey("sources.id", ondelete="SET NULL"), index=True, nullable=True)
    trigger_type: Mapped[AiProcessingJobTrigger] = mapped_column(enum_column(AiProcessingJobTrigger), nullable=False)
    status: Mapped[AiProcessingJobStatus] = mapped_column(
        enum_column(AiProcessingJobStatus), default=AiProcessingJobStatus.PENDING, index=True, nullable=False
    )
    offers_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    offers_processed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    offers_activated: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    offers_rejected: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    offers_skipped: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    celery_task_id: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    scrape_run: Mapped["ScrapeRun | None"] = relationship(back_populates="ai_jobs")
    source: Mapped["Source | None"] = relationship()
    offers: Mapped[list["JobOffer"]] = relationship(back_populates="ai_processing_job")

    __table_args__ = (
        CheckConstraint("offers_total >= 0", name="ai_processing_job_offers_total_positive"),
        CheckConstraint("offers_processed >= 0", name="ai_processing_job_offers_processed_positive"),
        CheckConstraint("offers_activated >= 0", name="ai_processing_job_offers_activated_positive"),
        CheckConstraint("offers_rejected >= 0", name="ai_processing_job_offers_rejected_positive"),
        CheckConstraint("offers_skipped >= 0", name="ai_processing_job_offers_skipped_positive"),
    )
