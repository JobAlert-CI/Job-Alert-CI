from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from models.enums import (
    AIAlertSeverity,
    AIErrorType,
    AIFiliereSuggestionStatus,
    AIJobStatus,
    AIJobTrigger,
    AIOfferAttemptStatus,
    AiProcessingJobStatus,
    AiProcessingJobTrigger,
    AIProviderType,
)
from models.types import enum_column

if TYPE_CHECKING:
    from models.admin import Administrator
    from models.jobs import JobOffer
    from models.referentials import Source
    from models.scraping import ScrapeRun


class AIApiKey(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "ai_api_keys"

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    provider_type: Mapped[AIProviderType] = mapped_column(enum_column(AIProviderType), index=True, nullable=False)
    base_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    models: Mapped[list[str] | dict | None] = mapped_column(JSON, nullable=True)
    api_key_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    api_key_last4: Mapped[str | None] = mapped_column(String(8), nullable=True)
    priority: Mapped[int] = mapped_column(Integer, default=100, index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)
    max_concurrent_requests: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    max_retries: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    retry_backoff_seconds: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    rate_limit_per_minute: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True, nullable=True)
    disabled_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True, nullable=True)

    jobs: Mapped[list[AIJob]] = relationship(back_populates="primary_api_key")
    attempts: Mapped[list[AIOfferAttempt]] = relationship(back_populates="api_key")

    __table_args__ = (
        CheckConstraint("priority >= 0", name="ai_api_key_priority_positive"),
        CheckConstraint("max_concurrent_requests >= 1", name="ai_api_key_max_concurrent_positive"),
        CheckConstraint("timeout_seconds >= 1", name="ai_api_key_timeout_positive"),
        CheckConstraint("max_retries >= 0", name="ai_api_key_max_retries_positive"),
        CheckConstraint("retry_backoff_seconds >= 0", name="ai_api_key_retry_backoff_positive"),
        CheckConstraint("rate_limit_per_minute IS NULL OR rate_limit_per_minute >= 1", name="ai_api_key_rate_limit_positive"),
        Index("ix_ai_api_keys_selection", "is_active", "priority", "last_error_at", "created_at"),
    )


class AIJob(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ai_jobs"

    trigger_type: Mapped[AIJobTrigger] = mapped_column(enum_column(AIJobTrigger), index=True, nullable=False)
    status: Mapped[AIJobStatus] = mapped_column(
        enum_column(AIJobStatus), default=AIJobStatus.PENDING, index=True, nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    offers_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    offers_activated: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    offers_pending_review: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    offers_rejected: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    offers_reprocess_required: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    primary_api_key_id: Mapped[str | None] = mapped_column(ForeignKey("ai_api_keys.id", ondelete="SET NULL"), index=True, nullable=True)
    fallback_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    celery_task_id: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)

    primary_api_key: Mapped[AIApiKey | None] = relationship(back_populates="jobs")
    attempts: Mapped[list[AIOfferAttempt]] = relationship(back_populates="job")
    alerts: Mapped[list[AIAlert]] = relationship(back_populates="job")
    filiere_suggestions: Mapped[list[AIFiliereSuggestion]] = relationship(back_populates="job")

    __table_args__ = (
        CheckConstraint("offers_total >= 0", name="ai_job_offers_total_positive"),
        CheckConstraint("offers_activated >= 0", name="ai_job_offers_activated_positive"),
        CheckConstraint("offers_pending_review >= 0", name="ai_job_offers_pending_review_positive"),
        CheckConstraint("offers_rejected >= 0", name="ai_job_offers_rejected_positive"),
        CheckConstraint("offers_reprocess_required >= 0", name="ai_job_offers_reprocess_required_positive"),
        CheckConstraint("fallback_count >= 0", name="ai_job_fallback_count_positive"),
    )


class AIOfferAttempt(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "ai_offer_attempts"

    offer_id: Mapped[str] = mapped_column(ForeignKey("job_offers.id", ondelete="CASCADE"), index=True, nullable=False)
    ai_job_id: Mapped[str | None] = mapped_column(ForeignKey("ai_jobs.id", ondelete="SET NULL"), index=True, nullable=True)
    ai_api_key_id: Mapped[str | None] = mapped_column(ForeignKey("ai_api_keys.id", ondelete="SET NULL"), index=True, nullable=True)
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[AIOfferAttemptStatus] = mapped_column(enum_column(AIOfferAttemptStatus), index=True, nullable=False)
    error_type: Mapped[AIErrorType | None] = mapped_column(enum_column(AIErrorType), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    offer: Mapped[JobOffer] = relationship()
    job: Mapped[AIJob | None] = relationship(back_populates="attempts")
    api_key: Mapped[AIApiKey | None] = relationship(back_populates="attempts")

    __table_args__ = (
        CheckConstraint("attempt_number >= 1", name="ai_offer_attempt_number_positive"),
        CheckConstraint("duration_ms IS NULL OR duration_ms >= 0", name="ai_offer_attempt_duration_positive"),
    )


class AIAlert(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "ai_alerts"

    job_id: Mapped[str | None] = mapped_column(ForeignKey("ai_jobs.id", ondelete="SET NULL"), index=True, nullable=True)
    type: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    severity: Mapped[AIAlertSeverity] = mapped_column(enum_column(AIAlertSeverity), index=True, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    acknowledged_by_admin_id: Mapped[str | None] = mapped_column(
        ForeignKey("administrators.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    job: Mapped[AIJob | None] = relationship(back_populates="alerts")
    acknowledged_by_admin: Mapped[Administrator | None] = relationship()


class AIFiliereSuggestion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ai_filiere_suggestions"

    offer_id: Mapped[str | None] = mapped_column(ForeignKey("job_offers.id", ondelete="SET NULL"), index=True, nullable=True)
    job_id: Mapped[str | None] = mapped_column(ForeignKey("ai_jobs.id", ondelete="SET NULL"), index=True, nullable=True)
    code: Mapped[str] = mapped_column(String(120), nullable=False)
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[AIFiliereSuggestionStatus] = mapped_column(
        enum_column(AIFiliereSuggestionStatus), default=AIFiliereSuggestionStatus.PENDING, index=True, nullable=False
    )
    reviewed_by_admin_id: Mapped[str | None] = mapped_column(
        ForeignKey("administrators.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    offer: Mapped[JobOffer | None] = relationship()
    job: Mapped[AIJob | None] = relationship(back_populates="filiere_suggestions")
    reviewed_by_admin: Mapped[Administrator | None] = relationship()


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

    scrape_run: Mapped[ScrapeRun | None] = relationship(back_populates="ai_jobs")
    source: Mapped[Source | None] = relationship()
    offers: Mapped[list[JobOffer]] = relationship(back_populates="ai_processing_job")

    __table_args__ = (
        CheckConstraint("offers_total >= 0", name="ai_processing_job_offers_total_positive"),
        CheckConstraint("offers_processed >= 0", name="ai_processing_job_offers_processed_positive"),
        CheckConstraint("offers_activated >= 0", name="ai_processing_job_offers_activated_positive"),
        CheckConstraint("offers_rejected >= 0", name="ai_processing_job_offers_rejected_positive"),
        CheckConstraint("offers_skipped >= 0", name="ai_processing_job_offers_skipped_positive"),
    )
