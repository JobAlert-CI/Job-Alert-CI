from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.deps import get_current_admin, get_db, require_roles
from models import TransactionalEmailEvent
from models.enums import TransactionalEmailPurpose, TransactionalEmailStatus
from schemas.emails import TransactionalEmailEventRead

# Historique des emails transactionnels : super_admin (toute la base) ou
# gestionnaire_utilisateurs (support abonne).
router = APIRouter(
    prefix="/api/admin/transactional-emails",
    tags=["admin-transactional-emails"],
    dependencies=[Depends(require_roles("super_admin", "gestionnaire_utilisateurs"))],
    # Toutes les routes dependent de get_current_admin (pas juste au niveau router)
    # pour eviter les surprises si quelqu'un ajoute une route publique plus tard.
)


@router.get("", response_model=list[TransactionalEmailEventRead])
def list_transactional_emails(
    db: Session = Depends(get_db),
    _: object = Depends(get_current_admin),
    purpose: TransactionalEmailPurpose | None = Query(
        None, description="Filtrer par motif (confirm_email, resend_confirmation, manage_alert, unsubscribe)"
    ),
    status: TransactionalEmailStatus | None = Query(
        None, description="Filtrer par statut (queued, sent, failed)"
    ),
    to_email: str | None = Query(
        None, description="Filtre exact (ou ilike si prefixe %) sur l'adresse destinataire"
    ),
    subscriber_id: str | None = Query(None, description="Limiter aux events d'un abonne"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Liste paginee des `TransactionalEmailEvent` pour le support client.

    Tri : plus recent en premier (created_at DESC). Aucun payload (request/response)
    n'est expose ici par securite — voir la note dans `TransactionalEmailEventRead`.
    """
    stmt = select(TransactionalEmailEvent).order_by(TransactionalEmailEvent.created_at.desc())
    if purpose is not None:
        purpose_value = purpose.value if hasattr(purpose, "value") else purpose
        stmt = stmt.where(TransactionalEmailEvent.purpose == purpose_value)
    if status is not None:
        status_value = status.value if hasattr(status, "value") else status
        stmt = stmt.where(TransactionalEmailEvent.status == status_value)
    if to_email is not None:
        if "%" in to_email:
            stmt = stmt.where(TransactionalEmailEvent.to_email.ilike(to_email))
        else:
            stmt = stmt.where(TransactionalEmailEvent.to_email == to_email.lower())
    if subscriber_id is not None:
        stmt = stmt.where(TransactionalEmailEvent.subscriber_id == subscriber_id)
    stmt = stmt.limit(limit).offset(offset)
    return list(db.scalars(stmt))


@router.get("/count")
def count_transactional_emails(
    db: Session = Depends(get_db),
    _: object = Depends(get_current_admin),
    status: TransactionalEmailStatus | None = Query(None, description="Filtrer par statut"),
    purpose: TransactionalEmailPurpose | None = Query(None, description="Filtrer par motif"),
):
    """Compte rapide du nombre d'evenements, utile pour le tableau de bord.

    Meme filtre que `/transactional-emails` mais renvoie juste le total
    (sans pagination) pour afficher un badge dans le menu.
    """
    stmt = select(func.count(TransactionalEmailEvent.id))
    if status is not None:
        status_value = status.value if hasattr(status, "value") else status
        stmt = stmt.where(TransactionalEmailEvent.status == status_value)
    if purpose is not None:
        purpose_value = purpose.value if hasattr(purpose, "value") else purpose
        stmt = stmt.where(TransactionalEmailEvent.purpose == purpose_value)
    return {"count": db.scalar(stmt) or 0}


__all__ = ["router"]
