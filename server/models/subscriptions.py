from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from models.enums import NotificationChannel, SubscriberStatus, TokenPurpose
from models.types import enum_column

"""Abonnes et preferences d'alerte.

Le modele garde le MVP sans mot de passe de la v1, mais ajoute les statuts,
tokens et preferences structurees de la v2 pour pouvoir grandir sans casser les
emails deja envoyes.
"""

if TYPE_CHECKING:
    from models.emails import EmailDigest
    from models.jobs import JobOffer
    from models.referentials import ContractType, ExperienceLevel, Filiere


class Subscriber(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "subscribers"

    email: Mapped[str] = mapped_column(String(320), nullable=False)
    email_normalized: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(180), nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), index=True, nullable=True)
    status: Mapped[SubscriberStatus] = mapped_column(
        enum_column(SubscriberStatus), default=SubscriberStatus.ACTIVE, index=True, nullable=False
    )
    channel: Mapped[NotificationChannel] = mapped_column(
        enum_column(NotificationChannel), default=NotificationChannel.EMAIL, nullable=False
    )
    timezone: Mapped[str] = mapped_column(String(80), default="Africa/Abidjan", nullable=False)
    wants_career_tips: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    experience_level_id: Mapped[str | None] = mapped_column(ForeignKey("experience_levels.id", ondelete="SET NULL"), nullable=True)
    source: Mapped[str | None] = mapped_column(String(120), nullable=True)
    subscribed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paused_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    unsubscribed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    unsubscribe_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_email_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    bounce_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    experience_level: Mapped[ExperienceLevel | None] = relationship(back_populates="subscribers")
    filiere_links: Mapped[list[SubscriberFiliere]] = relationship(
        back_populates="subscriber", cascade="all, delete-orphan", order_by="SubscriberFiliere.priority"
    )
    contract_preferences: Mapped[list[SubscriberContractPreference]] = relationship(
        back_populates="subscriber", cascade="all, delete-orphan"
    )
    tokens: Mapped[list[SubscriberToken]] = relationship(back_populates="subscriber", cascade="all, delete-orphan")
    digests: Mapped[list[EmailDigest]] = relationship(back_populates="subscriber")
    saved_offers: Mapped[list[SavedOffer]] = relationship(back_populates="subscriber", cascade="all, delete-orphan")
    unsubscribe_events: Mapped[list[UnsubscribeEvent]] = relationship(back_populates="subscriber", cascade="all, delete-orphan")

    __table_args__ = (CheckConstraint("bounce_count >= 0", name="subscriber_bounce_count_positive"),)


class SubscriberFiliere(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "subscriber_filieres"

    subscriber_id: Mapped[str] = mapped_column(ForeignKey("subscribers.id", ondelete="CASCADE"), index=True, nullable=False)
    filiere_id: Mapped[str] = mapped_column(ForeignKey("filieres.id", ondelete="CASCADE"), index=True, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    subscriber: Mapped[Subscriber] = relationship(back_populates="filiere_links")
    filiere: Mapped[Filiere] = relationship(back_populates="subscriber_links")

    __table_args__ = (
        UniqueConstraint("subscriber_id", "filiere_id", name="uq_subscriber_filieres_subscriber_filiere"),
        UniqueConstraint("subscriber_id", "priority", name="uq_subscriber_filieres_subscriber_priority"),
        CheckConstraint("priority >= 1 AND priority <= 3", name="subscriber_filiere_priority_range"),
    )


class SubscriberContractPreference(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "subscriber_contract_preferences"

    subscriber_id: Mapped[str] = mapped_column(ForeignKey("subscribers.id", ondelete="CASCADE"), index=True, nullable=False)
    contract_type_id: Mapped[str] = mapped_column(ForeignKey("contract_types.id", ondelete="CASCADE"), index=True, nullable=False)

    subscriber: Mapped[Subscriber] = relationship(back_populates="contract_preferences")
    contract_type: Mapped[ContractType] = relationship(back_populates="subscriber_preferences")

    __table_args__ = (
        UniqueConstraint("subscriber_id", "contract_type_id", name="uq_subscriber_contract_preferences_subscriber_contract"),
    )


class SubscriberToken(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "subscriber_tokens"

    subscriber_id: Mapped[str] = mapped_column(ForeignKey("subscribers.id", ondelete="CASCADE"), index=True, nullable=False)
    purpose: Mapped[TokenPurpose] = mapped_column(enum_column(TokenPurpose), index=True, nullable=False)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    subscriber: Mapped[Subscriber] = relationship(back_populates="tokens")


class UnsubscribeEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "unsubscribe_events"

    subscriber_id: Mapped[str] = mapped_column(ForeignKey("subscribers.id", ondelete="CASCADE"), index=True, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(80), default="email_link", nullable=False)
    ip_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

    subscriber: Mapped[Subscriber] = relationship(back_populates="unsubscribe_events")


class SavedOffer(TimestampMixin, Base):
    __tablename__ = "saved_offers"

    subscriber_id: Mapped[str] = mapped_column(ForeignKey("subscribers.id", ondelete="CASCADE"), primary_key=True)
    offer_id: Mapped[str] = mapped_column(ForeignKey("job_offers.id", ondelete="CASCADE"), primary_key=True)

    subscriber: Mapped[Subscriber] = relationship(back_populates="saved_offers")
    offer: Mapped[JobOffer] = relationship(back_populates="saved_by")
