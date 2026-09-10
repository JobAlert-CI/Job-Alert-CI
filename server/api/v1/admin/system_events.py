"""Journal des evenements systeme — vue admin (audit 4, G.1 — Lot 6).

GET /api/admin/system/events : liste filtrable (source, severity, fenetre
`days`, `limit` bornee) des evenements traces par log_system_event() —
echecs de tasks Celery, d'envois d'emails, du pipeline IA et ops.

Reserve au super_admin (meme perimetre que system_health / system_schedule).
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.deps import get_current_admin, get_db, require_roles
from models import Administrator, SystemEventLog
from models.enums import SystemEventSeverity, SystemEventSource

router = APIRouter(
    prefix="/api/admin/system",
    tags=["admin-system"],
    dependencies=[Depends(require_roles("super_admin"))],
)

MAX_LIMIT = 200
MAX_DAYS = 90


@router.get("/events")
def list_system_events(
    source: str | None = Query(default=None, description="Filtre par source (celery, email, scraping, ia, api)"),
    severity: str | None = Query(default=None, description="Filtre par severity (info, warning, error, critical)"),
    event_type: str | None = Query(default=None, description="Filtre par event_type exact"),
    days: int = Query(default=7, ge=1, le=MAX_DAYS, description="Fenetre en jours (max 90)"),
    limit: int = Query(default=50, ge=1, le=MAX_LIMIT, description="Nombre maximum d'evenements"),
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
) -> dict:
    """Derniers evenements systeme, plus recents en tete (audit 4, G.1)."""
    # Validation des valeurs enum AVANT la requete : une valeur inconnue
    # renvoie un 400 explicite plutot qu'une liste vide trompeuse.
    source_enum = None
    if source is not None:
        try:
            source_enum = SystemEventSource(source)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Source inconnue: {source}") from None

    severity_enum = None
    if severity is not None:
        try:
            severity_enum = SystemEventSeverity(severity)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Severity inconnue: {severity}") from None

    cutoff = datetime.now(UTC) - timedelta(days=days)
    stmt = select(SystemEventLog).where(SystemEventLog.created_at >= cutoff)
    if source_enum is not None:
        stmt = stmt.where(SystemEventLog.source == source_enum)
    if severity_enum is not None:
        stmt = stmt.where(SystemEventLog.severity == severity_enum)
    if event_type:
        stmt = stmt.where(SystemEventLog.event_type == event_type[:120])

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = list(
        db.scalars(
            stmt.order_by(SystemEventLog.created_at.desc()).limit(limit)
        )
    )

    return {
        "total": total,
        "limit": limit,
        "days": days,
        "events": [
            {
                "id": row.id,
                "source": row.source.value,
                "severity": row.severity.value,
                "event_type": row.event_type,
                "message": row.message,
                "context": row.context,
                "created_at": row.created_at.isoformat(),
            }
            for row in rows
        ],
    }
