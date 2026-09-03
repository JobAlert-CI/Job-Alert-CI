"""Admin : suggestions de filiere IA (document 8 — 2.2 / 2.6).

Le modele AIFiliereSuggestion existe deja (base ai_filiere_suggestions).
Il manque les routes admin pour :
- lister (GET /admin/ai/suggestions)
- approuver / rejeter (PATCH /admin/ai/suggestions/{id})
- si approuvee, creer la filiere et mettre le statut APPROVED.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import get_current_admin, get_db, require_roles
from models.ai import AIFiliereSuggestion, AIFiliereSuggestionStatus
from models.referentials import Filiere, FiliereKeyword
from schemas.ai import AIFiliereSuggestionRead, AIFiliereSuggestionUpdate

router = APIRouter(prefix="/api/admin/ai", tags=["admin-ai"], dependencies=[Depends(require_roles("super_admin"))])


@router.get("/suggestions", response_model=list[AIFiliereSuggestionRead])
async def list_ai_suggestions(
    db: Session = Depends(get_db),
    status_filter: Optional[str] = Query(None, description="PENDING, APPROVED, REJECTED"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    stmt = select(AIFiliereSuggestion).order_by(AIFiliereSuggestion.created_at.desc())
    if status_filter:
        stmt = stmt.where(AIFiliereSuggestion.status == AIFiliereSuggestionStatus(status_filter))
    stmt = stmt.offset(offset).limit(limit)
    return list(db.scalars(stmt))


@router.patch("/suggestions/{suggestion_id}", response_model=AIFiliereSuggestionRead)
async def update_ai_suggestion(
    suggestion_id: str,
    payload: AIFiliereSuggestionUpdate,
    db: Session = Depends(get_db),
    admin: __import__("models").admin.Administrator = Depends(get_current_admin),
):
    """Approuve (cree la filiere) ou rejette une suggestion IA."""
    suggestion = db.get(AIFiliereSuggestion, suggestion_id)
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion non trouvee")

    if payload.status == AIFiliereSuggestionStatus.APPROVED:
        # Verifier si la filiere existe deja (par code)
        existing_filiere = db.scalar(select(Filiere).where(Filiere.code == suggestion.code))
        if not existing_filiere:
            filiere = Filiere(
                code=suggestion.code,
                label=suggestion.label,
                slug=suggestion.code,
                is_active=True,
            )
            db.add(filiere)
            db.flush()
            # Ajouter le premier mot-cle (le label de la suggestion) comme mot-cle de base
            keyword = FiliereKeyword(
                filiere_id=filiere.id,
                keyword=suggestion.label,
                normalized_keyword=suggestion.label.lower(),
                weight=50,
                is_active=True,
            )
            db.add(keyword)
        else:
            filiere = existing_filiere
        suggestion.status = AIFiliereSuggestionStatus.APPROVED

    elif payload.status == AIFiliereSuggestionStatus.REJECTED:
        suggestion.status = AIFiliereSuggestionStatus.REJECTED
    else:
        # Si le statut reste PENDING, on peut mettre a jour reviewed_by_admin_id
        pass

    if admin.id or payload.status != AIFiliereSuggestionStatus.PENDING:
        suggestion.reviewed_by_admin_id = admin.id
        suggestion.reviewed_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)

    db.commit()
    db.refresh(suggestion)
    return suggestion
