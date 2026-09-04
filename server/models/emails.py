from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, CheckConstraint, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from models.enums import DigestStatus, EmailAttemptStatus, TransactionalEmailPurpose, TransactionalEmailStatus
from models.types import enum_column

"""Historique des digests email.

Chaque digest garde sa selection d'offres et ses tentatives d'envoi. On peut
donc rejouer un echec sans recalculer le contenu envoye au candidat.
"""

if TYPE_CHECKING:
    from models.jobs import JobOffer
    from models.scraping import ScrapeRun
    from models.subscriptions import Subscriber


class EmailDigest(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "email_digests"

    subscriber_id: Mapped[str] = mapped_column(ForeignKey("subscribers.id", ondelete="CASCADE"), index=True, nullable=False)
    scrape_run_id: Mapped[str | None] = mapped_column(ForeignKey("scrape_runs.id", ondelete="SET NULL"), index=True, nullable=True)
    digest_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    scheduled_for: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    status: Mapped[DigestStatus] = mapped_column(enum_column(DigestStatus), default=DigestStatus.QUEUED, index=True, nullable=False)
    subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    offer_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    skipped_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    template_version: Mapped[str] = mapped_column(String(40), default="v1", nullable=False)
    payload_preview: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Palier de matching atteint par la cascade T0-T5 (defaut T0 = selection stricte).
    match_tier: Mapped[str] = mapped_column(String(8), default="T0", index=True, nullable=False)

    subscriber: Mapped[Subscriber] = relationship(back_populates="digests")
    scrape_run: Mapped[ScrapeRun | None] = relationship(back_populates="digests")
    offer_links: Mapped[list[EmailDigestOffer]] = relationship(
        back_populates="digest", cascade="all, delete-orphan", order_by="EmailDigestOffer.position"
    )
    attempts: Mapped[list[EmailDeliveryAttempt]] = relationship(
        back_populates="digest", cascade="all, delete-orphan", order_by="EmailDeliveryAttempt.attempt_no"
    )

    __table_args__ = (
        UniqueConstraint("subscriber_id", "digest_date", name="uq_email_digests_subscriber_date"),
        CheckConstraint("offer_count >= 0", name="email_digest_offer_count_positive"),
    )


class EmailDigestOffer(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "email_digest_offers"

    digest_id: Mapped[str] = mapped_column(ForeignKey("email_digests.id", ondelete="CASCADE"), index=True, nullable=False)
    offer_id: Mapped[str] = mapped_column(ForeignKey("job_offers.id", ondelete="CASCADE"), index=True, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    # Comment l'offre a ete recuperee: 'primary' (filiere principale stricte),
    # 'secondary' (T1), 'fallback_contract' (T2), 'fallback_freshness' (T3),
    # 'fallback_experience' (T4), 'fallback_city' (T5).
    match_kind: Mapped[str] = mapped_column(String(32), default="primary", nullable=False)

    digest: Mapped[EmailDigest] = relationship(back_populates="offer_links")
    offer: Mapped[JobOffer] = relationship(back_populates="digest_links")

    __table_args__ = (
        UniqueConstraint("digest_id", "offer_id", name="uq_email_digest_offers_digest_offer"),
        UniqueConstraint("digest_id", "position", name="uq_email_digest_offers_digest_position"),
        CheckConstraint("position >= 1", name="email_digest_offer_position_positive"),
    )


class EmailDeliveryAttempt(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "email_delivery_attempts"

    digest_id: Mapped[str] = mapped_column(ForeignKey("email_digests.id", ondelete="CASCADE"), index=True, nullable=False)
    attempt_no: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[EmailAttemptStatus] = mapped_column(
        enum_column(EmailAttemptStatus), default=EmailAttemptStatus.PENDING, index=True, nullable=False
    )
    provider: Mapped[str | None] = mapped_column(String(80), nullable=True)
    provider_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    digest: Mapped[EmailDigest] = relationship(back_populates="attempts")

    __table_args__ = (
        UniqueConstraint("digest_id", "attempt_no", name="uq_email_delivery_attempts_digest_attempt"),
        CheckConstraint("attempt_no >= 1 AND attempt_no <= 3", name="email_delivery_attempt_no_range"),
    )


class TransactionalEmailEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Journal des emails transactionnels (confirmation, renvoi, gestion, desinscription).

    Distinct de `EmailDigest`/`EmailDeliveryAttempt` qui couvrent les digests
    quotidiens: ici on trace chaque tentative d'envoi individuelle faite via
    un provider transactionnel (Resend), y compris quand l'abonne n'existe
    plus (subscriber_id nullable, SET NULL) pour garder l'historique de debug.

    Regle de securite: `request_payload`/`response_payload` ne doivent jamais
    contenir de cle API ni de token brut, seulement ce qui est utile au debug.
    """

    __tablename__ = "transactional_email_events"

    subscriber_id: Mapped[str | None] = mapped_column(
        ForeignKey("subscribers.id", ondelete="SET NULL"), index=True, nullable=True
    )
    purpose: Mapped[TransactionalEmailPurpose] = mapped_column(
        enum_column(TransactionalEmailPurpose), index=True, nullable=False
    )
    to_email: Mapped[str] = mapped_column(String(320), nullable=False)
    provider: Mapped[str] = mapped_column(String(40), default="resend", nullable=False)
    provider_email_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[TransactionalEmailStatus] = mapped_column(
        enum_column(TransactionalEmailStatus), default=TransactionalEmailStatus.QUEUED, index=True, nullable=False
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    request_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    response_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    subscriber: Mapped[Subscriber | None] = relationship()

    __table_args__ = (CheckConstraint("attempts >= 0", name="attempts_positive"),)


class NoOfferEmailLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Trace les emails 'no offer' envoyes aux abonnes.

    Utilise pour appliquer le rate limit (NO_OFFER_EMAIL_MIN_INTERVAL_DAYS) :
    on ne renvoie pas l'email 'no offer' a un abonne qui en a deja recu un
    dans la fenetre glissante (defaut 7 jours).

    Distinct de EmailDigest : un 'no offer' n'est pas un digest (pas
    d'offres selectionnees, pas de EmailDigestOffer lies). C'est un email
    transactionnel avec sa propre table de logs pour ne pas polluer
    EmailDigest qui sert aux metriques de la prod quotidienne.
    """

    __tablename__ = "no_offer_email_logs"

    subscriber_id: Mapped[str] = mapped_column(
        ForeignKey("subscribers.id", ondelete="CASCADE"), index=True, nullable=False
    )
    digest_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)

    subscriber: Mapped[Subscriber] = relationship()
