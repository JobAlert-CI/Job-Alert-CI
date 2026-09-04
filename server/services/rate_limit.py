"""Rate-limits applicatifs (audit P0 #8, S5, S6, S7).

Couvre les routes publiques / API qui n'etaient pas protegees:
- POST /api/subscriptions (inscription, anti-bombing)
- POST /api/contact (anti-spam)
- POST /api/offers/{id}/view, /save (anti-gonflement de compteurs)

Backend Redis (avec fallback memoire best-effort: si Redis est tombe,
on laisse passer pour ne pas casser l'UX, mais on journalise en WARNING).
"""
from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass

from core.config import get_settings

logger = logging.getLogger(__name__)

GENERIC_KEY_PREFIX = "jobalert:generic-rl"


@dataclass(slots=True)
class GenericRateLimitDecision:
    allowed: bool
    retry_after_seconds: int | None = None
    degraded: bool = False


def _digest(value: str) -> str:
    return hashlib.sha256(value.strip().lower().encode("utf-8")).hexdigest()[:32]


def _redis_client():
    from redis import Redis

    return Redis.from_url(get_settings().redis_url, decode_responses=True)


def check_ip_rate_limit(
    *,
    scope: str,
    client_ip: str,
    limit_per_minute: int,
    cooldown_seconds: int = 0,
) -> GenericRateLimitDecision:
    """Rate-limit par IP, par scope (ex: 'subscribe', 'contact', 'offer-view').

    Args:
        scope: nom du bucket (ex: "subscribe", "contact", "offer-view").
        client_ip: IP de l'appelant (extraite de X-Forwarded-For par l'appelant).
        limit_per_minute: nombre max de requetes par minute.
        cooldown_seconds: cooldown strict entre deux requetes (0 pour desactiver).

    Returns:
        GenericRateLimitDecision avec retry_after_seconds si refuse.
    """
    if not client_ip:
        # Sans IP on ne peut pas proteger: on laisse passer (defense de tomber
        # sur 500 en cascade).
        return GenericRateLimitDecision(allowed=True, degraded=True)
    try:
        client = _redis_client()
        ip_digest = _digest(client_ip)
        cooldown_key = f"{GENERIC_KEY_PREFIX}:cooldown:{scope}:{ip_digest}"
        if cooldown_seconds > 0 and not client.set(cooldown_key, "1", nx=True, ex=cooldown_seconds):
            ttl = client.ttl(cooldown_key)
            return GenericRateLimitDecision(
                allowed=False,
                retry_after_seconds=ttl if isinstance(ttl, int) and ttl > 0 else cooldown_seconds,
            )
        minute_key = f"{GENERIC_KEY_PREFIX}:minute:{scope}:{ip_digest}"
        count = client.incr(minute_key)
        if count == 1:
            client.expire(minute_key, 60)
        if count > limit_per_minute:
            ttl = client.ttl(minute_key)
            return GenericRateLimitDecision(
                allowed=False,
                retry_after_seconds=ttl if isinstance(ttl, int) and ttl > 0 else 60,
            )
        return GenericRateLimitDecision(allowed=True)
    except Exception:
        logger.warning("Rate-limit Redis indisponible (scope=%s), fallback pass-through", scope)
        return GenericRateLimitDecision(allowed=True, degraded=True)


def is_login_blocked(email: str, *, max_failures: int = 10) -> GenericRateLimitDecision:
    """Verifie SANS INCREMENTER si un email est bloque par ses echecs (W5)."""
    digest = _digest(email)
    key = f"{GENERIC_KEY_PREFIX}:login-failures:{digest}"
    try:
        client = _redis_client()
        raw = client.get(key)
        count = int(raw) if raw else 0
        if count >= max_failures:
            ttl = client.ttl(key)
            return GenericRateLimitDecision(
                allowed=False,
                retry_after_seconds=ttl if isinstance(ttl, int) and ttl > 0 else 900,
            )
        return GenericRateLimitDecision(allowed=True)
    except Exception:
        logger.warning("Rate-limit Redis indisponible (login par email), fallback pass-through")
        return GenericRateLimitDecision(allowed=True, degraded=True)


def register_login_failure(email: str, *, window_seconds: int = 900) -> None:
    """Incremente le compteur d'echecs de login pour un email (audit 3, W5).

    Complement du rate-limit par IP : un botnet distribue peut respecter la
    limite IP tout en brute-forcant un meme compte. La cle ne contient jamais
    l'email en clair (SHA-256 tronque) ; Redis indisponible ne bloque pas
    l'authentification (degraded pass-through, coherent avec le module).
    """
    digest = _digest(email)
    key = f"{GENERIC_KEY_PREFIX}:login-failures:{digest}"
    try:
        client = _redis_client()
        count = client.incr(key)
        if count == 1:
            client.expire(key, window_seconds)
    except Exception:
        logger.warning("Rate-limit Redis indisponible (echec login non compte)")


def clear_login_failures(email: str) -> None:
    """Purge le compteur d'echecs d'un email apres une connexion reussie."""
    digest = _digest(email)
    key = f"{GENERIC_KEY_PREFIX}:login-failures:{digest}"
    try:
        client = _redis_client()
        client.delete(key)
    except Exception:
        logger.warning("Redis indisponible: compteur d'echecs non purge (sans consequence)")


__all__ = [
    "GenericRateLimitDecision",
    "check_ip_rate_limit",
    "clear_login_failures",
    "is_login_blocked",
    "register_login_failure",
]
