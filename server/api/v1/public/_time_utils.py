from __future__ import annotations

from datetime import UTC, datetime


def today_start_utc() -> datetime:
    """Retourne minuit (00:00:00) du jour courant, en UTC, timezone-aware.

    Point unique de vérité pour la borne "Aujourd'hui" utilisée par tous les
    compteurs "nouvelles offres" (stats.py, filieres.py, sources.py).

    Pourquoi centraliser ceci :
    - Abidjan est en UTC+0 (pas de décalage horaire), donc minuit UTC == minuit
      local. Pas de conversion supplémentaire nécessaire.
    - `first_seen_at` est une colonne TIMESTAMPTZ : elle DOIT toujours être
      comparée à un datetime timezone-aware. Un datetime naïf (sans tzinfo,
      ex. `datetime.utcnow()`) envoyé en paramètre à Postgres peut être
      réinterprété selon le fuseau de la session DB, ce qui décale
      silencieusement la fenêtre de comparaison et produit des compteurs
      incohérents d'un endpoint à l'autre pour les mêmes données.
    - Avant ce correctif, `stats.py` calculait "aujourd'hui" en aware,
      pendant que `filieres.py` / `sources.py` calculaient "les 7 derniers
      jours" en naïf : deux définitions différentes de "nouvelles offres"
      coexistaient, d'où les écarts constatés entre pages.
    """
    return datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
