from __future__ import annotations

import csv
import io
import json
from collections.abc import Iterable, Iterator
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from models import EmailDigest, JobOffer, Subscriber
from services.search_utils import raw_ilike, safe_ilike


def _stream_csv(rows: Iterable[dict[str, Any]], columns: list[str]) -> Iterator[str]:
    """Generator qui yield du CSV chunk par chunk pour StreamingResponse.

    On utilise `io.StringIO` au lieu d'un vrai fichier : ca tient en memoire
    pour des exports < 100k lignes, mais permet le streaming grace au fait
    qu'on yield a la volee (FastAPI ecrit le chunk au fur et a mesure sur le
    socket).

    `columns` pilote l'ordre et la liste exacte des colonnes exposees. Pas
    de colonne surprise (ex: mot de passe, cle API) qui se glisse par un
    `__dict__` reflechirait.
    """
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    yield buffer.getvalue()
    buffer.seek(0)
    buffer.truncate(0)

    for row in rows:
        writer.writerow({col: row.get(col, "") for col in columns})
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)


def _stream_json(items: Iterable[dict[str, Any]]) -> Iterator[str]:
    """Stream un tableau JSON ligne par ligne (NDJSON-like), compatible StreamingResponse.

    On ecrit `[` une fois, puis chaque item comme `, {...}` ou `{...}`, puis `]`
    a la fin. C'est un compromis entre 'JSON compact' et 'streaming reellement
    incrémental' : on ne sait pas a l'avance combien d'items on aura sans faire
    un count, donc on ne peut pas preparer le `[` complet. On accepte donc
    un overhead memoire negligeable (un `{...}` par item).
    """
    yield "["
    first = True
    for item in items:
        line = json.dumps(item, default=str, ensure_ascii=False)
        if first:
            yield line
            first = False
        else:
            yield "," + line
    yield "]"


# ─── Offres ──────────────────────────────────────────────────────────


OFFER_EXPORT_COLUMNS = [
    "id",
    "title",
    "status",
    "origin",
    "visible_site",
    "view_count",
    "save_count",
    "company_name",
    "primary_filiere_id",
    "contract_type_id",
    "source_code",
    "source_url",
    "published_at",
    "expires_at",
    "collected_at",
    "created_at",
]


def iter_offers_for_export(db: Session, filters: dict[str, Any]) -> Iterator[dict[str, Any]]:
    """Yield les offres sous forme de dict plat pour export CSV/JSON.

    `filters` accepte : status, origin, visible_site, filiere_id, source_id, q.
    On ne materialize pas la liste en memoire : ca scale au dela de 100k
    offres sans OOM.
    """
    stmt = select(JobOffer).order_by(JobOffer.created_at.desc())
    if f := filters.get("status"):
        stmt = stmt.where(JobOffer.status == f)
    if o := filters.get("origin"):
        stmt = stmt.where(JobOffer.origin == o)
    if (vs := filters.get("visible_site")) is not None:
        stmt = stmt.where(JobOffer.visible_site == vs)
    if fid := filters.get("filiere_id"):
        stmt = stmt.where(JobOffer.primary_filiere_id == fid)
    if sid := filters.get("source_id"):
        stmt = stmt.where(JobOffer.source_id == sid)
    if q := filters.get("q"):
            stmt = stmt.where(safe_ilike(JobOffer.title, q))

        # `yield_per` declenche le streaming cote SQLAlchemy : on recupere les
    # resultats par batch, pas tout d'un coup.
    for offer in db.scalars(stmt.execution_options(yield_per=500)):
        yield _offer_to_row(offer)


def _offer_to_row(offer: JobOffer) -> dict[str, Any]:
    return {
        "id": offer.id,
        "title": offer.title,
        "status": offer.status.value if hasattr(offer.status, "value") else offer.status,
        "origin": offer.origin.value if hasattr(offer.origin, "value") else offer.origin,
        "visible_site": offer.visible_site,
        "view_count": offer.view_count,
        "save_count": offer.save_count,
        "company_name": offer.company.name if offer.company else "",
        "primary_filiere_id": offer.primary_filiere_id or "",
        "contract_type_id": offer.contract_type_id or "",
        "source_code": offer.source.code if offer.source else "",
        "source_url": offer.source_url,
        "published_at": offer.published_at.isoformat() if offer.published_at else "",
        "expires_at": offer.expires_at.isoformat() if offer.expires_at else "",
        "collected_at": offer.collected_at.isoformat() if offer.collected_at else "",
        "created_at": offer.created_at.isoformat() if offer.created_at else "",
    }


# ─── Abonnes ────────────────────────────────────────────────────────


SUBSCRIBER_EXPORT_COLUMNS = [
    "id",
    "email",
    "full_name",
    "city",
    "status",
    "wants_career_tips",
    "channel",
    "created_at",
    "channel",
]


def iter_subscribers_for_export(db: Session, filters: dict[str, Any]) -> Iterator[dict[str, Any]]:
    stmt = select(Subscriber).order_by(Subscriber.created_at.desc())
    if f := filters.get("status"):
        stmt = stmt.where(Subscriber.status == f)
    if cid := filters.get("city"):
        stmt = stmt.where(safe_ilike(Subscriber.city, cid))
    if q := filters.get("q"):
        stmt = stmt.where(safe_ilike(Subscriber.email, q))
    # Audit 2, Q1: filtre to_email (exact ou ilike avec %) aligne sur le
    # vocabulaire de /api/admin/emails (transactional_emails).
    if to_email := filters.get("to_email"):
        if "%" in to_email:
            stmt = stmt.where(raw_ilike(Subscriber.email, to_email))
        else:
            stmt = stmt.where(Subscriber.email == to_email.lower())
    for subscriber in db.scalars(stmt.execution_options(yield_per=500)):
        yield _subscriber_to_row(subscriber)


def _subscriber_to_row(subscriber: Subscriber) -> dict[str, Any]:
    return {
        "id": subscriber.id,
        "email": subscriber.email,
        "full_name": subscriber.full_name or "",
        "city": subscriber.city or "",
        "status": subscriber.status.value if hasattr(subscriber.status, "value") else subscriber.status,
        "wants_career_tips": getattr(subscriber, "wants_career_tips", False),
        "channel": getattr(subscriber, "channel", getattr(subscriber, "channel", "")),
        "created_at": subscriber.created_at.isoformat() if subscriber.created_at else "",
    }


# ─── Envois (digests) ───────────────────────────────────────────────


DIGEST_EXPORT_COLUMNS = [
    "id",
    "subscriber_email",
    "digest_date",
    "status",
    "match_tier",
    "template_version",
    "offer_count",
    "scheduled_for",
    "sent_at",
    "skipped_reason",
]


def iter_digests_for_export(db: Session, filters: dict[str, Any]) -> Iterator[dict[str, Any]]:
    stmt = select(EmailDigest).order_by(EmailDigest.created_at.desc())
    if f := filters.get("status"):
        stmt = stmt.where(EmailDigest.status == f)
    if tv := filters.get("template_version"):
        stmt = stmt.where(EmailDigest.template_version == tv)
    if tier := filters.get("match_tier"):
        stmt = stmt.where(EmailDigest.match_tier == tier)
    # Audit 2, Q1: filtre to_email sur l'email du subscriber du digest
    # (jointure), exact ou ilike avec %.
    if to_email := filters.get("to_email"):
        from models import Subscriber as _Subscriber

        stmt = stmt.join(_Subscriber, _Subscriber.id == EmailDigest.subscriber_id)
        if "%" in to_email:
            stmt = stmt.where(raw_ilike(_Subscriber.email, to_email))
        else:
            stmt = stmt.where(_Subscriber.email == to_email.lower())
    for digest in db.scalars(stmt.execution_options(yield_per=500)):
        yield _digest_to_row(digest)


def _digest_to_row(digest: EmailDigest) -> dict[str, Any]:
    return {
        "id": digest.id,
        "subscriber_email": digest.subscriber.email if digest.subscriber else "",
        "digest_date": digest.digest_date.isoformat() if digest.digest_date else "",
        "status": digest.status.value if hasattr(digest.status, "value") else digest.status,
        "match_tier": digest.match_tier,
        "template_version": digest.template_version,
        "offer_count": digest.offer_count,
        "scheduled_for": digest.scheduled_for.isoformat() if digest.scheduled_for else "",
        "sent_at": digest.sent_at.isoformat() if digest.sent_at else "",
        "skipped_reason": digest.skipped_reason or "",
    }


# ─── Public streaming helpers ─────────────────────────────────────────


def stream_as(
    *,
    format: str,
    rows: Iterable[dict[str, Any]],
    columns: list[str],
) -> tuple[Iterator[str], str, str]:
    """Renvoie (generator, media_type, content_disposition_filename).

    `format` doit etre 'csv' ou 'json'. Pour 'json', `columns` est ignore
    (on serialise chaque dict tel quel).
    """
    if format == "csv":
        media_type = "text/csv; charset=utf-8"
        filename = "export.csv"
        return _stream_csv(rows, columns), media_type, filename
    if format == "json":
        media_type = "application/json; charset=utf-8"
        filename = "export.json"
        return _stream_json(rows), media_type, filename
    raise ValueError(f"Format d'export non supporte: {format!r}")


__all__ = [
    "DIGEST_EXPORT_COLUMNS",
    "OFFER_EXPORT_COLUMNS",
    "SUBSCRIBER_EXPORT_COLUMNS",
    "iter_digests_for_export",
    "iter_offers_for_export",
    "iter_subscribers_for_export",
    "stream_as",
]
