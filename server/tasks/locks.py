from __future__ import annotations

import logging
import secrets
from collections.abc import Iterator
from contextlib import contextmanager

from core.config import get_settings

logger = logging.getLogger(__name__)

# Script Lua: supprime la cle UNIQUEMENT si sa valeur correspond au token.
# Atomique cote Redis (eval): pas de race entre GET et DEL depuis Python.
_LUA_RELEASE = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
else
    return 0
end
"""


@contextmanager
def redis_lock(name: str, ttl_seconds: int = 600) -> Iterator[bool]:
    """Verrou distribue `SET NX EX` avec token aleatoire + release atomique Lua.

    Correction de l'audit P0 #5:
    - L'ancien code utilisait le nom du lock comme token: deux workers
      pouvaient acquerir puis relacher en cascade.
    - On genere un token aleatoire a l'acquisition et on ne relache
      que si le token est toujours le notre (script Lua atomique).
    """
    token = secrets.token_hex(16)
    client = None
    acquired = False
    try:
        from redis import Redis

        client = Redis.from_url(get_settings().redis_url, decode_responses=True)
        acquired = bool(client.set(name, token, nx=True, ex=ttl_seconds))
    except Exception:
        # Redis down: on laisse passer (mode degraded documente).
        logger.warning("Redis indisponible, execution sans verrou distribue", extra={"lock": name})
        acquired = True

    try:
        yield acquired
    finally:
        if client is not None and acquired:
            try:
                client.eval(_LUA_RELEASE, 1, name, token)
            except Exception:
                logger.warning("Liberation du verrou Redis impossible", extra={"lock": name})


__all__ = ["redis_lock"]
