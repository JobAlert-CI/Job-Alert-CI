from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.deps import get_current_admin, get_db, require_roles
from models import TransactionalEmailEvent
from models.enums import TransactionalEmailPurpose, TransactionalEmailStatus
from schemas.emails import TransactionalEmailEventRead, TransactionalEmailStatsRead

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


@router.get("/stats", response_model=TransactionalEmailStatsRead)
def transactional_email_stats(
    db: Session = Depends(get_db),
    _: object = Depends(get_current_admin),
    days: int = Query(30, ge=1, le=365, description="Fenetre des axes par_jour et echecs_fenetre"),
):
    """Stats des emails transactionnels pour /admin/logs (cycle 17).

    Un seul appel alimente les compteurs M1-M6 : totaux par statut et par
    motif (globaux), echecs sur la fenetre, envois par jour separes par
    statut (le front empile sent/failed/queued).

    `days=1` donne le badge « echecs du jour » de la doc v3 §17.3 (le /count
    existant n'a pas de fenetre temporelle). Aucun payload n'est touche.
    """
    now = datetime.now(UTC)
    depuis = now - timedelta(days=days)

    # Compteurs globaux par statut et par motif : deux GROUP BY (colonnes
    # separees et indexees, une passe chacun — un GROUP BY croise serait
    # plus cher pour la meme information).
    par_statut = {
        statut.value if hasattr(statut, "value") else str(statut): total
        for statut, total in db.execute(
            select(TransactionalEmailEvent.status, func.count()).group_by(TransactionalEmailEvent.status)
        ).all()
    }
    par_motif = {
        motif.value if hasattr(motif, "value") else str(motif): total
        for motif, total in db.execute(
            select(TransactionalEmailEvent.purpose, func.count()).group_by(TransactionalEmailEvent.purpose)
        ).all()
    }
    total = sum(par_statut.values())

    # Echecs sur la fenetre demandee (COUNT cible, jamais NULL).
    echecs_fenetre = (
        db.scalar(
            select(func.count(TransactionalEmailEvent.id)).where(
                TransactionalEmailEvent.status == TransactionalEmailStatus.FAILED,
                TransactionalEmailEvent.created_at >= depuis,
            )
        )
        or 0
    )

    # Axe par jour x statut sur la fenetre : [{jour, total, par_statut}]
    rows = db.execute(
        select(
            func.date(TransactionalEmailEvent.created_at),
            TransactionalEmailEvent.status,
            func.count(),
        )
        .where(TransactionalEmailEvent.created_at >= depuis)
        .group_by(func.date(TransactionalEmailEvent.created_at), TransactionalEmailEvent.status)
        .order_by(func.date(TransactionalEmailEvent.created_at))
    ).all()
    jours: dict[str, dict] = {}
    for jour, statut, nb in rows:
        cle = str(jour)
        entree = jours.setdefault(cle, {"jour": cle, "total": 0, "par_statut": {}})
        entree["total"] += nb
        entree["par_statut"][statut.value if hasattr(statut, "value") else str(statut)] = nb
    par_jour = list(jours.values())

    return TransactionalEmailStatsRead(
        total=total,
        par_statut=par_statut,
        par_motif=par_motif,
        echecs_fenetre=echecs_fenetre,
        par_jour=par_jour,
        days=days,
    )


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
