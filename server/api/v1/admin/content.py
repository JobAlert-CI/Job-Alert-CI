# Crée schema ContentPageCreate et ContentPageUpdate
from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from api.deps import get_current_admin, get_db, require_roles
from models.admin import AdminAction, Administrator
from models.content import ContentPage
from models.editorial import (
    Article,
    ArticleCategory,
    ArticleSection,
    ArticleSectionBlock,
    ArticleSeries,
    DailyTip,
    SeriesArticle,
)
from models.enums import ContentStatus, ContentType
from schemas.content import ContentPageRead
from schemas.editorial import (
    ArticleBlockCreate,
    ArticleBlockUpdate,
    ArticleCategoryCreate,
    ArticleCategoryRead,
    ArticleCategoryUpdate,
    ArticleCreate,
    ArticleFeaturedUpdate,
    ArticleListItem,
    ArticleRead,
    ArticleSectionCreate,
    ArticleSectionUpdate,
    ArticleSeriesCreate,
    ArticleSeriesRead,
    ArticleSeriesUpdate,
    ArticleStatusUpdate,
    ArticleUpdate,
    DailyTipCreate,
    DailyTipRead,
    DailyTipUpdate,
    SectionsReorder,
    SeriesArticlesUpdate,
)
from services.audit import log_admin_action
from services.normalization import slugify
from services.search_utils import safe_ilike

# Le contenu editorial (articles, pages, FAQ) est pilote par les moderateurs.
router = APIRouter(
    prefix="/api/admin/content",
    tags=["admin-content"],
    dependencies=[Depends(require_roles("super_admin", "moderateur"))],
)


def _article_query():
    return (
        select(Article)
        .join(Article.content_page)
        .options(joinedload(Article.content_page), joinedload(Article.category))
    )


def _build_article_item(article: Article) -> dict:
    return {
        "id": article.id,
        "content_page_id": article.content_page_id,
        "category_id": article.category_id,
        "reading_minutes": article.reading_minutes,
        "view_count": article.view_count,
        "is_featured": article.is_featured,
        "slug": article.content_page.slug if article.content_page else None,
        "title": article.content_page.title if article.content_page else None,
        "excerpt": article.content_page.excerpt if article.content_page else None,
        "status": article.content_page.status.value if article.content_page and article.content_page.status else None,
        "published_at": article.content_page.published_at if article.content_page else None,
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
            "seo_title": article.content_page.seo_title if article.content_page else None,
            "seo_description": article.content_page.seo_description if article.content_page else None,
        }
    )
    return base


def _require_article(db: Session, article_id: str) -> Article:
    article = db.scalar(_article_query().where(Article.id == article_id))
    if not article:
        raise HTTPException(status_code=404, detail="Article introuvable")
    return article


# ─── Articles ───────────────────────────────────────────
@router.get("/articles", response_model=list[ArticleListItem])
async def list_articles_admin(
    db: Session = Depends(get_db),
    status: str | None = None,
    category_id: str | None = None,
    q: str | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    stmt = _article_query()
    if status:
        stmt = stmt.where(ContentPage.status == status)
    if category_id:
        stmt = stmt.where(Article.category_id == category_id)
    if q:
            stmt = stmt.where(safe_ilike(ContentPage.title, q))
    stmt = stmt.order_by(ContentPage.published_at.desc().nullslast(), ContentPage.created_at.desc())
    articles = db.scalars(stmt.limit(limit).offset(offset)).unique()
    return [_build_article_item(a) for a in articles]


@router.get("/articles/{article_id}", response_model=ArticleRead)
async def get_article_admin(article_id: str, db: Session = Depends(get_db)):
    article = _require_article(db, article_id)
    return _build_article_read(article)


@router.post("/articles", status_code=201, response_model=ArticleRead)
async def create_article(
    payload: ArticleCreate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    content_page = ContentPage(
        content_type=ContentType.ARTICLE,
        slug=payload.slug,
        title=payload.title,
        excerpt=payload.excerpt,
        status=ContentStatus.DRAFT,
        seo_title=payload.seo_title,
        seo_description=payload.seo_description,
        updated_by_admin_id=admin.id,
    )
    article = Article(
        content_page=content_page,
        category_id=payload.category_id,
        reading_minutes=payload.reading_minutes,
        is_featured=payload.is_featured,
        featured_order=payload.featured_order,
        quote_text=payload.quote_text,
        quote_author=payload.quote_author,
        tags=payload.tags,
    )
    db.add(content_page)
    db.add(article)
    db.flush()
    log_admin_action(db, admin_id=admin.id, action=AdminAction.CREATE, target_table="articles", target_id=article.id)
    db.commit()
    return _build_article_read(_require_article(db, article.id))


@router.put("/articles/{article_id}", response_model=ArticleRead)
async def update_article(
    article_id: str,
    payload: ArticleUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    article = _require_article(db, article_id)
    data = payload.model_dump(exclude_unset=True)

    page_fields = {"title", "slug", "excerpt", "seo_title", "seo_description"}
    for field_name in page_fields & data.keys():
        setattr(article.content_page, field_name, data[field_name])
    article.content_page.updated_by_admin_id = admin.id

    article_fields = {"category_id", "reading_minutes", "is_featured", "featured_order", "quote_text", "quote_author", "tags"}
    for field_name in article_fields & data.keys():
        setattr(article, field_name, data[field_name])

    log_admin_action(db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="articles", target_id=article.id)
    db.commit()
    return _build_article_read(_require_article(db, article_id))


@router.patch("/articles/{article_id}/status")
async def update_article_status(
    article_id: str,
    payload: ArticleStatusUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Publier / archiver / repasser en brouillon."""
    article = _require_article(db, article_id)
    article.content_page.status = ContentStatus(payload.status)
    if payload.status == "published" and article.content_page.published_at is None:
        article.content_page.published_at = datetime.now(UTC)
    article.content_page.updated_by_admin_id = admin.id

    log_admin_action(
        db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="articles", target_id=article.id,
        details={"status": payload.status},
    )
    db.commit()
    return {"message": "Statut mis à jour", "status": article.content_page.status.value}


@router.patch("/articles/{article_id}/featured")
async def toggle_article_featured(
    article_id: str,
    payload: ArticleFeaturedUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Mettre / retirer de 'À la une'."""
    article = _require_article(db, article_id)
    article.is_featured = payload.is_featured
    article.featured_order = payload.featured_order

    log_admin_action(
        db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="articles", target_id=article.id,
        details={"is_featured": payload.is_featured},
    )
    db.commit()
    return {"message": "Mis à jour", "is_featured": article.is_featured}


@router.delete("/articles/{article_id}", status_code=204)
async def delete_article(article_id: str, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    article = _require_article(db, article_id)
    now = datetime.now(UTC)
    article.deleted_at = now
    article.content_page.deleted_at = now
    log_admin_action(db, admin_id=admin.id, action=AdminAction.DELETE, target_table="articles", target_id=article_id)
    db.commit()


# ─── Sections & Blocs ──────────────────────────────────
@router.post("/articles/{article_id}/sections", status_code=201, response_model=ArticleRead)
async def add_section(
    article_id: str,
    payload: ArticleSectionCreate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    article = _require_article(db, article_id)
    section = ArticleSection(article_id=article.id, **payload.model_dump())
    db.add(section)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.CREATE, target_table="article_sections", target_id=section.id)
    db.commit()
    return _build_article_read(_require_article(db, article_id))


@router.put("/sections/{section_id}")
async def update_section(
    section_id: str,
    payload: ArticleSectionUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    section = db.get(ArticleSection, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section introuvable")
    for field_name, value in payload.model_dump(exclude_unset=True).items():
        setattr(section, field_name, value)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="article_sections", target_id=section.id)
    db.commit()
    return {"message": "Section mise à jour"}


@router.delete("/sections/{section_id}", status_code=204)
async def delete_section(section_id: str, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    section = db.get(ArticleSection, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section introuvable")
    db.delete(section)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.DELETE, target_table="article_sections", target_id=section_id)
    db.commit()


@router.post("/sections/{section_id}/blocks", status_code=201)
async def add_block(
    section_id: str,
    payload: ArticleBlockCreate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    section = db.get(ArticleSection, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section introuvable")
    block = ArticleSectionBlock(section_id=section_id, **payload.model_dump())
    db.add(block)
    db.flush()
    log_admin_action(db, admin_id=admin.id, action=AdminAction.CREATE, target_table="article_section_blocks", target_id=block.id)
    db.commit()
    return {"message": "Bloc ajouté", "id": block.id}


@router.put("/blocks/{block_id}")
async def update_block(
    block_id: str,
    payload: ArticleBlockUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    block = db.get(ArticleSectionBlock, block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Bloc introuvable")
    for field_name, value in payload.model_dump(exclude_unset=True).items():
        setattr(block, field_name, value)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="article_section_blocks", target_id=block.id)
    db.commit()
    return {"message": "Bloc mis à jour"}


@router.delete("/blocks/{block_id}", status_code=204)
async def delete_block(block_id: str, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    block = db.get(ArticleSectionBlock, block_id)
    if not block:
        raise HTTPException(status_code=404, detail="Bloc introuvable")
    db.delete(block)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.DELETE, target_table="article_section_blocks", target_id=block_id)
    db.commit()


@router.put("/articles/{article_id}/sections/reorder")
async def reorder_sections(
    article_id: str,
    payload: SectionsReorder,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    article = _require_article(db, article_id)
    sections = {s.id: s for s in article.sections}
    missing = [sid for sid in payload.section_ids if sid not in sections]
    if missing:
        raise HTTPException(status_code=400, detail=f"Sections introuvables: {', '.join(missing)}")

    # Passage par des positions temporaires negatives pour eviter les
    # collisions avec la contrainte unique (article_id, position).
    for offset, section_id in enumerate(payload.section_ids, start=1):
        sections[section_id].position = -offset
    db.flush()
    for position, section_id in enumerate(payload.section_ids, start=1):
        sections[section_id].position = position

    log_admin_action(db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="article_sections", target_id=article.id)
    db.commit()
    return {"message": "Ordre des sections mis à jour"}


# ─── Catégories d'articles ─────────────────────────────
@router.get("/categories", response_model=list[ArticleCategoryRead])
async def list_categories_admin(db: Session = Depends(get_db)):
    return list(db.scalars(select(ArticleCategory).order_by(ArticleCategory.sort_order)))


@router.post("/categories", status_code=201, response_model=ArticleCategoryRead)
async def create_category(payload: ArticleCategoryCreate, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    category = ArticleCategory(**payload.model_dump())
    db.add(category)
    db.flush()
    log_admin_action(db, admin_id=admin.id, action=AdminAction.CREATE, target_table="article_categories", target_id=category.id)
    db.commit()
    db.refresh(category)
    return category


@router.put("/categories/{category_id}", response_model=ArticleCategoryRead)
async def update_category(category_id: str, payload: ArticleCategoryUpdate, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    category = db.get(ArticleCategory, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Catégorie introuvable")
    for field_name, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field_name, value)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="article_categories", target_id=category.id)
    db.commit()
    db.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=204)
async def delete_category(category_id: str, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    category = db.get(ArticleCategory, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Catégorie introuvable")
    db.delete(category)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.DELETE, target_table="article_categories", target_id=category_id)
    db.commit()


# ─── Conseils quotidiens ───────────────────────────────
@router.get("/daily-tips", response_model=list[DailyTipRead])
async def list_daily_tips(db: Session = Depends(get_db)):
    return list(db.scalars(select(DailyTip).order_by(DailyTip.rotation_order)))


@router.post("/daily-tips", status_code=201, response_model=DailyTipRead)
async def create_daily_tip(payload: DailyTipCreate, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    existing = db.scalar(select(DailyTip).where(DailyTip.rotation_order == payload.rotation_order))
    if existing:
        raise HTTPException(status_code=409, detail="Un conseil existe déjà pour cet ordre de rotation")
    tip = DailyTip(**payload.model_dump())
    db.add(tip)
    db.flush()
    log_admin_action(db, admin_id=admin.id, action=AdminAction.CREATE, target_table="daily_tips", target_id=tip.id)
    db.commit()
    db.refresh(tip)
    return tip


@router.put("/daily-tips/{tip_id}", response_model=DailyTipRead)
async def update_daily_tip(tip_id: str, payload: DailyTipUpdate, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    tip = db.get(DailyTip, tip_id)
    if not tip:
        raise HTTPException(status_code=404, detail="Conseil introuvable")
    for field_name, value in payload.model_dump(exclude_unset=True).items():
        setattr(tip, field_name, value)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="daily_tips", target_id=tip.id)
    db.commit()
    db.refresh(tip)
    return tip


@router.delete("/daily-tips/{tip_id}", status_code=204)
async def delete_daily_tip(tip_id: str, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    tip = db.get(DailyTip, tip_id)
    if not tip:
        raise HTTPException(status_code=404, detail="Conseil introuvable")
    db.delete(tip)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.DELETE, target_table="daily_tips", target_id=tip_id)
    db.commit()


# ─── Séries ─────────────────────────────────────────────
@router.get("/series", response_model=list[ArticleSeriesRead])
async def list_series_admin(db: Session = Depends(get_db)):
    return list(db.scalars(select(ArticleSeries).order_by(ArticleSeries.sort_order)))


@router.post("/series", status_code=201, response_model=ArticleSeriesRead)
async def create_series(payload: ArticleSeriesCreate, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    series = ArticleSeries(**payload.model_dump())
    db.add(series)
    db.flush()
    log_admin_action(db, admin_id=admin.id, action=AdminAction.CREATE, target_table="article_series", target_id=series.id)
    db.commit()
    db.refresh(series)
    return series


@router.put("/series/{series_id}", response_model=ArticleSeriesRead)
async def update_series(series_id: str, payload: ArticleSeriesUpdate, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    series = db.get(ArticleSeries, series_id)
    if not series:
        raise HTTPException(status_code=404, detail="Série introuvable")
    for field_name, value in payload.model_dump(exclude_unset=True).items():
        setattr(series, field_name, value)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="article_series", target_id=series.id)
    db.commit()
    db.refresh(series)
    return series


@router.delete("/series/{series_id}", status_code=204)
async def delete_series(series_id: str, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    series = db.get(ArticleSeries, series_id)
    if not series:
        raise HTTPException(status_code=404, detail="Série introuvable")
    db.delete(series)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.DELETE, target_table="article_series", target_id=series_id)
    db.commit()


@router.put("/series/{series_id}/articles")
async def update_series_articles(
    series_id: str,
    payload: SeriesArticlesUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Ajouter / retirer / réordonner les articles d'une série (remplacement complet de la liste)."""
    series = db.get(ArticleSeries, series_id)
    if not series:
        raise HTTPException(status_code=404, detail="Série introuvable")

    if payload.article_ids:
        found = set(db.scalars(select(Article.id).where(Article.id.in_(payload.article_ids))))
        missing = [aid for aid in payload.article_ids if aid not in found]
        if missing:
            raise HTTPException(status_code=400, detail=f"Articles introuvables: {', '.join(missing)}")

    db.query(SeriesArticle).filter(SeriesArticle.series_id == series_id).delete()
    db.flush()
    for position, article_id in enumerate(payload.article_ids, start=1):
        db.add(SeriesArticle(series_id=series_id, article_id=article_id, position=position))

    log_admin_action(
        db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="series_articles", target_id=series_id,
        details={"article_ids": payload.article_ids},
    )
    db.commit()
    return {"message": "Articles de la série mis à jour", "count": len(payload.article_ids)}


# ─── Pages statiques ───────────────────────────────────
@router.get("/pages", response_model=list[ContentPageRead])
async def list_pages(db: Session = Depends(get_db)):
    stmt = (
        select(ContentPage)
        .where(ContentPage.content_type.in_([ContentType.STATIC_PAGE, ContentType.LEGAL_PAGE]))
        .order_by(ContentPage.title)
    )
    return list(db.scalars(stmt))


@router.post("/pages", status_code=201, response_model=ContentPageRead)
async def create_page(payload: ContentPageRead, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    page = ContentPage(
        content_type=ContentType(payload.content_type),
        slug=payload.slug or slugify(payload.title),
        title=payload.title,
        excerpt=payload.excerpt,
        body=payload.body,
        status=ContentStatus.DRAFT,
        seo_title=payload.seo_title,
        seo_description=payload.seo_description,
        keywords=payload.keywords,
        updated_by_admin_id=admin.id,
    )
    db.add(page)
    db.flush()
    log_admin_action(db, admin_id=admin.id, action=AdminAction.CREATE, target_table="content_pages", target_id=page.id)
    db.commit()
    db.refresh(page)
    return page


@router.put("/pages/{page_id}", response_model=ContentPageRead)
async def update_page(page_id: str, payload: ContentPageRead, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    page = db.get(ContentPage, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page introuvable")
    for field_name, value in payload.model_dump(exclude_unset=True).items():
        setattr(page, field_name, value)
    page.updated_by_admin_id = admin.id
    log_admin_action(db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="content_pages", target_id=page.id)
    db.commit()
    db.refresh(page)
    return page


@router.delete("/pages/{page_id}", status_code=204)
async def delete_page(page_id: str, db: Session = Depends(get_db), admin: Administrator = Depends(get_current_admin)):
    page = db.get(ContentPage, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page introuvable")
    page.deleted_at = datetime.now(UTC)
    log_admin_action(db, admin_id=admin.id, action=AdminAction.DELETE, target_table="content_pages", target_id=page_id)
    db.commit()
