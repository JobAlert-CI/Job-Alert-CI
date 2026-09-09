"""Utilitaires de dates metier partages (audit 4, A.9).

Avant : `date.today()` (heure serveur) dans api/v1/admin/scraping.py et
api/v1/admin/sending.py, contre `_abidjan_date()` (fuseau produit) dans
services/ingestion.py — deux definitions de « la date du run » qui
divergeraient sur tout hote non-UTC. Un seul point de verite desormais.
"""
from __future__ import annotations

from datetime import date, datetime
from zoneinfo import ZoneInfo

from core.config import get_settings


def today_local() -> date:
    """Date metier du jour dans le fuseau produit (APP_TIMEZONE, defaut Abidjan)."""
    return datetime.now(ZoneInfo(get_settings().timezone)).date()


__all__ = ["today_local"]
