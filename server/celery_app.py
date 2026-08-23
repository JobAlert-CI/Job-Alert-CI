from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "jobalert_ci",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["tasks.ai_processing", "tasks.scrapers", "tasks.emails"],
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
    },
)
