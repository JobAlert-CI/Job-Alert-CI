from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from api.deps import get_db
from models.editorial import Article, ArticleCategory, ArticleSeries, DailyTip
from models.content import ContentPage
from models.enums import ContentStatus
from schemas.editorial import (
    ArticleCategoryRead,
    ArticleListItem,
    ArticleRead,
    ArticleSeriesRead,
    DailyTipRead,
)

router = APIRouter(prefix="/api/articles", tags=["articles"])


def _build_article_item(article: Article) -> dict:
    return {
        "id": article.id,
        "content_page_id": article.content_page_id,
        "category_id": article.category_id,
        "category": article.category,
        "reading_minutes": article.reading_minutes,
        "view_count": article.view_count,
        "is_featured": article.is_featured,
        "slug": article.content_page.slug if article.content_page else None,
        "title": article.content_page.title if article.content_page else None,
        "excerpt": article.content_page.excerpt if article.content_page else None,
        "status": article.content_page.status.value
        if article.content_page and article.content_page.status
        else None,
        "published_at": article.content_page.published_at
        if article.content_page
        else None,
    }


def _build_article_read(article: Article) -> dict:
    base = _build_article_item(article)
    base.update(
        {
            "category": article.category,
            "featured_order": article.featured_order,
            "quote_text": article.quote_text,
            "quote_author": article.quote_author,
            "tags": article.tags,
            "sections": article.sections,
            "takeaways": article.takeaways,
            "key_figures": article.key_figures,
            "seo_title": article.content_page.seo_title
            if article.content_page
            else None,
            "seo_description": article.content_page.seo_description
            if article.content_page
            else None,
        }
    )
    return base


@router.get("", response_model=list[ArticleListItem])
async def list_articles(
    db: Session = Depends(get_db),
    category_id: Optional[str] = None,
    q: Optional[str] = Query(None, min_length=2),
    sort: str = Query("recent", pattern="^(recent|popular|short)$"),
    is_featured: Optional[bool] = None,
    limit: int = Query(9, ge=1, le=50),
    offset: int = Query(0, ge=0),
):
    """Bibliothèque de conseils. Filtre par catégorie, recherche, tri."""
    stmt = (
        select(Article)
        .join(Article.content_page)
        .options(joinedload(Article.content_page), joinedload(Article.category))
        .where(ContentPage.status == ContentStatus.PUBLISHED)
    )
    if category_id:
        stmt = stmt.where(Article.category_id == category_id)
    if is_featured is not None:
        stmt = stmt.where(Article.is_featured == is_featured)
    if q:
        stmt = stmt.where(ContentPage.title.ilike(f"%{q}%"))

    if sort == "popular":
        stmt = stmt.order_by(Article.view_count.desc())
    elif sort == "short":
        stmt = stmt.order_by(Article.reading_minutes.asc())
    else:
        stmt = stmt.order_by(ContentPage.published_at.desc().nullslast())

    articles = db.scalars(stmt.limit(limit).offset(offset)).unique()
    return [_build_article_item(a) for a in articles]


@router.get("/categories", response_model=list[ArticleCategoryRead])
async def list_article_categories(db: Session = Depends(get_db)):
    """8 catégories de conseils (code, label, hue, icon)."""
    return db.scalars(
        select(ArticleCategory)
        .where(ArticleCategory.is_active.is_(True))
        .order_by(ArticleCategory.sort_order.asc())
    ).all()


@router.get("/featured", response_model=list[ArticleListItem])
async def get_featured_articles(db: Session = Depends(get_db)):
    """Articles 'À la une' (carrousel hero, max 3)."""
    stmt = (
        select(Article)
        .join(Article.content_page)
        .options(joinedload(Article.content_page), joinedload(Article.category))
        .where(
            ContentPage.status == ContentStatus.PUBLISHED, Article.is_featured.is_(True)
        )
        .order_by(Article.featured_order.asc().nullslast())
        .limit(3)
    )
    articles = db.scalars(stmt).unique()
    return [_build_article_item(a) for a in articles]


@router.get("/daily-tip", response_model=DailyTipRead)
async def get_daily_tip(db: Session = Depends(get_db)):
    """Conseil du jour (rotation déterministe 7 jours)."""
    # Dummy rotation based on day of year
    import datetime

    day_of_year = datetime.datetime.now().timetuple().tm_yday
    rotation_order = day_of_year % 7
    tip = db.scalar(
        select(DailyTip).where(
            DailyTip.is_active.is_(True), DailyTip.rotation_order == rotation_order
        )
    )
    if not tip:
        # Fallback to any tip
        tip = db.scalar(select(DailyTip).where(DailyTip.is_active.is_(True)).limit(1))
    if not tip:
        raise HTTPException(status_code=404, detail="No daily tip available")
    return tip


@router.get("/series", response_model=list[ArticleSeriesRead])
async def list_series(db: Session = Depends(get_db)):
    """Séries de lecture avec progression."""
    return db.scalars(
        select(ArticleSeries)
        .where(ArticleSeries.is_active.is_(True))
        .order_by(ArticleSeries.sort_order.asc())
    ).all()


@router.get("/popular", response_model=list[ArticleListItem])
async def get_popular_articles(
    limit: int = Query(5, ge=1, le=10), db: Session = Depends(get_db)
):
    """Les plus lus (sidebar)."""
    stmt = (
        select(Article)
        .join(Article.content_page)
        .options(joinedload(Article.content_page), joinedload(Article.category))
        .where(ContentPage.status == ContentStatus.PUBLISHED)
        .order_by(Article.view_count.desc())
        .limit(limit)
    )
    articles = db.scalars(stmt).unique()
    return [_build_article_item(a) for a in articles]


@router.get("/{slug}", response_model=ArticleRead)
async def get_article(slug: str, db: Session = Depends(get_db)):
    """Article complet : sections, blocs, takeaways, key_figures, citation, tags."""
    stmt = (
        select(Article)
        .join(Article.content_page)
        .options(
            joinedload(Article.content_page),
            joinedload(Article.category),
            joinedload(Article.sections),
            joinedload(Article.takeaways),
            joinedload(Article.key_figures),
        )
        .where(ContentPage.slug == slug)
    )
    article = db.scalar(stmt)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return _build_article_read(article)


@router.get("/{slug}/related", response_model=list[ArticleListItem])
async def get_related_articles(
    slug: str, limit: int = Query(3, ge=1, le=6), db: Session = Depends(get_db)
):
    """Articles sur le même thème (sidebar + 'Continuer la lecture')."""
    base_article = db.scalar(
        select(Article).join(Article.content_page).where(ContentPage.slug == slug)
    )
    if not base_article:
        raise HTTPException(status_code=404, detail="Article not found")

    stmt = (
        select(Article)
        .join(Article.content_page)
        .options(joinedload(Article.content_page), joinedload(Article.category))
        .where(
            ContentPage.status == ContentStatus.PUBLISHED,
            Article.id != base_article.id,
            Article.category_id == base_article.category_id,
        )
        .order_by(ContentPage.published_at.desc().nullslast())
        .limit(limit)
    )
    articles = db.scalars(stmt).unique()
    return [_build_article_item(a) for a in articles]


@router.post("/{slug}/view")
async def register_article_view(slug: str, db: Session = Depends(get_db)):
    """Incrémente view_count + log analytics."""
    article = db.scalar(
        select(Article).join(Article.content_page).where(ContentPage.slug == slug)
    )
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    article.view_count += 1
    db.commit()
    return {"message": "View recorded", "view_count": article.view_count}
