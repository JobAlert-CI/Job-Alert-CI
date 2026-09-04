from __future__ import annotations

from collections.abc import Iterable
from typing import Any
from uuid import UUID

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from models import (
    AIJob,
    ContractType,
    EducationLevel,
    ExperienceLevel,
    Filiere,
    JobOffer,
)
from schemas.ai import (
    AIBatchOfferInput,
    AIBatchRequest,
    AIInternalResultSubmission,
    AIJobResultPayload,
    AIProcessedOfferResult,
    AIProviderBatchResponse,
    AIReferentialItem,
    AIReferentialSpecialty,
    AIValidationErrorItem,
    AIValidationSummary,
)
from services.ai_errors import AIResponseValidationError
from services.ai_key_manager import AIProviderExecutionResult, generate_structured_with_fallback
from services.ai_prompts import ai_response_schema_hint, build_batch_prompt

MAX_DESCRIPTION_CHARS = 6000
MAX_RAW_PAYLOAD_KEYS = 24
MAX_RAW_PAYLOAD_VALUE_CHARS = 1200


def _truncate(value: str | None, max_chars: int) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    if len(stripped) <= max_chars:
        return stripped
    return stripped[:max_chars].rstrip()


def _safe_raw_payload(raw_payload: dict | None) -> dict[str, Any] | None:
    if not raw_payload:
        return None

    safe: dict[str, Any] = {}
    for index, (key, value) in enumerate(raw_payload.items()):
        if index >= MAX_RAW_PAYLOAD_KEYS:
            break
        if key.lower() in {"api_key", "token", "authorization", "password", "secret"}:
            continue
        if isinstance(value, str):
            safe[key] = _truncate(value, MAX_RAW_PAYLOAD_VALUE_CHARS)
        elif isinstance(value, (int, float, bool)) or value is None:
            safe[key] = value
        elif isinstance(value, list):
            safe[key] = [
                _truncate(item, 300) if isinstance(item, str) else item
                for item in value[:20]
                if isinstance(item, (str, int, float, bool)) or item is None
            ]
        elif isinstance(value, dict):
            safe[key] = {
                str(child_key): _truncate(child_value, 300) if isinstance(child_value, str) else child_value
                for child_key, child_value in list(value.items())[:12]
                if isinstance(child_value, (str, int, float, bool)) or child_value is None
            }
    return safe or None


def _description_from_offer(offer: JobOffer) -> str | None:
    if offer.detail and offer.detail.source_text:
        return _truncate(offer.detail.source_text, MAX_DESCRIPTION_CHARS)
    if offer.raw_payload:
        for key in ("description", "detail", "details", "source_text", "content", "missions"):
            value = offer.raw_payload.get(key)
            if isinstance(value, str) and value.strip():
                return _truncate(value, MAX_DESCRIPTION_CHARS)
    if offer.detail and offer.detail.intro:
        return _truncate(offer.detail.intro, MAX_DESCRIPTION_CHARS)
    return None


def load_ai_referentials(db: Session) -> tuple[
    list[AIReferentialItem],
    list[AIReferentialItem],
    list[AIReferentialItem],
    list[AIReferentialItem],
]:
    filieres = list(
        db.scalars(
            select(Filiere)
            .options(selectinload(Filiere.specialties))
            .where(Filiere.is_active.is_(True))
            .order_by(Filiere.sort_order, Filiere.label)
        )
    )
    contract_types = list(
        db.scalars(select(ContractType).where(ContractType.is_active.is_(True)).order_by(ContractType.sort_order))
    )
    experience_levels = list(
        db.scalars(select(ExperienceLevel).where(ExperienceLevel.is_active.is_(True)).order_by(ExperienceLevel.sort_order))
    )
    education_levels = list(
        db.scalars(select(EducationLevel).where(EducationLevel.is_active.is_(True)).order_by(EducationLevel.sort_order))
    )

    filiere_items = [
        AIReferentialItem(
            code=filiere.code,
            label=filiere.label,
            specialties=[
                AIReferentialSpecialty(code=specialty.code, label=specialty.label)
                for specialty in filiere.specialties
                if specialty.is_active
            ],
        )
        for filiere in filieres
    ]
    return (
        filiere_items,
        [AIReferentialItem(code=item.code, label=item.label) for item in contract_types],
        [AIReferentialItem(code=item.code, label=item.label) for item in experience_levels],
        [AIReferentialItem(code=item.code, label=item.label) for item in education_levels],
    )


def build_batch_offer_input(offer: JobOffer) -> AIBatchOfferInput:
    return AIBatchOfferInput(
        offer_id=UUID(offer.id),
        title=offer.title,
        company_name=offer.company.name if offer.company else None,
        source_code=offer.source.code if offer.source else "",
        source_url=offer.source_url,
        location_raw=offer.location_raw or (offer.location.label if offer.location else None),
        salary_raw=offer.salary_raw,
        description=_description_from_offer(offer),
        source_text=offer.detail.source_text if offer.detail else None,
        raw_payload=_safe_raw_payload(offer.raw_payload),
        published_at=offer.published_at,
        contract_type_code=offer.contract_type.code if offer.contract_type else None,
        experience_level_code=offer.experience_level.code if offer.experience_level else None,
        education_level_code=offer.education_level.code if offer.education_level else None,
        primary_filiere_code=offer.primary_filiere.code if offer.primary_filiere else None,
    )


def build_ai_batch_request(db: Session, offers: Iterable[JobOffer], *, job_id: str | None = None) -> AIBatchRequest:
    filieres, contract_types, experience_levels, education_levels = load_ai_referentials(db)
    return AIBatchRequest(
        job_id=UUID(job_id) if job_id else None,
        offers=[build_batch_offer_input(offer) for offer in offers],
        filieres=filieres,
        contract_types=contract_types,
        experience_levels=experience_levels,
        education_levels=education_levels,
        schema_hint=ai_response_schema_hint(),
    )


def validate_provider_response(raw_response: dict, expected_offer_ids: set[UUID]) -> tuple[list[AIProcessedOfferResult], list[AIValidationErrorItem]]:
    try:
        parsed = AIProviderBatchResponse.model_validate(raw_response)
    except ValidationError as exc:
        raise AIResponseValidationError(str(exc)) from exc

    valid_results: list[AIProcessedOfferResult] = []
    errors: list[AIValidationErrorItem] = []
    seen_offer_ids: set[UUID] = set()

    for result in parsed.results:
        if result.offer_id not in expected_offer_ids:
            errors.append(AIValidationErrorItem(offer_id=result.offer_id, message="offer_id inconnu dans la reponse IA"))
            continue
        if result.offer_id in seen_offer_ids:
            errors.append(AIValidationErrorItem(offer_id=result.offer_id, message="resultat IA duplique pour cette offre"))
            continue
        seen_offer_ids.add(result.offer_id)
        valid_results.append(result)

    for missing_offer_id in expected_offer_ids - seen_offer_ids:
        errors.append(AIValidationErrorItem(offer_id=missing_offer_id, message="offre absente de la reponse IA"))

    return valid_results, errors


def build_internal_submission(
    *,
    job_id: str,
    provider_result: AIProviderExecutionResult,
    results: list[AIProcessedOfferResult],
) -> AIInternalResultSubmission:
    return AIInternalResultSubmission(
        job_id=UUID(job_id),
        provider_key_id=UUID(provider_result.api_key_id),
        results=results,
    )


def summarize_ai_results(payload: AIJobResultPayload, errors: list[AIValidationErrorItem]) -> AIValidationSummary:
    pending_review = sum(1 for result in payload.results if result.requires_admin_review)
    activated = len(payload.results) - pending_review
    return AIValidationSummary(
        job_id=payload.job_id,
        processed=len(payload.results),
        activated=activated,
        pending_review=pending_review,
        rejected=0,
        reprocess_required=len(errors),
        reprocess_offer_ids=[error.offer_id for error in errors if error.offer_id is not None],
        errors=errors,
    )


def process_ai_batch_with_provider(
    db: Session,
    *,
    job_id: str,
    offers: Iterable[JobOffer],
) -> tuple[AIInternalResultSubmission, AIValidationSummary]:
    batch_request = build_ai_batch_request(db, offers, job_id=job_id)
    expected_offer_ids = {offer.offer_id for offer in batch_request.offers}
    prompt = build_batch_prompt(batch_request)
    provider_result = generate_structured_with_fallback(
        db,
        prompt=prompt,
        schema_hint=batch_request.schema_hint,
        job_id=job_id,
    )
    job = db.get(AIJob, job_id)
    if job is not None:
        job.primary_api_key_id = provider_result.api_key_id
        job.fallback_count = provider_result.fallback_count
    results, errors = validate_provider_response(provider_result.data, expected_offer_ids)
    submission = build_internal_submission(job_id=job_id, provider_result=provider_result, results=results)
    summary = summarize_ai_results(submission, errors)
    return submission, summary
