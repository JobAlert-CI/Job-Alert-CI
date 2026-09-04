from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, date, datetime, time
from zoneinfo import ZoneInfo

from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.orm import Session, selectinload

from core.config import Settings, get_settings
from models import (
    DigestStatus,
    EmailDigest,
    EmailDigestOffer,
    ExperienceLevel,
    JobOffer,
    JobOfferStatus,
    Location,
    Subscriber,
    SubscriberFiliere,
    SubscriberStatus,
)
from services.city_matching_service import CityMatchingService, CityResolution
from services.scoring_service import SubscriberScoringContext, compute_offer_score, rank_offers

"""Phase 1 du digest quotidien : selection des offres et creation des EmailDigest.

Regles cles (prompt_send_offres_email.md):
- seuls les abonnes actifs avec au moins une filiere sont eligibles;
- filtres durs separes du scoring: statut/visibilite (index ix_job_offers_feed),
  jamais envoyee deux fois au meme abonne (NOT EXISTS sur digest `sent`),
  filiere principale, contrat, experience, ville, fraicheur;
- un digest est cree meme sans offre (skipped_empty);
- UNIQUE(subscriber_id, digest_date): pas de second digest pour la meme date;
  en mode `force`, un digest non envoye (non sent/sending) peut etre recalcule.
"""

logger = logging.getLogger(__name__)

# Borne haute d'offres chargees avant scoring, pour borner la memoire par abonne.
_CANDIDATE_FETCH_CAP = 50


@dataclass(slots=True)
class DigestBuildResult:
    """Resultat exploitable renvoye par la construction d'un digest."""

    subscriber_id: str
    digest_id: str | None
    status: str
    offer_count: int
    detail: str | None = None


def digest_date_for(day: date | None = None, *, tz_name: str | None = None) -> date:
    """Date du digest calculee dans la timezone du digest (Africa/Abidjan)."""

    tz = ZoneInfo(tz_name or get_settings().digest_timezone)
    reference = day or datetime.now(tz).date()
    return reference


def scheduled_send_time(digest_day: date, *, settings: Settings | None = None) -> datetime:
    """Datetime aware (UTC) de l'heure d'envoi cible pour ce digest."""

    resolved = settings or get_settings()
    tz = ZoneInfo(resolved.digest_timezone)
    local_send = datetime.combine(
        digest_day,
        time(hour=resolved.daily_digest_send_hour, minute=resolved.daily_digest_send_minute),
        tzinfo=tz,
    )
    return local_send.astimezone(UTC)


def _as_aware(value: datetime | None) -> datetime | None:
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=UTC)


def is_subscriber_eligible(subscriber: Subscriber, now: datetime | None = None) -> bool:
    """Elibilite partagee par la preparation ET l'envoi (derniere verification)."""

    effective_now = _as_aware(now) or datetime.now(UTC)
    if subscriber.status != SubscriberStatus.ACTIVE:
        return False
    if getattr(subscriber, "deleted_at", None) is not None:
        return False
    email = (subscriber.email or "").strip()
    if "@" not in email:
        return False
    if not subscriber.filiere_links:
        return False
    paused_until = _as_aware(subscriber.paused_until)
    # SIM103 (audit 3, Q1) : condition negee retournee directement.
    return paused_until is None or paused_until <= effective_now


def get_eligible_subscriber_ids(db: Session) -> list[str]:
    """Ids des abonnes eligibles, tries pour un parcours deterministe.

    La requete ne charge que les ids; l'orchestrateur iterera ensuite avec
    yield_per() pour ne jamais charger toute la table en RAM.
    """

    has_filiere = exists().where(SubscriberFiliere.subscriber_id == Subscriber.id)
    stmt = (
        select(Subscriber.id)
        .where(
            Subscriber.status == SubscriberStatus.ACTIVE,
            Subscriber.deleted_at.is_(None),
            has_filiere,
            or_(
                Subscriber.paused_until.is_(None),
                Subscriber.paused_until <= func.now(),
            ),
        )
        .order_by(Subscriber.id)
    )
    return list(db.scalars(stmt))


def get_eligible_subscribers_iter(db: Session):
    """Iterateur memoire-efficace sur les abonnes eligibles (yield_per)."""

    has_filiere = exists().where(SubscriberFiliere.subscriber_id == Subscriber.id)
    stmt = (
        select(Subscriber)
        .options(selectinload(Subscriber.filiere_links))
        .where(
            Subscriber.status == SubscriberStatus.ACTIVE,
            Subscriber.deleted_at.is_(None),
            has_filiere,
            or_(
                Subscriber.paused_until.is_(None),
                Subscriber.paused_until <= func.now(),
            ),
        )
        .order_by(Subscriber.id)
    )
    yield from db.scalars(stmt).yield_per(100)


def _freshness_window(db: Session, subscriber: Subscriber) -> datetime | None:
    """Point de depart de fraicheur: dernier digest reellement envoye.

    Un digest `skipped_empty` ne remet PAS le compteur a zero.
    Fallback: confirmed_at, sinon subscribed_at.
    """

    last_sent_at = db.scalar(
        select(EmailDigest.sent_at)
        .where(
            EmailDigest.subscriber_id == subscriber.id,
            EmailDigest.status == DigestStatus.SENT,
            EmailDigest.sent_at.is_not(None),
        )
        .order_by(EmailDigest.sent_at.desc())
        .limit(1)
    )
    window_start = _as_aware(last_sent_at)
    if window_start is not None:
        return window_start
    candidates = [
        aware
        for aware in (_as_aware(subscriber.confirmed_at), _as_aware(subscriber.subscribed_at))
        if aware is not None
    ]
    return min(candidates) if candidates else None


def _resolve_city(db: Session, subscriber: Subscriber) -> CityResolution:
    """Resolution de la ville libre contre le referentiel Location actif."""

    locations = db.scalars(select(Location).where(Location.is_active.is_(True))).all()
    service = CityMatchingService(locations)
    return service.resolve(subscriber.city)


def _build_scoring_context(subscriber: Subscriber, resolution: CityResolution) -> SubscriberScoringContext:
    filiere_priorities = {link.filiere_id: link.priority for link in subscriber.filiere_links}
    contract_type_ids = {pref.contract_type_id for pref in subscriber.contract_preferences}
    subscriber_experience = subscriber.experience_level
    return SubscriberScoringContext(
        filiere_priorities=filiere_priorities,
        contract_type_ids=contract_type_ids,
        subscriber_min_years=subscriber_experience.min_years if subscriber_experience else None,
        subscriber_max_years=subscriber_experience.max_years if subscriber_experience else None,
        city_resolution=resolution,
    )


def _hard_filter_conditions(
    db: Session,
    subscriber: Subscriber,
    *,
    settings: Settings,
    window_start: datetime | None,
    resolution: CityResolution,
) -> list:
    """Filtres DURS: chaque condition ici EXCLUT une offre. Aucun classement."""

    filiere_ids = [link.filiere_id for link in subscriber.filiere_links]

    conditions = [
        # 1. Statut et visibilite (colonnes de tete de ix_job_offers_feed).
        JobOffer.visible_site.is_(True),
        JobOffer.status == JobOfferStatus.ACTIVE,
        # 2. Jamais deja envoyee a cet abonne (digest `sent` uniquement).
        ~exists().where(
            EmailDigestOffer.offer_id == JobOffer.id,
            EmailDigestOffer.digest_id == EmailDigest.id,
            EmailDigest.subscriber_id == subscriber.id,
            EmailDigest.status == DigestStatus.SENT,
        ),
        # 3. Correspondance de filiere principale.
        JobOffer.primary_filiere_id.in_(filiere_ids),
    ]

    # 4. Type de contrat.
    preferred_contract_ids = [pref.contract_type_id for pref in subscriber.contract_preferences]
    if preferred_contract_ids:
        contract_condition = JobOffer.contract_type_id.in_(preferred_contract_ids)
        if settings.digest_include_no_contract_offers:
            contract_condition = or_(contract_condition, JobOffer.contract_type_id.is_(None))
        conditions.append(contract_condition)

    # 5. Niveau d'experience: offre sans exigence toujours compatible;
    #    sinon chevauchement des tranches d'annees (+/- tolerance).
    experience_condition = JobOffer.experience_level_id.is_(None)
    subscriber_experience = subscriber.experience_level
    if subscriber_experience is not None:
        tolerance = settings.experience_match_tolerance_years
        sub_lo = max(0, (subscriber_experience.min_years or 0) - tolerance)
        sub_hi = (subscriber_experience.max_years if subscriber_experience.max_years is not None else subscriber_experience.min_years or 0) + tolerance
        compatible_experience = exists().where(
            ExperienceLevel.id == JobOffer.experience_level_id,
            or_(
                ExperienceLevel.min_years.is_(None),
                and_(
                    ExperienceLevel.min_years <= sub_hi,
                    or_(
                        ExperienceLevel.max_years.is_(None),
                        ExperienceLevel.max_years >= sub_lo,
                    ),
                ),
            ),
        )
        experience_condition = or_(experience_condition, compatible_experience)
    conditions.append(experience_condition)

    # 6. Ville texte libre.
    subscriber_has_city = bool(resolution.normalized_city)
    if resolution.matched_location_ids:
        city_condition = JobOffer.location_id.in_(resolution.matched_location_ids)
        if settings.include_remote_offers:
            city_condition = or_(
                city_condition,
                exists().where(and_(Location.id == JobOffer.location_id, Location.is_remote.is_(True))),
            )
        if settings.digest_include_no_location_offers:
            city_condition = or_(city_condition, JobOffer.location_id.is_(None))
        conditions.append(city_condition)
    elif subscriber_has_city:
        # Ville non matchee: pas de fuzzy matching dangereux. Remote seulement
        # si la configuration l'autorise, plus les offres sans localisation.
        allowed = []
        if settings.include_remote_offers_for_unmatched_city:
            allowed.append(exists().where(and_(Location.id == JobOffer.location_id, Location.is_remote.is_(True))))
        if settings.digest_include_no_location_offers:
            allowed.append(JobOffer.location_id.is_(None))
        if allowed:
            conditions.append(or_(*allowed))
        else:
            # Aucune offre localisee ne peut matcher proprement.
            conditions.append(JobOffer.location_id.is_(None) if settings.digest_include_no_location_offers else false_clause())
    else:
        # Cas 1: abonne sans ville. Par defaut (prefer_city) toutes les offres;
        # mode explicite remote_only => uniquement les offres distantes.
        if settings.digest_city_mode == "remote_only":
            conditions.append(exists().where(and_(Location.id == JobOffer.location_id, Location.is_remote.is_(True))))

    # 7. Fraicheur depuis le dernier digest reellement envoye.
    if window_start is not None:
        conditions.append(
            or_(
                JobOffer.published_at >= window_start,
                and_(JobOffer.published_at.is_(None), JobOffer.collected_at >= window_start),
            )
        )

    return conditions


def false_clause():
    """Condition SQL toujours fausse (SQLAlchemy generic)."""

    from sqlalchemy import false

    return false()


def select_candidate_offers(
    db: Session,
    subscriber: Subscriber,
    *,
    settings: Settings | None = None,
    now: datetime | None = None,
) -> tuple[list[object], CityResolution]:
    """Applique les filtres durs puis retourne les offres classees par score.

    Renvoie (offres_rangees, resolution_ville). Le nombre d'offres chargees
    avant scoring est borne (_CANDIDATE_FETCH_CAP) pour contenir la RAM.
    """

    resolved_settings = settings or get_settings()
    effective_now = _as_aware(now) or datetime.now(UTC)

    resolution = _resolve_city(db, subscriber)
    window_start = _freshness_window(db, subscriber)

    conditions = _hard_filter_conditions(
        db,
        subscriber,
        settings=resolved_settings,
        window_start=window_start,
        resolution=resolution,
    )
    stmt = (
        select(JobOffer)
        .options(selectinload(JobOffer.location), selectinload(JobOffer.experience_level))
        .where(*conditions)
        .order_by(JobOffer.published_at.desc().nullslast(), JobOffer.collected_at.desc(), JobOffer.title)
        .limit(_CANDIDATE_FETCH_CAP)
    )
    candidates = db.scalars(stmt).all()

    context = _build_scoring_context(subscriber, resolution)
    scored = [(offer, compute_offer_score(offer, context, effective_now)) for offer in candidates]
    ranked = rank_offers(scored)
    return ranked, resolution


def _replace_digest_offers(
    db: Session,
    digest: EmailDigest,
    offers: list[object],
    *,
    match_kinds: dict[str, str] | None = None,
) -> None:
    """Remplace les lignes EmailDigestOffer en respectant les contraintes UNIQUE.

    Suppression explicite + flush AVANT les inserts: evite tout conflit entre
    DELETE et INSERT dans le meme flush.

    `match_kinds` (offre_id -> 'primary'/'secondary'/...) est persiste sur
    chaque ligne pour permettre a l'email de distinguer la section
    "Selectionnees pour vous" de "Pourrait aussi vous interesser".
    """

    db.query(EmailDigestOffer).filter(EmailDigestOffer.digest_id == digest.id).delete(synchronize_session=False)
    db.flush()
    for position, offer in enumerate(offers, start=1):
        kind = (match_kinds or {}).get(offer.id, "primary")
        db.add(EmailDigestOffer(
            digest_id=digest.id,
            offer_id=offer.id,
            position=position,
            match_kind=kind,
        ))


def build_and_queue_digest_sync(
    db: Session,
    *,
    subscriber_id: str,
    digest_day: date,
    settings: Settings | None = None,
    force: bool = False,
) -> DigestBuildResult:
    """Construit le digest d'un abonne pour une date donnee (phase 1).

    - aucune offre => EmailDigest `skipped_empty` (offre_count=0);
    - offres => EmailDigest `queued` + EmailDigestOffer positionnes 1..N;
    - digest deja existant: ignore sauf mode `force` et statut non sent/sending.
    """

    resolved_settings = settings or get_settings()

    subscriber = db.scalar(
        select(Subscriber)
        .options(
            selectinload(Subscriber.filiere_links),
            selectinload(Subscriber.contract_preferences),
            selectinload(Subscriber.experience_level),
        )
        .where(Subscriber.id == subscriber_id)
    )
    if subscriber is None:
        return DigestBuildResult(subscriber_id=subscriber_id, digest_id=None, status="missing", offer_count=0, detail="abonne introuvable")
    if not is_subscriber_eligible(subscriber):
        return DigestBuildResult(subscriber_id=subscriber_id, digest_id=None, status="ineligible", offer_count=0)

    existing = db.scalar(
        select(EmailDigest).where(
            EmailDigest.subscriber_id == subscriber_id,
            EmailDigest.digest_date == digest_day,
        )
    )
    if existing is not None:
        replaceable = existing.status not in {DigestStatus.SENT, DigestStatus.SENDING}
        if not (force and replaceable):
            return DigestBuildResult(
                subscriber_id=subscriber_id,
                digest_id=existing.id,
                status=existing.status.value,
                offer_count=existing.offer_count,
                detail="digest deja existant",
            )
        digest = existing
    else:
        digest = EmailDigest(subscriber_id=subscriber_id, digest_date=digest_day)
        db.add(digest)

    ranked, resolution = select_candidate_offers(db, subscriber, settings=resolved_settings)
    if not subscriber_has_reliable_city(resolution):
        # Journalise les villes non matchees pour audit (matching prudent).
        logger.info("digest_city_unmatched", extra={"subscriber_id": subscriber_id, "city": subscriber.city})

    selected = ranked[: resolved_settings.digest_max_offers]
    digest.scheduled_for = scheduled_send_time(digest_day, settings=resolved_settings)
    digest.template_version = "v1"

    # Cascade T0-T5 (defaut active, peut etre desactivee via setting
    # digest_cascade_enabled si on veut revenir au comportement strict seul).
    cascade_enabled = getattr(resolved_settings, "digest_cascade_enabled", True)
    if cascade_enabled and len(selected) < resolved_settings.digest_min_offers:
        from services.digest_cascade_selector import select_with_cascade

        outcome = select_with_cascade(db, subscriber=subscriber, settings=resolved_settings)
        if not outcome.insufficient and outcome.selected_offers:
            ranked = outcome.selected_offers
            selected = ranked[: resolved_settings.digest_max_offers]
            digest.match_tier = outcome.tier
            # On garde la trace des match_kinds pour les persister sur les liens.
            digest._pending_match_kinds = dict(zip(
                [o.id for o in outcome.selected_offers],
                outcome.match_kinds,
                strict=False,  # match_kinds peut etre plus court (troncature)
            ))
            # On reaffecte aussi le resolution pour la trace.
            if not subscriber_has_reliable_city(resolution):
                logger.info(
                    "digest_cascade_relached",
                    extra={
                        "subscriber_id": subscriber_id,
                        "tier": outcome.tier,
                        "match_kinds": outcome.match_kinds,
                    },
                )

    if not selected:
        digest.status = DigestStatus.SKIPPED_EMPTY
        digest.offer_count = 0
        digest.skipped_reason = "no_matching_offer"
        digest.subject = None
        if force:
            _replace_digest_offers(db, digest, [])
        db.flush()
        return DigestBuildResult(subscriber_id=subscriber_id, digest_id=digest.id, status=DigestStatus.SKIPPED_EMPTY.value, offer_count=0)

    digest.status = DigestStatus.QUEUED
    digest.offer_count = len(selected)
    digest.skipped_reason = None
    digest.subject = f"{len(selected)} nouvelles offres pour vous sur JobAlert CI"
    digest.payload_preview = {
        "titles": [getattr(offer, "title", "") for offer in selected],
    }
    _replace_digest_offers(db, digest, selected, match_kinds=getattr(digest, "_pending_match_kinds", None))
    db.flush()
    return DigestBuildResult(subscriber_id=subscriber_id, digest_id=digest.id, status=DigestStatus.QUEUED.value, offer_count=len(selected))


def subscriber_has_reliable_city(resolution: CityResolution) -> bool:
    """Vrai si la ville de l'abonne a trouve une correspondance fiable."""

    return resolution.kind != "unmatched"
