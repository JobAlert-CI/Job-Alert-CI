"""Service metier : reinitialisation du mot de passe admin (audit 2, N2-N6).

Corrige les flaws du flux historique:
- le token est stocke **hashe** (SHA-256) dans `request_payload`, jamais en clair
  (convention du projet, cf. SubscriberToken) ;
- usage unique: un token consomme ne peut plus reset (champ `used` + statut) ;
- TTL: un token expire apres `admin_reset_token_ttl_minutes` (60 min) ;
- l'envoi passe par `provider.send(EmailMessage)` (le protocole reel),
  plus de methode `send_simple` inexistante ;
- le message est neutre pour ne pas reveler l'existence d'un compte.

Ce service ne connait pas FastAPI: la route traduit les exceptions.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from models import TransactionalEmailEvent, TransactionalEmailPurpose, TransactionalEmailStatus
from services.email.email_provider import EmailMessage, EmailProviderProtocol
from services.normalization import token_hash

logger = logging.getLogger(__name__)

RESET_TOKEN_TTL_MINUTES = 60
_RESET_SUBJECT = "Reinitialisation du mot de passe JobAlert CI"


class AdminResetPasswordError(Exception):
    """Erreur metier portant le code HTTP a renvoyer par la route."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(slots=True)
class AdminResetRequest:
    """Resultat de `request_password_reset` (toujours "succes" cote reponse)."""

    token: str | None  # brut, uniquement en memoire pour l'email
    event_id: str | None


def _match_payload_hash(event: TransactionalEmailEvent) -> bool:
    payload = event.request_payload or {}
    return isinstance(payload, dict) and payload.get("reset_token_hash") is not None


def request_password_reset(
    db: Session,
    *,
    email: str,
    provider: EmailProviderProtocol,
) -> AdminResetRequest:
    """Genere un token, le journalise (hashe) et envoie l'email.

    Ne leve jamais d'erreur visible cote client quand l'email est inconnu
    (anti-enumeration): la reponse de la route reste identique.
    """
    # Import tardif pour eviter un cycle au chargement du module.
    from models.admin import Administrator

    admin = db.scalar(select(Administrator).where(Administrator.email == email.strip().lower()))
    if admin is None:
        # Anti-enumeration: on ne distingue pas ce cas dans la reponse HTTP.
        logger.info("Demande de reset pour email inconnu (silence)")
        return AdminResetRequest(token=None, event_id=None)

    from secrets import token_urlsafe

    raw_token = token_urlsafe(32)
    now = datetime.now(UTC)
    event = TransactionalEmailEvent(
        purpose=TransactionalEmailPurpose.RESET_PASSWORD,
        to_email=admin.email,
        status=TransactionalEmailStatus.QUEUED,
        request_payload={
            # Jamais le token brut: seulement son SHA-256 (convention projet).
            "reset_token_hash": token_hash(raw_token),
            "expires_at": (now + timedelta(minutes=RESET_TOKEN_TTL_MINUTES)).isoformat(),
        },
    )
    db.add(event)
    db.commit()

    email_message = EmailMessage(
        to_email=admin.email,
        subject=_RESET_SUBJECT,
        text=f"Votre code de reinitialisation (valide {RESET_TOKEN_TTL_MINUTES} min) : {raw_token}",
        # Pas de HTML riche pour ce message a usage unique: texte sec, sans
        # interpretation possible du token.
        html=(
            "<p>Vous avez demande la reinitialisation de votre mot de passe.</p>"
            f"<p><code>{raw_token}</code></p>"
            f"<p>Ce code expire dans {RESET_TOKEN_TTL_MINUTES} minutes. "
            "Si vous n'etes pas a l'origine de cette demande, ignorez ce message.</p>"
        ),
    )
    result = provider.send(email_message)
    if result.success:
        event.status = TransactionalEmailStatus.SENT
        event.provider_email_id = result.provider_email_id
    else:
        event.status = TransactionalEmailStatus.FAILED
        event.last_error = result.error_message
    db.commit()

    return AdminResetRequest(token=raw_token, event_id=event.id)


def consume_reset_token(
    db: Session,
    *,
    raw_token: str,
    new_password_hash: str,
) -> None:
    """Valide le token (hash, TTL, usage unique) et applique le nouveau hash.

    Leve `AdminResetPasswordError` si le token est inconnu, expire ou deja
    consomme. L'appelant fournit deja le `new_password_hash` (bcrypt) pour
    que ce service reste agnostique du hachage.
    """
    # Import tardif pour eviter un cycle au chargement du module.
    from models.admin import Administrator

    hashed = token_hash(raw_token)
    now = datetime.now(UTC)
    candidate = None
    events = db.scalars(
        select(TransactionalEmailEvent)
        .where(
            TransactionalEmailEvent.purpose == TransactionalEmailPurpose.RESET_PASSWORD,
            TransactionalEmailEvent.status.in_(
                [TransactionalEmailStatus.QUEUED, TransactionalEmailStatus.SENT]
            ),
        )
        .order_by(TransactionalEmailEvent.created_at.desc())
        .limit(200)
    ).all()
    for ev in events:
        payload = ev.request_payload or {}
        if not isinstance(payload, dict):
            continue
        if payload.get("reset_token_hash") != hashed:
            continue
        # Le token est consomme des qu'un nouveau mdp a ete applique.
        if payload.get("used") is True:
            raise AdminResetPasswordError("Token deja utilise", status_code=400)
        expires_raw = payload.get("expires_at")
        if expires_raw:
            try:
                expires_at = datetime.fromisoformat(expires_raw)
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=UTC)
                if expires_at <= now:
                    raise AdminResetPasswordError("Token expire", status_code=400)
            except ValueError:
                pass  # format inattendu: on laisse passer (legacy)
        candidate = ev
        break

    if candidate is None:
        raise AdminResetPasswordError("Token invalide ou expire", status_code=400)

    admin = db.scalar(select(Administrator).where(Administrator.email == candidate.to_email))
    if admin is None:
        raise AdminResetPasswordError("Compte administrateur introuvable", status_code=404)

    admin.password_hash = new_password_hash

    # Usage unique: on marque le token consomme dans le payload.
    payload = dict(candidate.request_payload or {})
    payload["used"] = True
    payload["used_at"] = now.isoformat()
    candidate.request_payload = payload
    candidate.status = TransactionalEmailStatus.SENT
    db.commit()
    logger.info(
        "Mot de passe admin reinitialise via token",
        extra={"event_id": candidate.id, "admin_email": candidate.to_email},
    )


__all__ = [
    "RESET_TOKEN_TTL_MINUTES",
    "AdminResetPasswordError",
    "AdminResetRequest",
    "consume_reset_token",
    "request_password_reset",
]
