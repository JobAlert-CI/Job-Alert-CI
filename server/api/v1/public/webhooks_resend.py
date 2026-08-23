from __future__ import annotations

import base64
import hashlib
import hmac
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.deps import get_db
from core.config import get_settings
from models import (
    Subscriber,
    SubscriberStatus,
    TransactionalEmailEvent,
    TransactionalEmailStatus,
)

"""Webhook Resend (optionnel mais recommande).

Resend signe ses webhooks a la maniere de Svix: `svix-id`, `svix-timestamp` et
`svix-signature` (`v1,<base64>`), la signature portant sur
`{id}.{timestamp}.{body}` avec le secret `whsec_...` decode en base64.

Regles:
- si `RESEND_WEBHOOK_SECRET` n'est pas configure, le webhook renvoie 503
  (jamais d'acceptation aveugle d'evenements non signes);
- comparaison en temps constant (`hmac.compare_digest`);
- idempotent: un evenement deja applique ne change plus rien;
- aucune donnee sensible dans la reponse (toujours `{"received": true}`).
"""

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

BOUNCE_EVENTS = {"email.bounced", "email.complained"}
DELIVERED_EVENTS = {"email.delivered", "email.sent"}


def _verify_signature(secret: str, *, svix_id: str, svix_timestamp: str, signature_header: str, body: bytes) -> bool:
    key = secret.removeprefix("whsec_")
    try:
        secret_bytes = base64.b64decode(key)
    except Exception:
        secret_bytes = key.encode("utf-8")

    signed_payload = f"{svix_id}.{svix_timestamp}.".encode("utf-8") + body
    expected = base64.b64encode(hmac.new(secret_bytes, signed_payload, hashlib.sha256).digest()).decode("utf-8")

    for part in signature_header.split():
        _, _, value = part.partition(",")
        if value and hmac.compare_digest(value, expected):
            return True
    return False


@router.post("/resend", status_code=status.HTTP_200_OK)
async def resend_webhook(request: Request, db: Session = Depends(get_db)) -> dict[str, bool]:
    settings = get_settings()
    if not settings.resend_webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook Resend non configuré")

    body = await request.body()
    svix_id = request.headers.get("svix-id") or request.headers.get("webhook-id") or ""
    svix_timestamp = request.headers.get("svix-timestamp") or request.headers.get("webhook-timestamp") or ""
    signature_header = request.headers.get("svix-signature") or request.headers.get("webhook-signature") or ""

    if not signature_header or not _verify_signature(
        settings.resend_webhook_secret,
        svix_id=svix_id,
        svix_timestamp=svix_timestamp,
        signature_header=signature_header,
        body=body,
    ):
        raise HTTPException(status_code=401, detail="Signature invalide")

    try:
        payload: dict[str, Any] = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Payload JSON invalide") from exc

    event_type = str(payload.get("type") or "")
    data = payload.get("data") or {}
    provider_email_id = data.get("email_id") or data.get("id")
    if not provider_email_id:
        return {"received": True}

    event = db.scalar(
        select(TransactionalEmailEvent).where(TransactionalEmailEvent.provider_email_id == str(provider_email_id))
    )
    if event is None:
        logger.info("Webhook Resend: evenement %s inconnu en base, ignore", event_type)
        return {"received": True}

    if event_type in DELIVERED_EVENTS:
        event.status = TransactionalEmailStatus.SENT
    elif event_type in BOUNCE_EVENTS:
        # Idempotence: on ne recompte pas un bounce deja enregistre.
        already_failed = event.status == TransactionalEmailStatus.FAILED
        event.status = TransactionalEmailStatus.FAILED
        event.last_error = f"Resend: {event_type}"
        if not already_failed and event.subscriber_id:
            subscriber = db.scalar(select(Subscriber).where(Subscriber.id == event.subscriber_id))
            if subscriber is not None:
                subscriber.bounce_count = (subscriber.bounce_count or 0) + 1
                if subscriber.bounce_count >= settings.email_bounce_threshold:
                    subscriber.status = SubscriberStatus.BOUNCED

    db.commit()
    return {"received": True}
