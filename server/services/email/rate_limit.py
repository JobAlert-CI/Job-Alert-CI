from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from core.config import get_settings

"""Anti-abus du renvoi d'email de confirmation.

Deux garde-fous, comptes dans Redis (source de verite) :
- un cooldown strict entre deux renvois pour un meme email (60s par defaut) ;
- un quota horaire par email (`EMAIL_RATE_LIMIT_RESEND_PER_HOUR`, 3 par defaut).

Le meme mecanisme est applique par IP quand l'appelant fournit une IP.

Si Redis est indisponible, on retombe sur `Subscriber.last_email_sent_at`
(fallback documente dans le cahier des charges) : le cooldown reste applique,
le quota horaire ne peut pas etre reconstitue sans Redis.

Les cles Redis ne contiennent jamais l'email en clair (SHA-256 tronque).
"""

logger = logging.getLogger(__name__)

RESEND_COOLDOWN_SECONDS = 60
KEY_PREFIX = "jobalert:resend-confirmation"


@dataclass(slots=True)
class RateLimitDecision:
    allowed: bool
    reason: str | None = None
    retry_after_seconds: int | None = None
    degraded: bool = False  # True quand Redis est injoignable (mode fallback)


def _digest(value: str) -> str:
    return hashlib.sha256(value.strip().lower().encode("utf-8")).hexdigest()[:32]


def _redis_client():
    from redis import Redis

    return Redis.from_url(get_settings().redis_url, decode_responses=True)


def _consume_scope(client, scope: str, identifier: str, *, limit: int, cooldown: int) -> RateLimitDecision:
    digest = _digest(identifier)
    cooldown_key = f"{KEY_PREFIX}:cooldown:{scope}:{digest}"
    hourly_key = f"{KEY_PREFIX}:hourly:{scope}:{digest}"

    if cooldown > 0 and not client.set(cooldown_key, "1", nx=True, ex=cooldown):
        ttl = client.ttl(cooldown_key)
        return RateLimitDecision(
            allowed=False,
            reason="cooldown",
            retry_after_seconds=ttl if isinstance(ttl, int) and ttl > 0 else cooldown,
        )

    count = client.incr(hourly_key)
    if count == 1:
        client.expire(hourly_key, 3600)
    if limit > 0 and count > limit:
        ttl = client.ttl(hourly_key)
        client.delete(cooldown_key)
        return RateLimitDecision(
            allowed=False,
            reason="hourly_quota",
            retry_after_seconds=ttl if isinstance(ttl, int) and ttl > 0 else 3600,
        )
    return RateLimitDecision(allowed=True)


def check_resend_quota(
    email: str,
    *,
    client_ip: str | None = None,
    last_email_sent_at: datetime | None = None,
    cooldown_seconds: int = RESEND_COOLDOWN_SECONDS,
) -> RateLimitDecision:
    """Consomme un jeton de renvoi pour cet email (et cette IP si fournie).

    Retourne `allowed=False` avec un `retry_after_seconds` exploitable dans un
    header `Retry-After` quand la limite est atteinte.
    """

    settings = get_settings()
    limit = settings.email_rate_limit_resend_per_hour

    try:
        client = _redis_client()
        decision = _consume_scope(client, "email", email, limit=limit, cooldown=cooldown_seconds)
        if not decision.allowed:
            return decision
        if client_ip:
            # Quota IP plus large: plusieurs personnes peuvent partager une IP.
            ip_decision = _consume_scope(
                client, "ip", client_ip, limit=max(limit * 5, limit), cooldown=0
            )
            if not ip_decision.allowed:
                return ip_decision
        return decision
    except Exception:  # redis absent, injoignable, ou erreur protocole
        logger.warning("Redis indisponible: fallback last_email_sent_at pour le renvoi de confirmation")

    if last_email_sent_at is not None and cooldown_seconds > 0:
        reference = last_email_sent_at
        if reference.tzinfo is None:
            reference = reference.replace(tzinfo=UTC)
        elapsed = datetime.now(UTC) - reference
        if elapsed < timedelta(seconds=cooldown_seconds):
            remaining = cooldown_seconds - int(elapsed.total_seconds())
            return RateLimitDecision(
                allowed=False,
                reason="cooldown",
                retry_after_seconds=max(remaining, 1),
                degraded=True,
            )

    return RateLimitDecision(allowed=True, degraded=True)


__all__ = ["RESEND_COOLDOWN_SECONDS", "RateLimitDecision", "check_resend_quota"]
