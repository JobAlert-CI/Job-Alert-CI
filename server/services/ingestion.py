from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.config import get_settings
from models import (
    AiOfferStatus,
    AiProcessingJob,
    AiProcessingJobStatus,
    AiProcessingJobTrigger,
    Company,
    ContractType,
    EducationLevel,
    ExperienceLevel,
    Filiere,
    IngestionAction,
    JobOffer,
    JobOfferDetail,
    JobOfferOrigin,
    JobOfferStatus,
    OfferFiliere,
    OfferIngestionEvent,
    ScrapeRun,
    ScrapeRunStatus,
    Source,
    SourceScrapeRun,
    SourceStatus,
)
from schemas.ingestion import IngestBatchCreate, IngestBatchSummaryRead, IngestOfferItemCreate
from services.normalization import normalize_text, slugify

logger = logging.getLogger(__name__)


class IngestionError(ValueError):
    pass


def compute_offer_hash(
    *,
    source_code: str,
    source_reference: str | None,
    title: str | None,
    company_name: str | None,
    source_url: str | None,
    canonical_url: str | None,
) -> str:
    if canonical_url:
        raw = canonical_url
    elif source_url:
        raw = source_url
    elif source_reference:
        raw = f"{source_code}|{source_reference}"
    else:
        raw = f"{source_code}|{normalize_text(title)}|{normalize_text(company_name)}"
    return hashlib.sha256(normalize_text(raw).encode("utf-8")).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _abidjan_date() -> datetime.date:
    return datetime.now(ZoneInfo(get_settings().timezone)).date()


def _event(
    db: Session,
    *,
    source_run: SourceScrapeRun | None,
    action: IngestionAction,
    offer: JobOffer | None = None,
    hash_unique: str | None = None,
    raw_url: str | None = None,
    reason: str | None = None,
    raw_payload: dict | None = None,
) -> None:
    db.add(
        OfferIngestionEvent(
            offer_id=offer.id if offer else None,
            source_scrape_run_id=source_run.id if source_run else None,
            action=action,
            hash_unique=hash_unique,
            raw_url=raw_url,
            reason=reason,
            raw_payload=raw_payload,
        )
    )


def _resolve_source(db: Session, source_code: str) -> Source:
    source = db.scalar(select(Source).where(Source.code == source_code))
    if source is None:
        raise IngestionError(f"Source inconnue: {source_code}")
    if source.status != SourceStatus.ACTIVE or not source.supports_scraping:
        raise IngestionError(f"Source inactive pour ingestion: {source_code}")
    return source


def _unique_slug(db: Session, model, value: str, *, current_id: str | None = None, max_length: int = 340) -> str:
    base = slugify(value)[: max_length - 9]
    candidate = base
    suffix = 2
    while True:
        stmt = select(model.id).where(model.slug == candidate)
        if current_id:
            stmt = stmt.where(model.id != current_id)
        if db.scalar(stmt) is None:
            return candidate
        digest = hashlib.sha1(f"{base}|{suffix}".encode("utf-8")).hexdigest()[:6]
        candidate = f"{base}-{digest}"[:max_length]
        suffix += 1


def _get_or_create_company(db: Session, company_name: str) -> Company:
    normalized_name = normalize_text(company_name)
    if not normalized_name:
        raise IngestionError("Entreprise manquante")
    company = db.scalar(select(Company).where(Company.normalized_name == normalized_name))
    if company is not None:
        return company
    company = Company(
        name=company_name.strip(),
        normalized_name=normalized_name,
        slug=_unique_slug(db, Company, company_name, max_length=280),
    )
    db.add(company)
    db.flush()
    return company


def _resolve_optional_code(db: Session, model, code: str | None, label: str):
    if not code:
        return None
    item = db.scalar(select(model).where(model.code == code))
    if item is None:
        raise IngestionError(f"{label} inconnu: {code}")
    if hasattr(item, "is_active") and not item.is_active:
        raise IngestionError(f"{label} inactive: {code}")
    return item


def _next_public_id(db: Session) -> int:
    current = db.scalar(select(func.max(JobOffer.public_id))) or 0
    return int(current) + 1


def _make_offer_slug(db: Session, item: IngestOfferItemCreate, company: Company) -> str:
    suffix = item.source_reference or hashlib.sha1(str(item.source_url).encode("utf-8")).hexdigest()[:8]
    return _unique_slug(db, JobOffer, f"{item.title}-{company.name}-{suffix}")


def _existing_duplicate(db: Session, source: Source, item: IngestOfferItemCreate, hash_unique: str) -> JobOffer | None:
    filters = [JobOffer.hash_unique == hash_unique]
    if item.source_reference:
        filters.append((JobOffer.source_id == source.id) & (JobOffer.source_reference == item.source_reference))
    return db.scalar(select(JobOffer).where(or_(*filters)))


def _create_run(db: Session, payload: IngestBatchCreate, source: Source) -> tuple[ScrapeRun, SourceScrapeRun]:
    now = _now()
    scrape_run = ScrapeRun(
        run_date=_abidjan_date(),
        status=ScrapeRunStatus.RUNNING,
        started_at=now,
        triggered_by=f"ingest:{source.code}:{payload.batch_id}",
        external_batch_id=str(payload.batch_id),
        run_reference=payload.run_reference,
        scraped_at=payload.scraped_at,
    )
    db.add(scrape_run)
    db.flush()
    source_run = SourceScrapeRun(
        scrape_run_id=scrape_run.id,
        source_id=source.id,
        status=ScrapeRunStatus.RUNNING,
        started_at=now,
    )
    db.add(source_run)
    db.flush()
    return scrape_run, source_run


def ingest_offer_batch(db: Session, payload: IngestBatchCreate) -> IngestBatchSummaryRead:
    existing_run = db.scalar(select(ScrapeRun).where(ScrapeRun.external_batch_id == str(payload.batch_id)))
    if existing_run is not None:
        return IngestBatchSummaryRead(
            batch_id=payload.batch_id,
            source_code=payload.source_code,
            scrape_run_id=existing_run.id,
            status="already_processed",
            message="Batch deja recu, traitement ignore.",
        )

    source = _resolve_source(db, payload.source_code)
    scrape_run, source_run = _create_run(db, payload, source)
    received = len(payload.offers)
    valid = inserted = duplicates = invalid = errors = skipped = 0
    now = _now()

    for item in payload.offers:
        raw_payload = item.raw_data or item.as_raw_payload()
        source_url = str(item.source_url)
        canonical_url = str(item.canonical_url) if item.canonical_url else None
        hash_unique = compute_offer_hash(
            source_code=source.code,
            source_reference=item.source_reference,
            title=item.title,
            company_name=item.company_name,
            source_url=source_url,
            canonical_url=canonical_url,
        )

        try:
            company = _get_or_create_company(db, item.company_name)
            filiere = _resolve_optional_code(db, Filiere, item.filiere_code, "Filiere")
            contract_type = _resolve_optional_code(db, ContractType, item.contract_type_code, "Type de contrat")
            experience_level = _resolve_optional_code(db, ExperienceLevel, item.experience_level_code, "Niveau d'experience")
            education_level = _resolve_optional_code(db, EducationLevel, item.education_level_code, "Niveau de formation")
            valid += 1

            duplicate = _existing_duplicate(db, source, item, hash_unique)
            if duplicate is not None:
                duplicate.last_seen_at = now
                duplicates += 1
                _event(
                    db,
                    source_run=source_run,
                    action=IngestionAction.DUPLICATE,
                    offer=duplicate,
                    hash_unique=hash_unique,
                    raw_url=source_url,
                    reason="hash_unique_or_source_reference_exists",
                    raw_payload=raw_payload,
                )
                continue

            offer = JobOffer(
                public_id=_next_public_id(db),
                title=item.title.strip(),
                normalized_title=normalize_text(item.title),
                slug=_make_offer_slug(db, item, company),
                company_id=company.id,
                source_id=source.id,
                source_scrape_run_id=source_run.id,
                primary_filiere_id=filiere.id if filiere else None,
                contract_type_id=contract_type.id if contract_type else None,
                experience_level_id=experience_level.id if experience_level else None,
                education_level_id=education_level.id if education_level else None,
                status=JobOfferStatus.BRUTE,
                origin=JobOfferOrigin.SCRAPING,
                visible_site=False,
                source_reference=item.source_reference,
                source_url=source_url,
                canonical_url=canonical_url,
                hash_unique=hash_unique,
                content_hash=hashlib.sha256(normalize_text(item.description).encode("utf-8")).hexdigest() if item.description else None,
                location_raw=item.location_raw,
                salary_raw=item.salary_raw,
                raw_payload=raw_payload,
                published_at=item.published_at,
                collected_at=now,
                first_seen_at=now,
                last_seen_at=now,
                ai_status=AiOfferStatus.PENDING,
            )
            db.add(offer)
            db.flush()

            if item.description:
                db.add(JobOfferDetail(offer_id=offer.id, source_text=item.description, is_manual=False))
            if filiere:
                db.add(
                    OfferFiliere(
                        offer_id=offer.id,
                        filiere_id=filiere.id,
                        confidence=1.0,
                        is_primary=True,
                        matched_keywords=[],
                    )
                )

            inserted += 1
            _event(
                db,
                source_run=source_run,
                action=IngestionAction.INSERTED,
                offer=offer,
                hash_unique=hash_unique,
                raw_url=source_url,
                raw_payload=raw_payload,
            )
        except IngestionError as exc:
            invalid += 1
            _event(
                db,
                source_run=source_run,
                action=IngestionAction.FAILED,
                hash_unique=hash_unique,
                raw_url=source_url,
                reason=str(exc),
                raw_payload=raw_payload,
            )
        except IntegrityError as exc:
            db.rollback()
            raise exc
        except Exception as exc:
            errors += 1
            logger.exception("Erreur ingestion offre", extra={"source_code": source.code, "batch_id": str(payload.batch_id)})
            _event(
                db,
                source_run=source_run,
                action=IngestionAction.FAILED,
                hash_unique=hash_unique,
                raw_url=source_url,
                reason=str(exc)[:255],
                raw_payload=raw_payload,
            )

    finished_at = _now()
    status = ScrapeRunStatus.SUCCESS if errors == 0 and invalid == 0 else ScrapeRunStatus.PARTIAL_FAILURE
    if inserted == 0 and (errors or invalid) and duplicates == 0:
        status = ScrapeRunStatus.FAILED

    source_run.status = status
    source_run.finished_at = finished_at
    source_run.duration_ms = int((finished_at - (source_run.started_at or finished_at)).total_seconds() * 1000)
    source_run.raw_count = received
    source_run.inserted_count = inserted
    source_run.updated_count = 0
    source_run.duplicate_count = duplicates
    source_run.error_count = invalid + errors

    scrape_run.status = status
    scrape_run.finished_at = finished_at
    scrape_run.total_raw = received
    scrape_run.total_inserted = inserted
    scrape_run.total_updated = 0
    scrape_run.total_duplicates = duplicates
    scrape_run.total_errors = invalid + errors

    ai_job: AiProcessingJob | None = None
    if inserted > 0:
        ai_job = AiProcessingJob(
            scrape_run_id=scrape_run.id,
            source_id=source.id,
            trigger_type=AiProcessingJobTrigger.IMMEDIATE,
            status=AiProcessingJobStatus.PENDING,
            offers_total=inserted,
        )
        db.add(ai_job)
        db.flush()

    db.commit()

    ai_triggered = False
    if ai_job is not None:
        try:
            from tasks.ai_processing import process_raw_offers

            async_result = process_raw_offers.apply_async(
                kwargs={"scrape_run_id": scrape_run.id, "ai_job_id": ai_job.id},
                queue="ai",
            )
            ai_job.celery_task_id = async_result.id
            db.commit()
            ai_triggered = True
        except Exception as exc:
            logger.exception("Declenchement job IA impossible", extra={"scrape_run_id": scrape_run.id})
            ai_job.status = AiProcessingJobStatus.FAILED
            ai_job.error_message = str(exc)[:1000]
            db.commit()

    return IngestBatchSummaryRead(
        batch_id=payload.batch_id,
        source_code=payload.source_code,
        scrape_run_id=scrape_run.id,
        status="completed" if status in {ScrapeRunStatus.SUCCESS, ScrapeRunStatus.PARTIAL_FAILURE} else "failed",
        received=received,
        valid=valid,
        new=inserted,
        duplicates=duplicates,
        invalid=invalid,
        errors=errors,
        skipped=skipped,
        ai_job_triggered=ai_triggered,
        ai_job_id=ai_job.id if ai_job else None,
    )
