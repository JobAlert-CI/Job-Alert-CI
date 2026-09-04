from __future__ import annotations

import logging
from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Literal

from services.normalization import normalize_city, normalize_text

"""Service de matching ville texte libre <-> referentiel Location.

Le champ Subscriber.city est du texte libre : aucun fuzzy matching dangereux.
On compare la ville normalisee (normalize_city) aux champs Location.city /
label / district / normalized_label en comparaison exacte normalisee
(CITY_MATCH_MODE=normalized_exact), on journalise les cas ambigus et on laisse
la decision d'inclusion finale (remote, offres sans localisation) a l'appelant,
qui applique la configuration du digest.
"""

logger = logging.getLogger(__name__)

CityMatchMode = Literal["normalized_exact"]

# Resultats possibles d'une recherche de correspondance.
CityMatchKind = Literal["exact", "label", "district", "unmatched"]


@dataclass(slots=True)
class CityResolution:
    """Resultat de la resolution de la ville d'un abonne.

    matched_locations: ids des Location consideres comme correspondants a la
    ville de l'abonne. Vide si aucune correspondance fiable (kind=unmatched).
    """

    kind: CityMatchKind
    normalized_city: str
    matched_location_ids: list[str] = field(default_factory=list)
    detail: str | None = None


def _iter_normalized_fields(location: object) -> Iterable[tuple[CityMatchKind, str]]:
    """Champs normalises d'une Location, par ordre de priorite."""

    city = normalize_city(getattr(location, "city", None))
    if city:
        yield "exact", city
    label = normalize_text(getattr(location, "label", None))
    if label:
        yield "label", label
    district = normalize_text(getattr(location, "district", None))
    if district:
        yield "district", district


class CityMatchingService:
    """Compare une ville libre avec les Location actives du referentiel.

    `locations` est un iterable precharge (Location.is_active == true) : la
    table est petite, on evite une requete par offre. Le service ne fait aucune
    ecriture et ne leve pas d'exception metier : en cas de doute il renvoie
    kind='unmatched' et journalise.
    """

    def __init__(self, locations: Iterable[object]) -> None:
        # Index memoire: cle normalisee -> liste d'ids Location.
        self._index: dict[tuple[CityMatchKind, str], list[str]] = {}
        for location in locations:
            location_id = getattr(location, "id", None)
            if not location_id:
                continue
            for kind, normalized in _iter_normalized_fields(location):
                self._index.setdefault((kind, normalized), []).append(str(location_id))

    def resolve(self, subscriber_city: str | None) -> CityResolution:
        """Resolve la ville d'un abonne contre l'index.

        1. Normalisation via normalize_city().
        2. Correspondance exacte sur Location.city normalise.
        3. Sinon correspondance sur Location.label ou district normalises.
        4. Sinon unmatched (fallback remote gere par la configuration appelante).
        """

        normalized = normalize_city(subscriber_city)
        if not normalized:
            return CityResolution(
                kind="unmatched",
                normalized_city="",
                matched_location_ids=[],
                detail="subscriber_city_vide",
            )

        for kind in ("exact", "label", "district"):
            location_ids = self._index.get((kind, normalized))
            if location_ids:
                return CityResolution(
                    kind=kind,
                    normalized_city=normalized,
                    matched_location_ids=list(location_ids),
                )

        logger.info(
            "digest_city_unmatched",
            extra={
                "subscriber_city_raw": subscriber_city,
                "subscriber_city_normalized": normalized,
            },
        )
        return CityResolution(
            kind="unmatched",
            normalized_city=normalized,
            matched_location_ids=[],
            detail=f"aucune correspondance pour '{normalized}'",
        )


def score_offer_city(
    offer_location_id: str | None,
    offer_is_remote: bool,
    resolution: CityResolution,
) -> int:
    """Score ville d'une offre (a n'appliquer qu'apres les filtres durs).

    - correspondance exacte ville normalisee: +25
    - correspondance via label ou district: +15
    - offre remote alors que l'abonne a une ville: +10
    - offre sans localisation (ou ville non matchee): +0
    """

    if offer_location_id and offer_location_id in resolution.matched_location_ids:
        # Exact (+25) si la ville elle-meme a matche, sinon label/district (+15).
        return 25 if resolution.kind == "exact" else 15
    if offer_is_remote and resolution.normalized_city:
        return 10
    return 0
