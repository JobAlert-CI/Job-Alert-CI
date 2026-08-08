from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import get_current_admin, get_db, require_roles
from models.admin import AdminAction, AdminActionLog, Administrator
from models.content import ContactMessage
from models.enums import ContactMessageStatus, IngestionAction
from models.jobs import OfferIngestionEvent
from models.scraping import SourceScrapeRun
from schemas.logs import AdminActionLogRead, ContactMessageAdminRead, ContactStatusUpdate, EventLogRead
from services.audit import log_admin_action

# Journaux techniques et d'audit: reserves au super_admin.
router = APIRouter(
    prefix="/api/admin/logs",
    tags=["admin-logs"],
    dependencies=[Depends(require_roles("super_admin"))],
)

_LEVEL_BY_ACTION = {
    IngestionAction.FAILED: "error",
    IngestionAction.SKIPPED: "warning",
    IngestionAction.DUPLICATE: "info",
    IngestionAction.UPDATED: "info",
    IngestionAction.INSERTED: "info",
}

# Vocabulaire API (utilise a la fois par le filtre GET et par le PATCH) mappe
# vers les valeurs reellement stockees dans ContactMessageStatus.
CONTACT_STATUS_ALIASES = {
    "new": ContactMessageStatus.NEW,
    "read": ContactMessageStatus.IN_PROGRESS,
    "replied": ContactMessageStatus.REPLIED,
    "archived": ContactMessageStatus.CLOSED,
    "spam": ContactMessageStatus.SPAM,
}

_VALID_AUDIT_ACTIONS = {action.value for action in AdminAction}


# ─── Journal d'audit admin ─────────────────────────────
@router.get("/audit", response_model=list[AdminActionLogRead])
async def list_audit_logs(
    db: Session = Depends(get_db),
    admin_id: Optional[str] = None,
    action: Optional[str] = None,
    target_table: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Historique des actions admin."""
    stmt = select(AdminActionLog)
    if admin_id:
        stmt = stmt.where(AdminActionLog.admin_id == admin_id)
    if action:
        if action not in _VALID_AUDIT_ACTIONS:
            raise HTTPException(status_code=400, detail=f"Action inconnue: {action}")
        stmt = stmt.where(AdminActionLog.action == action)
    if target_table:
        stmt = stmt.where(AdminActionLog.target_table == target_table)
    stmt = stmt.order_by(AdminActionLog.created_at.desc()).limit(limit).offset(offset)
    return list(db.scalars(stmt))


# ─── Logs événements (scraping, envoi…) ────────────────
@router.get("/events", response_model=list[EventLogRead])
async def list_event_logs(
    db: Session = Depends(get_db),
    module: Optional[str] = Query(None, description="Toujours 'scraping' pour l'instant (seule source d'événements disponible)."),
    level: Optional[str] = Query(None, description="info, warning ou error"),
    source_id: Optional[str] = Query(None, description="ID de source, pour ne garder que ses runs"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Logs techniques filtrables par module et niveau (dérivés du suivi d'ingestion des offres)."""
    if module and module != "scraping":
        return []

    stmt = select(OfferIngestionEvent).order_by(OfferIngestionEvent.created_at.desc())
    if source_id:
        stmt = (
            stmt.join(SourceScrapeRun, SourceScrapeRun.id == OfferIngestionEvent.source_scrape_run_id)
            .where(SourceScrapeRun.source_id == source_id)
        )
    events = list(db.scalars(stmt.limit(limit * 3).offset(offset)))

    results = []
    for event in events:
        computed_level = _LEVEL_BY_ACTION.get(event.action, "info")
        if level and computed_level != level:
            continue
        results.append(
            EventLogRead(
                id=event.id,
                created_at=event.created_at,
                updated_at=event.created_at,
                module="scraping",
                niveau=computed_level,
                action=event.action.value,
                offer_id=event.offer_id,
                source_scrape_run_id=event.source_scrape_run_id,
                hash_unique=event.hash_unique,
                raw_url=event.raw_url,
                message=event.reason,
            )
        )
        if len(results) >= limit:
            break
    return results


# ─── Messages de contact ───────────────────────────────
@router.get("/contacts", response_model=list[ContactMessageAdminRead])
async def list_contact_messages(
    db: Session = Depends(get_db),
    status: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    stmt = select(ContactMessage).where(ContactMessage.deleted_at.is_(None))
    if status:
        if status not in CONTACT_STATUS_ALIASES:
            raise HTTPException(status_code=400, detail=f"Statut inconnu: {status}")
        stmt = stmt.where(ContactMessage.status == CONTACT_STATUS_ALIASES[status])
    stmt = stmt.order_by(ContactMessage.created_at.desc()).limit(limit).offset(offset)
    return list(db.scalars(stmt))


@router.patch("/contacts/{contact_id}/status", response_model=ContactMessageAdminRead)
async def update_contact_status(
    contact_id: str,
    payload: ContactStatusUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    message = db.scalar(select(ContactMessage).where(ContactMessage.id == contact_id))
    if not message:
        raise HTTPException(status_code=404, detail="Message introuvable")

    message.status = CONTACT_STATUS_ALIASES[payload.status]

    log_admin_action(
        db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="contact_messages", target_id=message.id,
        details={"status": payload.status},
    )
    db.commit()
    db.refresh(message)
    return message