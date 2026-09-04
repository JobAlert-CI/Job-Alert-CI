from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from models.enums import ContactMessageStatus, ContentStatus, ContentType
from models.types import enum_column

"""Pages CMS, FAQ et messages de contact.

Le contenu editorial riche vit dans `models.editorial`. Ce fichier garde les
objets plus transverses du site: pages statiques, FAQ et demandes entrantes.
"""

if TYPE_CHECKING:
    from models.admin import Administrator
    from models.editorial import Article


class ContentPage(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "content_pages"

    content_type: Mapped[ContentType] = mapped_column(enum_column(ContentType), index=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(180), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    status: Mapped[ContentStatus] = mapped_column(
        enum_column(ContentStatus), default=ContentStatus.DRAFT, index=True, nullable=False
    )
    seo_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    seo_description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    keywords: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True, nullable=True)
    updated_by_admin_id: Mapped[str | None] = mapped_column(
        ForeignKey("administrators.id", ondelete="SET NULL"), nullable=True
    )

    article: Mapped[Article | None] = relationship(back_populates="content_page", uselist=False)
    faq_items: Mapped[list[FaqItem]] = relationship(back_populates="content_page")
    updated_by_admin: Mapped[Administrator | None] = relationship(back_populates="content_pages")

    __table_args__ = (UniqueConstraint("content_type", "slug", name="uq_content_pages_type_slug"),)


class FaqCategory(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "faq_categories"

    code: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    color_hex: Mapped[str | None] = mapped_column(String(16), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    items: Mapped[list[FaqItem]] = relationship(back_populates="category", cascade="all, delete-orphan")


class FaqItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "faq_items"

    category_id: Mapped[str] = mapped_column(ForeignKey("faq_categories.id", ondelete="CASCADE"), index=True, nullable=False)
    content_page_id: Mapped[str | None] = mapped_column(ForeignKey("content_pages.id", ondelete="SET NULL"), nullable=True)
    code: Mapped[str] = mapped_column(String(120), nullable=False)
    question: Mapped[str] = mapped_column(String(500), nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    category: Mapped[FaqCategory] = relationship(back_populates="items")
    content_page: Mapped[ContentPage | None] = relationship(back_populates="faq_items")

    __table_args__ = (UniqueConstraint("category_id", "code", name="uq_faq_items_category_code"),)


class ContactMessage(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "contact_messages"

    full_name: Mapped[str] = mapped_column(String(180), nullable=False)
    email: Mapped[str] = mapped_column(String(320), index=True, nullable=False)
    subject_code: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    subject_label: Mapped[str] = mapped_column(String(180), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[ContactMessageStatus] = mapped_column(
        enum_column(ContactMessageStatus), default=ContactMessageStatus.NEW, index=True, nullable=False
    )
    ip_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    replied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    internal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
