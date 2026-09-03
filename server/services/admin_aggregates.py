from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from models import Company, JobOffer, JobOfferStatus, Subscriber, SubscriberStatus
from schemas.aggregates import (
    CompanySummary,
    OfferSummaryRead,
    SearchResultsRead,
    SubscriberSummaryRead,
)


def _normalize_search_query(q: str) -> str:
    """Trim + lowercase + strip des wildcards utilisateur pour eviter l'injection LIKE.

    On garde un seul prefixe/suffixe `%` ajoute par le caller. Si l'utilisateur
    tape `%` ou `_` on l'echappe avec `\\` (Postgres/SQLite via ESCAPE).
    """
    cleaned = (q or "").strip().lower()
    if not cleaned:
        return cleaned
    return cleaned.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def top_viewed_offers(
    db: Session,
    *,
    days: int = 7,
    limit: int = 10,
    include_statuses: Optional[list[str]] = None,
) -> list[OfferSummaryRead]:
    """Top N offres par `view_count` sur une fenetre temporelle.

    Strategie : on ne filtre PAS sur `last_seen_at` (pas fiable) — on prend
    toutes les offres non-archivees, et on trie par `view_count DESC`. Le
    filtre `days` reste dispo pour evolution (ex: si on tracke un
    `first_view_at` un jour).

    `include_statuses` : par defaut, seules les offres visibles et actives
    remontent (sense business : pas la peine d'exhiber les archivees dans
    un widget 'Top 10 consultees').
    """
    if include_statuses is None:
        include_statuses = [JobOfferStatus.ACTIVE.value]

    stmt = (
        select(JobOffer)
        .where(JobOffer.status.in_(include_statuses))
        .where(JobOffer.deleted_at.is_(None))
        .order_by(JobOffer.view_count.desc(), JobOffer.id)
        .limit(limit)
    )
    items = list(db.scalars(stmt).unique())
    return [_to_offer_summary(o) for o in items]


def global_search(
    db: Session,
    *,
    query: str,
    per_type_limit: int = 10,
) -> SearchResultsRead:
    """Recherche parallele dans 3 domaines : offres, abonnes, entreprises.

    - Offres : LIKE insensible a la casse sur `title` ET `normalized_title`
      (on utilise `func.lower()` pour rester compatible SQLite, qui ne
      supporte pas ILIKE reellement insensible a la casse).
    - Abonnes : LIKE insensible sur `email` et `full_name`.
    - Entreprises : LIKE insensible sur `name`.
    """
    cleaned = _normalize_search_query(query)
    if not cleaned:
        return SearchResultsRead(query=query, per_type_limit=per_type_limit)
    # On force le pattern a rester suffix-prefixe par le caller (q vient du front)
    like = f"%{cleaned}%"

    lower_like = func.lower(like)
    offers_q = (
        select(JobOffer)
        .where(JobOffer.deleted_at.is_(None))
        .where(
            or_(
                func.lower(JobOffer.title).like(lower_like, escape="\\"),
                func.lower(JobOffer.normalized_title).like(lower_like, escape="\\"),
            )
        )
        .order_by(JobOffer.view_count.desc())
        .limit(per_type_limit)
    )

    subscribers_q = (
        select(Subscriber)
        .where(Subscriber.deleted_at.is_(None))
        .where(Subscriber.status != SubscriberStatus.DELETED)
        .where(
            or_(
                func.lower(Subscriber.email).like(lower_like, escape="\\"),
                func.lower(Subscriber.full_name).like(lower_like, escape="\\"),
            )
        )
        .order_by(Subscriber.created_at.desc())
        .limit(per_type_limit)
    )

    companies_q = (
        select(Company)
        .where(func.lower(Company.name).like(lower_like, escape="\\"))
        .order_by(func.length(Company.name))
        .limit(per_type_limit)
    )

    offers = list(db.scalars(offers_q).unique())
    subscribers = list(db.scalars(subscribers_q).unique())
    companies = list(db.scalars(companies_q).unique())

    return SearchResultsRead(
        query=query,
        per_type_limit=per_type_limit,
        offers=[_to_offer_summary(o) for o in offers],
        subscribers=[_to_subscriber_summary(s) for s in subscribers],
        companies=[_to_company_summary(c) for c in companies],
    )


def _to_offer_summary(offer: JobOffer) -> OfferSummaryRead:
    return OfferSummaryRead(
        id=offer.id,
        title=offer.title,
        status=offer.status.value if hasattr(offer.status, "value") else offer.status,
        visible_site=offer.visible_site,
        view_count=offer.view_count,
        save_count=offer.save_count,
        published_at=offer.published_at,
        company=_to_company_summary(offer.company),
        primary_filiere_id=offer.primary_filiere_id,
    )


def _to_company_summary(company: Company) -> CompanySummary:
    return CompanySummary(id=company.id, name=company.name, slug=company.slug)


def _to_subscriber_summary(subscriber: Subscriber) -> SubscriberSummaryRead:
    return SubscriberSummaryRead(
        id=subscriber.id,
        email=subscriber.email,
        full_name=subscriber.full_name,
        status=subscriber.status.value if hasattr(subscriber.status, "value") else subscriber.status,
        city=subscriber.city,
    )


__all__ = ["top_viewed_offers", "global_search"]