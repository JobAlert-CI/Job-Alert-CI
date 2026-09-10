"""Tests du Lot 6 de l'audit 4 — Observabilité (G.1, O.1, O.4, H.3).

Couvre :
- G.1 : le helper log_system_event ecrit en base, ne plante JAMAIS
  l'appelant (echec d'ecriture avale), et les tasks echouees tracent
  bien leurs evenements (purge system, digest send abandonne) ;
- G.1 : GET /api/admin/system/events — liste, filtres source/severity,
  400 sur valeur enum inconnue ;
- O.4 : le statut email_provider est DERIVE des derniers echecs
  (EmailDeliveryAttempt FAILED < 15 min -> degraded ; rien -> ok),
  ai_provider via last_error_at / disabled_until / AI_ENABLED=false ;
- H.3 : les profondeurs de queues proviennent du LLEN broker (mock
  Redis) et retombent sur "N/A" quand le broker est injoignable ;
- O.1 : /metrics expose les compteurs metier (offers, digests, IA)
  avec cardinalite fixe.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

pytestmark = pytest.mark.admin_db

from sqlalchemy import select

from models import (
    DigestStatus,
    EmailDeliveryAttempt,
    EmailDigest,
    SystemEventLog,
    SystemEventSeverity,
    SystemEventSource,
)
from models.ai import AIApiKey
from models.enums import EmailAttemptStatus
from services.system_events import log_system_event
from tasks.maintenance import SYSTEM_EVENT_RETENTION_DAYS, purge_system_events

# ─── G.1 : helper log_system_event ────────────────────────────────────


def test_log_system_event_ecrit_en_base(admin_client, admin_db):
    log_system_event(
        source=SystemEventSource.CELERY,
        severity=SystemEventSeverity.ERROR,
        event_type="digest_prepare_failed",
        message="Preparation des digests echouee pour 2026-09-09",
        context={"day_key": "2026-09-09", "error": "ValueError"},
        db=admin_db,
    )
    admin_db.commit()

    entry = admin_db.scalar(select(SystemEventLog).where(SystemEventLog.event_type == "digest_prepare_failed"))
    assert entry is not None
    assert entry.source == SystemEventSource.CELERY
    assert entry.severity == SystemEventSeverity.ERROR
    assert entry.context == {"day_key": "2026-09-09", "error": "ValueError"}


def test_log_system_event_ne_plante_jamais_l_appelant(admin_client, admin_db, monkeypatch):
    """G.1 : l'echec de journalisation ne doit PAS masquer l'echec d'origine."""

    class _BrokenSession:
        def add(self, *_a, **_kw):
            raise RuntimeError("session morte")

    # db=None declenche session_scope : on le casse aussi pour verifier
    # le double filet (l'exception du bloc try est avalee, log warning).
    import db.session as db_session_mod

    monkeypatch.setattr(db_session_mod, "session_scope", lambda: _BrokenSession())

    result = log_system_event(
        source=SystemEventSource.EMAIL,
        severity=SystemEventSeverity.ERROR,
        event_type="digest_send_failed",
        message="Envoi abandonne",
    )
    assert result is None  # avale, pas de raise


def test_log_system_event_tronque_les_champs(admin_client, admin_db):
    """G.1 : event_type borne a 120, message a 2000 — pas de payload non borne."""
    log_system_event(
        source=SystemEventSource.API,
        severity=SystemEventSeverity.WARNING,
        event_type="x" * 500,
        message="m" * 5000,
        db=admin_db,
    )
    admin_db.commit()
    entry = admin_db.scalars(select(SystemEventLog).order_by(SystemEventLog.created_at.desc())).first()
    assert len(entry.event_type) == 120
    assert len(entry.message) == 2000


# ─── G.1 : endpoint GET /api/admin/system/events ───────────────────────


def _seed_events(admin_db, n: int = 3) -> None:
    admin_db.query(SystemEventLog).delete(synchronize_session=False)
    for index in range(n):
        log_system_event(
            source=SystemEventSource.EMAIL if index % 2 else SystemEventSource.CELERY,
            severity=SystemEventSeverity.ERROR if index == 0 else SystemEventSeverity.WARNING,
            event_type=f"event_{index}",
            message=f"Message {index}",
            db=admin_db,
        )
    admin_db.commit()


def test_system_events_liste_et_filtres(admin_client, admin_db):
    _seed_events(admin_db, 3)

    body = admin_client.get("/api/admin/system/events").json()
    assert body["total"] == 3
    assert [e["event_type"] for e in body["events"]] == ["event_2", "event_1", "event_0"]

    body = admin_client.get("/api/admin/system/events", params={"source": "email"}).json()
    assert body["total"] == 1
    assert body["events"][0]["source"] == "email"

    body = admin_client.get("/api/admin/system/events", params={"severity": "error"}).json()
    assert body["total"] == 1
    assert body["events"][0]["severity"] == "error"

    body = admin_client.get(
        "/api/admin/system/events", params={"source": "email", "severity": "error"}
    ).json()
    assert body["total"] == 0


def test_system_events_rejette_valeur_inconnue(admin_client, admin_db):
    assert admin_client.get("/api/admin/system/events", params={"source": "inconnu"}).status_code == 400
    assert admin_client.get("/api/admin/system/events", params={"severity": "fatal"}).status_code == 400


def test_system_events_fenetre_days(admin_client, admin_db):
    """G.1 : days=1 exclut les evenements de plus d'un jour."""
    admin_db.query(SystemEventLog).delete(synchronize_session=False)
    log_system_event(
        source=SystemEventSource.CELERY,
        severity=SystemEventSeverity.ERROR,
        event_type="vieux",
        message="ancien",
        db=admin_db,
    )
    admin_db.flush()
    old = admin_db.scalars(select(SystemEventLog)).first()
    old.created_at = datetime.now(UTC) - timedelta(days=30)
    admin_db.commit()

    body = admin_client.get("/api/admin/system/events", params={"days": 1}).json()
    assert body["total"] == 0
    body = admin_client.get("/api/admin/system/events", params={"days": 60}).json()
    assert body["total"] == 1


# ─── G.1 : purge du journal ────────────────────────────────────────────


def test_purge_system_events_90j(admin_client, admin_db):
    admin_db.query(SystemEventLog).delete(synchronize_session=False)
    log_system_event(
        source=SystemEventSource.CELERY, severity=SystemEventSeverity.ERROR,
        event_type="recent", message="recent", db=admin_db,
    )
    log_system_event(
        source=SystemEventSource.CELERY, severity=SystemEventSeverity.ERROR,
        event_type="vieux", message="vieux", db=admin_db,
    )
    admin_db.flush()
    vieux = admin_db.scalars(select(SystemEventLog).where(SystemEventLog.event_type == "vieux")).first()
    vieux.created_at = datetime.now(UTC) - timedelta(days=120)
    admin_db.commit()

    result = purge_system_events.run()
    admin_db.expire_all()
    remaining = {e.event_type for e in admin_db.scalars(select(SystemEventLog)).all()}

    assert result["deleted"] >= 1
    assert "recent" in remaining
    assert "vieux" not in remaining
    assert SYSTEM_EVENT_RETENTION_DAYS == 90


def test_task_digest_build_echouee_trace_un_event(admin_client, admin_db, monkeypatch):
    """G.1 : build_and_queue_digest en erreur laisse une trace requetable."""

    def _boom(*_a, **_kw):
        raise ValueError("pipeline casse")

    import services.digest_builder_service as builder_mod
    import tasks.digests as digests_mod

    monkeypatch.setattr(builder_mod, "build_and_queue_digest_sync", _boom)

    before = len(list(admin_db.scalars(select(SystemEventLog))))
    result = digests_mod.build_and_queue_digest("subscriber-1", "2026-09-09", force=True)
    admin_db.expire_all()
    events = list(admin_db.scalars(select(SystemEventLog)))

    assert result["status"] == "error"  # la task ne plante pas
    assert len(events) == before + 1
    assert events[-1].event_type == "digest_build_failed"
    assert events[-1].source == SystemEventSource.CELERY


# ─── H.3 : profondeurs LLEN ────────────────────────────────────────────


def _queue_depth_patch(monkeypatch, depths):
    """Patche _redis_queue_depths pour simuler le broker (LLEN)."""

    import api.v1.admin.system_health as health_mod

    monkeypatch.setattr(health_mod, "_redis_queue_depths", lambda: depths)


def test_health_profondeurs_llen_reelles(admin_client, admin_db, monkeypatch):
    """H.3 : ai/ingestion/emails affichent la profondeur LLEN du broker."""
    _queue_depth_patch(monkeypatch, {"celery": 0, "ai": 4, "ingestion": 2, "emails": 11})

    body = admin_client.get("/api/admin/system/health").json()
    queues = body["redis_queues"]["queues"]
    assert queues["ai_depth"] == 4
    assert queues["ingestion_depth"] == 2
    assert queues["emails_depth"] == 11
    assert body["redis_queues"]["status"] == "ok"


def test_health_profondeurs_na_broker_injoignable(admin_client, admin_db, monkeypatch):
    """H.3 : broker Redis injoignable -> N/A + status warning, pas de 500."""
    _queue_depth_patch(monkeypatch, {queue: "N/A" for queue in ("celery", "ai", "ingestion", "emails")})

    response = admin_client.get("/api/admin/system/health")
    assert response.status_code == 200
    body = response.json()
    assert all(depth == "N/A" for depth in body["redis_queues"]["queues"].values() if isinstance(depth, str))
    assert body["redis_queues"]["status"] == "warning"


# ─── O.4 : sante derivee des providers ─────────────────────────────────


def _cleanup_provider_state(admin_db) -> None:
    """Isole chaque test O.4 : les tentatives/cles des tests precedents
    ne doivent pas influencer le statut derive."""
    admin_db.query(EmailDeliveryAttempt).delete(synchronize_session=False)
    admin_db.query(EmailDigest).where(EmailDigest.status == DigestStatus.FAILED).delete(synchronize_session=False)
    admin_db.query(AIApiKey).delete(synchronize_session=False)
    admin_db.commit()


def test_health_email_provider_ok_sans_echec_recent(admin_client, admin_db, monkeypatch):
    _queue_depth_patch(monkeypatch, {"celery": 0, "ai": 0, "ingestion": 0, "emails": 0})
    _cleanup_provider_state(admin_db)
    body = admin_client.get("/api/admin/system/health").json()
    assert body["email_provider"]["status"] == "ok"


def _seed_digest_with_attempt(admin_db, *, finished_at, status: EmailAttemptStatus = EmailAttemptStatus.FAILED) -> None:
    """Digest + tentative d'envoi avec l'horodatage voulu (O.4)."""
    from models import Subscriber, SubscriberStatus

    stamp = datetime.now(UTC).timestamp()
    subscriber = Subscriber(
        email=f"health-{stamp}@example.com",
        email_normalized=f"health-{stamp}@example.com",
        status=SubscriberStatus.ACTIVE,
    )
    admin_db.add(subscriber)
    admin_db.flush()
    digest = EmailDigest(
        digest_date=datetime.now(UTC).date(),
        status=DigestStatus.FAILED,
        subscriber_id=subscriber.id,
        scheduled_for=datetime.now(UTC),
    )
    admin_db.add(digest)
    admin_db.flush()
    admin_db.add(
        EmailDeliveryAttempt(
            digest_id=digest.id,
            attempt_no=1,
            status=status,
            finished_at=finished_at,
        )
    )
    admin_db.commit()


def test_health_email_provider_degraded_sur_echec_recent(admin_client, admin_db, monkeypatch):
    """O.4 : EmailDeliveryAttempt FAILED < 15 min -> degraded, sans ping Resend."""
    _queue_depth_patch(monkeypatch, {"celery": 0, "ai": 0, "ingestion": 0, "emails": 0})

    _seed_digest_with_attempt(admin_db, finished_at=datetime.now(UTC) - timedelta(minutes=5))

    body = admin_client.get("/api/admin/system/health").json()
    assert body["email_provider"]["status"] == "degraded"
    assert body["overall_status"] == "degraded"


def test_health_email_provider_echec_ancien_pas_degraded(admin_client, admin_db, monkeypatch):
    """O.4 : une erreur d'il y a 3 h ne degrade pas la sante actuelle."""
    _queue_depth_patch(monkeypatch, {"celery": 0, "ai": 0, "ingestion": 0, "emails": 0})
    _cleanup_provider_state(admin_db)

    _seed_digest_with_attempt(admin_db, finished_at=datetime.now(UTC) - timedelta(hours=3))

    body = admin_client.get("/api/admin/system/health").json()
    assert body["email_provider"]["status"] == "ok"


def test_health_ai_provider_disabled_si_ai_off(admin_client, admin_db, monkeypatch):
    """O.4 : AI_ENABLED=false (defaut tests) -> disabled, pas degraded."""
    _queue_depth_patch(monkeypatch, {"celery": 0, "ai": 0, "ingestion": 0, "emails": 0})
    body = admin_client.get("/api/admin/system/health").json()
    assert body["ai_provider"]["status"] in {"disabled", "warning"}
    assert body["ai_provider"]["status"] != "degraded"


def test_health_ai_provider_degraded_sur_erreur_recente(admin_client, admin_db, monkeypatch):
    """O.4 : AIApiKey.last_error_at < 15 min -> degraded, sans ping Anthropic."""
    _queue_depth_patch(monkeypatch, {"celery": 0, "ai": 0, "ingestion": 0, "emails": 0})
    _cleanup_provider_state(admin_db)

    from core.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("AI_ENABLED", "true")
    try:
        admin_db.add(
            AIApiKey(
                name="prod",
                provider_type="mock",
                api_key_encrypted="xxx",
                is_active=True,
                last_error_at=datetime.now(UTC) - timedelta(minutes=5),
            )
        )
        admin_db.commit()

        body = admin_client.get("/api/admin/system/health").json()
        assert body["ai_provider"]["status"] == "degraded"
    finally:
        monkeypatch.delenv("AI_ENABLED", raising=False)
        get_settings.cache_clear()


def test_health_ai_provider_toutes_cles_en_cooldown(admin_client, admin_db, monkeypatch):
    """O.4 : toutes les cles actives disabled_until > now -> degraded."""
    _queue_depth_patch(monkeypatch, {"celery": 0, "ai": 0, "ingestion": 0, "emails": 0})
    _cleanup_provider_state(admin_db)

    from core.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("AI_ENABLED", "true")
    try:
        admin_db.add(
            AIApiKey(
                name="cooldown",
                provider_type="mock",
                api_key_encrypted="xxx",
                is_active=True,
                disabled_until=datetime.now(UTC) + timedelta(minutes=30),
            )
        )
        admin_db.commit()

        body = admin_client.get("/api/admin/system/health").json()
        assert body["ai_provider"]["status"] == "degraded"
        assert body["overall_status"] == "degraded"
    finally:
        monkeypatch.delenv("AI_ENABLED", raising=False)
        get_settings.cache_clear()


# ─── O.1 : metriques metier /metrics ──────────────────────────────────


def test_metrics_contient_les_compteurs_metier(admin_client, admin_db):
    """/metrics expose offers/digests/IA (O.1) — scrapeable et cardinalite fixe."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from api.metrics import router as metrics_router

    app = FastAPI()
    app.include_router(metrics_router)
    with TestClient(app) as client:
        body = client.get("/metrics").text

    for metric in (
        "jobalert_offers_total",
        "jobalert_offers_inserted_total",
        'jobalert_digests_total{status="sent"}',
        'jobalert_digests_total{status="failed"}',
        'jobalert_digests_total{status="queued"}',
        "jobalert_ai_jobs_failed_total",
    ):
        assert metric in body, f"metrique metier absente: {metric}"
    # Compteurs HTTP toujours presents.
    assert "http_requests_total" in body


def test_metrics_reste_scrapeable_base_indisponible(monkeypatch):
    """O.1 : erreur SQL -> metriques metier omises, /metrics repond 200."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    import db.session as db_session_mod
    from api.metrics import router as metrics_router

    def _boom():
        raise RuntimeError("base indisponible")

    # On casse la source (pas la fonction) : _business_metrics importe
    # SessionLocal AU MOMENT de l'appel depuis db.session — c'est donc
    # l'attribut du module source qu'il faut patcher. L'erreur SQL doit
    # etre avalee et /metrics rester scrapeable.
    monkeypatch.setattr(db_session_mod, "SessionLocal", _boom)

    app = FastAPI()
    app.include_router(metrics_router)
    with TestClient(app) as client:
        response = client.get("/metrics")

    assert response.status_code == 200
    assert "http_requests_total" in response.text
    assert "jobalert_offers_total" not in response.text
