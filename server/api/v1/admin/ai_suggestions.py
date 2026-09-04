"""Admin : suggestions de filiere IA (document 8 — 2.2 / 2.6).

Le modele AIFiliereSuggestion existe deja (base ai_filiere_suggestions).
Il manque les routes admin pour :
- lister (GET /admin/ai/suggestions)
- approuver / rejeter (PATCH /admin/ai/suggestions/{id})
- si approuvee, creer la filiere et mettre le statut APPROVED.
"""
from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.deps import get_current_admin, get_db, require_roles
from models.admin import AdminAction, Administrator
from models.ai import AIFiliereSuggestion, AIFiliereSuggestionStatus
from models.referentials import Filiere, FiliereKeyword
from schemas.ai import AIFiliereSuggestionRead, AIFiliereSuggestionUpdate
from services.audit import log_admin_action

router = APIRouter(
    prefix="/api/admin/ai",
    tags=["admin-ai"],
    dependencies=[Depends(require_roles("super_admin"))],
)


@router.get("/suggestions", response_model=list[AIFiliereSuggestionRead])
async def list_ai_suggestions(
    db: Session = Depends(get_db),
    status_filter: AIFiliereSuggestionStatus | None = Query(
        None, description="Filtre par statut (PENDING, APPROVED, REJECTED)"
    ),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    stmt = select(AIFiliereSuggestion).order_by(AIFiliereSuggestion.created_at.desc())
    if status_filter is not None:
        stmt = stmt.where(AIFiliereSuggestion.status == status_filter)
    stmt = stmt.offset(offset).limit(limit)
    return list(db.scalars(stmt))


@router.patch("/suggestions/{suggestion_id}", response_model=AIFiliereSuggestionRead)
async def update_ai_suggestion(
    suggestion_id: str,
    payload: AIFiliereSuggestionUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Approuve (cree la filiere) ou rejette une suggestion IA (transaction explicite)."""
    suggestion = db.get(AIFiliereSuggestion, suggestion_id)
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion non trouvee")

    if payload.status == AIFiliereSuggestionStatus.APPROVED:
        existing_filiere = db.scalar(select(Filiere).where(Filiere.code == suggestion.code))
        if existing_filiere is None:
            try:
                filiere = Filiere(
                    code=suggestion.code,
                    label=suggestion.label,
                    slug=suggestion.code,
                    is_active=True,
                )
                db.add(filiere)
                db.flush()
                keyword = FiliereKeyword(
                    filiere_id=filiere.id,
                    keyword=suggestion.label,
                    normalized_keyword=suggestion.label.lower(),
                    weight=50,
                    is_active=True,
                )
                db.add(keyword)
            except IntegrityError as exc:
                db.rollback()
                raise HTTPException(
                    status_code=409,
                    detail=f"Filiere deja creee en parallele (race condition): {exc.orig}",
                ) from exc
        suggestion.status = AIFiliereSuggestionStatus.APPROVED
    elif payload.status == AIFiliereSuggestionStatus.REJECTED:
        suggestion.status = AIFiliereSuggestionStatus.REJECTED

    suggestion.reviewed_by_admin_id = admin.id
    suggestion.reviewed_at = datetime.now(UTC)

    log_admin_action(
        db,
        admin_id=admin.id,
        action=AdminAction.UPDATE,
        target_table="ai_filiere_suggestions",
        target_id=suggestion.id,
        details={"status": payload.status.value, "code": suggestion.code},
    )

    db.commit()
    db.refresh(suggestion)
    return suggestion
