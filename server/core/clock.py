"""Horloge centralisee (audit 4, I.4 — Lot 7).

Avant : quatre helpers identiques coexistaient (`utc_now` dans
ai_key_manager, `_now` dans ai_results / ingestion / ai_processing) plus
67 usages directs `datetime.now(UTC)`. Tous cohérents, mais toute
evolution (horloge simuable pour les tests, remplacement d'un `utcnow()`
deprecie) aurait exige 4 edits + 67 recherches.

Contrat : TOUJOURS un datetime UTC aware (jamais naive, jamais local).
Les modules historiques gardent leur alias local (`_now = now_utc`)
pour ne pas toucher 67 appels en drive-by.
"""
from __future__ import annotations

from datetime import UTC, datetime


def now_utc() -> datetime:
    """Horodatage UTC aware — reference unique du projet."""
    return datetime.now(UTC)


__all__ = ["now_utc"]
