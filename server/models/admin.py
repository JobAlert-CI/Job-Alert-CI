from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from models.enums import AdminAction, AdminRole
from models.types import enum_column

"""Back-office: comptes, audit et parametres editables."""


class Administrator(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "administrators"

    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(180), nullable=False)
    role: Mapped[AdminRole] = mapped_column(enum_column(AdminRole), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Forward-refs resolues par le registre ORM (pas d import explicite: cycle).
    offers: Mapped[list["JobOffer"]] = relationship(back_populates="admin")  # noqa: F821
    content_pages: Mapped[list["ContentPage"]] = relationship(back_populates="updated_by_admin")  # noqa: F821


class AdminActionLog(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "admin_action_logs"

    admin_id: Mapped[str] = mapped_column(ForeignKey("administrators.id", ondelete="CASCADE"), nullable=False, index=True)
    action: Mapped[AdminAction] = mapped_column(enum_column(AdminAction), nullable=False)
    target_table: Mapped[str] = mapped_column(String(100), nullable=False)
    target_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    admin: Mapped[Administrator] = relationship()


class SiteSetting(Base):
    __tablename__ = "site_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    updated_by_admin_id: Mapped[str | None] = mapped_column(ForeignKey("administrators.id", ondelete="SET NULL"), nullable=True)


class AdminRefreshToken(Base):
    """Refresh tokens JWT admin (audit #13: rotation effective).

    On persiste le hash SHA-256 du token brut (jamais le brut). Quand un refresh
    est consomme, on le marque `used_at`; tout reuse detecte -> revocation
    immediate de TOUTE la famille de refresh de cet admin.
    """

    __tablename__ = "admin_refresh_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    admin_id: Mapped[str] = mapped_column(ForeignKey("administrators.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    admin: Mapped[Administrator] = relationship()
