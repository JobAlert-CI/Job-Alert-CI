"""Helpers partages pour la recherche type LIKE / ILIKE.

Centralise l'echappement des wildcards utilisateur (`%`, `_`, `\\`) pour
eviter les problemes signales par l'audit:

- `ilike(f"%{q}%")` brut -> un user tapant `%` declenche un scan complet,
  et `q='_'` matche n'importe quel caractere.
- L'unique module qui faisait deja l'echappement etait
  `services/admin_aggregates.py` (fonction `_normalize_search_query`).
  On l'expose ici comme source unique de verite.

Usage:

    from services.search_utils import safe_ilike, safe_like

    stmt = stmt.where(safe_ilike(JobOffer.title, q))
"""
from __future__ import annotations

from sqlalchemy import func

LIKE_ESCAPE_CHAR = "\\"


def normalize_search_query(q: str | None) -> str:
    """Trim, lowercase, et echappe les wildcards utilisateur.

    Conserve les separateurs de mots (`' '`, `'-'`, ...). Renvoie une
    chaine vide si `q` est vide ou n'a que des blancs.
    """
    if not q:
        return ""
    cleaned = q.strip().lower()
    if not cleaned:
        return ""
    # Ordre important: doubler les backslashes AVANT d'echapper % et _.
    return (
        cleaned
        .replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )


def safe_like(column, q: str | None, *, pattern: str = "%{q}%") -> object:
    """Clause `column LIKE pattern ESCAPE '\\\\'` case-sensitive avec wildcards echappes.

    Utiliser pour Postgres (`LIKE` natif) ou quand la collation est deja CI.
    """
    cleaned = normalize_search_query(q)
    if not cleaned:
        # Laisser passer un filtre toujours-vrai (1=1) au lieu d'un LIKE `%` vide.
        from sqlalchemy import true
        return true()
    return column.like(pattern.format(q=cleaned), escape=LIKE_ESCAPE_CHAR)


def safe_ilike(column, q: str | None, *, pattern: str = "%{q}%") -> object:
    """Clause `column ILIKE pattern ESCAPE '\\\\'` insensible a la casse.

    Prefere `ilike` quand le dialecte la supporte (Postgres). Sur SQLite,
    `ilike` est case-sensitive (cf. l'audit), donc preferer `safe_like`
    avec `func.lower()`.
    """
    cleaned = normalize_search_query(q)
    if not cleaned:
        from sqlalchemy import true
        return true()
    return column.ilike(pattern.format(q=cleaned), escape=LIKE_ESCAPE_CHAR)


def safe_like_lower(column, q: str | None, *, pattern: str = "%{q}%") -> object:
    """Variant cross-dialecte (SQLite + Postgres): `func.lower(col) LIKE func.lower(q) ESCAPE '\\\\'`."""
    cleaned = normalize_search_query(q)
    if not cleaned:
        from sqlalchemy import true
        return true()
    return func.lower(column).like(func.lower(pattern.format(q=cleaned)), escape=LIKE_ESCAPE_CHAR)


def raw_ilike(column, pattern: str) -> object:
    """Clause `column ILIKE pattern ESCAPE '\\\\'` ou le pattern est fourni
    par l'appelant (wildcards % et _ VOLONTAIRES, backslashes echappes).

    Contrairement a `safe_ilike`, ceci est pour les filtres administratifs
    documentes (ex: `to_email=%tag%`) ou l'utilisateur fournit lui-meme un
    motif LIKE assume. On double seulement les backslashes pour garder
    l'ESCAPE coherent.
    """
    cleaned = pattern.replace("\\", "\\\\")
    if not cleaned.strip("%_"):
        from sqlalchemy import true
        return true()
    return column.ilike(cleaned, escape=LIKE_ESCAPE_CHAR)


__all__ = [
    "LIKE_ESCAPE_CHAR",
    "normalize_search_query",
    "raw_ilike",
    "safe_ilike",
    "safe_like",
    "safe_like_lower",
]
