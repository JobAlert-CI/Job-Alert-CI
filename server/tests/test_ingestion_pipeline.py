from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from api.deps import get_db
import api.deps as deps
from db.base import Base
from main import app
from models import (
    AiOfferStatus,
    Company,
    Filiere,
    IngestionAction,
    JobOffer,
    JobOfferStatus,
    OfferIngestionEvent,
    ScrapeRun,
    Source,
    SourceScrapeRun,
    SourceStatus,
)
from services.ingestion import compute_offer_hash


class _Settings:
    scraper_api_token = "test-token"
    ingestion_batch_size_max = 10
    timezone = "Africa/Abidjan"
    ai_enabled = False
    redis_url = "redis://localhost:6390/15"


class _AsyncResult:
    id = "test-celery-task"


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    session = SessionLocal()
    session.add(
        Source(
            code="emploi-dakar",
            name="Emploi Dakar",
            slug="emploi-dakar",
            base_url="https://example.com",
            status=SourceStatus.ACTIVE,
            supports_scraping=True,
        )
    )
    session.add(Filiere(code="tech-dev", label="Tech Dev", slug="tech-dev", is_active=True))
    session.commit()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


@pytest.fixture()
def client(db_session, monkeypatch):
    def override_db():
        yield db_session

    monkeypatch.setattr(deps, "get_settings", lambda: _Settings())
    app.dependency_overrides[get_db] = override_db

    from tasks.ai_processing import process_raw_offers

    monkeypatch.setattr(process_raw_offers, "apply_async", lambda *args, **kwargs: _AsyncResult())
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _payload(batch_id: str | None = None, *, title: str = "Developpeur Python") -> dict:
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    return {
        "batch_id": batch_id or str(uuid4()),
        "source_code": "emploi-dakar",
        "run_reference": "pytest",
        "scraped_at": now,
        "offers": [
            {
                "source_reference": "REF-001",
                "title": title,
                "company_name": "Acme CI",
                "source_url": "https://example.com/jobs/ref-001",
                "canonical_url": "https://example.com/jobs/ref-001",
                "published_at": now,
                "location_raw": "Abidjan",
                "description": "Une description brute.",
                "raw_data": {"source": "pytest"},
                "filiere_code": "tech-dev",
            }
        ],
    }


def test_ingest_requires_token(client):
    response = client.post("/api/ingest/offers", json=_payload())
    assert response.status_code == 401


def test_ingest_rejects_invalid_token(client):
    response = client.post("/api/ingest/offers", json=_payload(), headers={"X-Scraper-Token": "bad"})
    assert response.status_code == 401


def test_valid_offer_is_inserted_as_brute_and_triggers_ai_job(client, db_session):
    response = client.post("/api/ingest/offers", json=_payload(), headers={"X-Scraper-Token": "test-token"})

    assert response.status_code == 201
    summary = response.json()
    assert summary["received"] == 1
    assert summary["new"] == 1
    assert summary["duplicates"] == 0
    assert summary["ai_job_triggered"] is True

    offer = db_session.scalar(select(JobOffer))
    assert offer is not None
    assert offer.status == JobOfferStatus.BRUTE
    assert offer.visible_site is False
    assert offer.ai_status == AiOfferStatus.PENDING
    assert offer.source_scrape_run_id is not None
    assert db_session.scalar(select(Company).where(Company.normalized_name == "acme ci")) is not None


def test_duplicate_offer_is_not_inserted_twice(client, db_session):
    first_payload = _payload()
    second_payload = _payload()
    second_payload["batch_id"] = str(uuid4())

    client.post("/api/ingest/offers", json=first_payload, headers={"X-Scraper-Token": "test-token"})
    response = client.post("/api/ingest/offers", json=second_payload, headers={"X-Scraper-Token": "test-token"})

    assert response.status_code == 201
    summary = response.json()
    assert summary["new"] == 0
    assert summary["duplicates"] == 1
    assert len(list(db_session.scalars(select(JobOffer)))) == 1
    events = list(db_session.scalars(select(OfferIngestionEvent)))
    assert any(event.action == IngestionAction.DUPLICATE for event in events)


def test_same_batch_id_is_idempotent(client, db_session):
    batch_id = str(uuid4())
    response_1 = client.post("/api/ingest/offers", json=_payload(batch_id), headers={"X-Scraper-Token": "test-token"})
    response_2 = client.post("/api/ingest/offers", json=_payload(batch_id), headers={"X-Scraper-Token": "test-token"})

    assert response_1.status_code == 201
    assert response_2.status_code == 201
    assert response_2.json()["status"] == "already_processed"
    assert len(list(db_session.scalars(select(ScrapeRun)))) == 1


def test_unknown_filiere_marks_item_invalid_without_blocking_batch(client, db_session):
    payload = _payload()
    payload["offers"].append(
        {
            "source_reference": "REF-002",
            "title": "Analyste",
            "company_name": "Beta CI",
            "source_url": "https://example.com/jobs/ref-002",
            "filiere_code": "unknown",
        }
    )

    response = client.post("/api/ingest/offers", json=payload, headers={"X-Scraper-Token": "test-token"})

    assert response.status_code == 201
    summary = response.json()
    assert summary["received"] == 2
    assert summary["new"] == 1
    assert summary["invalid"] == 1


def test_hash_rules_are_stable():
    first = compute_offer_hash(
        source_code="src",
        source_reference="A",
        title="Titre",
        company_name="Acme",
        source_url="https://example.com/a",
        canonical_url="https://example.com/canonical",
    )
    second = compute_offer_hash(
        source_code="src",
        source_reference="B",
        title="Autre",
        company_name="Beta",
        source_url="https://example.com/b",
        canonical_url="https://example.com/canonical",
    )
    different = compute_offer_hash(
        source_code="src",
        source_reference="A",
        title="Titre",
        company_name="Acme",
        source_url="https://example.com/other",
        canonical_url=None,
    )
    fallback = compute_offer_hash(
        source_code="src",
        source_reference=None,
        title="  Développeur   Python ",
        company_name="ACME CI",
        source_url=None,
        canonical_url=None,
    )

    assert first == second
    assert first != different
    assert fallback == compute_offer_hash(
        source_code="src",
        source_reference=None,
        title="developpeur python",
        company_name="acme ci",
        source_url=None,
        canonical_url=None,
    )


def test_noop_ai_job_activates_valid_brute_offer(db_session, monkeypatch):
    from tasks import ai_processing

    source = db_session.scalar(select(Source).where(Source.code == "emploi-dakar"))
    company = Company(name="Acme CI", normalized_name="acme ci", slug="acme-ci")
    db_session.add(company)
    db_session.flush()
    scrape_run = ScrapeRun(run_date=datetime.now(timezone.utc).date(), triggered_by="pytest")
    db_session.add(scrape_run)
    db_session.flush()
    source_run = SourceScrapeRun(scrape_run_id=scrape_run.id, source_id=source.id)
    db_session.add(source_run)
    db_session.flush()
    offer = JobOffer(
        public_id=1,
        title="Developpeur Python",
        normalized_title="developpeur python",
        slug="developpeur-python-acme",
        company_id=company.id,
        source_id=source.id,
        source_scrape_run_id=source_run.id,
        status=JobOfferStatus.BRUTE,
        visible_site=False,
        source_url="https://example.com/job",
        hash_unique="abc",
        raw_payload={"title": "Developpeur Python"},
    )
    db_session.add(offer)
    db_session.commit()

    @contextmanager
    def test_scope():
        try:
            yield db_session
            db_session.commit()
        except Exception:
            db_session.rollback()
            raise

    monkeypatch.setattr(ai_processing, "session_scope", test_scope)
    result = ai_processing.process_raw_offers(scrape_run_id=scrape_run.id, trigger_type="manual")

    assert result["status"] == "completed"
    db_session.refresh(offer)
    assert offer.status == JobOfferStatus.ACTIVE
    assert offer.visible_site is True
    assert offer.ai_status == AiOfferStatus.NOOP
