from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.deps import get_current_admin, get_db, require_roles
from models.admin import AdminAction, AdminActionLog, Administrator
from models.content import ContactMessage
from models.enums import ContactMessageStatus, IngestionAction
from models.jobs import OfferIngestionEvent
from models.scraping import SourceScrapeRun
from schemas.logs import (
    AdminActionLogRead,
    AuditLogPageRead,
    AuditStatsRead,
    ContactMessageAdminRead,
    ContactStatusUpdate,
    EventLogRead,
    LogsStatsRead,
)
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
def _audit_filters(stmt, admin_id: str | None, action: str | None, target_table: str | None):
    """Filtres partages par /audit et /audit/stats (meme semantics)."""
    if admin_id:
        stmt = stmt.where(AdminActionLog.admin_id == admin_id)
    if action:
        if action not in _VALID_AUDIT_ACTIONS:
            raise HTTPException(status_code=400, detail=f"Action inconnue: {action}")
        stmt = stmt.where(AdminActionLog.action == action)
    if target_table:
        stmt = stmt.where(AdminActionLog.target_table == target_table)
    return stmt


@router.get("/audit", response_model=AuditLogPageRead)
async def list_audit_logs(
    db: Session = Depends(get_db),
    admin_id: str | None = None,
    action: str | None = None,
    target_table: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Historique des actions admin, enveloppe paginee {items, total}.

    Cycle 16 : le total est calcule par un COUNT cible (meme WHERE que la
    page) — le front peut afficher « X sur N » et paginer honnetement.
    Le tri reste created_at DESC.
    """
    base = _audit_filters(select(AdminActionLog), admin_id, action, target_table)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = list(
        db.scalars(
            base.order_by(AdminActionLog.created_at.desc()).limit(limit).offset(offset)
        )
    )
    # DTO explicite (AdminActionLogRead est un BaseModel pur, pas un
    # ORMModel from_attributes : on ne lui confie jamais l'objet ORM brut,
    # pattern cycle 6 « champ calcule = DTO construit »).
    items = [
        AdminActionLogRead(
            id=row.id,
            admin_id=row.admin_id,
            action=row.action.value if hasattr(row.action, "value") else str(row.action),
            target_table=row.target_table,
            target_id=row.target_id,
            details=row.details,
            created_at=row.created_at,
        )
        for row in rows
    ]
    return AuditLogPageRead(items=items, total=total, limit=limit, offset=offset)


@router.get("/audit/stats", response_model=AuditStatsRead)
async def audit_stats(
    db: Session = Depends(get_db),
    days: int = Query(30, ge=1, le=365, description="Fenetre des axes par_jour et top_auteurs"),
):
    """Stats du journal d'activite (cycle 16) : compteurs globaux + axe
    par jour + top auteurs sur la fenetre demandee.

    SUM/echelle : COUNT renvoie toujours 0 sur base vide (pas de NULL,
    cf. piege SUM documente) ; coalesce inutile ici.
    """
    now = datetime.now(UTC)
    depuis = now - timedelta(days=days)

    total = db.scalar(select(func.count()).select_from(AdminActionLog)) or 0

    by_action = {
        row[0].value if hasattr(row[0], "value") else str(row[0]): row[1]
        for row in db.execute(select(AdminActionLog.action, func.count()).group_by(AdminActionLog.action)).all()
    }

    # Axe par jour : GROUP BY date (jour ISO) sur la fenetre, toutes actions
    # confondues (le front empile par type via le detail /audit filtre).
    # func.date() : portable SQLite (tests) ET PostgreSQL (prod) — to_char
    # n'existe qu'en Postgres.
    par_jour = [
        {"jour": str(row[0]), "total": row[1]}
        for row in db.execute(
            select(
                func.date(AdminActionLog.created_at),
                func.count(),
            )
            .where(AdminActionLog.created_at >= depuis)
            .group_by(func.date(AdminActionLog.created_at))
            .order_by(func.date(AdminActionLog.created_at))
        ).all()
    ]

    # Top auteurs sur la fenetre : JOIN administrators pour le nom (les
    # lignes orphelines admin_id NULL — admin supprime, FK SET NULL cycle
    # 15 — sont regroupees a part, affichees comme « admin supprime »).
    top_auteurs = [
        {
            "admin_id": row[0],
            "nom": row[1] or "Admin supprimé",
            "email": row[2] or "",
            "total": row[3],
        }
        for row in db.execute(
            select(
                AdminActionLog.admin_id,
                Administrator.full_name,
                Administrator.email,
                func.count(),
            )
            .outerjoin(Administrator, Administrator.id == AdminActionLog.admin_id)
            .where(AdminActionLog.created_at >= depuis)
            .group_by(AdminActionLog.admin_id, Administrator.full_name, Administrator.email)
            .order_by(func.count().desc())
            .limit(10)
        ).all()
    ]

    return AuditStatsRead(
        total=total,
        by_action=by_action,
        par_jour=par_jour,
        top_auteurs=top_auteurs,
    )


# ─── Stats journal technique (cycle 17) ───────────────
@router.get("/stats", response_model=LogsStatsRead)
async def logs_stats(
    db: Session = Depends(get_db),
    days: int = Query(30, ge=1, le=365, description="Fenetre des axes par_jour/par_action"),
):
    """Compteurs + axes du journal technique pour /admin/logs (cycle 17).

    Sources : OfferIngestionEvent (evenements scraping, niveaux derives du
    mapping _LEVEL_BY_ACTION) + ContactMessage (boite de reception, statuts
    renvoyes en VOCABULAIRE API via l'inverse des aliases — jamais les
    valeurs internes new/in_progress stockees en base).

    Pieges respectes :
    - COUNT renvoie 0 sur base vide (pas de SUM NULL ici, mais on garde le
      `or 0` defensif pour le scalar) ;
    - func.date() portable SQLite (tests) ET PostgreSQL (prod) ;
    - les soft-deleted de ContactMessage sont exclus comme dans la liste.
    """
    now = datetime.now(UTC)
    depuis = now - timedelta(days=days)

    # ── Evenements d'ingestion ──
    # Compteurs globaux : une seule passe GROUP BY action, puis agregation
    # Python par niveau/action (5 actions possibles, pas de sur-fetch).
    par_action_rows = db.execute(
        select(OfferIngestionEvent.action, func.count()).group_by(OfferIngestionEvent.action)
    ).all()
    compteurs_action = {action: total for action, total in par_action_rows}

    def _compte(*actions: IngestionAction) -> int:
        return sum(compteurs_action.get(action, 0) for action in actions)

    events_total = sum(compteurs_action.values())
    events_errors = _compte(IngestionAction.FAILED)
    events_warnings = _compte(IngestionAction.SKIPPED)
    events_duplicates = _compte(IngestionAction.DUPLICATE)

    # Axe par jour (fenetre), empilable par niveau cote front : on groupe par
    # jour + action, le front derive le niveau via le meme mapping que /events.
    events_par_jour_rows = db.execute(
        select(
            func.date(OfferIngestionEvent.created_at),
            OfferIngestionEvent.action,
            func.count(),
        )
        .where(OfferIngestionEvent.created_at >= depuis)
        .group_by(func.date(OfferIngestionEvent.created_at), OfferIngestionEvent.action)
        .order_by(func.date(OfferIngestionEvent.created_at))
    ).all()
    # Restructure : [{jour, total, par_action: {action: n}}] — le total par
    # jour sert l'axe principal, par_action l'empilement par niveau.
    jours_events: dict[str, dict] = {}
    for jour, action, total in events_par_jour_rows:
        cle = str(jour)
        entree = jours_events.setdefault(cle, {"jour": cle, "total": 0, "par_action": {}})
        entree["total"] += total
        entree["par_action"][action.value if hasattr(action, "value") else str(action)] = total
    events_par_jour = list(jours_events.values())

    # Axe par action (fenetre) : barres horizontales donut-ready.
    events_par_action_rows = db.execute(
        select(OfferIngestionEvent.action, func.count())
        .where(OfferIngestionEvent.created_at >= depuis)
        .group_by(OfferIngestionEvent.action)
        .order_by(func.count().desc())
    ).all()
    events_par_action = [
        {
            "action": action.value if hasattr(action, "value") else str(action),
            "total": total,
        }
        for action, total in events_par_action_rows
    ]

    # ── Messages de contact ──
    # Statuts en vocabulaire API : on inverse CONTACT_STATUS_ALIASES pour
    # traduire les valeurs internes (IN_PROGRESS -> "read", CLOSED ->
    # "archived") — le front ne connait QUE le vocabulaire API.
    inverse_aliases = {valeur: cle for cle, valeur in CONTACT_STATUS_ALIASES.items()}
    contacts_rows = db.execute(
        select(ContactMessage.status, func.count())
        .where(ContactMessage.deleted_at.is_(None))
        .group_by(ContactMessage.status)
    ).all()
    contacts_par_statut: dict[str, int] = {}
    for statut, total in contacts_rows:
        cle_api = inverse_aliases.get(statut, statut.value if hasattr(statut, "value") else str(statut))
        # Cumul defensif si deux valeurs internes mappent la meme cle API.
        contacts_par_statut[cle_api] = contacts_par_statut.get(cle_api, 0) + total
    contacts_total = sum(contacts_par_statut.values())

    return LogsStatsRead(
        events_total=events_total,
        events_errors=events_errors,
        events_warnings=events_warnings,
        events_duplicates=events_duplicates,
        events_par_jour=events_par_jour,
        events_par_action=events_par_action,
        contacts_total=contacts_total,
        contacts_par_statut=contacts_par_statut,
        days=days,
    )


# ─── Logs événements (scraping, envoi…) ────────────────
@router.get("/events", response_model=list[EventLogRead])
async def list_event_logs(
    db: Session = Depends(get_db),
    module: str | None = Query(None, description="Toujours 'scraping' pour l'instant (seule source d'evenements disponible)."),
    level: str | None = Query(None, description="info, warning ou error"),
    source_id: str | None = Query(None, description="ID de source, pour ne garder que ses runs"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Logs techniques filtrables par module et niveau.

    Audit P1 #14: on filtre SQL sur `level` (mapping _LEVEL_BY_ACTION inverse)
    pour eviter le sur-fetch * 3 + filtre Python.
    """
    if module and module != "scraping":
        return []

    # Mapping inverse: level -> liste d'actions correspondantes.
    if level is None:
        allowed_actions = None  # tous
    else:
        allowed_actions = [action for action, lvl in _LEVEL_BY_ACTION.items() if lvl == level]
        if not allowed_actions:
            return []

    stmt = select(OfferIngestionEvent).order_by(OfferIngestionEvent.created_at.desc())
    if source_id:
        stmt = (
            stmt.join(SourceScrapeRun, SourceScrapeRun.id == OfferIngestionEvent.source_scrape_run_id)
            .where(SourceScrapeRun.source_id == source_id)
        )
    if allowed_actions is not None:
        stmt = stmt.where(OfferIngestionEvent.action.in_(allowed_actions))
    events = list(db.scalars(stmt.limit(limit).offset(offset)))

    return [
        EventLogRead(
            id=event.id,
            created_at=event.created_at,
            updated_at=event.created_at,
            module="scraping",
            niveau=_LEVEL_BY_ACTION.get(event.action, "info"),
            action=event.action.value,
            offer_id=event.offer_id,
            source_scrape_run_id=event.source_scrape_run_id,
            hash_unique=event.hash_unique,
            raw_url=event.raw_url,
            message=event.reason,
        )
        for event in events
    ]


# ─── Messages de contact ───────────────────────────────
@router.get("/contacts", response_model=list[ContactMessageAdminRead])
async def list_contact_messages(
    db: Session = Depends(get_db),
    status: str | None = None,
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

    # Cycle 17 : la colonne replied_at existait mais AUCUNE route ne la
    # posait — on la renseigne quand on passe le message a "replied"
    # (premiere reponse seulement, un retour en arriere ne l'efface pas).
    if CONTACT_STATUS_ALIASES[payload.status] is ContactMessageStatus.REPLIED:
        if message.replied_at is None:
            message.replied_at = datetime.now(UTC)
    message.status = CONTACT_STATUS_ALIASES[payload.status]

    log_admin_action(
        db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="contact_messages", target_id=message.id,
        details={"status": payload.status},
    )
    db.commit()
    db.refresh(message)
    return message
