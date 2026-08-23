from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from api.deps import get_db
from models import ContractType, Filiere, Subscriber, SubscriberContractPreference, SubscriberFiliere, SubscriberStatus, SubscriberToken, TokenPurpose, UnsubscribeEvent
from schemas.subscriptions import (
    EmailConfirmationResult,
    ResendConfirmationCreate,
    ResendConfirmationResponse,
    SubscriberCreate,
    SubscriberPreferencesUpdate,
    SubscriberRead,
    SubscriptionCreateResponse,
)
from services.email_confirmation_service import (
    EmailConfirmationError,
    MESSAGE_ALREADY_CONFIRMED,
    MESSAGE_CONFIRMED,
    ResendRateLimitedError,
    confirm_email,
    dispatch_confirmation_email,
    register_subscriber,
    resend_confirmation,
)
from services.normalization import token_hash

router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])


def _get_subscriber_by_token(db: Session, raw_token: str, purpose: TokenPurpose) -> tuple[SubscriberToken, Subscriber]:
    """Valide un token et retourne (token_obj, subscriber). Lève 404 si invalide."""
    hashed = token_hash(raw_token)
    token = db.scalar(
        select(SubscriberToken).where(
            SubscriberToken.token_hash == hashed,
            SubscriberToken.purpose == purpose,
            SubscriberToken.revoked_at.is_(None),
        )
    )
    if token is None:
        raise HTTPException(status_code=404, detail="Lien invalide ou expiré")
    subscriber = db.scalar(select(Subscriber).where(Subscriber.id == token.subscriber_id, Subscriber.deleted_at.is_(None)))
    if subscriber is None:
        raise HTTPException(status_code=404, detail="Abonné introuvable")
    return token, subscriber


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post("", response_model=SubscriptionCreateResponse, status_code=status.HTTP_201_CREATED)
def subscribe(payload: SubscriberCreate, db: Session = Depends(get_db)):
    """Inscription email + 1 à 3 filières + préférences optionnelles.

    Si `EMAIL_CONFIRMATION_REQUIRED=true`, l'abonné est créé en `pending` et un
    email de confirmation est mis en file d'envoi (Celery, non bloquant).
    La réponse reste un sur-ensemble de `SubscriberRead` (aucune rupture).
    """
    try:
        registration = register_subscriber(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except EmailConfirmationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Cet email est déjà inscrit")

    # Publication après commit: le worker doit retrouver token et événement en base.
    if registration.pending is not None:
        dispatch_confirmation_email(registration.pending)

    response = SubscriptionCreateResponse.model_validate(registration.subscriber)
    return response.model_copy(
        update={
            "requires_confirmation": registration.requires_confirmation,
            "confirmation_message": registration.message,
        }
    )


@router.get("/confirm/{token}", response_model=EmailConfirmationResult)
def confirm_subscription(token: str, db: Session = Depends(get_db)):
    """Confirmation d'inscription (lien dans l'email).

    Idempotent si l'abonné est déjà confirmé. 410 si le lien a expiré.
    """
    try:
        outcome = confirm_email(db, token)
    except EmailConfirmationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    message = MESSAGE_ALREADY_CONFIRMED if outcome.already_confirmed else MESSAGE_CONFIRMED
    return EmailConfirmationResult(message=message, email=outcome.email)


@router.post("/resend-confirmation", response_model=ResendConfirmationResponse)
def resend_confirmation_email(
    payload: ResendConfirmationCreate,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Renvoi de l'email de confirmation (réponse générique, anti-énumération)."""
    try:
        outcome = resend_confirmation(db, str(payload.email), client_ip=_client_ip(request))
    except ResendRateLimitedError as exc:
        headers = {"Retry-After": str(exc.retry_after_seconds)} if exc.retry_after_seconds else None
        raise HTTPException(status_code=exc.status_code, detail=exc.detail, headers=headers) from exc
    except EmailConfirmationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    if outcome.pending is not None:
        dispatch_confirmation_email(outcome.pending)

    return ResendConfirmationResponse(message=outcome.message, email=outcome.email)


@router.post("/unsubscribe/{token}")
def unsubscribe(token: str, reason: str | None = None, db: Session = Depends(get_db)):
    """Désinscription en 1 clic (lien unique dans chaque email)."""
    token_obj, subscriber = _get_subscriber_by_token(db, token, TokenPurpose.MANAGE_ALERT)
    now = datetime.now(timezone.utc)
    subscriber.status = SubscriberStatus.UNSUBSCRIBED
    subscriber.unsubscribed_at = now
    subscriber.unsubscribe_reason = reason
    db.add(UnsubscribeEvent(subscriber_id=subscriber.id, reason=reason, source="email_link"))
    db.commit()
    return {"message": "Désinscription enregistrée"}


@router.get("/preferences/{token}", response_model=SubscriberRead)
def get_preferences(token: str, db: Session = Depends(get_db)):
    """Récupère les préférences via le token (pour page de gestion future)."""
    _, subscriber = _get_subscriber_by_token(db, token, TokenPurpose.MANAGE_ALERT)
    return subscriber


@router.put("/preferences/{token}", response_model=SubscriberRead)
def update_preferences(token: str, payload: SubscriberPreferencesUpdate, db: Session = Depends(get_db)):
    """Modifie les filières / contrats choisis."""
    _, subscriber = _get_subscriber_by_token(db, token, TokenPurpose.MANAGE_ALERT)

    # Mettre à jour les filières
    subscriber.filiere_links.clear()
    subscriber.contract_preferences.clear()
    # Flush des suppressions avant les insertions (contraintes d'unicite).
    db.flush()

    unique_filieres = list(dict.fromkeys(payload.filieres))[:3]
    for index, code in enumerate(unique_filieres, start=1):
        filiere = db.scalar(select(Filiere).where((Filiere.code == code) | (Filiere.slug == code)))
        if filiere is None:
            raise HTTPException(status_code=400, detail=f"Filière inconnue: {code}")
        subscriber.filiere_links.append(SubscriberFiliere(filiere_id=filiere.id, priority=index))

    # Mettre à jour les contrats
    for ct_code in dict.fromkeys(payload.contract_types):
        ct = db.scalar(select(ContractType).where(ContractType.code == ct_code))
        if ct is not None:
            subscriber.contract_preferences.append(SubscriberContractPreference(contract_type_id=ct.id))

    subscriber.wants_career_tips = payload.wants_career_tips
    db.commit()
    db.refresh(subscriber)
    return subscriber
