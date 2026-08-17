from __future__ import annotations

import logging
from contextlib import contextmanager
from collections.abc import Iterator

from core.config import get_settings

logger = logging.getLogger(__name__)


@contextmanager
def redis_lock(name: str, ttl_seconds: int = 600) -> Iterator[bool]:
    token = name
    client = None
    acquired = False
    try:
        from redis import Redis

        client = Redis.from_url(get_settings().redis_url, decode_responses=True)
        acquired = bool(client.set(name, token, nx=True, ex=ttl_seconds))
    except Exception:
        logger.warning("Redis indisponible, execution sans verrou distribue", extra={"lock": name})
        acquired = True

    try:
        yield acquired
    finally:
        if client is not None and acquired:
            try:
                if client.get(name) == token:
                    client.delete(name)
            except Exception:
                logger.warning("Liberation du verrou Redis impossible", extra={"lock": name})
