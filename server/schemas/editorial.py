from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from schemas.base import TimestampRead


# ─── Catégories ─────────────────────────────────────────

class ArticleCategoryRead(TimestampRead):
    id: str
    code: str
    label: str
    slug: str
    hue: str | None = None
    icon_name: str | None = None
    sort_order: int
    is_active: bool


class ArticleCategoryCreate(BaseModel):
    code: str = Field(min_length=2, max_length=120)
    label: str = Field(min_length=2, max_length=160)
    slug: str = Field(min_length=2, max_length=180)
    hue: str | None = Field(default=None, max_length=40)
    icon_name: str | None = Field(default=None, max_length=80)
    sort_order: int = Field(default=100, ge=0)
    is_active: bool = True


class ArticleCategoryUpdate(BaseModel):
    label: str | None = Field(default=None, max_length=160)
    slug: str | None = Field(default=None, max_length=180)
    hue: str | None = Field(default=None, max_length=40)
    icon_name: str | None = Field(default=None, max_length=80)
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


# ─── Blocs de section ───────────────────────────────────

class ArticleBlockRead(TimestampRead):
    id: str
    position: int
    block_type: str
    content: str
    attribution: str | None = None
    metadata_json: dict | None = None


class ArticleBlockCreate(BaseModel):
    position: int = Field(ge=1)
    block_type: str = Field(min_length=1, max_length=60)
    content: str = Field(min_length=1)
    attribution: str | None = Field(default=None, max_length=255)
    metadata_json: dict | None = None


class ArticleBlockUpdate(BaseModel):
    position: int | None = Field(default=None, ge=1)
    block_type: str | None = Field(default=None, max_length=60)
    content: str | None = None
    attribution: str | None = Field(default=None, max_length=255)
    metadata_json: dict | None = None


# ─── Sections ───────────────────────────────────────────

class ArticleSectionRead(TimestampRead):
    id: str
    position: int
    anchor: str
    title: str
    blocks: list[ArticleBlockRead] = []


class ArticleSectionCreate(BaseModel):
    position: int = Field(ge=1)
    anchor: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=320)


class ArticleSectionUpdate(BaseModel):
    position: int | None = Field(default=None, ge=1)
    anchor: str | None = Field(default=None, max_length=100)
    title: str | None = Field(default=None, max_length=320)


class SectionsReorder(BaseModel):
    """Liste ordonnée des IDs de sections."""
    section_ids: list[str] = Field(min_length=1)


# ─── Takeaways & Key Figures ────────────────────────────

class ArticleTakeawayRead(TimestampRead):
    id: str
    position: int
    text: str


class ArticleKeyFigureRead(TimestampRead):
    id: str
    position: int
    value: float
    label: str
    prefix: str | None = None
    suffix: str | None = None


# ─── Série ──────────────────────────────────────────────

class ArticleSeriesRead(TimestampRead):
    id: str
    title: str
    slug: str
    hue: str | None = None
    description: str | None = None
    sort_order: int
    is_active: bool


class ArticleSeriesCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    slug: str = Field(min_length=2, max_length=280)
    hue: str | None = Field(default=None, max_length=40)
    description: str | None = None
    sort_order: int = Field(default=100, ge=0)
    is_active: bool = True


class ArticleSeriesUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    slug: str | None = Field(default=None, max_length=280)
    hue: str | None = Field(default=None, max_length=40)
    description: str | None = None
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class SeriesArticlesUpdate(BaseModel):
    """Liste ordonnée des IDs d'articles pour la série."""
    article_ids: list[str] = Field(min_length=0)


# ─── Article ────────────────────────────────────────────

class ArticleRead(TimestampRead):
    id: str
    content_page_id: str
    category_id: str | None = None
    category: ArticleCategoryRead | None = None
    reading_minutes: int
    view_count: int
    is_featured: bool
    featured_order: int | None = None
    quote_text: str | None = None
    quote_author: str | None = None
    tags: list[str] | None = None
    sections: list[ArticleSectionRead] = []
    takeaways: list[ArticleTakeawayRead] = []
    key_figures: list[ArticleKeyFigureRead] = []
    # Champs de content_page
    slug: str | None = None
    title: str | None = None
    excerpt: str | None = None
    status: str | None = None
    published_at: datetime | None = None
    seo_title: str | None = None
    seo_description: str | None = None


class ArticleListItem(BaseModel):
    """Version allégée pour la liste."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str | None = None
    title: str | None = None
    excerpt: str | None = None
    status: str | None = None
    is_featured: bool = False
    view_count: int = 0
    reading_minutes: int = 5
    published_at: datetime | None = None
    category_id: str | None = None
    category: ArticleCategoryRead | None = None


class ArticleCreate(BaseModel):
    title: str = Field(min_length=2, max_length=500)
    slug: str = Field(min_length=2, max_length=520)
    excerpt: str | None = Field(default=None, max_length=500)
    category_id: str | None = None
    reading_minutes: int = Field(default=5, ge=1)
    is_featured: bool = False
    featured_order: int | None = Field(default=None, ge=1)
    quote_text: str | None = None
    quote_author: str | None = Field(default=None, max_length=255)
    tags: list[str] | None = None
    seo_title: str | None = Field(default=None, max_length=255)
    seo_description: str | None = Field(default=None, max_length=500)


class ArticleUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=500)
    slug: str | None = Field(default=None, max_length=520)
    excerpt: str | None = Field(default=None, max_length=500)
    category_id: str | None = None
    reading_minutes: int | None = Field(default=None, ge=1)
    is_featured: bool | None = None
    featured_order: int | None = Field(default=None, ge=1)
    quote_text: str | None = None
    quote_author: str | None = Field(default=None, max_length=255)
    tags: list[str] | None = None
    seo_title: str | None = Field(default=None, max_length=255)
    seo_description: str | None = Field(default=None, max_length=500)


class ArticleStatusUpdate(BaseModel):
    status: Literal["draft", "published", "archived"]


class ArticleFeaturedUpdate(BaseModel):
    is_featured: bool
    featured_order: int | None = Field(default=None, ge=1)


# ─── Daily Tip ──────────────────────────────────────────

class DailyTipRead(TimestampRead):
    id: str
    text: str
    rotation_order: int
    is_active: bool
    category_id: str | None = None


class DailyTipCreate(BaseModel):
    text: str = Field(min_length=5)
    rotation_order: int = Field(ge=0, le=6)
    is_active: bool = True
    category_id: str | None = None


class DailyTipUpdate(BaseModel):
    text: str | None = None
    rotation_order: int | None = Field(default=None, ge=0, le=6)
    is_active: bool | None = None
    category_id: str | None = None


# ─── Page statique ──────────────────────────────────────

class ContentPageCreate(BaseModel):
    content_type: str = Field(min_length=1, max_length=60)
    slug: str = Field(min_length=1, max_length=255)
    title: str = Field(min_length=2, max_length=500)
    excerpt: str | None = Field(default=None, max_length=500)
    body: dict | list | None = None
    seo_title: str | None = Field(default=None, max_length=255)
    seo_description: str | None = Field(default=None, max_length=500)
    keywords: list[str] | None = None


class ContentPageUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=500)
    excerpt: str | None = Field(default=None, max_length=500)
    body: dict | list | None = None
    seo_title: str | None = Field(default=None, max_length=255)
    seo_description: str | None = Field(default=None, max_length=500)
    keywords: list[str] | None = None
