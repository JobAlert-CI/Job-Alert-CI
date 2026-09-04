"""Cascade de selection T0-T5 pour le digest quotidien.

Objectif: maximiser le nombre d'offres pertinentes envoyees tout en
respectant la separation stricte entre filtres durs (exclusion) et
scoring (classement). Les paliers T0-T5 representent des **relaxations
cumulatives** des filtres de pertinence (filiere, contrat, experience,
fraicheur, ville), pas une derogation aux invariants produit:

- Filtres 1 (visible_site + status active) et 2 (anti-doublon) ne sont
  JAMAIS relaches.
- Le scoring reste l'autorite de classement: une offre de repli (T1+)
  ne remonte que si elle merite sa place par son score de
  filiere/contrat/experience/ville/fraicheur.

Sequence des paliers (cumulatif):
- T0: selection stricte, equivalente au pipeline actuel.
- T1: filiere elargie (offres dont la filiere de l'abonne apparait
  en filiere secondaire via `offer_filieres`, pas seulement en
  filiere principale `primary_filiere_id`).
- T2: contrat ouvert (on ignore les preferences de contrat).
- T3: fraicheur elargie (on repousse window_start a
  `today - DIGEST_CASCADE_FRESHNESS_DAYS`).
- T4: experience elargie (on double la tolerance
  `EXPERIENCE_MATCH_TOLERANCE_YEARS`).
- T5: ville fallback (si l'abonne a une ville non matchee, on inclut
  les offres de la ville de repli `DIGEST_CASCADE_FALLBACK_CITY`).

Le selector s'arrete au premier palier ou `len(selected) >=
digest_min_offers` (defaut 2). Si aucun palier ne produit assez, il
retourne `insufficient=True` et le dernier tier tente (`T5_INSUFFICIENT`
par defaut, ou `<Tmax>_INSUFFICIENT` si `max_tier` plafonne).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import and_, exists, or_, select
from sqlalchemy.orm import Session

from core.config import Settings, get_settings
from models import (
    JobOffer,
    Location,
    OfferFiliere,
    Subscriber,
)
from services.digest_builder_service import (
    _build_scoring_context,
    _freshness_window,
    _hard_filter_conditions,
    _resolve_city,
    is_subscriber_eligible,
    select_candidate_offers,
)
from services.scoring_service import compute_offer_score, rank_offers

if TYPE_CHECKING:
    pass

# Ordre canonique des paliers (chaque entree = nom + fonction qui produit
# le match_kind de l'offre selon ce palier). Le selector les tente dans
# l'ordre jusqu'a trouver `digest_min_offers` offres.
TIER_ORDER: tuple[str, ...] = ("T0", "T1", "T2", "T3", "T4", "T5")


@dataclass(slots=True)
class CascadeOutcome:
    """Resultat du cascade selector.

    - `selected_offers`: liste triee par score descendant, tronquee a
      `digest_max_offers`.
    - `match_kinds`: un match_kind par offre dans le meme ordre
      (utilise par l'email pour distinguer la section
      "Selectionnees pour vous" de "Pourrait aussi vous interesser").
    - `tier`: nom du palier final (T0..T5, ou `<Tmax>_INSUFFICIENT`).
    - `insufficient`: True si aucun palier n'a produit assez d'offres.
    """

    selected_offers: list[JobOffer] = field(default_factory=list)
    match_kinds: list[str] = field(default_factory=list)
    tier: str = "T5_INSUFFICIENT"
    insufficient: bool = True


def select_with_cascade(
    db: Session,
    *,
    subscriber: Subscriber,
    settings: Settings | None = None,
    max_tier: str | None = None,
) -> CascadeOutcome:
    """Orchestre la cascade T0->Tmax et retourne le meilleur palier.

    - `max_tier` permet de plafonner la cascade (utile pour derouler
      en prod un sous-ensemble de paliers). Si None, on utilise le
      plafond de settings ou "T5" par defaut.
    - Cote test, on peut directement passer `max_tier="T2"` etc.
    """
    resolved = settings or get_settings()
    effective_max_tier = max_tier or resolved.digest_cascade_max_tier or "T5"
    if effective_max_tier not in TIER_ORDER:
        effective_max_tier = "T5"

    if not is_subscriber_eligible(subscriber):
        return CascadeOutcome(tier=f"{effective_max_tier}_INSUFFICIENT", insufficient=True)

    # T0: pipeline actuel, on essaie d'abord.
    t0_offers, t0_kinds = _select_for_tier(db, subscriber, tier="T0", settings=resolved)
    if len(t0_offers) >= resolved.digest_min_offers:
        return CascadeOutcome(
            selected_offers=t0_offers[: resolved.digest_max_offers],
            match_kinds=t0_kinds[: resolved.digest_max_offers],
            tier="T0",
            insufficient=False,
        )

    # T1+ : on accumule (union) les resultats de chaque palier, puis on
    # prend les `digest_max_offers` mieux classes par le scoring.
    accumulated: dict[str, str] = {}  # offer_id -> match_kind du plus petit palier qui l'a ajoute
    last_tier_tried: str = "T0"
    for tier in TIER_ORDER[1:]:  # T1..T5
        if TIER_ORDER.index(tier) > TIER_ORDER.index(effective_max_tier):
            break
        last_tier_tried = tier
        offers, kinds = _select_for_tier(db, subscriber, tier=tier, settings=resolved)
        for offer, kind in zip(offers, kinds, strict=False):
            if offer.id not in accumulated:
                accumulated[offer.id] = kind
        # On s'arrete des qu'on a assez d'offres.
        if len(accumulated) >= resolved.digest_min_offers:
            break

    if len(accumulated) < resolved.digest_min_offers:
        # On a tente tous les paliers autorises, rien ne suffit.
        return CascadeOutcome(
            tier=f"{effective_max_tier}_INSUFFICIENT", insufficient=True
        )

    # On recupere les objets JobOffer dans l'ordre d'apparition puis on
    # les classe par score (autorite unique de classement).
    offer_by_id: dict[str, JobOffer] = {}
    for tier in TIER_ORDER:
        if TIER_ORDER.index(tier) > TIER_ORDER.index(effective_max_tier):
            break
        offers, _ = _select_for_tier(db, subscriber, tier=tier, settings=resolved)
        for offer in offers:
            offer_by_id.setdefault(offer.id, offer)

    final_offers = [offer_by_id[oid] for oid in accumulated if oid in offer_by_id]
    final_kinds = [accumulated[oid] for oid in accumulated if oid in offer_by_id]
    ranked = _rank_offers(final_offers, db, subscriber, settings=resolved)  # scoring canonique
    rank_index = {offer.id: idx for idx, offer in enumerate(ranked)}
    final_offers.sort(key=lambda o: rank_index.get(o.id, 10**9))
    final_kinds = [accumulated[o.id] for o in final_offers]
    # On tronque a digest_max_offers.
    return CascadeOutcome(
        selected_offers=final_offers[: resolved.digest_max_offers],
        match_kinds=final_kinds[: resolved.digest_max_offers],
        tier=last_tier_tried,
        insufficient=False,
    )


def _rank_offers(
    offers: list[JobOffer],
    db: Session,
    subscriber: Subscriber,
    *,
    settings: Settings,
) -> list[JobOffer]:
    """Classe les offres via le scoring canonique (services.scoring_service)."""
    if not offers:
        return []
    resolution = _resolve_city(db, subscriber)
    context = _build_scoring_context(subscriber, resolution)
    now = datetime.now(UTC)
    scored = [(offer, compute_offer_score(offer, context, now)) for offer in offers]
    return rank_offers(scored)


def _select_for_tier(
    db: Session,
    subscriber: Subscriber,
    *,
    tier: str,
    settings: Settings,
) -> tuple[list[JobOffer], list[str]]:
    """Selectionne les offres matchant un palier donne, avec leur match_kind.

    Renvoie (offres, match_kinds) dans l'ordre de pertinence (score desc).
    """
    if tier == "T0":
        ranked, _ = select_candidate_offers(db, subscriber, settings=settings)
        return ranked, ["primary"] * len(ranked)

    if tier == "T1":
        # Elargissement filiere: on prend les offres T0 + celles dont
        # la filiere de l'abonne est en filiere secondaire (offer_filieres).
        t0_offers, _ = _select_for_tier(db, subscriber, tier="T0", settings=settings)
        t0_ids = {o.id for o in t0_offers}
        secondary = _select_by_secondary_filiere(db, subscriber, settings=settings)
        combined: list[JobOffer] = list(t0_offers)
        kinds: list[str] = ["primary"] * len(t0_offers)
        for offer in secondary:
            if offer.id in t0_ids:
                continue
            combined.append(offer)
            kinds.append("secondary")
        # On classe via le scoring canonique.
        ranked = _rank_offers(combined, db, subscriber, settings=settings)
        ranked_kinds = [kinds[combined.index(o)] for o in ranked]
        return ranked, ranked_kinds

    if tier == "T2":
        # Elargissement contrat: on construit des conditions hard
        # sans le filtre contrat.
        return _select_with_relaxed_contract(db, subscriber, settings=settings)

    if tier == "T3":
        # Elargissement fraicheur: on repousse window_start.
        return _select_with_relaxed_freshness(db, subscriber, settings=settings)

    if tier == "T4":
        # Elargissement experience: tolerance x2.
        return _select_with_relaxed_experience(db, subscriber, settings=settings)

    if tier == "T5":
        # Fallback ville: si ville non matchee, on inclut la ville de repli.
        return _select_with_city_fallback(db, subscriber, settings=settings)

    return [], []


def _select_by_secondary_filiere(
    db: Session,
    subscriber: Subscriber,
    *,
    settings: Settings,
) -> list[JobOffer]:
    """Offres dont la filiere de l'abonne apparait en filiere secondaire."""
    filiere_ids = [link.filiere_id for link in subscriber.filiere_links]
    if not filiere_ids:
        return []
    resolution = _resolve_city(db, subscriber)
    window_start = _freshness_window(db, subscriber)
    # On reutilise les filtres durs T0 mais on remplace la condition filiere
    # par un EXISTS sur offer_filieres (filiere secondaire).
    conditions = _hard_filter_conditions(
        db,
        subscriber,
        settings=settings,
        window_start=window_start,
        resolution=resolution,
    )
    # Remplacer la condition filiere principale (index 2) par un OR avec
    # filiere secondaire. Pour eviter de toucher la liste en place, on la
    # reconstitue.
    secondary_condition = exists().where(
        and_(
            OfferFiliere.offer_id == JobOffer.id,
            OfferFiliere.filiere_id.in_(filiere_ids),
        )
    )
    new_conditions = []
    for cond in conditions:
        # On garde tout SAUF la condition "primary_filiere_id.in_".
        if "primary_filiere_id" not in str(cond):
            new_conditions.append(cond)
    new_conditions.append(or_(JobOffer.primary_filiere_id.in_(filiere_ids), secondary_condition))
    stmt = select(JobOffer).where(*new_conditions).order_by(JobOffer.published_at.desc().nullslast())
    return list(db.scalars(stmt.limit(50)).all())


def _select_with_relaxed_contract(
    db: Session,
    subscriber: Subscriber,
    *,
    settings: Settings,
) -> tuple[list[JobOffer], list[str]]:
    """Tier T2: on retire le filtre contrat des conditions hard."""
    resolution = _resolve_city(db, subscriber)
    window_start = _freshness_window(db, subscriber)
    conditions = _hard_filter_conditions(
        db,
        subscriber,
        settings=settings,
        window_start=window_start,
        resolution=resolution,
    )
    # On retire les conditions liees au contrat (le mot "contract_type_id"
    # apparait dans la string du contrat). On garde le reste.
    new_conditions = [c for c in conditions if "contract_type_id" not in str(c)]
    stmt = select(JobOffer).where(*new_conditions).order_by(JobOffer.published_at.desc().nullslast())
    offers = list(db.scalars(stmt.limit(50)).all())
    return offers, ["fallback_contract"] * len(offers)


def _select_with_relaxed_freshness(
    db: Session,
    subscriber: Subscriber,
    *,
    settings: Settings,
) -> tuple[list[JobOffer], list[str]]:
    """Tier T3: on elargit la fenetre de fraÃƒÂ®cheur."""
    from datetime import datetime, timedelta
    resolution = _resolve_city(db, subscriber)
    window_start = _freshness_window(db, subscriber) or datetime.now(UTC)
    # On elargit: max(window_start, now - N jours).
    new_window = min(
        window_start,
        datetime.now(UTC) - timedelta(days=settings.digest_cascade_freshness_days),
    )
    conditions = _hard_filter_conditions(
        db,
        subscriber,
        settings=settings,
        window_start=new_window,
        resolution=resolution,
    )
    stmt = select(JobOffer).where(*conditions).order_by(JobOffer.published_at.desc().nullslast())
    offers = list(db.scalars(stmt.limit(50)).all())
    return offers, ["fallback_freshness"] * len(offers)


def _select_with_relaxed_experience(
    db: Session,
    subscriber: Subscriber,
    *,
    settings: Settings,
) -> tuple[list[JobOffer], list[str]]:
    """Tier T4: on double la tolerance d'experience."""
    # On construit des conditions hard avec un settings "virtuel" a tolerance x2.
    # Le plus simple: on elargit les bornes en SQL directement.
    from sqlalchemy import and_, or_

    from models import ExperienceLevel as EL
    resolution = _resolve_city(db, subscriber)
    window_start = _freshness_window(db, subscriber)
    base_conditions = _hard_filter_conditions(
        db,
        subscriber,
        settings=settings,
        window_start=window_start,
        resolution=resolution,
    )
    new_conditions = [c for c in base_conditions if "experience_level" not in str(c).lower() or "IS NULL" in str(c)]
    # On rajoute une condition experience tres elargie: tout chevauchement meme via min_years.
    if subscriber.experience_level is not None:
        tolerance = settings.experience_match_tolerance_years * 2
        sub_lo = max(0, (subscriber.experience_level.min_years or 0) - tolerance)
        sub_hi = (subscriber.experience_level.max_years or subscriber.experience_level.min_years or 0) + tolerance
        broad = exists().where(
            and_(
                EL.id == JobOffer.experience_level_id,
                or_(
                    EL.min_years.is_(None),
                    and_(
                        EL.min_years <= sub_hi,
                        or_(EL.max_years.is_(None), EL.max_years >= sub_lo),
                    ),
                ),
            )
        )
        new_conditions.append(or_(JobOffer.experience_level_id.is_(None), broad))
    else:
        new_conditions.append(JobOffer.experience_level_id.is_(None))
    stmt = select(JobOffer).where(*new_conditions).order_by(JobOffer.published_at.desc().nullslast())
    offers = list(db.scalars(stmt.limit(50)).all())
    return offers, ["fallback_experience"] * len(offers)


def _select_with_city_fallback(
    db: Session,
    subscriber: Subscriber,
    *,
    settings: Settings,
) -> tuple[list[JobOffer], list[str]]:
    """Tier T5: si ville non matchee, on inclut la ville de repli."""
    resolution = _resolve_city(db, subscriber)
    # On n'active T5 que si la ville n'est PAS resolue de maniere fiable.
    if resolution.kind == "exact":
        # Ville deja resolue: T5 ne fait rien de plus.
        return _select_for_tier(db, subscriber, tier="T4", settings=settings)
    window_start = _freshness_window(db, subscriber)
    conditions = _hard_filter_conditions(
        db,
        subscriber,
        settings=settings,
        window_start=window_start,
        resolution=resolution,
    )
    # On ajoute une condition: location.city = ville de repli.
    fallback_loc_ids = list(
        db.scalars(
            select(Location.id).where(Location.city == settings.digest_cascade_fallback_city)
        )
    )
    if fallback_loc_ids:
        new_cond = or_(conditions[-1], JobOffer.location_id.in_(fallback_loc_ids))
        new_conditions = conditions[:-1] + [new_cond]
    else:
        new_conditions = conditions
    stmt = select(JobOffer).where(*new_conditions).order_by(JobOffer.published_at.desc().nullslast())
    offers = list(db.scalars(stmt.limit(50)).all())
    return offers, ["fallback_city"] * len(offers)
