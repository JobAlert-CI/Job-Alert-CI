from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from api.deps import get_db, require_roles
from services.admin_exports import (
    DIGEST_EXPORT_COLUMNS,
    OFFER_EXPORT_COLUMNS,
    SUBSCRIBER_EXPORT_COLUMNS,
    iter_digests_for_export,
    iter_offers_for_export,
    iter_subscribers_for_export,
    stream_as,
)


router = APIRouter(
    prefix="/api/admin",
    tags=["admin-exports"],
    # Les exports sont ouverts a tous les roles admin concernes : on n'applique
    # pas le check `get_current_admin` au niveau router pour pouvoir declarer
    # des `Depends(require_roles(...))` specifiques par endpoint.
)


ExportFormat = Literal["csv", "json"]


def _validate_format(fmt: str) -> str:
    fmt = (fmt or "").lower().strip()
    if fmt not in ("csv", "json"):
        raise HTTPException(status_code=400, detail="format doit etre 'csv' ou 'json'")
    return fmt


@router.get("/exports/data-export/offers")
def export_offers(
    db: Session = Depends(get_db),
    _: object = Depends(require_roles("super_admin", "gestionnaire_offres")),
    format: str = Query("csv", description="csv ou json"),
    status: Optional[str] = Query(None),
    origin: Optional[str] = Query(None),
    visible_site: Optional[bool] = Query(None),
    filiere_id: Optional[str] = Query(None),
    source_id: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
):
    """Export streamant les offres au format CSV ou JSON.

    Memes filtres que `GET /api/admin/offers`. Utilise `yield_per` SQLAlchemy
    + `StreamingResponse` : scale au-dela de 100k offres sans OOM.

    Le segment `/data-export/offers` (au lieu de `/offers/export`) evite le
    conflit avec `GET /api/admin/offers/{offer_id}` qui capturerait
    `export` comme un offer_id. Les 3 endpoints d'export partagent le meme
    prefixe `/data-export/*` pour rester coherents.
    """
    fmt = _validate_format(format)
    filters = {"status": status, "origin": origin, "visible_site": visible_site, "filiere_id": filiere_id, "source_id": source_id, "q": q}
    body, media_type, filename = stream_as(
        format=fmt,
        rows=iter_offers_for_export(db, filters),
        columns=OFFER_EXPORT_COLUMNS,
    )
    return StreamingResponse(
        body,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/exports/data-export/subscribers")
def export_subscribers(
    db: Session = Depends(get_db),
    _: object = Depends(require_roles("super_admin", "gestionnaire_utilisateurs")),
    format: str = Query("csv"),
    status: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
):
    """Export des abonnes (support, audit RGPD, communication).

    Placee sous `/data-export/...` pour eviter le conflit avec
    `GET /api/admin/subscribers/{subscriber_id}`.
    """
    fmt = _validate_format(format)
    filters = {"status": status, "city": city, "q": q}
    body, media_type, filename = stream_as(
        format=fmt,
        rows=iter_subscribers_for_export(db, filters),
        columns=SUBSCRIBER_EXPORT_COLUMNS,
    )
    return StreamingResponse(
        body,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/exports/data-export/sending")
def export_sending(
    db: Session = Depends(get_db),
    _: object = Depends(require_roles("super_admin", "gestionnaire_utilisateurs")),
    format: str = Query("csv"),
    status: Optional[str] = Query(None),
    template_version: Optional[str] = Query(None),
    match_tier: Optional[str] = Query(None),
):
    """Export des envois (digests + manuels) avec leur palier de matching.

    Placee sous `/data-export/...` pour eviter le conflit avec les routes
    existantes de `/api/admin/sending/*` (prepare, send, run, sends, stats, ...).
    """
    fmt = _validate_format(format)
    filters = {"status": status, "template_version": template_version, "match_tier": match_tier}
    body, media_type, filename = stream_as(
        format=fmt,
        rows=iter_digests_for_export(db, filters),
        columns=DIGEST_EXPORT_COLUMNS,
    )
    return StreamingResponse(
        body,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


__all__ = ["router"]