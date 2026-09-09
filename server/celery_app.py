from __future__ import annotations

import logging
import os
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from celery import Celery
from celery.schedules import crontab

from core.config import get_settings

logger = logging.getLogger(__name__)

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


def _local_plus_minutes(hour: int, minute: int, delta_minutes: int) -> tuple[int, int]:
    """Ajoute `delta_minutes` a une heure locale, avec report au jour suivant.

    Audit 4, F.3 : derive l'heure du no-offer de l'heure d'envoi du digest ;
    le report minuit evite qu'un envoi a 23:45 produise 24:15 (crontab invalide).
    """
    total = (hour * 60 + minute + delta_minutes) % (24 * 60)
    return total // 60, total % 60


def _check_no_dst_timezone() -> None:
    """Audit 4, F.4 : garde au boot contre un fuseau a heure d'ete.

    `_hour_in_utc` ne convertit qu'a partir d'une date de reference fixe
    (15 juin). Si APP_TIMEZONE designait un fuseau a DST (ex. Europe/Paris),
    le decalage calcule serait celui de l'ete et divergerait d'une heure en
    hiver, silencieusement. On loggue une erreur explicite plutot que de
    crasher au boot (le planning resterait correct a +/- 1 h pres).
    """
    from datetime import timedelta

    for probe in (datetime(2026, 1, 15, 12, 0, tzinfo=TARGET_TZ), datetime(2026, 7, 15, 12, 0, tzinfo=TARGET_TZ)):
        if probe.dst() != timedelta(0):
            logger.error(
                "APP_TIMEZONE=%s observe l'heure d'ete (DST) : les crontabs du "
                "beat, derives d'une date de reference unique, derivent d'une "
                "heure selon la saison. Utiliser un fuseau sans DST "
                "(ex. Africa/Abidjan) ou rendre chaque entree dynamique.",
                settings.timezone,
            )
            return


_check_no_dst_timezone()


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
    "tasks.maintenance.requalify_stale_runs": {"queue": "ingestion"},
    # Audit 4, lot 4 (F.1-F.4) : les 3 tasks maintenance ci-dessous etaient
    # absentes de task_routes — un .delay() manuel partait sur la queue par
    # defaut "celery", jamais consommee par les workers du projet (le beat
    # les contourne via options.queue, mais pas les appels directs).
    "tasks.maintenance.purge_expired_refresh_tokens": {"queue": "emails"},
    "tasks.maintenance.flush_offer_metrics": {"queue": "emails"},
    "tasks.maintenance.purge_ai_alerts": {"queue": "emails"},
    # Audit 4, lot 5 (A.3) : purge des evenements d'ingestion (2 vitesses).
    "tasks.maintenance.purge_ingestion_events": {"queue": "ingestion"},
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


def _abidjan_crontab(local_hour: int | str, local_minute: int) -> crontab:
    """Crontab dont l'heure/minute exprimees en LOCAL (fuseau settings.timezone)
    sont converties en UTC (audit P1 #34).

    `local_hour` accepte une plage Celery ("9-18") : le decalage UTC calcule
    sur le debut de plage est applique aux deux bornes (decalage constant —
    les fuseaux a DST restent hors contrat, cf. _check_no_dst_timezone).
    """
    if isinstance(local_hour, str) and "-" in local_hour:
        start_local, end_local = (int(part) for part in local_hour.split("-"))
        start_utc, minute = _hour_in_utc(start_local, local_minute)
        offset = start_utc - start_local
        return crontab(hour=f"{(start_local + offset) % 24}-{(end_local + offset) % 24}", minute=minute)
    hour, minute = _hour_in_utc(local_hour, local_minute)
    return crontab(hour=hour, minute=minute)


if SCRAPER_BEAT_ENABLED:
    # Audit 4, F.1 (decision produit option a, 2026-09-09) : UN SEUL crontab
    # 06:00 declenchant run_active_scrapers, qui lit la table sources et
    # fan-oute run_source_scraper vers toutes les sources ACTIVE avec
    # supports_scraping. Une source creee/activee via l'admin est desormais
    # scrapee des le lendemain, sans intervention code ni redéploiement.
    # L'ancien etagement 06:00/06:05/06:10 etait une protection de charge
    # desormais couverte par le verrou Redis par source + la queue ingestion.
    # Le declenchement reste pilotable par settings.daily_collection_hour
    # (DAILY_COLLECTION_HOUR, defaut 6) et desactivable via
    # SCRAPER_BEAT_ENABLED=false.
    beat_schedule.update(
        {
            "scrape-all-sources": {
                "task": "tasks.scrapers.run_active_scrapers",
                "schedule": _abidjan_crontab(settings.daily_collection_hour, 0),
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

# Audit 4, F.3 : le no-offer email est DERIVE de l'heure d'envoi du digest
# (send + 30 minutes) — plus d'horodatage independant 08:30 qui pouvait partir
# AVANT l'envoi principal si DAILY_DIGEST_SEND_HOUR etait decale apres 08:30.
# _local_plus_minutes gere le report minuit (envoi a 23:45 -> no-offer 00:15).
_no_offer_hour, _no_offer_minute = _local_plus_minutes(
    settings.daily_digest_send_hour, settings.daily_digest_send_minute, 30
)
beat_schedule["digest-send-no-offer"] = {
    "task": "tasks.digests.send_no_offer_emails",
    "schedule": _abidjan_crontab(_no_offer_hour, _no_offer_minute),
    "options": {"queue": "emails"},
}

# Audit 4, F.3 : heure de la purge nocturne configurable (DAILY_PURGE_HOUR,
# defaut 3 = statu quo). Purge refresh tokens a H:00, purge alertes IA a H:15.
# Audit 2, F1/N12 : purge quotidienne des refresh tokens expires.
beat_schedule["purge-expired-refresh-tokens"] = {
    "task": "tasks.maintenance.purge_expired_refresh_tokens",
    "schedule": _abidjan_crontab(settings.daily_purge_hour, 0),
    "options": {"queue": "emails"},
}
# Audit 4, B.4 : purge quotidienne des alertes IA de plus de 90 jours.
beat_schedule["purge-ai-alerts"] = {
    "task": "tasks.maintenance.purge_ai_alerts",
    "schedule": _abidjan_crontab(settings.daily_purge_hour, 15),
    "options": {"queue": "emails"},
}

# Audit 4, lot 5 (A.3) : purge des evenements d'ingestion, deux vitesses —
# raw_payload NULL au-dela de 15 jours, DELETE au-dela de 90 jours. Nocturne
# (H:30, apres les autres purges), queue ingestion : le lotissement par 5000
# lignes tient des verrous courts sur la table la plus grosse du systeme.
beat_schedule["purge-ingestion-events"] = {
    "task": "tasks.maintenance.purge_ingestion_events",
    "schedule": _abidjan_crontab(settings.daily_purge_hour, 30),
    "options": {"queue": "ingestion"},
}

# Audit 2, F3: flush des compteurs view/save Redis -> base, toutes les minutes.
beat_schedule["flush-offer-metrics"] = {
    "task": "tasks.maintenance.flush_offer_metrics",
    "schedule": 60.0,
    "options": {"queue": "emails"},
}

# Audit 4, M.1: requalification des runs de scraping zombies (PENDING/RUNNING
# abandonnes depuis plus de 6 h — worker crashe, broker perdu...). Toutes les
# 30 min, queue ingestion (meme univers que les scrapers).
beat_schedule["requalify-stale-runs"] = {
    "task": "tasks.maintenance.requalify_stale_runs",
    "schedule": 1800.0,
    "options": {"queue": "ingestion"},
}

# Audit 4, M.2 (decision produit, 2026-09-09) : rattrapage des digests FAILED
# (toutes tentatives non epuisees) planifie horairement 09:00-18:00 heure
# Abidjan. Une panne Resend de 2 h ne detruit plus la journee : chaque heure
# ouvreuse republie les failed. Le flag RETRY_FAILED_DIGESTS_ENABLED reste le
# kill-switch (false par defaut : la task se metcourt-circuite en no-op si
# l'ops ne l'a pas activee).
beat_schedule["retry-failed-digests"] = {
    "task": "tasks.digests.retry_failed_digests",
    "schedule": _abidjan_crontab("9-18", 0),
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
    # Audit 4, P.1 : une tache en cours au moment du crash/redéploiement d'un
    # worker doit etre REATTRIBUEE, pas perdue. Defauts Celery acks_late=False
    # (ack a la reception) => perte definitive silencieuse (digest phantom
    # `sending`, source non scrapee, offres bloquees en AI_PROCESSING).
    # Toutes les tasks du projet sont idempotentes ou defendables (verifie
    # audit 4 : ingestion par batch_id, send_digest reprend du statut base,
    # scrapers verrouilles, sweep reprend le reste). prefetch=1 evite qu'un
    # worker accapare des taches qu'il rendra aux autres a sa mort.
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    # Audit 4, P.2 : purge Redis explicite des resultats (defaut Celery 24 h).
    # Les valeurs de retour ne servent qu'au debug — 1 h suffit et borne la
    # croissance de la base 1.
    result_expires=3600,
)


# ─── Vue metier du schedule (audit 4, F.2) ──────────────────────────────
# Source de verite unique : l'endpoint admin GET /api/admin/system/schedule
# lit `beat_schedule` ci-dessus (et sa metadonnee `audit` par entree) — jamais
# de constante dupliquee cote route. Chaque entree embarque sa metadonnee pour
# que la vue reste exacte meme si le beat tourne sur un build anterieur.

_BEAT_META: dict[str, dict] = {
    "ai-process-raw-offers-sweep": {
        "label": "Sweep IA des offres brutes",
        "description": "Toutes les 5 min : traite les offres status=brut restantes (queue ai).",
        "kind": "interval",
    },
    "scrape-all-sources": {
        "label": "Scraping de toutes les sources actives",
        "description": (
            "Toutes les sources ACTIVE supports_scraping de la table sources, via "
            "run_active_scrapers (audit 4, F.1 : une source ajoutee via l'admin est "
            "scrapee des le lendemain sans redéploiement)."
        ),
        "kind": "daily",
        "local_time": f"{settings.daily_collection_hour:02d}:00",
        "env_key": "DAILY_COLLECTION_HOUR",
        "toggle": "SCRAPER_BEAT_ENABLED",
    },
    "digest-prepare": {
        "label": "Digest — phase 1 preparation",
        "description": "Construit et file les digests du jour (verrou Redis lock:digest:prepare:{date}).",
        "kind": "daily",
        "local_time": f"{settings.daily_digest_prepare_hour:02d}:{settings.daily_digest_prepare_minute:02d}",
        "env_key": "DAILY_DIGEST_PREPARE_HOUR / DAILY_DIGEST_PREPARE_MINUTE",
    },
    "digest-send": {
        "label": "Digest — phase 2 envoi",
        "description": "Envoie les digests files par la phase 1 (verrou lock:digest:send:{date}).",
        "kind": "daily",
        "local_time": f"{settings.daily_digest_send_hour:02d}:{settings.daily_digest_send_minute:02d}",
        "env_key": "DAILY_DIGEST_SEND_HOUR / DAILY_DIGEST_SEND_MINUTE",
    },
    "digest-send-no-offer": {
        "label": "Digest — emails sans offre",
        "description": "30 min apres l'envoi principal : emails « aucune offre » aux abonnes concernes (derive de DAILY_DIGEST_SEND_HOUR, audit 4, F.3).",
        "kind": "daily",
        "local_time": f"{_no_offer_hour:02d}:{_no_offer_minute:02d}",
        "env_key": "derive de DAILY_DIGEST_SEND_HOUR (+30 min)",
    },
    "purge-expired-refresh-tokens": {
        "label": "Purge refresh tokens expires",
        "description": "Supprime les refresh tokens admin arrives a expiration.",
        "kind": "daily",
        "local_time": f"{settings.daily_purge_hour:02d}:00",
        "env_key": "DAILY_PURGE_HOUR",
    },
    "purge-ai-alerts": {
        "label": "Purge alertes IA (> 90 jours)",
        "description": "Supprime les alertes IA de plus de 90 jours (audit 4, B.4).",
        "kind": "daily",
        "local_time": f"{settings.daily_purge_hour:02d}:15",
        "env_key": "DAILY_PURGE_HOUR (minute fixe :15)",
    },
    "purge-ingestion-events": {
        "label": "Purge events d'ingestion (2 vitesses)",
        "description": (
            "raw_payload NULL au-dela de 15 jours, suppression complete au-dela de 90 jours "
            "(audit 4, A.3 — par lots de 5000, la table etant la plus grosse du systeme)."
        ),
        "kind": "daily",
        "local_time": f"{settings.daily_purge_hour:02d}:30",
        "env_key": "DAILY_PURGE_HOUR (minute fixe :30)",
    },
    "flush-offer-metrics": {
        "label": "Flush compteurs offres",
        "description": "Applique les deltas view/save Redis en base, chaque minute.",
        "kind": "interval",
    },
    "requalify-stale-runs": {
        "label": "Requalification runs zombies",
        "description": "Toutes les 30 min : RUNNING > 6 h ou PENDING > 24 h -> FAILED (audit 4, M.1).",
        "kind": "interval",
    },
    "retry-failed-digests": {
        "label": "Rattrapage digests failed",
        "description": "Horaire 09:00-18:00 : republie les digests FAILED non epuises (kill-switch RETRY_FAILED_DIGESTS_ENABLED, off par defaut — audit 4, M.2).",
        "kind": "hourly-range",
        "local_time": "09:00-18:00",
    },
}


def schedule_view() -> list[dict]:
    """Vue lecture seule du beat_schedule REEL de ce build (audit 4, F.2).

    Derive les heures locales et UTC depuis les objets crontab/interval du
    schedule lui-meme (pas de constante dupliquee) et ajoute la metadonnee
    metier de _BEAT_META. Expose aussi les kill-switchs actifs.
    """
    from datetime import timedelta

    entries: list[dict] = []
    for name, entry in sorted(beat_schedule.items()):
        schedule_obj = entry["schedule"]
        meta = _BEAT_META.get(name, {})
        item: dict = {
            "name": name,
            "task": entry["task"],
            "queue": entry.get("options", {}).get("queue"),
            "label": meta.get("label", name),
            "description": meta.get("description"),
            "env_key": meta.get("env_key"),
        }
        if meta.get("toggle"):
            item["toggle"] = meta["toggle"]
        if isinstance(schedule_obj, crontab):
            # crontab stocke ses champs d'origine dans _orig_* (verifie
            # celery 5.6.3) ; ces champs sont exprimes en UTC (conf enable_utc).
            utc_hour = "-".join(part.zfill(2) for part in str(schedule_obj._orig_hour).split("-"))
            item["utc_time"] = f"{utc_hour}:{str(schedule_obj._orig_minute).zfill(2)}"
            item["local_time"] = meta.get("local_time")
            item["schedule_kind"] = meta.get("kind", "daily")
        else:
            # Entree a intervalle : la schedule est soit un nombre (float
            # secondes) soit un objet exposes `run_every`.
            interval = None
            if isinstance(schedule_obj, (int, float)):
                interval = int(schedule_obj)
            else:
                run_every = getattr(schedule_obj, "run_every", None)
                if run_every is not None:
                    interval = int(run_every.total_seconds() if isinstance(run_every, timedelta) else run_every)
            if interval is not None:
                item["interval_seconds"] = interval
                item["schedule_kind"] = meta.get("kind", "interval")
            else:
                item["schedule_kind"] = meta.get("kind", "other")
            if meta.get("local_time"):
                item["local_time"] = meta["local_time"]
        entries.append(item)
    return entries
