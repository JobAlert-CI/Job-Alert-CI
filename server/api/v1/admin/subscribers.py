from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import get_current_admin, get_db, require_roles
from models.admin import AdminAction, Administrator
from models.emails import EmailDigest, EmailDigestOffer
from models.enums import DigestStatus
from models.jobs import JobOffer
from models.subscriptions import Subscriber, SubscriberFiliere, SubscriberStatus
from schemas.sending import CustomSendCreate, EmailDigestRead
from schemas.subscriptions import SubscriberAdminUpdate, SubscriberRead, SubscriberStatusUpdate
from services.audit import log_admin_action

router = APIRouter(
    prefix="/api/admin/subscribers",
    tags=["admin-subscribers"],
    dependencies=[Depends(require_roles("super_admin", "gestionnaire_utilisateurs"))],
)

# La query string et le PATCH /status partagent le meme vocabulaire cote API
# ("bouncing") meme si la valeur stockee en base differe ("bounced").
STATUS_ALIASES = {
    "active": SubscriberStatus.ACTIVE,
    "unsubscribed": SubscriberStatus.UNSUBSCRIBED,
    "bouncing": SubscriberStatus.BOUNCED,
    "paused": SubscriberStatus.PAUSED,
    "pending": SubscriberStatus.PENDING,
    "deleted": SubscriberStatus.DELETED,
}


def _require_subscriber(db: Session, subscriber_id: str) -> Subscriber:
    subscriber = db.scalar(select(Subscriber).where(Subscriber.id == subscriber_id))
    if not subscriber:
        raise HTTPException(status_code=404, detail="Abonné introuvable")
    return subscriber


@router.get("", response_model=list[SubscriberRead])
async def list_subscribers(
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None, description="Recherche email ou nom"),
    status: Optional[str] = Query(None, description="Statut exact"),
    filiere_id: Optional[str] = Query(None, description="ID de filière"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Liste des abonnés avec filtres."""
    stmt = select(Subscriber)

    if q:
        stmt = stmt.where((Subscriber.email.ilike(f"%{q}%")) | (Subscriber.full_name.ilike(f"%{q}%")))
    if status:
        if status not in STATUS_ALIASES:
            raise HTTPException(status_code=400, detail=f"Statut inconnu: {status}")
        stmt = stmt.where(Subscriber.status == STATUS_ALIASES[status])
    if filiere_id:
        stmt = stmt.join(Subscriber.filiere_links).where(SubscriberFiliere.filiere_id == filiere_id)

    stmt = stmt.order_by(Subscriber.subscribed_at.desc())
    return list(db.scalars(stmt.limit(limit).offset(offset)).unique())


@router.get("/{subscriber_id}", response_model=SubscriberRead)
async def get_subscriber(subscriber_id: str, db: Session = Depends(get_db)):
    """Détail : profil, filières, historique envois, notes."""
    return _require_subscriber(db, subscriber_id)


@router.put("/{subscriber_id}", response_model=SubscriberRead)
async def update_subscriber(
    subscriber_id: str,
    payload: SubscriberAdminUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Édition (nom, ville, notes admin, préférence conseils)."""
    subscriber = _require_subscriber(db, subscriber_id)

    if payload.full_name is not None:
        subscriber.full_name = payload.full_name
    if payload.city is not None:
        subscriber.city = payload.city
    if payload.admin_notes is not None:
        subscriber.admin_notes = payload.admin_notes
    if payload.wants_career_tips is not None:
        subscriber.wants_career_tips = payload.wants_career_tips

    log_admin_action(db, admin_id=admin.id, action=AdminAction.UPDATE, target_table="subscribers", target_id=subscriber.id)
    db.commit()
    db.refresh(subscriber)
    return subscriber


@router.patch("/{subscriber_id}/status")
async def update_subscriber_status(
    subscriber_id: str,
    payload: SubscriberStatusUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Active / désinscrit / met en pause / bascule en bouncing."""
    subscriber = _require_subscriber(db, subscriber_id)
    subscriber.status = STATUS_ALIASES[payload.status]
    if payload.status == "unsubscribed":
        subscriber.unsubscribed_at = datetime.now(timezone.utc)
        subscriber.unsubscribe_reason = payload.reason

    log_admin_action(
        db,
        admin_id=admin.id,
        action=AdminAction.UPDATE,
        target_table="subscribers",
        target_id=subscriber.id,
        details={"status": payload.status, "reason": payload.reason},
    )
    db.commit()
    return {"message": "Statut mis à jour", "status": subscriber.status.value}


@router.get("/{subscriber_id}/sends", response_model=list[EmailDigestRead])
async def get_subscriber_sends(subscriber_id: str, db: Session = Depends(get_db), limit: int = Query(20, ge=1, le=100)):
    """Historique des envois (digests quotidiens + envois personnalisés) pour un abonné."""
    _require_subscriber(db, subscriber_id)
    stmt = (
        select(EmailDigest)
        .where(EmailDigest.subscriber_id == subscriber_id)
        .order_by(EmailDigest.sent_at.desc().nullslast(), EmailDigest.created_at.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt))


@router.post("/{subscriber_id}/send", response_model=EmailDigestRead, status_code=201)
async def send_custom_email(
    subscriber_id: str,
    payload: CustomSendCreate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Envoi personnalisé d'offres sélectionnées à un abonné (mise en file, cf. module d'envoi)."""
    subscriber = _require_subscriber(db, subscriber_id)

    offers = list(db.scalars(select(JobOffer).where(JobOffer.id.in_(payload.offer_ids))))
    found_ids = {offer.id for offer in offers}
    missing = [offer_id for offer_id in payload.offer_ids if offer_id not in found_ids]
    if missing:
        raise HTTPException(status_code=400, detail=f"Offres introuvables: {', '.join(missing)}")

    now = datetime.now(timezone.utc)
    digest = EmailDigest(
        subscriber_id=subscriber.id,
        digest_date=now.date(),
        scheduled_for=now,
        status=DigestStatus.QUEUED,
        subject=payload.subject or "Sélection personnalisée JobAlert CI",
        offer_count=len(offers),
        template_version="manual",
    )
    for position, offer in enumerate(offers, start=1):
        digest.offer_links.append(EmailDigestOffer(offer_id=offer.id, position=position))

    db.add(digest)
    db.flush()

    log_admin_action(
        db,
        admin_id=admin.id,
        action=AdminAction.SEND,
        target_table="email_digests",
        target_id=digest.id,
        details={"subscriber_id": subscriber.id, "offer_ids": payload.offer_ids},
    )
    db.commit()
    db.refresh(digest)
    return digest


@router.delete("/{subscriber_id}", status_code=204)
async def delete_subscriber(
    subscriber_id: str,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Suppression RGPD (anonymisation, pas de suppression physique pour garder l'historique cohérent)."""
    subscriber = _require_subscriber(db, subscriber_id)

    subscriber.email = f"deleted_{subscriber.id}@anonymized.local"
    subscriber.email_normalized = f"deleted_{subscriber.id}@anonymized.local"
    subscriber.full_name = "Utilisateur anonymisé"
    subscriber.city = None
    subscriber.admin_notes = None
    subscriber.status = SubscriberStatus.DELETED
    subscriber.deleted_at = datetime.now(timezone.utc)

    log_admin_action(db, admin_id=admin.id, action=AdminAction.DELETE, target_table="subscribers", target_id=subscriber.id)
    db.commit()