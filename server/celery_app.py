from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "jobalert_ci",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["tasks.ai_processing", "tasks.scrapers"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone=settings.timezone,
    enable_utc=True,
    task_routes={
        "tasks.ai_processing.process_raw_offers": {"queue": "ai"},
        "tasks.scrapers.run_source_scraper": {"queue": "ingestion"},
    },
    beat_schedule={
        "ai-process-raw-offers-sweep": {
            "task": "tasks.ai_processing.process_raw_offers",
            "schedule": 300.0,
            "kwargs": {"trigger_type": "sweep"},
            "options": {"queue": "ai"},
        },
        # "scrape-emploi-dakar-0600": {
        #     "task": "tasks.scrapers.run_source_scraper",
        #     "schedule": crontab(hour=6, minute=0),
        #     "args": ("emploi-dakar",),
        #     "options": {"queue": "ingestion"},
        # },
        "scrape-goafrica-0600": {
            "task": "tasks.scrapers.run_source_scraper",
            "schedule": crontab(hour=6, minute=0),
            "args": ("goafrica",),
            "options": {"queue": "ingestion"},
        },
        "scrape-jobivoire-0610": {
            "task": "tasks.scrapers.run_source_scraper",
            "schedule": crontab(hour=6, minute=10),
            "args": ("jobivoire",),
            "options": {"queue": "ingestion"},
        },
        "scrape-educarriere-0620": {
            "task": "tasks.scrapers.run_source_scraper",
            "schedule": crontab(hour=6, minute=20),
            "args": ("educarriere",),
            "options": {"queue": "ingestion"},
        },
    },
)
