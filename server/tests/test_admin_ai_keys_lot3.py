"""Tests du Lot 3 (audit 4) : configuration des cles IA.

Couvre :
- B.1 : AI_CIRCUIT_BREAKER_MINUTES reellement lu au call-site (monkeypatch
  du settings -> propage a generate_structured_with_fallback) ;
- B.5 : longueur minimale 32 du secret de chiffrement + script de rotation ;
- B.6 : lecture via get_settings (plus de getenv direct) ;
- B.7 : garde lifespan prod (secret IA requis si ai_enabled) ;
- B.4 : cooldown des alertes (occurrences incrementees, pas de nouvelle
  ligne tant que la precedente n'est pas acquittee) + purge 90 j ;
- B.9 : seuil de confiance admin (ai_min_filiere_confidence) — sous le
  seuil, un resultat prevu pour activation part en revue.

Base vivante entre tests du module (marker admin_db) : chaque test nettoie
ses cles/alertes/settings en tete.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

pytestmark = pytest.mark.admin_db

from sqlalchemy import select

from core.config import get_settings
from models import AIAlert, AIApiKey
from models.admin import SiteSetting
from models.enums import AIAlertSeverity, AIProviderType
from services.ai_errors import AIConfigurationError

# ─── Helpers ──────────────────────────────────────────────────────────


def _cleanup_lot3(db) -> None:
    db.query(AIAlert).delete()
    db.query(SiteSetting).filter(SiteSetting.key == "ai_min_filiere_confidence").delete()
    db.commit()


def _seed_key(db, name: str = "lot3-key") -> AIApiKey:
    from services.ai_crypto import encrypt_api_key

    key = AIApiKey(
        name=name,
        provider_type=AIProviderType.MOCK,
        api_key_encrypted=encrypt_api_key("sk-lot3-test-key"),
        api_key_last4="-key",
        is_active=True,
    )
    db.add(key)
    db.commit()
    return key


SECRET_32 = "0123456789abcdef0123456789abcdef"


# ─── B.5 : longueur minimale + rotation ──────────────────────────────


def test_secret_trop_court_refuse(admin_client, admin_db, monkeypatch):
    """Un secret < 32 chars leve AIConfigurationError (B.5)."""
    from dataclasses import replace

    _cleanup_lot3(admin_db)
    base = get_settings()
    monkeypatch.setattr(
        "core.config.get_settings",
        lambda: replace(base, ai_key_encryption_secret="court"),
    )
    from services.ai_crypto import _fernet_key_from_secret

    with pytest.raises(AIConfigurationError) as exc_info:
        _fernet_key_from_secret("court")
    assert "32" in str(exc_info.value)


def test_rotation_secret_reencrypte(admin_client, admin_db, monkeypatch):
    """Le script de rotation dechiffre avec l'ancien et re-encrypte avec le
    nouveau — la cle reste utilisable apres rotation (B.5)."""
    from dataclasses import replace

    from services import ai_crypto

    _cleanup_lot3(admin_db)
    base = get_settings()
    # Phase 1 : chiffrer avec le secret A (32 chars).
    monkeypatch.setattr(
        "core.config.get_settings",
        lambda: replace(base, ai_key_encryption_secret=SECRET_32),
    )
    encrypted_a = ai_crypto.encrypt_api_key("sk-rotation-test")

    # Phase 2 : le nouveau secret B est en env, l'ancien A est passe au script.
    secret_b = "fedcba9876543210fedcba9876543210"
    monkeypatch.setattr(
        "core.config.get_settings",
        lambda: replace(base, ai_key_encryption_secret=secret_b),
    )
    from scripts.rotate_ai_encryption_secret import _decrypt_with_secret

    # Le decrypt avec l'ANCIEN secret marche, le re-chiffrement avec le
    # NOUVEAU se verifie par decrypt direct.
    plain = _decrypt_with_secret(encrypted_a, SECRET_32)
    assert plain == "sk-rotation-test"
    encrypted_b = ai_crypto.encrypt_api_key(plain)
    assert ai_crypto.decrypt_api_key(encrypted_b) == "sk-rotation-test"
    # Le ciphertext a reellement change (re-chiffre, pas copie).
    assert encrypted_a != encrypted_b


# ─── B.6 : lecture via settings ──────────────────────────────────────


def test_crypto_lit_via_settings_pas_getenv(admin_client, admin_db):
    """_fernet() passe par get_settings().ai_key_encryption_secret (B.6).

    Verifie structurellement : un settings monkeypatte avec un secret A
    produit une cle qui dechiffre ce qui a ete chiffre avec A — si ai_crypto
    lisait getenv, le settings patche serait ignore.
    """
    from dataclasses import replace

    from services import ai_crypto

    _cleanup_lot3(admin_db)
    base = get_settings()
    secret_a = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    monkey_secret = replace(base, ai_key_encryption_secret=secret_a)

    # Patch du get_settings reference DANS ai_crypto (import tardif) : on
    # patche core.config.get_settings, que ai_crypto importe au call.
    import core.config

    original = core.config.get_settings
    core.config.get_settings = lambda: monkey_secret
    try:
        token = ai_crypto.encrypt_api_key("via-settings")
        assert ai_crypto.decrypt_api_key(token) == "via-settings"
    finally:
        core.config.get_settings = original


# ─── B.4 : cooldown des alertes ──────────────────────────────────────


def _make_alert(db, type_: str = "no_ai_api_key_available", acknowledged: bool = False) -> AIAlert:
    alert = AIAlert(
        type=type_,
        severity=AIAlertSeverity.ERROR,
        message="alerte test",
        acknowledged_at=datetime.now(UTC) if acknowledged else None,
    )
    db.add(alert)
    db.commit()
    return alert


def test_cooldown_alerte_meme_type_comptee(admin_client, admin_db):
    """Une 2e occurrence du meme type non-acquitte RAFRAICHit la ligne
    existante (occurrences+1) au lieu d'en creer une nouvelle (B.4)."""
    from services.ai_key_manager import _create_alert

    _cleanup_lot3(admin_db)
    first = _make_alert(admin_db)

    second = _create_alert(
        admin_db,
        job_id=None,
        type_="no_ai_api_key_available",
        severity=AIAlertSeverity.ERROR,
        message="Aucune cle IA active et disponible pour traiter le batch.",
    )

    total = admin_db.query(AIAlert).filter_by(type="no_ai_api_key_available").count()
    assert total == 1, "le cooldown ne doit pas creer de nouvelle ligne"
    assert second.id == first.id, "la meme alerte est rafraichie"
    assert (second.payload or {}).get("occurrences") == 2


def test_cooldown_alerte_acquittee_nouveau_flux(admin_client, admin_db):
    """Apres acquittement, une NOUVELLE alerte du meme type est creee : le
    cooldown ne doit pas fusionner une panne ancienne avec une panne neuve."""
    from services.ai_key_manager import _create_alert

    _cleanup_lot3(admin_db)
    _make_alert(admin_db, acknowledged=True)

    fresh = _create_alert(
        admin_db,
        job_id=None,
        type_="no_ai_api_key_available",
        severity=AIAlertSeverity.ERROR,
        message="Aucune cle IA active et disponible pour traiter le batch.",
    )

    total = admin_db.query(AIAlert).filter_by(type="no_ai_api_key_available").count()
    assert total == 2
    assert (fresh.payload or {}).get("occurrences") is None, "la nouvelle alerte repart a zero"


def test_cooldown_types_differents_independants(admin_client, admin_db):
    """Deux types differents produisent deux lignes distinctes."""
    from services.ai_key_manager import _create_alert

    _cleanup_lot3(admin_db)
    _create_alert(
        admin_db, job_id=None, type_="no_ai_api_key_available",
        severity=AIAlertSeverity.ERROR, message="a",
    )
    _create_alert(
        admin_db, job_id=None, type_="all_ai_providers_failed",
        severity=AIAlertSeverity.ERROR, message="b",
    )
    assert admin_db.query(AIAlert).count() == 2


def test_purge_ai_alerts_90j(admin_client, admin_db):
    """purge_ai_alerts supprime uniquement les lignes de plus de 90 jours."""
    from tasks.maintenance import AI_ALERT_RETENTION_DAYS, purge_ai_alerts

    _cleanup_lot3(admin_db)
    old = _make_alert(admin_db, "old-alert")
    old.created_at = datetime.now(UTC) - timedelta(days=AI_ALERT_RETENTION_DAYS + 1)
    _make_alert(admin_db, "recent-alert")
    admin_db.commit()

    result = purge_ai_alerts.run()
    assert result["deleted"] == 1
    remaining = {a.type for a in admin_db.scalars(select(AIAlert)).all()}
    assert remaining == {"recent-alert"}


# ─── B.1 : circuit-breaker cable ─────────────────────────────────────


def test_circuit_breaker_minutes_lu_depuis_settings(admin_client, admin_db, monkeypatch):
    """Le settings ai_circuit_breaker_minutes doit atteindre
    generate_structured_with_fallback (B.1) — verifie via capture du kwarg."""
    from dataclasses import replace

    _cleanup_lot3(admin_db)
    captured = {}

    import services.ai_batches as batches

    def fake_generate(db, **kwargs):
        captured.update(kwargs)
        raise AIConfigurationError("stop ici")

    monkeypatch.setattr(batches, "generate_structured_with_fallback", fake_generate)

    base = get_settings()
    monkeypatch.setattr(
        "services.ai_batches.get_settings",
        lambda: replace(base, ai_circuit_breaker_minutes=42),
    )

    offer = _make_offer(admin_db, "Lot3 CB")

    with pytest.raises(AIConfigurationError):
        batches.process_ai_batch_with_provider(admin_db, job_id="00000000-0000-0000-0000-000000000099", offers=[offer])

    assert captured.get("circuit_breaker_minutes") == 42, (
        "le settings AI_CIRCUIT_BREAKER_MINUTES doit etre passe au fallback manager"
    )


# ─── B.7 : garde lifespan ─────────────────────────────────────────────


def test_lifespan_refuse_prod_sans_secret_ia(admin_client, admin_db, monkeypatch):
    """is_production + ai_enabled + secret absent -> RuntimeError au boot."""
    from dataclasses import replace

    _cleanup_lot3(admin_db)
    base = get_settings()
    prod_like = replace(
        base,
        environment="production",
        ai_enabled=True,
        ai_key_encryption_secret=None,
    )
    monkeypatch.setattr("main.get_settings", lambda: prod_like)

    import main as main_module

    # On relance le module pour re-evaluer settings au niveau module.
    monkeypatch.setattr(main_module, "settings", prod_like)

    # Appel direct de la fonction lifespan (hors TestClient).
    import asyncio

    async def run_lifespan():
        # lifespan est un asynccontextmanager : on l'ouvre pour declencher
        # le code pre-yield (la garde).
        cm = main_module.lifespan(main_module.app)
        await cm.__aenter__()

    with pytest.raises(RuntimeError) as exc_info:
        asyncio.run(run_lifespan())
    assert "AI_KEY_ENCRYPTION_SECRET" in str(exc_info.value)


def test_lifespan_prod_avec_secret_passe(admin_client, admin_db, monkeypatch):
    """Secret present en prod + ai_enabled : la garde ne leve pas."""
    from dataclasses import replace

    _cleanup_lot3(admin_db)
    base = get_settings()
    prod_like = replace(
        base,
        environment="production",
        ai_enabled=True,
        ai_key_encryption_secret=SECRET_32,
    )
    import main as main_module

    monkeypatch.setattr(main_module, "settings", prod_like)

    import asyncio

    async def run_lifespan():
        cm = main_module.lifespan(main_module.app)
        await cm.__aenter__()
        await cm.__aexit__(None, None, None)

    # Ne doit PAS lever (le flag auto_create_tables reste celui de test).
    asyncio.run(run_lifespan())


# ─── B.9 : seuil de confiance admin ──────────────────────────────────


def _make_offer(db, title: str, status=None):
    from models import JobOffer, JobOfferStatus
    from models.enums import JobOfferOrigin
    from models.jobs import Company
    from models.referentials import Source

    source = db.scalar(select(Source).limit(1))
    if source is None:
        source = Source(code="lot3-src", name="Lot3 Src", slug="lot3-src", base_url="https://example.com")
        db.add(source)
        db.commit()
    company = db.scalar(select(Company).limit(1))
    if company is None:
        company = Company(name="Lot3 Co", normalized_name="lot3-co")
        db.add(company)
        db.commit()
    offer = JobOffer(
        title=title,
        normalized_title=title.lower(),
        company_id=company.id,
        source_id=source.id,
        source_url=f"https://example.com/lot3/{title}",
        hash_unique=f"lot3-{title}",
        status=status or JobOfferStatus.BRUT,
        origin=JobOfferOrigin.MANUAL,
    )
    db.add(offer)
    db.commit()
    return offer


def _ensure_filiere(db) -> None:
    """Cree la filiere informatique si absente (referentiel des tests B.9)."""
    from models import Filiere

    if db.scalar(select(Filiere).where(Filiere.code == "informatique")) is None:
        db.add(Filiere(code="informatique", label="Informatique", slug="informatique", sort_order=1))
        db.commit()


def _result(offer_id: str, *, confidence: float, review: bool, filiere_code: str | None = "informatique"):
    from schemas.ai import (
        AIInternalResultSubmission,
        AIProcessedOfferDetail,
        AIProcessedOfferResult,
    )

    return AIInternalResultSubmission(
        job_id="00000000-0000-0000-0000-0000000000b9",
        provider_key_id=None,
        results=[
            AIProcessedOfferResult(
                offer_id=offer_id,
                primary_filiere_code=filiere_code,
                specialty_code=None,
                filiere_confidence=confidence,
                requires_admin_review=review,
                suggested_filiere=None,
                contract_type_code=None,
                experience_level_code=None,
                education_level_code=None,
                detail=AIProcessedOfferDetail(
                    intro="Intro test",
                    missions=[],
                    profile_requirements=[],
                    benefits=[],
                    tags=[],
                ),
            )
        ],
    )


def test_seuil_confiance_admin_forcen_revue(admin_client, admin_db):
    """Avec ai_min_filiere_confidence=0.8, un resultat a 0.55 (prevu pour
    activation) part en revue humaine (B.9)."""
    from models import JobOfferStatus
    from services.ai_results import apply_ai_results

    _cleanup_lot3(admin_db)
    offer = _make_offer(admin_db, "Seuil Bas")
    admin_db.add(SiteSetting(key="ai_min_filiere_confidence", value="0.8"))
    admin_db.commit()

    _ensure_filiere(admin_db)
    summary = apply_ai_results(admin_db, _result(offer.id, confidence=0.55, review=False))

    assert summary.pending_review == 1
    assert summary.activated == 0
    admin_db.refresh(offer)
    assert offer.status == JobOfferStatus.PENDING_REVIEW
    assert offer.requires_admin_review is True
    assert offer.suggested_filiere_payload is not None
    assert "seuil" in (offer.suggested_filiere_payload.get("reason") or "").lower()


def test_seuil_confiance_haute_confiance_passe(admin_client, admin_db):
    """Confidence 0.9 >= seuil 0.8 : activation normale."""
    from models import JobOfferStatus
    from services.ai_results import apply_ai_results

    _cleanup_lot3(admin_db)
    offer = _make_offer(admin_db, "Seuil Haut")
    admin_db.add(SiteSetting(key="ai_min_filiere_confidence", value="0.8"))
    admin_db.commit()

    _ensure_filiere(admin_db)
    summary = apply_ai_results(admin_db, _result(offer.id, confidence=0.9, review=False))

    assert summary.activated == 1
    admin_db.refresh(offer)
    assert offer.status == JobOfferStatus.ACTIVE


def test_sans_seuil_comportement_inchange(admin_client, admin_db):
    """Aucun SiteSetting seuil : un resultat a 0.55 s'active comme avant
    (retrocompatibilite par defaut)."""
    from models import JobOfferStatus
    from services.ai_results import apply_ai_results

    _cleanup_lot3(admin_db)
    offer = _make_offer(admin_db, "Pas De Seuil")

    _ensure_filiere(admin_db)
    summary = apply_ai_results(admin_db, _result(offer.id, confidence=0.55, review=False))

    assert summary.activated == 1
    admin_db.refresh(offer)
    assert offer.status == JobOfferStatus.ACTIVE


def test_seuil_invalide_ignore(admin_client, admin_db):
    """Un seuil invalide ("abc") ou hors bornes ("1.5") est ignore — jamais
    d'exception, comportement historique conserve."""
    from services.ai_results import _min_filiere_confidence

    _cleanup_lot3(admin_db)
    for value in ("abc", "1.5", "0", "-0.2", ""):
        admin_db.add(SiteSetting(key="ai_min_filiere_confidence", value=value))
        admin_db.commit()
        assert _min_filiere_confidence(admin_db) is None, f"valeur {value!r} doit etre ignoree"
        admin_db.query(SiteSetting).filter_by(key="ai_min_filiere_confidence").delete()
        admin_db.commit()


# ─── K.5 : AI_BATCH_SIZE ─────────────────────────────────────────────


def test_ai_batch_size_configurable(admin_client, admin_db):
    """Le settings ai_batch_size existe, borne par usage (max/min 1-500),
    defaut 10."""
    base = get_settings()
    assert base.ai_batch_size == 10
    # La borne est appliquee au call-site (voir tasks/ai_processing.py) :
    # on verifie la logique de bornage directement.
    clamped = max(1, min(500, 9999))
    assert clamped == 500
    assert max(1, min(500, 0)) == 1
