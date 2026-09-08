from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
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
from services.site_settings_service import resolve_runtime_settings


@dataclass(slots=True)
class CreatedToken:
    """Valeur brute d'un token emis (pour permettre a l'appelant de
    construire l'URL /preferences/{token})."""

    purpose: TokenPurpose
    raw_token: str


def _lookup_by_code_or_label(db: Session, model, value: str | None):
    if not value:
        return None
    normalized = normalize_text(value)
    stmt = select(model).where(
        (model.code == value) | (model.label == value) | (model.code == normalized)
    )
    return db.scalar(stmt)


def replace_subscriber_filieres(
    db: Session,
    *,
    subscriber: Subscriber,
    filiere_ids_with_priority: list[tuple[str, int]],
) -> None:
    """Remplace les filieres d'un abonne SANS violer les contraintes UNIQUE.

    Bug connu (cahier des charges): clear() + append() dans le meme flush fait
    partir les INSERT avant les DELETE et viole uq(subscriber_id, priority) /
    uq(subscriber_id, filiere_id). Strategie sure:
    1. suppression EXPLICITE des lignes (pas via la collection) ;
    2. flush pour envoyer les DELETE ;
    3. expiration de la collection pour eviter toute ligne fantome en memoire ;
    4. insertion des nouvelles lignes ;
    5. flush final.
    """

    if not 1 <= len(filiere_ids_with_priority) <= 3:
        raise ValueError("Selectionnez entre 1 et 3 filieres")
    priorities = [priority for _filiere_id, priority in filiere_ids_with_priority]
    if len(set(priorities)) != len(priorities) or any(priority not in (1, 2, 3) for priority in priorities):
        raise ValueError("Les priorites de filieres doivent etre uniques et comprises entre 1 et 3")

    # 1-2. Suppression explicite + flush: les DELETE partent en premier.
    db.query(SubscriberFiliere).filter(SubscriberFiliere.subscriber_id == subscriber.id).delete(
        synchronize_session=False
    )
    db.flush()

    # 3. La collection ORM ne doit plus reference les lignes supprimees.
    db.expire(subscriber, ["filiere_links"])

    # 4. Insertion des nouvelles lignes.
    for filiere_id, priority in filiere_ids_with_priority:
        db.add(SubscriberFiliere(subscriber_id=subscriber.id, filiere_id=filiere_id, priority=priority))

    # 5. Flush: les INSERT partent APRES les DELETE, contraintes respectees.
    db.flush()


def replace_subscriber_contract_preferences(
    db: Session,
    *,
    subscriber: Subscriber,
    contract_type_ids: list[str],
) -> None:
    """Meme logique que replace_subscriber_filieres pour les contrats."""

    unique_contract_type_ids = list(dict.fromkeys(contract_type_ids))

    db.query(SubscriberContractPreference).filter(
        SubscriberContractPreference.subscriber_id == subscriber.id
    ).delete(synchronize_session=False)
    db.flush()
    db.expire(subscriber, ["contract_preferences"])
    for contract_type_id in unique_contract_type_ids:
        db.add(SubscriberContractPreference(subscriber_id=subscriber.id, contract_type_id=contract_type_id))
    db.flush()


def create_subscriber(
    db: Session,
    payload: SubscriberCreate,
    *,
    confirmation_required: bool | None = None,
) -> tuple[Subscriber, CreatedToken | None]:
    """Cree ou remet a jour un abonne.

    Renvoie `(subscriber, manage_alert_token)` : la valeur brute du token
    MANAGE_ALERT est exposee a l'appelant pour qu'il puisse construire
    l'URL /preferences/{token} (audit P1 #21).
    """
    # Cycle 18 : les parametres admin (site_settings) previennent sur
    # l'environnement — sans ce branchement, modifier la valeur dans
    # /admin/parametres ne changeait RIEN au comportement.
    settings = resolve_runtime_settings(db)
    if confirmation_required is None:
        confirmation_required = settings.email_confirmation_required

    email_normalized = payload.email.strip().lower()
    now = datetime.now(UTC)
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

    unique_filieres = list(dict.fromkeys(payload.filieres))[:3]
    if not unique_filieres:
        raise ValueError("Selectionnez au moins une filiere")

    filiere_ids_with_priority: list[tuple[str, int]] = []
    for index, filiere_code in enumerate(unique_filieres, start=1):
        filiere = _lookup_by_code_or_label(db, Filiere, filiere_code)
        if filiere is None:
            raise ValueError(f"Filiere inconnue: {filiere_code}")
        filiere_ids_with_priority.append((filiere.id, index))

    replace_subscriber_filieres(db, subscriber=subscriber, filiere_ids_with_priority=filiere_ids_with_priority)

    contract_type_ids: list[str] = []
    for contract_value in dict.fromkeys(payload.contract_types):
        contract_type = _lookup_by_code_or_label(db, ContractType, contract_value)
        if contract_type is not None:
            contract_type_ids.append(contract_type.id)
    replace_subscriber_contract_preferences(db, subscriber=subscriber, contract_type_ids=contract_type_ids)

    # Audit P1 #21: token MANAGE_ALERT, valeur brute retournee a l'appelant.
    existing_purposes = {token.purpose for token in subscriber.tokens if token.revoked_at is None}
    manage_alert_raw: str | None = None
    if TokenPurpose.MANAGE_ALERT not in existing_purposes:
        manage_alert_raw = token_urlsafe(32)
        subscriber.tokens.append(
            SubscriberToken(
                purpose=TokenPurpose.MANAGE_ALERT,
                token_hash=token_hash(manage_alert_raw),
            )
        )

    db.commit()
    db.refresh(subscriber)

    manage_alert_token = (
        CreatedToken(purpose=TokenPurpose.MANAGE_ALERT, raw_token=manage_alert_raw)
        if manage_alert_raw
        else None
    )
    return subscriber, manage_alert_token
