from __future__ import annotations

import hashlib

from sqlalchemy.orm import Session

from models import ContactMessage, ContactMessageStatus
from schemas.content import ContactMessageCreate

SUBJECT_LABELS = {
    "service": "Question sur le service",
    "alerte": "Probleme avec mon alerte",
    "source": "Proposer une source",
    "partenariat": "Partenariat / presse",
    "autre": "Autre chose",
}


def _hash_optional(value: str | None) -> str | None:
    if not value:
        return None
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def create_contact_message(
    db: Session,
    payload: ContactMessageCreate,
    *,
    client_ip: str | None = None,
    user_agent: str | None = None,
) -> ContactMessage:
    """Enregistre un message de contact avec quelques traces non sensibles.

    Audit 4, I.1 : le service ne depend plus de FastAPI — la route extrait
    l'IP et le user-agent et passe des valeurs simples. Le service devient
    testable sans app et reutilisable depuis une task.
    """

    subject_label = payload.subject_label or SUBJECT_LABELS.get(payload.subject_code, payload.subject_code)
    message = ContactMessage(
        full_name=payload.full_name.strip(),
        email=payload.email.strip().lower(),
        subject_code=payload.subject_code.strip(),
        subject_label=subject_label,
        message=payload.message.strip(),
        status=ContactMessageStatus.NEW,
        ip_hash=_hash_optional(client_ip),
        user_agent=user_agent,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message
