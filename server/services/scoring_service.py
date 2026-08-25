from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

"""Scoring du digest quotidien.

Ce module ne fait AUCUN filtrage : il classe uniquement les offres qui ont
deja passe les filtres durs. La separation filtres durs / facteurs de
classement est obligatoire (voir prompt_send_offres_email.md).

Formule :
    score = score_filiere + score_contract + score_experience
            + score_city + score_freshness

Egalite : publication decroissante, puis titre, puis id.
"""

# ─── Score filiere (priorite abonne) ─────────────────────────────────────
FILIERE_PRIORITY_SCORES = {1: 100, 2: 70, 3: 40}
FILIERE_PRIMARY_MATCH_BONUS = 10

# ─── Score contrat ────────────────────────────────────────────────────────
CONTRACT_MATCH_SCORE = 20
CONTRACT_NO_CONTRACT_ACCEPTED_SCORE = 5

# ─── Score experience ─────────────────────────────────────────────────────
EXPERIENCE_EXACT_SCORE = 20
EXPERIENCE_NO_REQUIREMENT_SCORE = 15
EXPERIENCE_ADJACENT_SCORE = 10
EXPERIENCE_ADJACENT_YEARS = 1  # EXPERIENCE_MATCH_TOLERANCE_YEARS

# ─── Score ville (coherent avec services.city_matching_service) ───────────
CITY_EXACT_SCORE = 25
CITY_LABEL_OR_DISTRICT_SCORE = 15
CITY_REMOTE_WITH_CITY_SCORE = 10
CITY_NONE_SCORE = 0

# ─── Score fraicheur ──────────────────────────────────────────────────────
FRESHNESS_24H_SCORE = 15
FRESHNESS_48H_SCORE = 10
FRESHNESS_7D_SCORE = 5

_FAR_PAST = datetime.min.replace(tzinfo=timezone.utc)
_DISTANT_AGE_THRESHOLD = timedelta(days=30)


@dataclass(slots=True)
class SubscriberScoringContext:
    """Donnees abonne necessaires au scoring, prechargees par l'appelant."""

    # {filiere_id: priorite} avec priorite dans 1..3
    filiere_priorities: dict[str, int] = field(default_factory=dict)
    # Ids des ContractType preferes ; vide => aucune preference contrat.
    contract_type_ids: set[str] = field(default_factory=set)
    # Tranche d'experience de l'abonne (None si non renseignee).
    subscriber_min_years: int | None = None
    subscriber_max_years: int | None = None
    # Resolution de la ville par CityMatchingService.resolve() (peut etre None).
    city_resolution: object | None = None


def compute_filiere_score(
    offer_primary_filiere_id: str | None,
    context: SubscriberScoringContext,
) -> int:
    """Score filiere : priorite 1/2/3, +bonus si filiere principale (prio 1)."""

    if not offer_primary_filiere_id:
        return 0
    priority = context.filiere_priorities.get(offer_primary_filiere_id)
    if priority is None:
        return 0
    score = FILIERE_PRIORITY_SCORES.get(priority, 0)
    if priority == 1:
        score += FILIERE_PRIMARY_MATCH_BONUS
    return score


def compute_contract_score(
    offer_contract_type_id: str | None,
    context: SubscriberScoringContext,
) -> int:
    """Score contrat : match +20 ; offre sans contrat acceptee par config +5.

    Une offre sans contrat ne doit atteindre ce code qu'apres validation du
    filtre dur DIGEST_INCLUDE_NO_CONTRACT_OFFERS.
    """

    if not offer_contract_type_id:
        return CONTRACT_NO_CONTRACT_ACCEPTED_SCORE
    if offer_contract_type_id in context.contract_type_ids:
        return CONTRACT_MATCH_SCORE
    return 0


def _spans_overlap(
    offer_min: int | None,
    offer_max: int | None,
    subscriber_min: int | None,
    subscriber_max: int | None,
) -> bool:
    """Vrai si les tranches d'annees se chevauchent."""

    offer_lo = offer_min if offer_min is not None else 0
    offer_hi = offer_max if offer_max is not None else 10**6
    sub_lo = subscriber_min if subscriber_min is not None else 0
    sub_hi = subscriber_max if subscriber_max is not None else 10**6
    return offer_lo <= sub_hi and sub_lo <= offer_hi


def _as_utc(value: datetime | None) -> datetime | None:
    """Renvoie une datetime timezone-aware UTC, ou None."""

    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def compute_experience_score(
    offer_min_years: int | None,
    offer_max_years: int | None,
    context: SubscriberScoringContext,
) -> int:
    """Score experience base sur ExperienceLevel.min_years / max_years.

    - offre sans exigence : +15
    - tranche compatible avec celle de l'abonne : +20
    - tranche adjacente (+/- EXPERIENCE_ADJACENT_YEARS) : +10

    L'exclusion des offres trop eloignees reste un FILTRE DUR en amont.
    """

    if offer_min_years is None and offer_max_years is None:
        return EXPERIENCE_NO_REQUIREMENT_SCORE
    if _spans_overlap(offer_min_years, offer_max_years, context.subscriber_min_years, context.subscriber_max_years):
        return EXPERIENCE_EXACT_SCORE

    tolerance = EXPERIENCE_ADJACENT_YEARS
    adjacent_offer_min = None if offer_min_years is None else max(0, offer_min_years - tolerance)
    adjacent_offer_max = None if offer_max_years is None else offer_max_years + tolerance
    if _spans_overlap(adjacent_offer_min, adjacent_offer_max, context.subscriber_min_years, context.subscriber_max_years):
        return EXPERIENCE_ADJACENT_SCORE
    return 0


def compute_freshness_score(
    published_at: datetime | None,
    now: datetime,
) -> int:
    """Score fraicheur sur JobOffer.published_at (fallback collecte/created)."""

    aware_now = _as_utc(now) or datetime.now(timezone.utc)
    reference = _as_utc(published_at)
    if reference is None:
        # Pas de date exploitable : on considere l'offre ancienne.
        reference = aware_now - _DISTANT_AGE_THRESHOLD
    age_hours = (aware_now - reference).total_seconds() / 3600
    if age_hours < 24:
        return FRESHNESS_24H_SCORE
    if age_hours < 48:
        return FRESHNESS_48H_SCORE
    if age_hours < 7 * 24:
        return FRESHNESS_7D_SCORE
    return 0


def compute_offer_score(
    offer: object,
    context: SubscriberScoringContext,
    now: datetime,
    city_score: int | None = None,
) -> int:
    """Score total d'une offre (aucun filtrage ici).

    `city_score` est calcule par services.city_matching_service.score_offer_city()
    ; s'il n'est pas fourni, un calcul minimal remote/ville est applique.
    """

    if city_score is None:
        resolution = context.city_resolution
        offer_location_id = getattr(offer, "location_id", None)
        offer_is_remote = bool(
            getattr(getattr(offer, "location", None), "is_remote", False)
        )
        if resolution is not None and hasattr(resolution, "matched_location_ids"):
            from services.city_matching_service import score_offer_city

            city_score = score_offer_city(offer_location_id, offer_is_remote, resolution)
        else:
            city_score = CITY_NONE_SCORE

    published_at = (
        getattr(offer, "published_at", None)
        or getattr(offer, "collected_at", None)
        or getattr(offer, "created_at", None)
    )
    return (
        compute_filiere_score(getattr(offer, "primary_filiere_id", None), context)
        + compute_contract_score(getattr(offer, "contract_type_id", None), context)
        + compute_experience_score(
            getattr(offer, "offer_min_years", None),
            getattr(offer, "offer_max_years", None),
            context,
        )
        + compute_freshness_score(published_at, now)
        + city_score
    )


def rank_offers(
    scored_offers: list[tuple[object, int]],
) -> list[object]:
    """Trie les couples (offre, score) : score desc, puis publication desc,
    puis titre, puis id. Renvoie uniquement les offres dans l'ordre."""

    def sort_key(item: tuple[object, int]) -> tuple:
        offer, score = item
        published_at = _as_utc(
            getattr(offer, "published_at", None)
            or getattr(offer, "collected_at", None)
            or getattr(offer, "created_at", None)
        ) or _FAR_PAST
        title = getattr(offer, "title", "") or ""
        offer_id = str(getattr(offer, "id", "") or "")
        return (-score, published_at, title, offer_id)

    return [offer for offer, _score in sorted(scored_offers, key=sort_key)]
