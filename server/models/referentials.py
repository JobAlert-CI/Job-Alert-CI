from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from models.enums import SourceStatus
from models.types import enum_column

"""Referentiels stables du produit.

Ces tables evitent les libelles libres dans les offres et les abonnements. Le
matching, les filtres et les emails restent coherents meme quand les sources
scrapees changent leur vocabulaire.
"""

if TYPE_CHECKING:
    from models.jobs import Company, JobOffer, OfferFiliere
    from models.scraping import SourceScrapeRun
    from models.subscriptions import Subscriber, SubscriberContractPreference, SubscriberFiliere


class Source(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "sources"

    code: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(140), unique=True, index=True, nullable=False)
    base_url: Mapped[str] = mapped_column(String(500), nullable=False)
    jobs_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    logo_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    color_hex: Mapped[str | None] = mapped_column(String(16), nullable=True)
    short_code: Mapped[str | None] = mapped_column(String(8), nullable=True)
    status: Mapped[SourceStatus] = mapped_column(
        enum_column(SourceStatus), default=SourceStatus.ACTIVE, index=True, nullable=False
    )
    priority: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    supports_scraping: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    anti_scraping_level: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    default_scan_time: Mapped[str | None] = mapped_column(String(8), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    offers: Mapped[list[JobOffer]] = relationship(back_populates="source")
    scrape_runs: Mapped[list[SourceScrapeRun]] = relationship(back_populates="source")

    __table_args__ = (
        CheckConstraint("priority >= 0", name="source_priority_positive"),
        CheckConstraint("anti_scraping_level >= 0 AND anti_scraping_level <= 5", name="source_anti_scraping_range"),
    )


class Filiere(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "filieres"

    code: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True, nullable=False)
    color_hex: Mapped[str | None] = mapped_column(String(16), nullable=True)
    tagline: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    keywords: Mapped[list[FiliereKeyword]] = relationship(
        back_populates="filiere",
        cascade="all, delete-orphan",
        order_by="FiliereKeyword.weight.desc(), FiliereKeyword.keyword",
    )
    specialties: Mapped[list[FiliereSpecialty]] = relationship(
        back_populates="filiere",
        cascade="all, delete-orphan",
        order_by="FiliereSpecialty.sort_order, FiliereSpecialty.label",
    )
    companies: Mapped[list[Company]] = relationship(back_populates="primary_filiere")
    offers: Mapped[list[JobOffer]] = relationship(back_populates="primary_filiere")
    offer_links: Mapped[list[OfferFiliere]] = relationship(back_populates="filiere", cascade="all, delete-orphan")
    subscriber_links: Mapped[list[SubscriberFiliere]] = relationship(
        back_populates="filiere", cascade="all, delete-orphan"
    )

    __table_args__ = (CheckConstraint("sort_order >= 0", name="filiere_sort_order_positive"),)


class FiliereKeyword(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "filiere_keywords"

    filiere_id: Mapped[str] = mapped_column(ForeignKey("filieres.id", ondelete="CASCADE"), index=True, nullable=False)
    keyword: Mapped[str] = mapped_column(String(160), nullable=False)
    normalized_keyword: Mapped[str] = mapped_column(String(160), nullable=False)
    weight: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    filiere: Mapped[Filiere] = relationship(back_populates="keywords")

    __table_args__ = (
        UniqueConstraint("filiere_id", "normalized_keyword", name="uq_filiere_keywords_filiere_keyword"),
        CheckConstraint("weight >= 1 AND weight <= 100", name="filiere_keyword_weight_range"),
    )


class FiliereSpecialty(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "filiere_specialties"

    filiere_id: Mapped[str] = mapped_column(ForeignKey("filieres.id", ondelete="CASCADE"), index=True, nullable=False)
    code: Mapped[str] = mapped_column(String(120), nullable=False)
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    filiere: Mapped[Filiere] = relationship(back_populates="specialties")
    offers: Mapped[list[JobOffer]] = relationship(back_populates="specialty")

    __table_args__ = (
        UniqueConstraint("filiere_id", "code", name="uq_filiere_specialties_filiere_code"),
        UniqueConstraint("filiere_id", "label", name="uq_filiere_specialties_filiere_label"),
    )


class ContractType(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "contract_types"

    code: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    label: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    offers: Mapped[list[JobOffer]] = relationship(back_populates="contract_type")
    subscriber_preferences: Mapped[list[SubscriberContractPreference]] = relationship(back_populates="contract_type")


class ExperienceLevel(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "experience_levels"

    code: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    label: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    min_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    offers: Mapped[list[JobOffer]] = relationship(back_populates="experience_level")
    subscribers: Mapped[list[Subscriber]] = relationship(back_populates="experience_level")

    __table_args__ = (
        CheckConstraint("min_years IS NULL OR min_years >= 0", name="experience_min_years_positive"),
        CheckConstraint("max_years IS NULL OR min_years IS NULL OR max_years >= min_years", name="experience_max_after_min"),
    )


class EducationLevel(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "education_levels"

    code: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    label: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    offers: Mapped[list[JobOffer]] = relationship(back_populates="education_level")


class Location(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "locations"

    country_code: Mapped[str] = mapped_column(String(2), default="CI", nullable=False)
    city: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    district: Mapped[str | None] = mapped_column(String(120), nullable=True)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    normalized_label: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    is_remote: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    offers: Mapped[list[JobOffer]] = relationship(back_populates="location")
