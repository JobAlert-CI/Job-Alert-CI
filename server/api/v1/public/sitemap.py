"""Sitemap dynamique généré depuis la base (Cf. Audit.md P1-4).

Le fichier statique `client/public/sitemap.xml` était périmé : il est
remplacé par cette route, qui liste les offres actives et les articles
publiés à chaque requête. Vercel rewrites `/sitemap.xml` vers cette route.
"""

from __future__ import annotations

from datetime import UTC, datetime
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import get_db
from models.content import ContentPage
from models.editorial import Article
from models.enums import ContentStatus, ContentType, JobOfferStatus
from models.jobs import JobOffer
from models.referentials import Filiere

router = APIRouter(tags=["seo"])

# URL publique du site (frontend). Le sitemap doit référencer le domaine
# navigable par les utilisateurs, pas celui de l'API.
SITE_URL = "https://job-alert-ci.vercel.app"

# Garde-fou perf : un sitemap index serait nécessaire au-delà.
MAX_OFFERS = 5_000


def _fmt_date(value: datetime | None) -> str | None:
    if not value:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).strftime("%Y-%m-%d")


def _add_url(urlset: Element, loc: str, *, lastmod: str | None = None, changefreq: str | None = None, priority: str | None = None) -> None:
    url = SubElement(urlset, "url")
    SubElement(url, "loc").text = escape(loc)
    if lastmod:
        SubElement(url, "lastmod").text = lastmod
    if changefreq:
        SubElement(url, "changefreq").text = changefreq
    if priority:
        SubElement(url, "priority").text = priority


@router.get("/sitemap.xml", include_in_schema=False)
def sitemap(db: Session = Depends(get_db)):
    urlset = Element("urlset")
    urlset.set("xmlns", "http://www.sitemaps.org/schemas/sitemap/0.9")

    # ── Pages statiques ──────────────────────────────────────────────
    static_pages = [
        ("/", "daily", "1.0"),
        ("/offres", "hourly", "0.95"),
        ("/conseils", "daily", "0.9"),
        ("/filieres", "weekly", "0.9"),
        ("/sources", "weekly", "0.6"),
        ("/comment-ca-marche", "monthly", "0.7"),
        ("/inscription", "monthly", "0.7"),
        ("/faq", "monthly", "0.6"),
        ("/contact", "monthly", "0.5"),
        ("/mentions-legales", "yearly", "0.3"),
    ]
    for path, changefreq, priority in static_pages:
        _add_url(urlset, f"{SITE_URL}{path}", changefreq=changefreq, priority=priority)

    # ── Filères actives ──────────────────────────────────────────────
    filiere_codes = db.scalars(
        select(Filiere.code).where(Filiere.is_active.is_(True)).order_by(Filiere.sort_order)
    ).all()
    for code in filiere_codes:
        _add_url(
            urlset,
            f"{SITE_URL}/filieres/{escape(code)}",
            changefreq="daily",
            priority="0.85",
        )

    # ── Offres actives (mêmes filtres que /api/offers) ───────────────
    offers = db.execute(
        select(JobOffer.slug, JobOffer.id, JobOffer.updated_at)
        .where(
            JobOffer.visible_site.is_(True),
            JobOffer.status == JobOfferStatus.ACTIVE,
            JobOffer.deleted_at.is_(None),
        )
        .order_by(JobOffer.published_at.desc().nullslast())
        .limit(MAX_OFFERS)
    ).all()
    today = _fmt_date(datetime.now(UTC))
    for slug, offer_id, updated_at in offers:
        # L'API détail accepte l'id OU le slug ; on privilégie le slug (SEO).
        _add_url(
            urlset,
            f"{SITE_URL}/offres/{escape(slug or offer_id)}",
            lastmod=_fmt_date(updated_at) or today,
            changefreq="daily",
            priority="0.8",
        )

    # ── Articles publiés ─────────────────────────────────────────────
    articles = db.execute(
        select(ContentPage.slug, ContentPage.updated_at, ContentPage.published_at)
        .join(Article, Article.content_page_id == ContentPage.id)
        .where(
            ContentPage.content_type == ContentType.ARTICLE,
            ContentPage.status == ContentStatus.PUBLISHED,
            ContentPage.deleted_at.is_(None),
            Article.deleted_at.is_(None),
        )
        .order_by(ContentPage.published_at.desc())
    ).all()
    for slug, updated_at, published_at in articles:
        _add_url(
            urlset,
            f"{SITE_URL}/conseils/{escape(slug)}",
            lastmod=_fmt_date(updated_at) or _fmt_date(published_at),
            changefreq="monthly",
            priority="0.75",
        )

    xml = tostring(urlset, encoding="unicode", xml_declaration=False)
    return Response(
        content=f'<?xml version="1.0" encoding="UTF-8"?>\n{xml}',
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=3600"},
    )
