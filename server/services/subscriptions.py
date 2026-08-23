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


def create_subscriber(
    db: Session,
    payload: SubscriberCreate,
    *,
    confirmation_required: bool | None = None,
) -> Subscriber:
    """Cree ou remet a jour un abonne.

    Les emails sont dedoublonnes en minuscule. Les preferences sont remplacees
    a chaque inscription pour que le formulaire puisse servir aussi de mise a
    jour simple.

    `confirmation_required` (defaut: `EMAIL_CONFIRMATION_REQUIRED`) pilote le
    statut final:
    - `True`  -> l'abonne reste/passe `pending`, `confirmed_at` reste null et
      l'appelant doit emettre un token + envoyer l'email
      (cf. services/email_confirmation_service.py);
    - `False` -> l'abonne est directement `active` avec `confirmed_at = now`
      (mode pratique en dev/test).

    Le token `confirm_email` n'est plus emis ici: sa valeur brute doit etre
    retournee a l'appelant pour construire le lien de l'email, ce que fait
    `services.token_service.issue_confirmation_token`.
    """

    settings = get_settings()
    if confirmation_required is None:
        confirmation_required = settings.email_confirmation_required

    email_normalized = payload.email.strip().lower()
    now = datetime.now(timezone.utc)
    subscriber = db.scalar(select(Subscriber).where(Subscriber.email_normalized == email_normalized))

    if subscriber is None:
        subscriber = Subscriber(
            email=payload.email.strip(),
            email_normalized=email_normalized,
            subscribed_at=now,
            status=SubscriberStatus.PENDING if confirmation_required else SubscriberStatus.ACTIVE,
        )
        db.add(subscriber)
    elif subscriber.deleted_at is not None:
        # Soft delete annule: on repart comme pour un nouvel email.
        subscriber.deleted_at = None
        subscriber.confirmed_at = None

    subscriber.full_name = payload.full_name.strip() if payload.full_name else None
    subscriber.city = payload.city.strip() if payload.city else None
    subscriber.timezone = settings.timezone
    subscriber.wants_career_tips = payload.wants_career_tips
    subscriber.source = payload.source
    subscriber.unsubscribed_at = None
    subscriber.unsubscribe_reason = None

    if confirmation_required:
        if subscriber.confirmed_at is None:
            subscriber.status = SubscriberStatus.PENDING
    else:
        subscriber.status = SubscriberStatus.ACTIVE
        if subscriber.confirmed_at is None:
            subscriber.confirmed_at = now

    experience = _lookup_by_code_or_label(db, ExperienceLevel, payload.experience)
    subscriber.experience_level_id = experience.id if experience else None

    subscriber.filiere_links.clear()
    subscriber.contract_preferences.clear()
    # Les suppressions doivent partir en base AVANT les nouvelles lignes, sinon
    # SQLAlchemy insere d'abord et viole uq(subscriber_id, priority).
    db.flush()

    unique_filieres = list(dict.fromkeys(payload.filieres))[:3]
    if not unique_filieres:
        raise ValueError("Selectionnez au moins une filiere")

    for index, filiere_code in enumerate(unique_filieres, start=1):
        filiere = _lookup_by_code_or_label(db, Filiere, filiere_code)
        if filiere is None:
            raise ValueError(f"Filiere inconnue: {filiere_code}")
        subscriber.filiere_links.append(SubscriberFiliere(filiere_id=filiere.id, priority=index))

    for contract_value in dict.fromkeys(payload.contract_types):
        contract_type = _lookup_by_code_or_label(db, ContractType, contract_value)
        if contract_type is not None:
            subscriber.contract_preferences.append(SubscriberContractPreference(contract_type_id=contract_type.id))

    # Token de gestion des preferences: un seul actif par abonne.
    existing_purposes = {token.purpose for token in subscriber.tokens if token.revoked_at is None}
    if TokenPurpose.MANAGE_ALERT not in existing_purposes:
        subscriber.tokens.append(
            SubscriberToken(
                purpose=TokenPurpose.MANAGE_ALERT,
                token_hash=token_hash(token_urlsafe(32)),
            )
        )

    db.commit()
    db.refresh(subscriber)
    return subscriber
