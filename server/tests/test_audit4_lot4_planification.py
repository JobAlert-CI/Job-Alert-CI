"""Tests du Lot 4 de l'audit 4 — Planification & Celery (F.1-F.4, P.1, P.2, M.2).

Couvre :
- F.1 : crontab unique scrape-all-sources -> run_active_scrapers (lecture table) ;
- F.2 : endpoint GET /api/admin/system/schedule (lecture seule, derive du beat) ;
- F.3 : no-offer DERIVE de l'heure d'envoi (+30 min, report minuit inclus) ;
- F.4 : garde au boot contre un APP_TIMEZONE a DST (log erreur, pas de crash) ;
- P.1 : task_acks_late + task_reject_on_worker_lost + prefetch 1 ;
- P.2 : result_expires explicite ;
- M.2 : retry_failed_digests inscrit au beat horaire 09:00-18:00.

Les tests structurels dependent de l'etat de SCRAPER_BEAT_ENABLED au moment
de l'import de celery_app (variable d'env globale) : ils sont conditionnes
par ca.SCRAPER_BEAT_ENABLED pour ne jamais dependre de l'ordre de collecte.
"""

from __future__ import annotations

from zoneinfo import ZoneInfo

import pytest

pytestmark = pytest.mark.admin_db

from celery.schedules import crontab

import celery_app as ca
from core.config import Settings

# ─── Helpers purs ──────────────────────────────────────────────────────


def test_local_plus_minutes_derivation_et_report_minuit():
    """F.3 : derivation no-offer = send + 30 min, report minuit gere."""
    assert ca._local_plus_minutes(8, 0, 30) == (8, 30)
    assert ca._local_plus_minutes(8, 45, 30) == (9, 15)
    # Passage de minuit : 23:45 + 30 min -> 00:15 (crontab invalide evite).
    assert ca._local_plus_minutes(23, 45, 30) == (0, 15)
    assert ca._local_plus_minutes(23, 30, 30) == (0, 0)


def test_abidjan_crontab_convertit_en_utc():
    """F.4 (heritage P1 #34) : heure locale convertie en UTC — ici Abidjan=UTC+0."""
    local = ca._abidjan_crontab(6, 0)
    assert local == crontab(hour=6, minute=0)


def test_abidjan_crontab_plage_heures():
    """M.2 : plage "9-18" acceptee, bornes converties en UTC."""
    plage = ca._abidjan_crontab("9-18", 0)
    assert plage == crontab(hour="9-18", minute=0)
    # Fuseau a decalage non nul : la plage entiere est decalee du meme offset.
    orig_tz = ca.TARGET_TZ
    try:
        ca.TARGET_TZ = ZoneInfo("Africa/Nairobi")  # UTC+3, sans DST
        plage_nairobi = ca._abidjan_crontab("9-18", 0)
        assert plage_nairobi == crontab(hour="6-15", minute=0)
    finally:
        ca.TARGET_TZ = orig_tz


def test_garde_dst_loggue_erreur_sans_crash(caplog):
    """F.4 : un fuseau a DST declenche un log ERROR, jamais d'exception."""
    orig_tz = ca.TARGET_TZ
    try:
        ca.TARGET_TZ = ZoneInfo("Europe/Paris")
        with caplog.at_level("ERROR", logger="celery_app"):
            ca._check_no_dst_timezone()
        assert any("DST" in rec.message or "heure d'ete" in rec.message for rec in caplog.records)
    finally:
        ca.TARGET_TZ = orig_tz
    # Fuseau sain : aucun log.
    caplog.clear()
    ca.TARGET_TZ = ZoneInfo("Africa/Abidjan")
    try:
        with caplog.at_level("ERROR", logger="celery_app"):
            ca._check_no_dst_timezone()
        assert not caplog.records
    finally:
        ca.TARGET_TZ = orig_tz


# ─── Structure du beat (F.1, F.3, M.2) ─────────────────────────────────


@pytest.mark.skipif(not ca.SCRAPER_BEAT_ENABLED, reason="SCRAPER_BEAT_ENABLED=false dans cet env")
def test_f1_un_seul_crontab_scrape_all_sources():
    """F.1 : le scraping passe par run_active_scrapers (lecture table sources),
    plus aucun crontab unitaire code en dur par source."""
    scraper_entries = {name for name, e in ca.beat_schedule.items() if "scrapers" in e["task"]}
    assert scraper_entries == {"scrape-all-sources"}
    entry = ca.beat_schedule["scrape-all-sources"]
    assert entry["task"] == "tasks.scrapers.run_active_scrapers"
    # L'heure est pilotable par DAILY_COLLECTION_HOUR (defaut 6 -> 06:00 local).
    assert entry["schedule"] == ca._abidjan_crontab(6, 0)


def test_f3_no_offer_derive_de_lheure_envoi():
    """F.3 : no-offer = digest-send + 30 min — jamais independant."""
    send_entry = ca.beat_schedule["digest-send"]
    no_offer = ca.beat_schedule["digest-send-no-offer"]
    send_minute = int(str(send_entry["schedule"]._orig_hour)) * 60 + int(str(send_entry["schedule"]._orig_minute))
    no_offer_minute = int(str(no_offer["schedule"]._orig_hour)) * 60 + int(str(no_offer["schedule"]._orig_minute))
    assert (no_offer_minute - send_minute) % (24 * 60) == 30


def test_f3_purge_heure_configurable():
    """F.3 : purges refresh tokens H:00 / alertes IA H:15 avec H = DAILY_PURGE_HOUR."""
    purge_hour = Settings().daily_purge_hour
    assert ca.beat_schedule["purge-expired-refresh-tokens"]["schedule"] == ca._abidjan_crontab(purge_hour, 0)
    assert ca.beat_schedule["purge-ai-alerts"]["schedule"] == ca._abidjan_crontab(purge_hour, 15)


def test_m2_retry_failed_digests_au_beat():
    """M.2 : rattrapage planifie horaire 09:00-18:00, kill-switch documente."""
    assert "retry-failed-digests" in ca.beat_schedule
    entry = ca.beat_schedule["retry-failed-digests"]
    assert entry["task"] == "tasks.digests.retry_failed_digests"
    assert entry["schedule"] == ca._abidjan_crontab("9-18", 0)


# ─── Conf Celery (P.1, P.2) ─────────────────────────────────────────────


def test_p1_acks_late_et_reject_on_worker_lost():
    """P.1 : une tache en cours au crash worker est reattribuee, pas perdue."""
    conf = ca.celery_app.conf
    assert conf.task_acks_late is True
    assert conf.task_reject_on_worker_lost is True
    assert conf.worker_prefetch_multiplier == 1


def test_p2_result_expires_explicite():
    """P.2 : purge des resultats Redis bornee explicitement (1 h)."""
    assert ca.celery_app.conf.result_expires == 3600


def test_routes_maintenance_absentes_corrigees():
    """Lot 4 (decouverte) : les 3 tasks maintenance ont une route de queue
    (un .delay() manuel ne part plus sur la queue defaut 'celery')."""
    for task_name in (
        "tasks.maintenance.purge_expired_refresh_tokens",
        "tasks.maintenance.flush_offer_metrics",
        "tasks.maintenance.purge_ai_alerts",
    ):
        assert ca.celery_app.conf.task_routes[task_name] == {"queue": "emails"}


# ─── schedule_view (F.2) ────────────────────────────────────────────────


def test_schedule_view_coherence_avec_beat_schedule():
    """F.2 : la vue expose exactement les entrees du beat, avec meta metier."""
    view = {item["name"]: item for item in ca.schedule_view()}
    assert set(view) == set(ca.beat_schedule)
    for name, entry in ca.beat_schedule.items():
        assert view[name]["task"] == entry["task"]
        assert view[name]["queue"] == entry["options"]["queue"]
    # Chaque entree porte un label metier (jamais le nom technique seul).
    for item in view.values():
        assert item["label"]
        assert item["description"]


@pytest.mark.skipif(not ca.SCRAPER_BEAT_ENABLED, reason="SCRAPER_BEAT_ENABLED=false dans cet env")
def test_schedule_view_expose_kill_switchs():
    """F.2 : le toggle scrape est visible (SCRAPER_BEAT_ENABLED) + env_key."""
    view = {item["name"]: item for item in ca.schedule_view()}
    assert view["scrape-all-sources"]["toggle"] == "SCRAPER_BEAT_ENABLED"
    assert view["digest-prepare"]["env_key"]


# ─── Endpoint admin (F.2) ───────────────────────────────────────────────


def test_endpoint_schedule_200_super_admin(admin_client):
    """F.2 : GET /api/admin/system/schedule repond la planification derivee."""
    resp = admin_client.get("/api/admin/system/schedule")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["timezone"]
    assert isinstance(body["entries"], list)
    names = {e["name"] for e in body["entries"]}
    assert names == set(ca.beat_schedule)
    scrape = next(e for e in body["entries"] if e["name"] == "scrape-all-sources")
    assert scrape["task"] == "tasks.scrapers.run_active_scrapers"


def test_endpoint_schedule_403_role_non_autorise(admin_client):
    """F.2 : la vue planning reste super_admin seul (403 sinon)."""
    from api.deps import get_current_admin
    from models.admin import Administrator
    from models.enums import AdminRole

    fake_moderateur = Administrator(
        id="admin-moderateur",
        email="moderateur@jobalert.ci",
        full_name="Moderateur",
        password_hash="x",
        role=AdminRole.MODERATOR,
        is_active=True,
    )
    app = admin_client.app
    app.dependency_overrides[get_current_admin] = lambda: fake_moderateur
    try:
        resp = admin_client.get("/api/admin/system/schedule")
        assert resp.status_code == 403
    finally:
        app.dependency_overrides[get_current_admin] = lambda: None
        app.dependency_overrides.pop(get_current_admin, None)


def test_endpoint_schedule_refuse_sans_auth():
    """F.2 : sans JWT, la vue planning est inaccessible (401)."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from api.v1.admin import system_schedule

    app = FastAPI()
    app.include_router(system_schedule.router)
    resp = TestClient(app).get("/api/admin/system/schedule")
    assert resp.status_code == 401
