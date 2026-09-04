from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi import status as http_status
from sqlalchemy.orm import Session

from api.deps import get_db
from services.contact import create_contact_message
from services.rate_limit import check_ip_rate_limit

router = APIRouter(prefix="/api/contact", tags=["contact"])


# Re-export du schema depuis schemas/contact pour eviter les defs en doublon.
from schemas.content import ContactMessageCreate


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post("", status_code=http_status.HTTP_201_CREATED)
def create_contact(
    payload: ContactMessageCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """Soumettre un message de contact.

    Rate-limit par IP (3 messages/minute, cooldown 30s) pour eviter le spam,
    cf. audit S6.
    """
    client_ip = _client_ip(request) or "unknown"
    decision = check_ip_rate_limit(
        scope="contact",
        client_ip=client_ip,
        limit_per_minute=3,
        cooldown_seconds=30,
    )
    if not decision.allowed:
        raise HTTPException(
            status_code=429,
            detail="Trop de messages envoyes. Merci de patienter.",
            headers={"Retry-After": str(decision.retry_after_seconds or 60)},
        )
    return create_contact_message(db, payload, request)
