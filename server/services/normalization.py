from __future__ import annotations

import hashlib
import re
import unicodedata


def normalize_text(value: str | None) -> str:
    """Normalise une chaine pour les recherches et les unicites."""

    if not value:
        return ""
    text = unicodedata.normalize("NFKD", value)
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = re.sub(r"[^a-zA-Z0-9]+", " ", text).strip().lower()
    return re.sub(r"\s+", " ", text)


def slugify(value: str) -> str:
    slug = normalize_text(value).replace(" ", "-")
    return slug or "element"


def hash_offer(*parts: str | None) -> str:
    """Hash de dedoublonnage stable entre scraping, imports et saisie admin."""

    raw = "|".join(normalize_text(part) for part in parts if part)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# Mots parasites retires d'une ville saisie en texte libre (pays, codes pays).
_CITY_PARASITE_PHRASES = ("cote d ivoire", "cote divoire", "ivory coast")
_CITY_PARASITE_TOKENS = {"ivoire", "ci", "republique"}


def normalize_city(value: str | None) -> str:
    """Normalise une ville libre en etendant normalize_text().

    Gere le format Ville - Quartier (on garde la partie ville), puis retire
    les mentions du pays. Le resultat doit rester comparable avec
    Location.normalized_label construit via normalize_text().
    """

    raw = (value or "").strip()
    if not raw:
        return ""
    # Format Ville - Quartier : seule la premiere partie est la ville.
    if "-" in raw:
        raw = raw.split("-", 1)[0]
    text = normalize_text(raw)
    for phrase in _CITY_PARASITE_PHRASES:
        text = text.replace(phrase, " ")
    tokens = [token for token in text.split() if token not in _CITY_PARASITE_TOKENS]
    return " ".join(tokens).strip()
