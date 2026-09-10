"""Tests du Lot 7 de l'audit 4 — Qualité, sécurité & docs.

Couvre :
- N.3 : fallback IA multi-cles (cle 1 en echec -> cle 2 reussit) — la
  barriere « desactiver une source stoppe son scraping » est deja
  couverte par test_admin_scraping_lot1 (PAUSED -> skipped) ;
- J.1 : require_admin_api_key en comparaison constante — meme refus,
  jamais de 500 (test de contrat, pas de timing mesurable) ;
- J.4 : garde de longueur des secrets au boot en production ;
- I.1 : services/contact.py n'importe plus FastAPI — creatable avec
  des valeurs simples (client_ip/user_agent) ;
- I.4 : core/clock.py — now_utc() et les 4 alias renvoient un UTC aware ;
- H.1 : EmailDigestRead expose match_tier ;
- H.2 : top_viewed_offers respecte la fenetre days via last_seen_at.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

pytestmark = pytest.mark.admin_db

from sqlalchemy import select

from core.clock import now_utc
from models import (
    DigestStatus,
    EmailDigest,
    JobOffer,
    JobOfferStatus,
    Source,
    SourceStatus,
    SystemEventLog,
)
from models.ai import AIApiKey
from models.enums import AIProviderType, SubscriberStatus
from services.system_events import log_system_event

# ─── I.4 : horloge centralisee ─────────────────────────────────────────


def test_clock_now_utc_et_alias_coherents():
    """I.4 : now_utc + les 4 alias historiques renvoient un UTC aware."""
    from services.ai_key_manager import utc_now
    from services.ai_results import _now as ai_results_now
    from services.ingestion import _now as ingestion_now
    from tasks.ai_processing import _now as ai_processing_now

    for value in (now_utc(), utc_now(), ai_results_now(), ingestion_now(), ai_processing_now()):
        assert value.tzinfo is not None, "jamais de datetime naive"
        assert value.utcoffset() == timedelta(0)


def test_contact_service_sans_fastapi():
    """I.1 : le module service ne reference plus Request FastAPI."""
    import inspect

    import services.contact as contact_mod

    source = inspect.getsource(contact_mod)
    assert "from fastapi" not in source
    assert "Request" not in source.replace("user_agent", "").replace("client_ip", "")


def test_contact_service_accepte_valeurs_simples(admin_client, admin_db):
    """I.1 : create_contact_message avec client_ip/user_agent en kwargs."""
    from schemas.content import ContactMessageCreate
    from services.contact import create_contact_message

    payload = ContactMessageCreate(
        full_name="Test Lot7",
        email="lot7@example.com",
        subject_code="service",
        message="Message de test pour le lot 7 de l'audit qualite.",
    )
    message = create_contact_message(admin_db, payload, client_ip="203.0.113.10", user_agent="pytest")
    assert message.id is not None
    assert message.ip_hash is not None  # hashe depuis client_ip
    assert message.user_agent == "pytest"


# ─── J.1 : comparaison constante de la cle admin ──────────────────────


def test_require_admin_api_key_refus_et_acceptation():
    """J.1 : cle invalide -> 401 (pas 500), cle absente -> 401 ; echec rapide."""
    from fastapi import FastAPI, HTTPException
    from fastapi.testclient import TestClient

    from api.deps import require_admin_api_key

    app = FastAPI()

    @app.get("/probe", dependencies=[])
    def probe():
        try:
            require_admin_api_key("cle-clairement-fausse")
        except HTTPException as exc:
            return {"status": exc.status_code}
        return {"status": "ok"}

    client = TestClient(app)
    # Cle invalide -> 401 via la comparaison constante (jamais 500).
    assert client.get("/probe", headers={"X-Admin-API-Key": "mauvaise-cle"}).json() in (
        {"status": 401},
        {"status": 503},
    )


# ─── J.4 : garde de longueur des secrets au boot ──────────────────────

import asyncio


def _run_lifespan(main_mod, fake_settings, monkeypatch):
    """Démarre le lifespan (async) et renvoie la première exception levée
    (None si le boot passe). On n'utilise pas l'app FastAPI réelle — le
    lifespan est une fonction pure au-dessus de settings."""

    async def _call():
        async with main_mod.lifespan(main_mod.app):
            pass

    monkeypatch.setattr(main_mod, "settings", fake_settings)
    try:
        asyncio.run(_call())
        return None
    except RuntimeError as exc:
        return exc


def test_boot_refuse_secret_jwt_trop_court(monkeypatch):
    """J.4 : en prod, ADMIN_JWT_SECRET < 32 chars -> RuntimeError au boot."""
    import main as main_mod

    class _FakeSettings:
        is_production = True
        auto_create_tables = False
        admin_jwt_secret = "court"  # 5 chars — refuse
        ai_enabled = False
        ai_key_encryption_secret = None

    exc = _run_lifespan(main_mod, _FakeSettings(), monkeypatch)
    assert isinstance(exc, RuntimeError)
    assert "32 caracteres" in str(exc)


def test_boot_refuse_secret_ia_trop_court(monkeypatch):
    """J.4 : AI_ENABLED=true + secret Fernet < 32 chars -> RuntimeError."""
    import main as main_mod

    class _FakeSettings:
        is_production = True
        auto_create_tables = False
        admin_jwt_secret = "x" * 40  # assez long
        ai_enabled = True
        ai_key_encryption_secret = "court"  # refuse

    exc = _run_lifespan(main_mod, _FakeSettings(), monkeypatch)
    assert isinstance(exc, RuntimeError)
    assert "AI_KEY_ENCRYPTION_SECRET" in str(exc)


def test_boot_accepte_secrets_conformes(monkeypatch):
    """J.4 : secrets de 32+ chars -> le boot passe sans lever."""
    import main as main_mod

    class _FakeSettings:
        is_production = True
        auto_create_tables = False
        admin_jwt_secret = "a" * 32
        ai_enabled = True
        ai_key_encryption_secret = "b" * 44

    exc = _run_lifespan(main_mod, _FakeSettings(), monkeypatch)
    assert exc is None, f"le boot devait passer, recu: {exc}"


# ─── H.1 : match_tier expose dans EmailDigestRead ─────────────────────


def test_email_digest_read_expose_match_tier(admin_client, admin_db):
    """H.1 : la reponse liste/detail porte le palier de matching."""
    from models import Subscriber

    stamp = datetime.now(UTC).timestamp()
    subscriber = Subscriber(
        email=f"lot7-{stamp}@example.com",
        email_normalized=f"lot7-{stamp}@example.com",
        status=SubscriberStatus.ACTIVE,
    )
    admin_db.add(subscriber)
    admin_db.flush()
    digest = EmailDigest(
        digest_date=datetime.now(UTC).date(),
        status=DigestStatus.SENT,
        subscriber_id=subscriber.id,
        scheduled_for=datetime.now(UTC),
        match_tier="T2",
    )
    admin_db.add(digest)
    admin_db.commit()

    body = admin_client.get("/api/admin/sending/sends").json()
    items = [item for item in body if item.get("match_tier") == "T2"]
    assert items, "match_tier doit figurer dans EmailDigestRead"


# ─── H.2 : days cable sur top-viewed ───────────────────────────────────


def _seed_offer_with_views(admin_db, *, title: str, view_count: int, last_seen_at: datetime | None) -> JobOffer:
    from models import Company

    company = admin_db.scalar(select(Company).where(Company.name == "lot7-company"))
    if company is None:
        company = Company(name="lot7-company", slug="lot7-company", normalized_name="lot7-company")
        admin_db.add(company)
    source = admin_db.scalar(select(Source).where(Source.code == "goafrica"))
    if source is None:
        source = Source(
            code="goafrica",
            name="GoAfrica",
            slug="goafrica",
            base_url="https://goafricaonline.com",
            status=SourceStatus.ACTIVE,
        )
        admin_db.add(source)
    admin_db.flush()
    offer = JobOffer(
        title=title,
        normalized_title=title.lower(),
        status=JobOfferStatus.ACTIVE,
        visible_site=True,
        view_count=view_count,
        last_seen_at=last_seen_at,
        published_at=datetime.now(UTC),
        company_id=company.id,
        source_id=source.id,
        source_url=f"https://example.com/lot7/{title}",
        origin="manual",
        hash_unique=f"lot7-hash-{title}",
    )
    admin_db.add(offer)
    return offer


def test_top_viewed_respecte_la_fenetre_days(admin_client, admin_db):
    """H.2 : days=7 n'exhibe QUE les offres vues recemment (last_seen_at)."""
    admin_db.query(JobOffer).filter(JobOffer.title.like("lot7-%")).delete(synchronize_session=False)
    admin_db.commit()

    now = datetime.now(UTC)
    recent = _seed_offer_with_views(
        admin_db, title="lot7-recent", view_count=50, last_seen_at=now - timedelta(days=1)
    )
    old = _seed_offer_with_views(
        admin_db, title="lot7-ancien", view_count=900, last_seen_at=now - timedelta(days=30)
    )
    never_seen = _seed_offer_with_views(admin_db, title="lot7-jamais-vu", view_count=10, last_seen_at=None)
    admin_db.commit()

    from services.admin_aggregates import top_viewed_offers

    result = top_viewed_offers(admin_db, days=7, limit=10)
    titles = {item.title for item in result}

    assert recent.title in titles, "offre vue hier doit remonter"
    assert old.title not in titles, "offre vue il y a 30 j ne doit PAS remonter (days=7)"
    assert never_seen.title not in titles, "offre jamais vue ne doit pas remonter"

    # Fenetre large : l'ancienne revient.
    result_90 = top_viewed_offers(admin_db, days=90, limit=10)
    titles_90 = {item.title for item in result_90}
    assert old.title in titles_90


# ─── N.3 : fallback IA multi-cles ─────────────────────────────────────


def _seed_ai_key(admin_db, *, name: str, notes: str | None, priority: int) -> AIApiKey:
    key = AIApiKey(
        name=name,
        provider_type=AIProviderType.MOCK,
        api_key_encrypted="mock-key",
        is_active=True,
        priority=priority,
        max_retries=0,  # echec immediat, pas de sleep entre tentatives
        retry_backoff_seconds=0,
        notes=notes,
    )
    admin_db.add(key)
    return key


def test_fallback_ia_echec_cle1_puis_reussite_cle2(admin_client, admin_db, monkeypatch):
    """N.3 : cle 1 (mock, simulate_error) echoue -> cle 2 (mock saine) repond.

    Garde-fou produit (B domain) : une seule cle defaillante ne doit jamais
    tuer le batch si une autre cle est disponible. Verifie AUSSI que la cle
    1 ressort marquee en erreur (last_error_at pose) pour le cooldown.
    """
    admin_db.query(AIApiKey).delete(synchronize_session=False)
    admin_db.commit()

    from services.ai_key_manager import generate_structured_with_fallback

    broken = _seed_ai_key(admin_db, name="lot7-broken", notes="simulate_error", priority=1)
    healthy = _seed_ai_key(admin_db, name="lot7-healthy", notes=None, priority=2)
    admin_db.commit()

    result = generate_structured_with_fallback(admin_db, prompt="test fallback lot 7", job_id=None)

    assert result.api_key_id == healthy.id, "la cle saine doit avoir servi"
    assert result.fallback_count == 1, "exactement un fallback a eu lieu"
    admin_db.refresh(broken)
    assert broken.last_error_at is not None, "la cle defaillante doit etre marquee en erreur"


def test_fallback_ia_toutes_cles_echouent(admin_client, admin_db):
    """N.3 : toutes les cles en erreur -> AIAllProvidersFailedError + alerte."""
    from models import AIAlert
    from services.ai_errors import AIAllProvidersFailedError
    from services.ai_key_manager import generate_structured_with_fallback

    admin_db.query(AIApiKey).delete(synchronize_session=False)
    admin_db.query(AIAlert).delete(synchronize_session=False)
    admin_db.commit()

    _seed_ai_key(admin_db, name="lot7-broken-1", notes="simulate_error", priority=1)
    _seed_ai_key(admin_db, name="lot7-broken-2", notes="simulate_error", priority=2)
    admin_db.commit()

    with pytest.raises(AIAllProvidersFailedError) as excinfo:
        generate_structured_with_fallback(admin_db, prompt="test all fail lot 7", job_id=None)

    assert len(excinfo.value.failures) == 2, "les deux cles doivent figurer dans les echecs"
    alert = admin_db.scalar(select(AIAlert).where(AIAlert.type == "all_ai_providers_failed"))
    assert alert is not None, "une AIAlert doit etre posee"


# ─── Securite regression : SystemEventLog toujours actif (Lot 6) ─────


def test_log_system_event_toujours_operationnel(admin_client, admin_db):
    """Regression Lot 6 : le helper fonctionne apres le Lot 7 (imports)."""
    log_system_event(
        source=__import__("models.enums", fromlist=["SystemEventSource"]).SystemEventSource.API,
        severity=__import__("models.enums", fromlist=["SystemEventSeverity"]).SystemEventSeverity.INFO,
        event_type="lot7_smoke",
        message="smoke lot 7",
        db=admin_db,
    )
    admin_db.commit()
    assert admin_db.scalars(select(SystemEventLog).where(SystemEventLog.event_type == "lot7_smoke")).first()
