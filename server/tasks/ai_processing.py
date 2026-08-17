from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from celery_app import celery_app
from db.session import session_scope
from models import (
    AiOfferStatus,
    AiProcessingJob,
    AiProcessingJobStatus,
    AiProcessingJobTrigger,
    IngestionAction,
    JobOffer,
    JobOfferStatus,
    OfferIngestionEvent,
    ScrapeRun,
    SourceScrapeRun,
)
from services.ai_processor import get_ai_processor
from services.normalization import slugify
from tasks.locks import redis_lock

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


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


def _query_raw_offers(db: Session, scrape_run_id: str | None, external_batch_id: str | None):
    stmt = select(JobOffer).where(JobOffer.status == JobOfferStatus.BRUTE)
    if scrape_run_id:
        stmt = stmt.where(JobOffer.source_scrape_run.has(SourceScrapeRun.scrape_run_id == scrape_run_id))
    elif external_batch_id:
        run = db.scalar(select(ScrapeRun).where(ScrapeRun.external_batch_id == external_batch_id))
        if run is None:
            return []
        stmt = stmt.where(JobOffer.source_scrape_run.has(SourceScrapeRun.scrape_run_id == run.id))
    stmt = stmt.order_by(JobOffer.created_at.asc()).limit(200).with_for_update(skip_locked=True)
    return list(db.scalars(stmt))


def _get_or_create_ai_job(
    db: Session,
    *,
    ai_job_id: str | None,
    scrape_run_id: str | None,
    trigger_type: str,
) -> AiProcessingJob:
    if ai_job_id:
        job = db.get(AiProcessingJob, ai_job_id)
        if job is not None:
            return job
    job = AiProcessingJob(
        scrape_run_id=scrape_run_id,
        trigger_type=AiProcessingJobTrigger(trigger_type),
        status=AiProcessingJobStatus.PENDING,
    )
    db.add(job)
    db.flush()
    return job


@celery_app.task(name="tasks.ai_processing.process_raw_offers", bind=True, autoretry_for=(ConnectionError,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def process_raw_offers(
    self,
    scrape_run_id: str | None = None,
    external_batch_id: str | None = None,
    ai_job_id: str | None = None,
    trigger_type: str = "immediate",
) -> dict:
    lock_name = f"ai:process_raw_offers:{scrape_run_id or external_batch_id or 'sweep'}"
    with redis_lock(lock_name, ttl_seconds=900) as acquired:
        if not acquired:
            return {"status": "locked", "processed": 0}

        with session_scope() as db:
            job = _get_or_create_ai_job(
                db,
                ai_job_id=ai_job_id,
                scrape_run_id=scrape_run_id,
                trigger_type=trigger_type,
            )
            job.status = AiProcessingJobStatus.RUNNING
            job.celery_task_id = self.request.id
            job.started_at = job.started_at or _now()
            db.flush()

            offers = _query_raw_offers(db, scrape_run_id, external_batch_id)
            job.offers_total = len(offers)
            if not offers:
                job.status = AiProcessingJobStatus.SKIPPED
                job.finished_at = _now()
                return {"status": "skipped", "processed": 0}

            processor = get_ai_processor()
            processed = activated = rejected = skipped = 0

            for offer in offers:
                if offer.status != JobOfferStatus.BRUTE:
                    skipped += 1
                    continue

                offer.status = JobOfferStatus.PROCESSING
                offer.ai_status = AiOfferStatus.PROCESSING
                offer.ai_processing_job_id = job.id
                db.flush()

                result = processor.process_offer(offer.raw_payload or {})
                validation_errors = _final_validation(offer)
                offer.ai_provider = result.provider
                offer.ai_model = result.model
                offer.ai_confidence = result.confidence
                offer.ai_processed_at = _now()

                if validation_errors or result.error:
                    reason = result.error or ",".join(validation_errors)
                    offer.status = JobOfferStatus.REJECTED
                    offer.visible_site = False
                    offer.ai_status = AiOfferStatus.FAILED
                    offer.ai_error_message = reason[:1000]
                    rejected += 1
                    db.add(
                        OfferIngestionEvent(
                            offer_id=offer.id,
                            source_scrape_run_id=offer.source_scrape_run_id,
                            action=IngestionAction.FAILED,
                            hash_unique=offer.hash_unique,
                            raw_url=offer.source_url,
                            reason=reason[:255],
                            raw_payload=offer.raw_payload,
                        )
                    )
                else:
                    offer.status = JobOfferStatus.ACTIVE
                    offer.visible_site = True
                    offer.ai_status = AiOfferStatus.NOOP
                    offer.ai_error_message = None
                    activated += 1
                processed += 1

            job.offers_processed = processed
            job.offers_activated = activated
            job.offers_rejected = rejected
            job.offers_skipped = skipped
            job.status = AiProcessingJobStatus.COMPLETED
            job.finished_at = _now()
            logger.info(
                "Job IA factice termine",
                extra={"task_id": self.request.id, "scrape_run_id": scrape_run_id, "processed": processed},
            )
            return {
                "status": "completed",
                "processed": processed,
                "activated": activated,
                "rejected": rejected,
                "skipped": skipped,
                "ai_job_id": job.id,
            }
