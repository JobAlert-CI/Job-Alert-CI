"""Compteurs view/save bufferises via Redis (audit 2, F3 / heritage P1 #11).

Probleme: chaque `POST /offers/{id}/view` faisait un `UPDATE ... view_count = +1`
+ COMMIT synchrone — un hotspot d'ecriture sous charge (100 vues/s = 100 commits/s).

Solution:
- Redis INCR sur une cle par offre (`jobalert:metrics:{field}:{offer_id}`).
- La valeur RENVOYEE est le compteur Redis (approximation immediate, assez
  fiable pour un widget de compteur).
- Une tache Celery periodique (`flush_offer_metrics`) decremente les cles
  Redis et applique les deltas en base en UN update par offre.
- Si Redis est indisponible: fallback au comportement synchrone direct
  (correct mais lent), journalise en WARNING.
"""
from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import update
from sqlalchemy.orm import Session

from core.config import get_settings
from models.jobs import JobOffer

logger = logging.getLogger(__name__)

METRIC_KEY_PREFIX = "jobalert:metrics"
METRIC_FLUSH_BATCH = 500

MetricField = Literal["view", "save"]


def _redis_client():
    from redis import Redis

    return Redis.from_url(get_settings().redis_url, decode_responses=True)


def _metric_key(field: MetricField, offer_id: str) -> str:
    return f"{METRIC_KEY_PREFIX}:{field}:{offer_id}"


def record_metric(db: Session, offer: JobOffer, field: MetricField) -> int | None:
    """Enregistre un hit pour (offre, champ) et renvoie le compteur approximatif.

    Returns:
        int: compteur mis a jour (Redis = valeur base + buffer).
        None: Redis indisponible — l'appelant doit faire le fallback direct.
    """
    try:
        client = _redis_client()
        key = _metric_key(field, offer.id)
        buffered = client.incr(key)
        current = getattr(offer, f"{field}_count", 0) or 0
        return current + buffered
    except Exception as exc:
        logger.warning("Redis indisponible pour les metriques (%s), fallback direct", exc)
        return None


def collect_metric_deltas(max_keys: int = METRIC_FLUSH_BATCH) -> dict[tuple[MetricField, str], int]:
    """Lit (et remet a zero) jusqu'a `max_keys` compteurs bufferises.

    Utilise SCAN (non bloquant) + GETDEL (atomique) pour eviter toute perte
    entre lecture et reinitialisation.
    """
    deltas: dict[tuple[MetricField, str], int] = {}
    try:
        client = _redis_client()
        cursor = 0
        scanned = 0
        while scanned < max_keys:
            cursor, keys = client.scan(cursor=cursor, match=f"{METRIC_KEY_PREFIX}:*", count=100)
            for key in keys:
                if scanned >= max_keys:
                    break
                value = client.getdel(key)
                if value is None:
                    continue
                try:
                    # Format: jobalert:metrics:{field}:{offer_id}
                    _, _, field, offer_id = key.split(":", 3)
                    if field in ("view", "save"):
                        deltas[(field, offer_id)] = int(value)
                        scanned += 1
                except ValueError:
                    logger.warning("Cle metrique inattendue ignoree: %s", key)
            if cursor == 0:
                break
    except Exception as exc:
        logger.warning("Lecture des compteurs Redis impossible: %s", exc)
    return deltas


def apply_metric_deltas(db: Session, deltas: dict[tuple[MetricField, str], int]) -> int:
    """Applique les deltas en base en UN update par offre (view et save separes)."""
    applied = 0
    now = datetime.now(UTC)
    for (field, offer_id), delta in deltas.items():
        if delta <= 0:
            continue
        column = JobOffer.view_count if field == "view" else JobOffer.save_count
        db.execute(
            update(JobOffer)
            .where(JobOffer.id == offer_id)
            .values({column: column + delta})
        )
        # Marquer la fraicheur pour le tri "recemment vues" si besoin.
        if field == "view":
            db.execute(
                update(JobOffer).where(JobOffer.id == offer_id).values(last_seen_at=now)
            )
        applied += 1
    db.commit()
    return applied


__all__ = [
    "METRIC_FLUSH_BATCH",
    "METRIC_KEY_PREFIX",
    "apply_metric_deltas",
    "collect_metric_deltas",
    "record_metric",
]
