from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from celery_app import celery_app
from core.config import get_settings
from db.session import session_scope
from models import (
    AIJob,
    AIJobStatus,
    AIJobTrigger,
    AIOfferAttempt,
    AIOfferAttemptStatus,
    AiOfferStatus,
    AiProcessingJob,
    AiProcessingJobStatus,
    IngestionAction,
    JobOffer,
    JobOfferStatus,
    OfferIngestionEvent,
    ScrapeRun,
    ScrapeRunStatus,
    Source,
    SourceScrapeRun,
    SourceStatus,
)
from services.ai_batches import process_ai_batch_with_provider
from services.ai_errors import AIAllProvidersFailedError, AIProviderError
from services.ai_results import apply_ai_results
from services.normalization import slugify
from tasks.locks import redis_lock

logger = logging.getLogger(__name__)

RAW_STATUSES = {JobOfferStatus.BRUT, JobOfferStatus.LEGACY_BRUTE}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _trigger(value: str) -> AIJobTrigger:
    try:
        return AIJobTrigger(value)
    except ValueError:
        if value == "immediate":
            return AIJobTrigger.AUTO
        return AIJobTrigger.SWEEP


def _final_validation(offer: JobOffer) -> list[str]:
    errors: list[str] = []
    if not offer.title or not offer.title.strip():
        errors.append("title_missing")
    if not offer.company_id:
        errors.append("company_missing")
    if not offer.source_id:
        errors.append("source_missing")
    if not offer.hash_unique:
        errors.append("hash_missing")
    if not offer.source_url:
        errors.append("source_url_missing")
    if not offer.slug:
        offer.slug = slugify(f"{offer.title}-{offer.id}")
    if not offer.public_id:
        errors.append("public_id_missing")
    return errors


def _scrapers_finished_today(db: Session) -> bool:
    """Retourne True si l'IA peut traiter les offres brutes.

    Logique :
    - S'il n'y a aucune source active avec scraping -> True (rien a attendre)
    - S'il y a au moins 1 scraper en statut RUNNING -> False (attendre la fin)
    - Sinon (aucun scraper en cours) -> True, meme si certaines sources n'ont
      produit aucune offre aujourd'hui (0 nouvelles offres = pas d'ingestion
      = pas de ScrapeRun cree, ce qui est normal et ne doit pas bloquer l'IA)
    """
    active_sources = list(
        db.scalars(select(Source).where(Source.status == SourceStatus.ACTIVE, Source.supports_scraping.is_(True)))
    )
    if not active_sources:
        return True

    source_ids = {source.id for source in active_sources}
    running_count = (
        db.scalar(
            select(func.count(SourceScrapeRun.id)).where(
                SourceScrapeRun.source_id.in_(source_ids),
                SourceScrapeRun.status == ScrapeRunStatus.RUNNING,
            )
        )
        or 0
    )
    # Bloquer uniquement si un scraper est encore actif
    return running_count == 0


def _query_raw_offers(db: Session, scrape_run_id: str | None, external_batch_id: str | None, limit: int = 10) -> list[JobOffer]:
    stmt = (
        select(JobOffer)
        .options(
            selectinload(JobOffer.company),
            selectinload(JobOffer.source),
            selectinload(JobOffer.location),
            selectinload(JobOffer.primary_filiere),
            selectinload(JobOffer.contract_type),
            selectinload(JobOffer.experience_level),
            selectinload(JobOffer.education_level),
            selectinload(JobOffer.detail),
            selectinload(JobOffer.filiere_links),
        )
        .where(JobOffer.status.in_(RAW_STATUSES), JobOffer.visible_site.is_(False), JobOffer.deleted_at.is_(None))
    )
    if scrape_run_id:
        stmt = stmt.where(JobOffer.source_scrape_run.has(SourceScrapeRun.scrape_run_id == scrape_run_id))
    elif external_batch_id:
        run = db.scalar(select(ScrapeRun).where(ScrapeRun.external_batch_id == external_batch_id))
        if run is None:
            return []
        stmt = stmt.where(JobOffer.source_scrape_run.has(SourceScrapeRun.scrape_run_id == run.id))
    stmt = stmt.order_by(JobOffer.collected_at.asc()).limit(limit).with_for_update(skip_locked=True)
    return list(db.scalars(stmt).unique())


def _create_ai_job(db: Session, *, trigger_type: str) -> AIJob:
    job = AIJob(trigger_type=_trigger(trigger_type), status=AIJobStatus.PENDING, started_at=_now())
    db.add(job)
    db.flush()
    return job


def _legacy_job(db: Session, ai_job_id: str | None) -> AiProcessingJob | None:
    if not ai_job_id:
        return None
    return db.get(AiProcessingJob, ai_job_id)


def _process_without_external_ai(db: Session, offers: list[JobOffer], legacy_job: AiProcessingJob | None) -> dict:
    processed = activated = rejected = skipped = 0
    for offer in offers:
        if offer.status not in RAW_STATUSES:
            skipped += 1
            continue
        offer.status = JobOfferStatus.AI_PROCESSING
        offer.ai_status = AiOfferStatus.PROCESSING
        offer.ai_last_attempt_at = _now()
        offer.ai_attempts += 1
        db.flush()

        errors = _final_validation(offer)
        if errors:
            offer.status = JobOfferStatus.REJECTED
            offer.visible_site = False
            offer.ai_status = AiOfferStatus.FAILED
            offer.ai_error_message = ",".join(errors)[:1000]
            rejected += 1
            db.add(
                OfferIngestionEvent(
                    offer_id=offer.id,
                    source_scrape_run_id=offer.source_scrape_run_id,
                    action=IngestionAction.FAILED,
                    hash_unique=offer.hash_unique,
                    raw_url=offer.source_url,
                    reason=offer.ai_error_message[:255],
                    raw_payload=offer.raw_payload,
                )
            )
        else:
            offer.status = JobOfferStatus.ACTIVE
            offer.visible_site = True
            offer.ai_status = AiOfferStatus.NOOP
            offer.ai_error_message = None
            offer.ai_processed_at = _now()
            activated += 1
        processed += 1

    if legacy_job is not None:
        legacy_job.offers_processed = processed
        legacy_job.offers_activated = activated
        legacy_job.offers_rejected = rejected
        legacy_job.offers_skipped = skipped
        legacy_job.status = AiProcessingJobStatus.COMPLETED
        legacy_job.finished_at = _now()

    return {"status": "completed", "processed": processed, "activated": activated, "rejected": rejected, "skipped": skipped}


@celery_app.task(name="tasks.ai_processing.process_raw_offers", bind=True, autoretry_for=(ConnectionError,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def process_raw_offers(
    self,
    scrape_run_id: str | None = None,
    external_batch_id: str | None = None,
    ai_job_id: str | None = None,
    trigger_type: str = "auto",
    force: bool = False,
) -> dict:
    lock_name = f"lock:ai:process_raw_offers:{scrape_run_id or external_batch_id or 'sweep'}"
    with redis_lock(lock_name, ttl_seconds=900) as acquired:
        if not acquired:
            return {"status": "locked", "processed": 0}

        settings = get_settings()
        with session_scope() as db:
            if not force and not scrape_run_id and not external_batch_id and not _scrapers_finished_today(db):
                return {"status": "scrapers_running_or_missing", "processed": 0}

            legacy = _legacy_job(db, ai_job_id)
            if legacy is not None:
                legacy.status = AiProcessingJobStatus.RUNNING
                legacy.started_at = legacy.started_at or _now()
                legacy.celery_task_id = self.request.id

            offers = _query_raw_offers(db, scrape_run_id, external_batch_id, limit=10)
            if legacy is not None:
                legacy.offers_total = len(offers)
            if not offers:
                if legacy is not None:
                    legacy.status = AiProcessingJobStatus.SKIPPED
                    legacy.finished_at = _now()
                return {"status": "skipped", "processed": 0}

            if not settings.ai_enabled:
                result = _process_without_external_ai(db, offers, legacy)
                result["mode"] = "ai_disabled_noop"
                if legacy is not None:
                    result["ai_job_id"] = legacy.id
                return result

            job = _create_ai_job(db, trigger_type=trigger_type)
            job.celery_task_id = self.request.id
            job.status = AIJobStatus.RUNNING
            job.offers_total = len(offers)
            for offer in offers:
                offer.status = JobOfferStatus.AI_PROCESSING
                offer.visible_site = False
                offer.ai_status = AiOfferStatus.PROCESSING
                offer.ai_attempts += 1
                offer.ai_last_attempt_at = _now()
            db.flush()

            try:
                submission, summary = process_ai_batch_with_provider(db, job_id=job.id, offers=offers)
                summary = apply_ai_results(db, submission)
                for offer in offers:
                    db.add(
                        AIOfferAttempt(
                            offer_id=offer.id,
                            ai_job_id=job.id,
                            ai_api_key_id=str(submission.provider_key_id) if submission.provider_key_id else None,
                            attempt_number=max(offer.ai_attempts, 1),
                            status=AIOfferAttemptStatus.REVIEW_REQUIRED
                            if offer.requires_admin_review
                            else AIOfferAttemptStatus.SUCCESS,
                            response_metadata={"provider_key_id": str(submission.provider_key_id) if submission.provider_key_id else None},
                        )
                    )
                job.status = AIJobStatus.COMPLETED if summary.reprocess_required == 0 else AIJobStatus.PARTIAL_FAILURE
                job.finished_at = _now()
                if legacy is not None:
                    legacy.offers_processed = summary.processed
                    legacy.offers_activated = summary.activated
                    legacy.offers_rejected = summary.rejected
                    legacy.offers_skipped = summary.pending_review + summary.reprocess_required
                    legacy.status = AiProcessingJobStatus.COMPLETED
                    legacy.finished_at = _now()
                return summary.model_dump(mode="json") | {"status": job.status.value, "ai_job_id": job.id}
            except AIAllProvidersFailedError as exc:
                job.status = AIJobStatus.FAILED
                job.error_message = str(exc)[:1000]
                job.finished_at = _now()
                for offer in offers:
                    offer.status = JobOfferStatus.BRUT
                    offer.visible_site = False
                    offer.ai_status = AiOfferStatus.FAILED
                    offer.ai_error_message = str(exc)[:1000]
                if legacy is not None:
                    legacy.status = AiProcessingJobStatus.FAILED
                    legacy.error_message = str(exc)[:1000]
                    legacy.finished_at = _now()
                return {"status": "failed", "processed": 0, "error": str(exc), "ai_job_id": job.id}
            except AIProviderError as exc:
                job.status = AIJobStatus.FAILED
                job.error_message = str(exc)[:1000]
                job.finished_at = _now()
                for offer in offers:
                    offer.status = JobOfferStatus.BRUT
                    offer.visible_site = False
                    offer.ai_status = AiOfferStatus.FAILED
                    offer.ai_error_message = str(exc)[:1000]
                return {"status": "failed", "processed": 0, "error": str(exc), "ai_job_id": job.id}


@celery_app.task(name="tasks.ai_processing.trigger_ai_processing")
def trigger_ai_processing(scraper_results: list[dict] | None = None, force: bool = False) -> dict:
    result = process_raw_offers.apply_async(kwargs={"trigger_type": "auto", "force": force}, queue="ai")
    return {"status": "queued", "task_id": result.id, "scraper_results_count": len(scraper_results or [])}


@celery_app.task(name="tasks.ai_processing.sweep_raw_offers")
def sweep_raw_offers() -> dict:
    result = process_raw_offers.apply_async(kwargs={"trigger_type": "sweep"}, queue="ai")
    return {"status": "queued", "task_id": result.id}
