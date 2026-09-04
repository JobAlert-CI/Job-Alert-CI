from __future__ import annotations

import os
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from celery import Celery
from celery.schedules import crontab

from core.config import get_settings

settings = get_settings()

# Interrupteur de test: SCRAPER_BEAT_ENABLED=false desactive les entrees beat
# des scrapers (evite le catch-up massif au demarrage de beat quand on teste
# une autre tache avec un crontab manuel).
SCRAPER_BEAT_ENABLED = os.getenv("SCRAPER_BEAT_ENABLED", "true").lower() not in {"0", "false", "no"}

# Audit P1 #34: Celery `crontab(hour=, minute=)` est evalue en UTC meme quand
# `enable_utc=True` est pose. On convertit explicitement les heures souhaitees
# (Africa/Abidjan) en UTC avant de construire les crontabs.
try:
    TARGET_TZ = ZoneInfo(settings.timezone)
except Exception:
    TARGET_TZ = ZoneInfo("UTC")


def _hour_in_utc(local_hour: int, local_minute: int) -> tuple[int, int]:
    """Convertit une heure locale (fuseau cible) en UTC pour crontab()."""
    # On prend n'importe quel jour de l'an : le decalage ne depend que du fuseau,
    # pas du jour de l'annee (l'Afrique/Abidjan n'a pas d'heure d'ete).
    ref = datetime(2026, 6, 15, local_hour, local_minute, tzinfo=TARGET_TZ)
    utc = ref.astimezone(UTC)
    return utc.hour, utc.minute


celery_app = Celery(
    "jobalert_ci",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["tasks.ai_processing", "tasks.scrapers", "tasks.emails", "tasks.digests", "tasks.maintenance"],
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


def _abidjan_crontab(local_hour: int, local_minute: int) -> crontab:
    hour, minute = _hour_in_utc(local_hour, local_minute)
    return crontab(hour=hour, minute=minute)


if SCRAPER_BEAT_ENABLED:
    # Scrapers a 06:00, 06:05, 06:10 heure Abidjan (= 04:00 UTC toute l'annee).
    scrape_hour_utc, _ = _hour_in_utc(6, 0)
    beat_schedule.update(
        {
            "scrape-goafrica-0600": {
                "task": "tasks.scrapers.run_source_scraper",
                "schedule": crontab(hour=scrape_hour_utc, minute=0),
                "args": ("goafrica",),
                "options": {"queue": "ingestion"},
            },
            "scrape-jobivoire-0605": {
                "task": "tasks.scrapers.run_source_scraper",
                "schedule": crontab(hour=scrape_hour_utc, minute=5),
                "args": ("jobivoire",),
                "options": {"queue": "ingestion"},
            },
            "scrape-educarriere-0610": {
                "task": "tasks.scrapers.run_source_scraper",
                "schedule": crontab(hour=scrape_hour_utc, minute=10),
                "args": ("educarriere",),
                "options": {"queue": "ingestion"},
            },
        }
    )

# Digest: phase 1 (07:30 Abidjan) et phase 2 (08:00 Abidjan).
beat_schedule["digest-prepare"] = {
    "task": "tasks.digests.prepare_daily_digests",
    "schedule": _abidjan_crontab(settings.daily_digest_prepare_hour, settings.daily_digest_prepare_minute),
    "options": {"queue": "emails"},
}
beat_schedule["digest-send"] = {
    "task": "tasks.digests.send_daily_digests",
    "schedule": _abidjan_crontab(settings.daily_digest_send_hour, settings.daily_digest_send_minute),
    "options": {"queue": "emails"},
}

# 08:30 Abidjan pour les no-offer emails.
beat_schedule["digest-send-no-offer"] = {
    "task": "tasks.digests.send_no_offer_emails",
    "schedule": _abidjan_crontab(8, 30),
    "options": {"queue": "emails"},
}

# Audit 2, F1/N12: purge quotidienne des refresh tokens expires (03:00 Abidjan).
beat_schedule["purge-expired-refresh-tokens"] = {
    "task": "tasks.maintenance.purge_expired_refresh_tokens",
    "schedule": _abidjan_crontab(3, 0),
    "options": {"queue": "emails"},
}

# Audit 2, F3: flush des compteurs view/save Redis -> base, toutes les minutes.
beat_schedule["flush-offer-metrics"] = {
    "task": "tasks.maintenance.flush_offer_metrics",
    "schedule": 60.0,
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
