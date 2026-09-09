"""Vue admin de la planification Celery (document 8 — audit 4, F.2).

Lecture seule : expose le beat_schedule REEL calcule par celery_app.py au
boot (heures locales + UTC, queues, kill-switchs, source de configuration
env). L'edition des heures reste du ressort des variables d'environnement
(DAILY_*) — aucune duplication de constante ici, tout est derive de
celery_app.schedule_view().

Reserve au super_admin (meme perimetre que system_health).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from api.deps import get_current_admin, require_roles
from celery_app import SCRAPER_BEAT_ENABLED, schedule_view
from core.config import get_settings
from models.admin import Administrator

router = APIRouter(
    prefix="/api/admin/system",
    tags=["admin-system"],
    dependencies=[Depends(require_roles("super_admin"))],
)


@router.get("/schedule")
async def system_schedule(
    admin: Administrator = Depends(get_current_admin),
) -> dict:
    """Planification effective du beat (lecture seule, audit 4, F.2)."""
    settings = get_settings()
    return {
        "timezone": settings.timezone,
        "scraper_beat_enabled": SCRAPER_BEAT_ENABLED,
        "retry_failed_digests_enabled": settings.retry_failed_digests_enabled,
        "no_offer_email_enabled": settings.send_no_offer_email,
        "entries": schedule_view(),
    }
