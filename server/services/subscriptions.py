from __future__ import annotations

from datetime import datetime, timezone
from secrets import token_urlsafe

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import get_settings
from models import (
    ContractType,
    ExperienceLevel,
    Filiere,
    Subscriber,
    SubscriberContractPreference,
    SubscriberFiliere,
    SubscriberStatus,
    SubscriberToken,
    TokenPurpose,
)
from schemas.subscriptions import SubscriberCreate
from services.normalization import normalize_text, token_hash


def _lookup_by_code_or_label(db: Session, model, value: str | None):
    if not value:
        return None
    normalized = normalize_text(value)
    stmt = select(model).where(
        (model.code == value) | (model.label == value) | (model.code == normalized)
    )
    return db.scalar(stmt)


def create_subscriber(db: Session, payload: SubscriberCreate) -> Subscriber:
    """Cree ou remet a jour un abonne.

    Les emails sont dedoublonnes en minuscule. Les preferences sont remplacees
    a chaque inscription pour que le formulaire puisse servir aussi de mise a
    jour simple.
    """

    settings = get_settings()
    email_normalized = payload.email.strip().lower()
    now = datetime.now(timezone.utc)
    subscriber = db.scalar(select(Subscriber).where(Subscriber.email_normalized == email_normalized))

    is_new_subscriber = subscriber is None

    if subscriber is None:
        subscriber = Subscriber(
            email=payload.email.strip(),
            email_normalized=email_normalized,
            subscribed_at=now,
            status=SubscriberStatus.ACTIVE,
        )
        db.add(subscriber)
    elif subscriber.deleted_at is not None:
        subscriber.deleted_at = None

    subscriber.full_name = payload.full_name.strip() if payload.full_name else None
    subscriber.city = payload.city.strip() if payload.city else None
    subscriber.timezone = settings.timezone
    subscriber.wants_career_tips = payload.wants_career_tips
    subscriber.source = payload.source
    subscriber.status = SubscriberStatus.ACTIVE
    subscriber.unsubscribed_at = None
    subscriber.unsubscribe_reason = None

    experience = _lookup_by_code_or_label(db, ExperienceLevel, payload.experience)
    subscriber.experience_level_id = experience.id if experience else None

    subscriber.filiere_links.clear()
    unique_filieres = list(dict.fromkeys(payload.filieres))[:3]
    if not unique_filieres:
        raise ValueError("Selectionnez au moins une filiere")

    for index, filiere_code in enumerate(unique_filieres, start=1):
        filiere = _lookup_by_code_or_label(db, Filiere, filiere_code)
        if filiere is None:
            raise ValueError(f"Filiere inconnue: {filiere_code}")
        subscriber.filiere_links.append(SubscriberFiliere(filiere_id=filiere.id, priority=index))

    subscriber.contract_preferences.clear()
    for contract_value in dict.fromkeys(payload.contract_types):
        contract_type = _lookup_by_code_or_label(db, ContractType, contract_value)
        if contract_type is not None:
            subscriber.contract_preferences.append(SubscriberContractPreference(contract_type_id=contract_type.id))

    # Un token est cree par usage (gestion des preferences / confirmation),
    # seulement s'il n'en existe pas deja un actif pour ce couple abonne+purpose.
    existing_purposes = {
        token.purpose for token in subscriber.tokens if token.revoked_at is None
    }
    if TokenPurpose.MANAGE_ALERT not in existing_purposes:
        subscriber.tokens.append(
            SubscriberToken(
                purpose=TokenPurpose.MANAGE_ALERT,
                token_hash=token_hash(token_urlsafe(32)),
            )
        )
    if is_new_subscriber and TokenPurpose.CONFIRM_EMAIL not in existing_purposes:
        subscriber.tokens.append(
            SubscriberToken(
                purpose=TokenPurpose.CONFIRM_EMAIL,
                token_hash=token_hash(token_urlsafe(32)),
            )
        )

    db.commit()
    db.refresh(subscriber)
    return subscriber
