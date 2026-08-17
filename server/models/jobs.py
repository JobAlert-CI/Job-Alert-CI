from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from models.enums import AiOfferStatus, IngestionAction, JobOfferOrigin, JobOfferStatus
from models.types import enum_column

"""Domaine offres.

Le modele fusionne la richesse de ServerJobAlert 1 (details, sources, filieres,
stats, origine admin/scraping) avec les garde-fous de ServerJobAlert 2
(normalisation, hash de dedoublonnage, suivi d'ingestion).
"""

if TYPE_CHECKING:
    from models.admin import Administrator
    from models.ai import AiProcessingJob
    from models.emails import EmailDigestOffer
    from models.referentials import ContractType, EducationLevel, ExperienceLevel, Filiere, FiliereSpecialty, Location, Source
    from models.scraping import SourceScrapeRun
    from models.subscriptions import SavedOffer


class Company(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "companies"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    slug: Mapped[str | None] = mapped_column(String(280), unique=True, nullable=True)
    website_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    primary_filiere_id: Mapped[str | None] = mapped_column(ForeignKey("filieres.id", ondelete="SET NULL"), nullable=True)

    primary_filiere: Mapped["Filiere | None"] = relationship(back_populates="companies")
    offers: Mapped[list["JobOffer"]] = relationship(back_populates="company")


class JobOffer(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "job_offers"

    public_id: Mapped[int | None] = mapped_column(Integer, unique=True, index=True, nullable=True)
    title: Mapped[str] = mapped_column(String(300), index=True, nullable=False)
    normalized_title: Mapped[str] = mapped_column(String(320), index=True, nullable=False)
    slug: Mapped[str | None] = mapped_column(String(340), unique=True, nullable=True)

    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"), index=True, nullable=False)
    source_id: Mapped[str] = mapped_column(ForeignKey("sources.id", ondelete="RESTRICT"), index=True, nullable=False)
    location_id: Mapped[str | None] = mapped_column(ForeignKey("locations.id", ondelete="SET NULL"), index=True, nullable=True)
    primary_filiere_id: Mapped[str | None] = mapped_column(ForeignKey("filieres.id", ondelete="SET NULL"), index=True, nullable=True)
    specialty_id: Mapped[str | None] = mapped_column(ForeignKey("filiere_specialties.id", ondelete="SET NULL"), index=True, nullable=True)
    contract_type_id: Mapped[str | None] = mapped_column(ForeignKey("contract_types.id", ondelete="SET NULL"), index=True, nullable=True)
    experience_level_id: Mapped[str | None] = mapped_column(ForeignKey("experience_levels.id", ondelete="SET NULL"), index=True, nullable=True)
    education_level_id: Mapped[str | None] = mapped_column(ForeignKey("education_levels.id", ondelete="SET NULL"), index=True, nullable=True)
    admin_id: Mapped[str | None] = mapped_column(ForeignKey("administrators.id", ondelete="SET NULL"), nullable=True)
    source_scrape_run_id: Mapped[str | None] = mapped_column(ForeignKey("source_scrape_runs.id", ondelete="SET NULL"), index=True, nullable=True)
    ai_processing_job_id: Mapped[str | None] = mapped_column(ForeignKey("ai_processing_jobs.id", ondelete="SET NULL"), index=True, nullable=True)

    status: Mapped[JobOfferStatus] = mapped_column(
        enum_column(JobOfferStatus), default=JobOfferStatus.ACTIVE, index=True, nullable=False
    )
    origin: Mapped[JobOfferOrigin] = mapped_column(
        enum_column(JobOfferOrigin), default=JobOfferOrigin.SCRAPING, nullable=False
    )
    visible_site: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)
    is_duplicate: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    duplicate_of_id: Mapped[str | None] = mapped_column(ForeignKey("job_offers.id", ondelete="SET NULL"), nullable=True)
    duplicate_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    source_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    canonical_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    hash_unique: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    content_hash: Mapped[str | None] = mapped_column(String(128), index=True, nullable=True)
    location_raw: Mapped[str | None] = mapped_column(String(255), nullable=True)
    salary_raw: Mapped[str | None] = mapped_column(String(255), nullable=True)
    raw_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True, nullable=True)
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True, nullable=False)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True, nullable=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True, nullable=True)
    application_deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    view_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    save_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    ai_status: Mapped[AiOfferStatus] = mapped_column(
        enum_column(AiOfferStatus), default=AiOfferStatus.PENDING, index=True, nullable=False
    )
    ai_provider: Mapped[str | None] = mapped_column(String(120), nullable=True)
    ai_model: Mapped[str | None] = mapped_column(String(160), nullable=True)
    ai_task_id: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    ai_error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    company: Mapped["Company"] = relationship(back_populates="offers")
    source: Mapped["Source"] = relationship(back_populates="offers")
    location: Mapped["Location | None"] = relationship(back_populates="offers")
    primary_filiere: Mapped["Filiere | None"] = relationship(back_populates="offers")
    specialty: Mapped["FiliereSpecialty | None"] = relationship(back_populates="offers")
    contract_type: Mapped["ContractType | None"] = relationship(back_populates="offers")
    experience_level: Mapped["ExperienceLevel | None"] = relationship(back_populates="offers")
    education_level: Mapped["EducationLevel | None"] = relationship(back_populates="offers")
    admin: Mapped["Administrator | None"] = relationship(back_populates="offers")
    source_scrape_run: Mapped["SourceScrapeRun | None"] = relationship(back_populates="offers")
    ai_processing_job: Mapped["AiProcessingJob | None"] = relationship(back_populates="offers")
    duplicate_of: Mapped["JobOffer | None"] = relationship(remote_side="JobOffer.id")
    detail: Mapped["JobOfferDetail | None"] = relationship(back_populates="offer", cascade="all, delete-orphan", uselist=False)
    filiere_links: Mapped[list["OfferFiliere"]] = relationship(back_populates="offer", cascade="all, delete-orphan")
    ingestion_events: Mapped[list["OfferIngestionEvent"]] = relationship(back_populates="offer")
    digest_links: Mapped[list["EmailDigestOffer"]] = relationship(back_populates="offer")
    saved_by: Mapped[list["SavedOffer"]] = relationship(back_populates="offer")

    __table_args__ = (
        UniqueConstraint("source_id", "source_reference", name="uq_job_offers_source_reference"),
        CheckConstraint("view_count >= 0", name="job_offer_view_count_positive"),
        CheckConstraint("save_count >= 0", name="job_offer_save_count_positive"),
        Index("ix_job_offers_feed", "visible_site", "status", "published_at"),
        Index("ix_job_offers_search", "normalized_title", "visible_site", "status"),
    )


class JobOfferDetail(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "job_offer_details"

    offer_id: Mapped[str] = mapped_column(ForeignKey("job_offers.id", ondelete="CASCADE"), unique=True, nullable=False)
    intro: Mapped[str | None] = mapped_column(Text, nullable=True)
    missions: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    profile_requirements: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    benefits: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    tags: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    source_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_manual: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    offer: Mapped["JobOffer"] = relationship(back_populates="detail")


class OfferFiliere(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "offer_filieres"

    offer_id: Mapped[str] = mapped_column(ForeignKey("job_offers.id", ondelete="CASCADE"), index=True, nullable=False)
    filiere_id: Mapped[str] = mapped_column(ForeignKey("filieres.id", ondelete="CASCADE"), index=True, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    matched_keywords: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    offer: Mapped["JobOffer"] = relationship(back_populates="filiere_links")
    filiere: Mapped["Filiere"] = relationship(back_populates="offer_links")

    __table_args__ = (
        UniqueConstraint("offer_id", "filiere_id", name="uq_offer_filieres_offer_filiere"),
        CheckConstraint("confidence >= 0 AND confidence <= 1", name="offer_filiere_confidence_range"),
    )


class OfferIngestionEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "offer_ingestion_events"

    offer_id: Mapped[str | None] = mapped_column(ForeignKey("job_offers.id", ondelete="SET NULL"), index=True, nullable=True)
    source_scrape_run_id: Mapped[str | None] = mapped_column(ForeignKey("source_scrape_runs.id", ondelete="SET NULL"), index=True, nullable=True)
    action: Mapped[IngestionAction] = mapped_column(enum_column(IngestionAction), nullable=False)
    hash_unique: Mapped[str | None] = mapped_column(String(128), index=True, nullable=True)
    raw_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    raw_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    offer: Mapped["JobOffer | None"] = relationship(back_populates="ingestion_events")
    source_scrape_run: Mapped["SourceScrapeRun | None"] = relationship(back_populates="ingestion_events")
