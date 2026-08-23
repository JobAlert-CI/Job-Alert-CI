from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import get_settings
from models import Subscriber, SubscriberToken, TokenPurpose
from services.normalization import token_hash as hash_token

"""Generation, hachage et validation des tokens a usage unique (subscriber_tokens).

Regles (cahier des charges "Generation et stockage du token de confirmation"):
- le token brut est genere avec `secrets.token_urlsafe`, jamais stocke en
  clair: seul `hash_token(token)` (SHA-256, reutilise de
  `services.normalization` pour rester coherent avec les tokens
  MANAGE_ALERT deja emis) va dans `SubscriberToken.token_hash`;
- chaque token a une duree de validite configurable (`expires_at`);
- generer un nouveau token de confirmation revoque les anciens tokens
  `confirm_email` non utilises (`revoked_at = now`), sans les supprimer;
- ce module ne fait aucun `db.commit()`: l'appelant (route/service) reste
  maitre de sa transaction, comme le reste du projet (cf. services/audit.py).
"""

TOKEN_ENTROPY_BYTES = 32


class TokenValidationError(Exception):
    """Erreur de base: un token de confirmation n'est pas valide."""


class TokenNotFoundError(TokenValidationError):
    """Aucun `SubscriberToken` ne correspond au hash fourni pour ce purpose."""


class TokenRevokedError(TokenValidationError):
    """Le token existe mais a ete revoque (remplace par un token plus recent)."""

    def __init__(self, token: SubscriberToken) -> None:
        self.token = token
        super().__init__("Token revoque")


class TokenExpiredError(TokenValidationError):
    """Le token existe mais sa duree de validite est depassee."""

    def __init__(self, token: SubscriberToken) -> None:
        self.token = token
        super().__init__("Token expire")


class TokenAlreadyUsedError(TokenValidationError):
    """Le token a deja ete consomme.

    Le `token` reste accessible sur l'exception pour permettre a l'appelant
    de verifier le statut courant de l'abonne et repondre de maniere
    idempotente s'il est deja actif (cf. cahier des charges).
    """

    def __init__(self, token: SubscriberToken) -> None:
        self.token = token
        super().__init__("Token deja utilise")


def _as_aware(value: datetime | None) -> datetime | None:
    """Ramene une date lue en base a un datetime aware (UTC).

    SQLite (tests, dev) restitue des datetimes naives la ou PostgreSQL renvoie
    des `timestamptz`: sans cette normalisation la comparaison d'expiration
    leve `TypeError` selon le moteur.
    """

    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=timezone.utc)


def generate_raw_token() -> str:
    """Genere un token URL-safe cryptographiquement sur (256 bits d'entropie)."""

    return secrets.token_urlsafe(TOKEN_ENTROPY_BYTES)


def revoke_active_tokens(
    db: Session,
    *,
    subscriber_id: str,
    purpose: TokenPurpose,
    now: datetime | None = None,
) -> int:
    """Revoque (sans supprimer) les tokens non utilises et non revoques.

    Retourne le nombre de tokens revoques.
    """

    effective_now = now or datetime.now(timezone.utc)
    tokens = db.scalars(
        select(SubscriberToken).where(
            SubscriberToken.subscriber_id == subscriber_id,
            SubscriberToken.purpose == purpose,
            SubscriberToken.used_at.is_(None),
            SubscriberToken.revoked_at.is_(None),
        )
    ).all()
    for token in tokens:
        token.revoked_at = effective_now
    return len(tokens)


def issue_token(
    db: Session,
    *,
    subscriber: Subscriber,
    purpose: TokenPurpose,
    ttl_hours: int | None = None,
    revoke_existing: bool = True,
) -> tuple[SubscriberToken, str]:
    """Cree un nouveau token a usage unique pour un abonne.

    Retourne `(token_orm, raw_token)`: `raw_token` est la seule occasion de
    recuperer la valeur en clair (a inserer dans l'URL de l'email) — elle
    n'est jamais relisible ensuite depuis la base.
    """

    settings = get_settings()
    resolved_ttl = ttl_hours if ttl_hours is not None else settings.confirm_email_token_ttl_hours

    if revoke_existing:
        revoke_active_tokens(db, subscriber_id=subscriber.id, purpose=purpose)

    raw_token = generate_raw_token()
    expires_at = (
        datetime.now(timezone.utc) + timedelta(hours=resolved_ttl) if resolved_ttl and resolved_ttl > 0 else None
    )

    token = SubscriberToken(
        subscriber_id=subscriber.id,
        purpose=purpose,
        token_hash=hash_token(raw_token),
        expires_at=expires_at,
    )
    db.add(token)
    return token, raw_token


def issue_confirmation_token(
    db: Session,
    subscriber: Subscriber,
    *,
    ttl_hours: int | None = None,
    revoke_existing: bool = True,
) -> tuple[SubscriberToken, str]:
    """Raccourci: emet un token `TokenPurpose.CONFIRM_EMAIL` pour un abonne."""

    return issue_token(
        db,
        subscriber=subscriber,
        purpose=TokenPurpose.CONFIRM_EMAIL,
        ttl_hours=ttl_hours,
        revoke_existing=revoke_existing,
    )


def get_token_by_raw_value(db: Session, raw_token: str, *, purpose: TokenPurpose) -> SubscriberToken:
    """Retrouve un `SubscriberToken` a partir de sa valeur brute (hashee avant recherche).

    Ne verifie pas encore la validite temporelle/l'usage: voir `validate_token`.
    """

    token = db.scalar(
        select(SubscriberToken).where(
            SubscriberToken.token_hash == hash_token(raw_token),
            SubscriberToken.purpose == purpose,
        )
    )
    if token is None:
        raise TokenNotFoundError("Token introuvable")
    return token


def validate_token(
    db: Session,
    raw_token: str,
    *,
    purpose: TokenPurpose,
    now: datetime | None = None,
) -> SubscriberToken:
    """Valide un token de bout en bout: existence, revocation, expiration, usage.

    Leve une sous-classe explicite de `TokenValidationError` pour chaque cas,
    afin que la route (Phase 2) puisse construire la reponse HTTP adaptee
    (404/400/410) et gerer l'idempotence quand l'abonne est deja actif malgre
    un token deja `used`.
    """

    effective_now = now or datetime.now(timezone.utc)
    token = get_token_by_raw_value(db, raw_token, purpose=purpose)
    expires_at = _as_aware(token.expires_at)

    if token.revoked_at is not None:
        raise TokenRevokedError(token)
    if expires_at is not None and expires_at <= effective_now:
        raise TokenExpiredError(token)
    if token.used_at is not None:
        raise TokenAlreadyUsedError(token)
    return token


def mark_token_used(db: Session, token: SubscriberToken, *, now: datetime | None = None) -> None:
    """Marque un token comme consomme (usage unique)."""

    token.used_at = now or datetime.now(timezone.utc)


__all__ = [
    "TOKEN_ENTROPY_BYTES",
    "TokenAlreadyUsedError",
    "TokenExpiredError",
    "TokenNotFoundError",
    "TokenRevokedError",
    "TokenValidationError",
    "generate_raw_token",
    "get_token_by_raw_value",
    "issue_confirmation_token",
    "issue_token",
    "mark_token_used",
    "revoke_active_tokens",
    "validate_token",
]