"""Apercu du digest avant envoi personnalise (document 8 — 1.6)."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from api.deps import get_current_admin, get_db, require_roles
from services.digest_preview_service import render_digest_preview

router = APIRouter(
    prefix="/api/admin/sending",
    tags=["admin-sending"],
    dependencies=[Depends(require_roles("gestionnaire_utilisateurs", "super_admin"))],
)


@router.post("/preview")
async def preview_digest(
    subscriber_id: str = Query(..., description="Abonne cible"),
    offer_ids: list[str] | None = Query(None, description="Liste d'IDs d'offres a inclure (facultatif)"),
    db: Session = Depends(get_db),
    admin: __import__("models").admin.Administrator = Depends(get_current_admin),
):
    """Renvoie le rendu HTML du digest (sans envoyer d'email).

    Si `offer_ids` est present, le rendu ne contient que ces offres.
    Sinon, le rendu contient les 5 premieres offres liees aux filieres de l'abonne.
    """
    preview = render_digest_preview(db, subscriber_id=subscriber_id, offer_ids=offer_ids)
    return {
        "preview": preview,
        "message": "Apercu du digest (non envoye) — selection personnalisee" if offer_ids else "Apercu du digest (non envoye) — offres liees aux filieres",
    }
