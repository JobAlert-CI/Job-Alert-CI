from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "jobalert_ci",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["tasks.ai_processing", "tasks.scrapers", "tasks.emails", "tasks.digests"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone=settings.timezone,
    enable_utc=True,
    task_routes={
        "tasks.ai_processing.process_raw_offers": {"queue": "ai"},
        "tasks.ai_processing.trigger_ai_processing": {"queue": "ai"},
        "tasks.ai_processing.sweep_raw_offers": {"queue": "ai"},
        "tasks.emails.send_confirmation_email_task": {"queue": "emails"},
        "tasks.scrapers.run_source_scraper": {"queue": "ingestion"},
        "tasks.scrapers.run_active_scrapers": {"queue": "ingestion"},
        "tasks.digests.prepare_daily_digests": {"queue": "emails"},
        "tasks.digests.build_and_queue_digest": {"queue": "emails"},
        "tasks.digests.mark_preparation_completed": {"queue": "emails"},
        "tasks.digests.send_daily_digests": {"queue": "emails"},
        "tasks.digests.send_digest": {"queue": "emails"},
        "tasks.digests.mark_sending_completed": {"queue": "emails"},
        "tasks.digests.retry_failed_digests": {"queue": "emails"},
    },
    beat_schedule={
        "ai-process-raw-offers-sweep": {
            "task": "tasks.ai_processing.sweep_raw_offers",
            "schedule": 300.0,
            "options": {"queue": "ai"},
        },
        "scrape-goafrica-0600": {
            "task": "tasks.scrapers.run_source_scraper",
            "schedule": crontab(hour=6, minute=00),
            "args": ("goafrica",),
            "options": {"queue": "ingestion"},
        },
        "scrape-jobivoire-0605": {
            "task": "tasks.scrapers.run_source_scraper",
            "schedule": crontab(hour=6, minute=5),
            "args": ("jobivoire",),
            "options": {"queue": "ingestion"},
        },
        "scrape-educarriere-0610": {
            "task": "tasks.scrapers.run_source_scraper",
            "schedule": crontab(hour=6, minute=10),
            "args": ("educarriere",),
            "options": {"queue": "ingestion"},
        },
        # ─── Digest quotidien en 2 phases ─────────────────────────────────
        # Crontabs exprimees en heure locale du worker (timezone = settings.timezone,
        # Africa/Abidjan par defaut). Phase 1 a 07h30: fige la selection des offres.
        "digest-prepare-0730": {
            "task": "tasks.digests.prepare_daily_digests",
            "schedule": crontab(
                hour=settings.daily_digest_prepare_hour,
                minute=settings.daily_digest_prepare_minute,
                timezone=settings.digest_timezone,
            ),
            "options": {"queue": "emails"},
        },
        # Phase 2 a 08h00. Les offres arrivees entre 07h30 et 08h00 seront
        # incluses dans le digest du lendemain (comportement attendu).
        "digest-build-0800": {
            "task": "tasks.digests.build_and_queue_digest",
            "schedule": crontab(
                hour=settings.daily_digest_build_hour,
                minute=settings.daily_digest_build_minute,   
                timezone=settings.digest_timezone,             
            ),
            "options": {"queue": "emails"},
        },
    },
)
