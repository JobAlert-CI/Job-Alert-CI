from __future__ import annotations

import os

from celery import Celery
from celery.schedules import crontab

from core.config import get_settings

settings = get_settings()

# Interrupteur de test: SCRAPER_BEAT_ENABLED=false desactive les entrees beat
# des scrapers (evite le catch-up massif au demarrage de beat quand on teste
# une autre tache avec un creneau manuel).
SCRAPER_BEAT_ENABLED = os.getenv("SCRAPER_BEAT_ENABLED", "true").lower() not in {"0", "false", "no"}

celery_app = Celery(
    "jobalert_ci",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["tasks.ai_processing", "tasks.scrapers", "tasks.emails", "tasks.digests"],
)

task_routes = {
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
    "tasks.digests.send_no_offer_emails": {"queue": "emails"},
    "tasks.digests.mark_sending_completed": {"queue": "emails"},
    "tasks.digests.retry_failed_digests": {"queue": "emails"},
}

beat_schedule = {
    "ai-process-raw-offers-sweep": {
        "task": "tasks.ai_processing.sweep_raw_offers",
        "schedule": 300.0,
        "options": {"queue": "ai"},
    },
}

if SCRAPER_BEAT_ENABLED:
    beat_schedule.update(
        {
            "scrape-goafrica-0600": {
                "task": "tasks.scrapers.run_source_scraper",
                # NB: pas de kwarg `timezone` sur crontab (non supporte par la
                # version de Celery du projet) — les heures sont lues comme
                # heure locale du beat, cadree par celery_app.conf.timezone.
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
        }
    )

# ─── Digest quotidien en 2 phases ─────────────────────────────────────────────
# Phase 1 a 07h30: fige la selection des offres du jour. Les offres arrivees
# entre 07h30 et 08h00 partent dans le digest du lendemain.
beat_schedule["digest-prepare"] = {
    "task": "tasks.digests.prepare_daily_digests",
    "schedule": crontab(
        hour=settings.daily_digest_prepare_hour,
        minute=settings.daily_digest_prepare_minute,
    ),
    "options": {"queue": "emails"},
}
# Phase 2 a 08h00: envoi des digests queues.
beat_schedule["digest-send"] = {
    "task": "tasks.digests.send_daily_digests",
    "schedule": crontab(
        hour=settings.daily_digest_send_hour,
        minute=settings.daily_digest_send_minute,
    ),
    "options": {"queue": "emails"},
}

# Phase 2.5 a 08h30: envoi des emails 'no offer' pour les skipped_empty.
# Tourne 30 min apres la phase 2 pour laisser le temps aux envois queued
# de se terminer (les retries Celery peuvent prendre quelques minutes).
beat_schedule["digest-send-no-offer"] = {
    "task": "tasks.digests.send_no_offer_emails",
    "schedule": crontab(hour=8, minute=30),
    "options": {"queue": "emails"},
}

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone=settings.timezone,
    enable_utc=True,
    task_routes=task_routes,
    beat_schedule=beat_schedule,
)
