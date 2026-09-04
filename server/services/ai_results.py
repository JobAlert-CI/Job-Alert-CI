from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from models import (
    AIFiliereSuggestion,
    AIJob,
    AiOfferStatus,
    ContractType,
    EducationLevel,
    ExperienceLevel,
    Filiere,
    FiliereSpecialty,
    IngestionAction,
    JobOffer,
    JobOfferDetail,
    JobOfferStatus,
    OfferFiliere,
    OfferIngestionEvent,
)
from schemas.ai import AIInternalResultSubmission, AIValidationErrorItem, AIValidationSummary


def _now() -> datetime:
    return datetime.now(UTC)


def _optional_code(db: Session, model, code: str | None, label: str):
    if not code:
        return None
    item = db.scalar(select(model).where(model.code == code))
    if item is None:
        raise ValueError(f"{label} inconnu: {code}")
    if hasattr(item, "is_active") and not item.is_active:
        raise ValueError(f"{label} inactive: {code}")
    return item


def _resolve_specialty(db: Session, filiere: Filiere | None, code: str | None) -> FiliereSpecialty | None:
    if not code:
        return None
    stmt = select(FiliereSpecialty).where(FiliereSpecialty.code == code)
    if filiere is not None:
        stmt = stmt.where(FiliereSpecialty.filiere_id == filiere.id)
    specialty = db.scalar(stmt)
    if specialty is None:
        raise ValueError(f"Specialite inconnue: {code}")
    if not specialty.is_active:
        raise ValueError(f"Specialite inactive: {code}")
    return specialty


def _upsert_offer_filiere(db: Session, offer: JobOffer, filiere: Filiere, confidence: float) -> None:
    existing = db.scalar(select(OfferFiliere).where(OfferFiliere.offer_id == offer.id, OfferFiliere.filiere_id == filiere.id))
    for link in offer.filiere_links:
        link.is_primary = False
    if existing is None:
        db.add(OfferFiliere(offer_id=offer.id, filiere_id=filiere.id, confidence=confidence, is_primary=True))
    else:
        existing.confidence = confidence
        existing.is_primary = True


def _apply_detail(offer: JobOffer, result) -> None:
    if offer.detail is None:
        offer.detail = JobOfferDetail(is_manual=False)
    offer.detail.intro = result.detail.intro
    offer.detail.missions = result.detail.missions
    offer.detail.profile_requirements = result.detail.profile_requirements
    offer.detail.benefits = result.detail.benefits
    offer.detail.tags = result.detail.tags


def apply_ai_results(db: Session, payload: AIInternalResultSubmission) -> AIValidationSummary:
    errors: list[AIValidationErrorItem] = []
    activated = pending_review = rejected = reprocess_required = 0

    job = db.get(AIJob, str(payload.job_id))

    for result in payload.results:
        offer = db.get(JobOffer, str(result.offer_id))
        if offer is None:
            errors.append(AIValidationErrorItem(offer_id=result.offer_id, message="offre introuvable"))
            reprocess_required += 1
            continue
        if offer.status == JobOfferStatus.ACTIVE:
            errors.append(AIValidationErrorItem(offer_id=result.offer_id, message="offre deja active, ignoree"))
            continue

        try:
            filiere = _optional_code(db, Filiere, result.primary_filiere_code, "Filiere")
            if not result.requires_admin_review and filiere is None:
                raise ValueError("primary_filiere_code manquant alors que requires_admin_review est false")

            specialty = _resolve_specialty(db, filiere, result.specialty_code)
            contract_type = _optional_code(db, ContractType, result.contract_type_code, "Type de contrat")
            experience_level = _optional_code(db, ExperienceLevel, result.experience_level_code, "Niveau d'experience")
            education_level = _optional_code(db, EducationLevel, result.education_level_code, "Niveau de formation")

            _apply_detail(offer, result)
            offer.primary_filiere_id = filiere.id if filiere else None
            offer.specialty_id = specialty.id if specialty else None
            offer.contract_type_id = contract_type.id if contract_type else offer.contract_type_id
            offer.experience_level_id = experience_level.id if experience_level else offer.experience_level_id
            offer.education_level_id = education_level.id if education_level else offer.education_level_id
            offer.ai_confidence = result.filiere_confidence
            offer.ai_processed_at = _now()
            offer.ai_error_message = None
            offer.requires_admin_review = result.requires_admin_review
            offer.suggested_filiere_payload = result.suggested_filiere.model_dump(mode="json") if result.suggested_filiere else None

            if result.requires_admin_review:
                offer.status = JobOfferStatus.PENDING_REVIEW
                offer.visible_site = False
                offer.ai_status = AiOfferStatus.SKIPPED
                pending_review += 1
                if result.suggested_filiere is not None:
                    db.add(
                        AIFiliereSuggestion(
                            offer_id=offer.id,
                            job_id=str(payload.job_id),
                            code=result.suggested_filiere.code,
                            label=result.suggested_filiere.label,
                            reason=result.suggested_filiere.reason,
                        )
                    )
            else:
                offer.status = JobOfferStatus.ACTIVE
                offer.visible_site = True
                offer.ai_status = AiOfferStatus.NOOP
                activated += 1
                if filiere is not None:
                    _upsert_offer_filiere(db, offer, filiere, result.filiere_confidence)

            db.add(
                OfferIngestionEvent(
                    offer_id=offer.id,
                    source_scrape_run_id=offer.source_scrape_run_id,
                    action=IngestionAction.UPDATED,
                    hash_unique=offer.hash_unique,
                    raw_url=offer.source_url,
                    reason="ai_result_applied",
                    raw_payload={"job_id": str(payload.job_id), "provider_key_id": str(payload.provider_key_id) if payload.provider_key_id else None},
                )
            )
        except ValueError as exc:
            offer.status = JobOfferStatus.BRUT
            offer.visible_site = False
            offer.ai_status = AiOfferStatus.FAILED
            offer.ai_error_message = str(exc)[:1000]
            offer.ai_processed_at = _now()
            errors.append(AIValidationErrorItem(offer_id=result.offer_id, message=str(exc)))
            reprocess_required += 1

    processed = activated + pending_review + rejected
    if job is not None:
        job.offers_activated = activated
        job.offers_pending_review = pending_review
        job.offers_rejected = rejected
        job.offers_reprocess_required = reprocess_required

    return AIValidationSummary(
        job_id=payload.job_id,
        processed=processed,
        activated=activated,
        pending_review=pending_review,
        rejected=rejected,
        reprocess_required=reprocess_required,
        reprocess_offer_ids=[error.offer_id for error in errors if error.offer_id is not None],
        errors=errors,
    )
