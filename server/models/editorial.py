from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin

"""Domaine editorial: articles, sections, series, conseils et analytics.

Cette separation garde `models.content` leger pour les pages/FAQ/contact et
rend le futur back-office editorial plus facile a faire evoluer.
"""

if TYPE_CHECKING:
    from models.content import ContentPage
    from models.subscriptions import Subscriber


class ArticleCategory(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "article_categories"

    code: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    label: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True, nullable=False)
    color_hex: Mapped[str | None] = mapped_column(String(16), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    articles: Mapped[list[Article]] = relationship(back_populates="category")
    daily_tips: Mapped[list[DailyTip]] = relationship(back_populates="category")


class Article(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "articles"

    content_page_id: Mapped[str] = mapped_column(ForeignKey("content_pages.id", ondelete="CASCADE"), unique=True, nullable=False)
    category_id: Mapped[str | None] = mapped_column(ForeignKey("article_categories.id", ondelete="SET NULL"), index=True, nullable=True)
    reading_minutes: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    view_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    featured_order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quote_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    quote_author: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tags: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    content_page: Mapped[ContentPage] = relationship(back_populates="article")
    category: Mapped[ArticleCategory | None] = relationship(back_populates="articles")
    sections: Mapped[list[ArticleSection]] = relationship(
        back_populates="article", cascade="all, delete-orphan", order_by="ArticleSection.position"
    )
    takeaways: Mapped[list[ArticleTakeaway]] = relationship(
        back_populates="article", cascade="all, delete-orphan", order_by="ArticleTakeaway.position"
    )
    key_figures: Mapped[list[ArticleKeyFigure]] = relationship(
        back_populates="article", cascade="all, delete-orphan", order_by="ArticleKeyFigure.position"
    )
    series_links: Mapped[list[SeriesArticle]] = relationship(back_populates="article", cascade="all, delete-orphan")
    view_logs: Mapped[list[ArticleViewLog]] = relationship(back_populates="article", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("view_count >= 0", name="article_view_count_positive"),
        CheckConstraint("reading_minutes >= 0", name="article_reading_minutes_positive"),
        Index("ix_articles_featured", "is_featured", "featured_order"),
    )


class ArticleSection(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "article_sections"

    article_id: Mapped[str] = mapped_column(ForeignKey("articles.id", ondelete="CASCADE"), index=True, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    anchor: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(320), nullable=False)

    article: Mapped[Article] = relationship(back_populates="sections")
    blocks: Mapped[list[ArticleSectionBlock]] = relationship(
        back_populates="section", cascade="all, delete-orphan", order_by="ArticleSectionBlock.position"
    )

    __table_args__ = (
        UniqueConstraint("article_id", "position", name="uq_article_sections_position"),
        UniqueConstraint("article_id", "anchor", name="uq_article_sections_anchor"),
    )


class ArticleSectionBlock(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "article_section_blocks"

    section_id: Mapped[str] = mapped_column(ForeignKey("article_sections.id", ondelete="CASCADE"), index=True, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    block_type: Mapped[str] = mapped_column(String(60), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    attribution: Mapped[str | None] = mapped_column(String(255), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    section: Mapped[ArticleSection] = relationship(back_populates="blocks")

    __table_args__ = (UniqueConstraint("section_id", "position", name="uq_article_blocks_position"),)


class ArticleTakeaway(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "article_takeaways"

    article_id: Mapped[str] = mapped_column(ForeignKey("articles.id", ondelete="CASCADE"), index=True, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)

    article: Mapped[Article] = relationship(back_populates="takeaways")

    __table_args__ = (UniqueConstraint("article_id", "position", name="uq_article_takeaways_position"),)


class ArticleKeyFigure(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "article_key_figures"

    article_id: Mapped[str] = mapped_column(ForeignKey("articles.id", ondelete="CASCADE"), index=True, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    prefix: Mapped[str | None] = mapped_column(String(10), nullable=True)
    suffix: Mapped[str | None] = mapped_column(String(10), nullable=True)

    article: Mapped[Article] = relationship(back_populates="key_figures")

    __table_args__ = (UniqueConstraint("article_id", "position", name="uq_article_key_figures_position"),)


class DailyTip(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "daily_tips"

    text: Mapped[str] = mapped_column(Text, nullable=False)
    rotation_order: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    category_id: Mapped[str | None] = mapped_column(ForeignKey("article_categories.id", ondelete="SET NULL"), index=True, nullable=True)

    category: Mapped[ArticleCategory | None] = relationship(back_populates="daily_tips")

    __table_args__ = (
        UniqueConstraint("rotation_order", name="uq_daily_tips_rotation"),
        CheckConstraint("rotation_order >= 0 AND rotation_order <= 6", name="daily_tips_rotation_range"),
    )


class ArticleSeries(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "article_series"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(280), unique=True, index=True, nullable=False)
    color_hex: Mapped[str | None] = mapped_column(String(16), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    entries: Mapped[list[SeriesArticle]] = relationship(
        back_populates="series", cascade="all, delete-orphan", order_by="SeriesArticle.position"
    )


class SeriesArticle(Base):
    """Association ordonnee entre une serie editoriale et ses articles."""

    __tablename__ = "series_articles"

    series_id: Mapped[str] = mapped_column(ForeignKey("article_series.id", ondelete="CASCADE"), primary_key=True)
    article_id: Mapped[str] = mapped_column(ForeignKey("articles.id", ondelete="CASCADE"), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)

    series: Mapped[ArticleSeries] = relationship(back_populates="entries")
    article: Mapped[Article] = relationship(back_populates="series_links")

    __table_args__ = (
        UniqueConstraint("series_id", "article_id", name="uq_series_articles"),
        UniqueConstraint("series_id", "position", name="uq_series_articles_position"),
    )


class ArticleViewLog(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "article_view_logs"

    article_id: Mapped[str] = mapped_column(ForeignKey("articles.id", ondelete="CASCADE"), index=True, nullable=False)
    viewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    subscriber_id: Mapped[str | None] = mapped_column(ForeignKey("subscribers.id", ondelete="SET NULL"), index=True, nullable=True)
    anonymous_token: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    scroll_depth_percent: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    article: Mapped[Article] = relationship(back_populates="view_logs")
    subscriber: Mapped[Subscriber | None] = relationship()

    __table_args__ = (Index("ix_article_view_logs_article_date", "article_id", "viewed_at"),)
