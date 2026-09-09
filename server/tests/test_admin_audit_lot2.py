"""Tests du Lot 2 (audit 4) : journalisation & audit.

Couvre :
- A.2 : logout (action LOGOUT), /me/password, /reset-password et
  /forgot-password journalises (jamais le secret) ;
- A.10 : POST /ai/run (SCRAPE sur ai_jobs) et /ai/keys/{id}/test
  (UPDATE sur ai_api_keys, resultat ok/echec) ;
- D.1 : ancien statut de source journalise avec le nouveau ;
- G.2c : ancienne valeur des settings journalisee (PUT + bulk) ;
- E.2 : mark_duplicate idempotent sur la meme reference, 409 sur
  re-marquage vers une autre reference ;
- A.7 : filtres date_debut/date_fin sur /audit et /events (SQL, bornes
  inclusives, 400 sur format invalide).

Base vivante entre tests du module (marker admin_db) : chaque test nettoie
ses lignes d'audit/events/settings en tete pour rester independant.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

pytestmark = pytest.mark.admin_db

from fastapi.testclient import TestClient
from sqlalchemy import select

from api.deps import get_current_admin
from core.security import hash_password
from models import AIApiKey
from models.admin import AdminActionLog, Administrator, AdminRole, SiteSetting
from models.enums import (
    AdminAction,
    AIProviderType,
    IngestionAction,
    JobOfferOrigin,
    JobOfferStatus,
    SourceStatus,
)
from models.jobs import Company, JobOffer, OfferIngestionEvent
from models.referentials import Source
from services.admin_password_reset import request_password_reset
from services.email.email_provider import EmailMessage, EmailSendResult

# ─── Helpers ──────────────────────────────────────────────────────────


class _FakeProvider:
    """Provider in-memory : capture les messages sans appel HTTP."""

    def __init__(self) -> None:
        self.sent: list[EmailMessage] = []

    def send(self, message: EmailMessage) -> EmailSendResult:
        self.sent.append(message)
        return EmailSendResult(
            success=True, provider="fake", provider_email_id=f"fake-{len(self.sent)}", status_code=200
        )


def _clear_audit_logs(db) -> None:
    db.query(AdminActionLog).delete()
    db.commit()


def _ensure_admin(db, email: str, password: str = "OldPass1234") -> Administrator:
    admin = db.scalar(select(Administrator).where(Administrator.email == email))
    if admin is None:
        admin = Administrator(
            email=email,
            password_hash=hash_password(password),
            full_name="Lot2 Test",
            role=AdminRole.SUPER_ADMIN,
            is_active=True,
        )
        db.add(admin)
        db.commit()
    return admin


def _ensure_source(db, code: str = "goafrica") -> Source:
    source = db.query(Source).filter_by(code=code).one_or_none()
    if source is not None:
        return source
    source = Source(code=code, name=code.title(), slug=code, base_url="https://example.com")
    db.add(source)
    db.commit()
    return source


def _last_audit(db, **filters) -> AdminActionLog | None:
    stmt = select(AdminActionLog)
    for key, value in filters.items():
        stmt = stmt.where(getattr(AdminActionLog, key) == value)
    return db.scalar(stmt.order_by(AdminActionLog.created_at.desc()).limit(1))


# ─── A.2 : journalisation des evenements de securite ──────────────────


def test_logout_journalise_action_deconnexion(admin_client: TestClient, admin_db):
    """POST /logout pose une ligne LOGOUT (deconnexion) sur administrators."""
    _clear_audit_logs(admin_db)

    resp = admin_client.post("/api/admin/auth/logout")

    assert resp.status_code == 200, resp.text
    log = _last_audit(admin_db, action=AdminAction.LOGOUT, target_table="administrators")
    assert log is not None, "le logout doit etre journalise"
    assert log.target_id == "admin-test"
    assert log.details["revoked_refresh_tokens"] is True
    assert log.details["email"] == "ops@jobalert.ci"


def test_change_password_journalise(admin_client: TestClient, admin_db):
    """PUT /me/password pose une ligne UPDATE (password_changed, pas le secret)."""
    _clear_audit_logs(admin_db)

    resp = admin_client.put(
        "/api/admin/auth/me/password",
        json={"current_password": "Test1234!", "new_password": "Nouveau123!"},
    )

    assert resp.status_code == 200, resp.text
    log = _last_audit(admin_db, action=AdminAction.UPDATE, target_table="administrators")
    assert log is not None, "le changement de mot de passe doit etre journalise"
    assert log.details["password_changed"] is True
    assert log.details["revoked_refresh_tokens"] is True
    # Jamais le secret dans la ligne d'audit.
    assert "Nouveau123!" not in str(log.details)
    assert "Test1234!" not in str(log.details)

    # Le fake admin survit a tout le module : on restaure son hash pour
    # ne pas casser les tests suivants qui s'authentifient avec lui.
    fake = admin_client.app.dependency_overrides[get_current_admin]()
    fake.password_hash = hash_password("Test1234!")


def test_reset_password_via_token_journalise(admin_client: TestClient, admin_db):
    """POST /reset-password journalise le takeover (email, jamais le token)."""
    _clear_audit_logs(admin_db)
    admin = _ensure_admin(admin_db, email="reset-lot2@example.com")
    provider = _FakeProvider()
    result = request_password_reset(admin_db, email=admin.email, provider=provider)
    assert result.token is not None

    resp = admin_client.post(
        "/api/admin/auth/reset-password",
        json={"token": result.token, "new_password": "Neuf12345"},
    )

    assert resp.status_code == 200, resp.text
    log = _last_audit(admin_db, action=AdminAction.UPDATE, target_table="administrators")
    assert log is not None, "le reset via token doit etre journalise"
    assert log.admin_id == admin.id
    assert log.details["password_reset_via_token"] is True
    assert log.details["email"] == admin.email
    assert result.token not in str(log.details), "le token brut ne doit jamais figurer dans l'audit"


def test_forgot_password_journalise_email_connu(admin_client: TestClient, admin_db, monkeypatch):
    """POST /forgot-password journalise cote serveur pour un admin connu."""
    _clear_audit_logs(admin_db)
    admin = _ensure_admin(admin_db, email="forgot-lot2@example.com")
    monkeypatch.setattr("api.v1.admin.auth.get_email_provider", lambda: _FakeProvider())

    resp = admin_client.post(
        "/api/admin/auth/forgot-password", json={"email": admin.email, "password": "n/a"}
    )

    assert resp.status_code == 200, resp.text
    assert "Si un compte existe" in resp.json()["message"]
    log = _last_audit(admin_db, action=AdminAction.UPDATE, target_table="administrators")
    assert log is not None, "la demande de reset d'un admin connu doit etre journalisee"
    assert log.admin_id == admin.id
    assert log.details["reset_requested"] is True


def test_forgot_password_email_inconnu_ne_journalise_pas(admin_client: TestClient, admin_db, monkeypatch):
    """Anti-enumeration : email inconnu -> reponse neutre, AUCUNE ligne d'audit."""
    _clear_audit_logs(admin_db)
    monkeypatch.setattr("api.v1.admin.auth.get_email_provider", lambda: _FakeProvider())
    before = admin_db.query(AdminActionLog).count()

    resp = admin_client.post(
        "/api/admin/auth/forgot-password", json={"email": "personne-lot2@example.com", "password": "n/a"}
    )

    assert resp.status_code == 200, resp.text
    after = admin_db.query(AdminActionLog).count()
    assert after == before, "aucune ligne d'audit pour un email inconnu (pas de journal a bruter)"


# ─── A.10 : journalisation IA ─────────────────────────────────────────


def test_ai_run_journalise(admin_client: TestClient, admin_db, monkeypatch):
    """POST /ai/run pose une ligne SCRAPE sur ai_jobs avec le task_id reel."""
    _clear_audit_logs(admin_db)
    monkeypatch.setattr(
        "tasks.ai_processing.process_raw_offers.apply_async",
        lambda *a, **kw: type("R", (), {"id": "task-run-lot2"})(),
        raising=False,
    )

    resp = admin_client.post("/api/admin/ai/run", json={"trigger_type": "manual"})

    assert resp.status_code == 202, resp.text
    log = _last_audit(admin_db, action=AdminAction.SCRAPE, target_table="ai_jobs")
    assert log is not None, "le declenchement manuel de l'IA doit etre journalise"
    assert log.target_id == "task-run-lot2"
    assert log.details["task_id"] == "task-run-lot2"
    assert log.details["trigger_type"] == "manual"


def _ensure_mock_key(db) -> AIApiKey:
    key = AIApiKey(
        name="cle-lot2-mock",
        provider_type=AIProviderType.MOCK,
        api_key_encrypted="x",
        api_key_last4="ab12",
        is_active=True,
    )
    db.add(key)
    db.commit()
    return key


def test_ai_key_test_journalise_ok(admin_client: TestClient, admin_db):
    """POST /ai/keys/{id}/test journalise le diagnostic reussi (result ok)."""
    _clear_audit_logs(admin_db)
    key = _ensure_mock_key(admin_db)

    resp = admin_client.post(f"/api/admin/ai/keys/{key.id}/test")

    assert resp.status_code == 200, resp.text
    assert resp.json()["ok"] is True
    log = _last_audit(admin_db, action=AdminAction.UPDATE, target_table="ai_api_keys")
    assert log is not None, "le test de cle IA doit etre journalise"
    assert log.target_id == key.id
    assert log.details["tested_connection"] is True
    assert log.details["result"] == "ok"


def test_ai_key_test_journalise_erreur(admin_client: TestClient, admin_db, monkeypatch):
    """Le test de cle en echec journalise result=error et pose last_error_at."""
    from services.ai_errors import AIProviderError

    _clear_audit_logs(admin_db)
    key = _ensure_mock_key(admin_db)

    def _boom(self):
        raise AIProviderError("simulated error")

    monkeypatch.setattr("services.ai_providers.MockAIAdapter.test_connection", _boom)

    resp = admin_client.post(f"/api/admin/ai/keys/{key.id}/test")

    assert resp.status_code == 200, resp.text
    assert resp.json()["ok"] is False
    admin_db.refresh(key)
    assert key.last_error_at is not None, "l'echec doit etre trace sur la cle (last_error_at)"
    log = _last_audit(admin_db, action=AdminAction.UPDATE, target_table="ai_api_keys")
    assert log is not None
    assert log.details["result"] == "error"


# ─── D.1 : ancien statut source ───────────────────────────────────────


def test_statut_source_journalise_ancien_statut(admin_client: TestClient, admin_db):
    """PATCH /sources/{id}/status porte l'ancien ET le nouveau statut."""
    _clear_audit_logs(admin_db)
    source = _ensure_source(admin_db, "educarriere")

    first = admin_client.patch(
        f"/api/admin/referentials/sources/{source.id}/status", json={"status": "paused"}
    )
    assert first.status_code == 200, first.text
    log = _last_audit(admin_db, target_table="sources")
    assert log is not None
    assert log.details == {"status": "paused", "ancien_status": "active"}

    second = admin_client.patch(
        f"/api/admin/referentials/sources/{source.id}/status", json={"status": "disabled"}
    )
    assert second.status_code == 200, second.text
    logs = (
        admin_db.query(AdminActionLog)
        .filter_by(target_table="sources")
        .order_by(AdminActionLog.created_at.desc())
        .all()
    )
    assert logs[0].details == {"status": "disabled", "ancien_status": "paused"}

    # Restauration pour les autres tests du module.
    source.status = SourceStatus.ACTIVE
    admin_db.commit()


# ─── G.2c : ancienne valeur des settings ──────────────────────────────


def _cleanup_lot2_settings(db) -> None:
    for setting in db.scalars(select(SiteSetting).where(SiteSetting.key.like("lot2_%"))).all():
        db.delete(setting)
    db.commit()


def test_setting_put_journalise_ancienne_valeur(admin_client: TestClient, admin_db):
    """PUT /settings/{key} : creation (ancienne None) puis edition (ancienne=v1)."""
    _clear_audit_logs(admin_db)
    _cleanup_lot2_settings(admin_db)

    first = admin_client.put("/api/admin/settings/lot2_cle", json={"value": "v1"})
    assert first.status_code == 200, first.text
    log = _last_audit(admin_db, target_table="site_settings")
    assert log is not None
    assert log.details == {"value": "v1", "ancienne_valeur": None}

    second = admin_client.put("/api/admin/settings/lot2_cle", json={"value": "v2"})
    assert second.status_code == 200, second.text
    log = _last_audit(admin_db, target_table="site_settings")
    assert log.details == {"value": "v2", "ancienne_valeur": "v1"}


def test_settings_bulk_journalise_anciennes_valeurs(admin_client: TestClient, admin_db):
    """POST /settings/bulk : anciennes valeurs par cle (None = creation)."""
    _clear_audit_logs(admin_db)
    _cleanup_lot2_settings(admin_db)

    first = admin_client.post("/api/admin/settings/bulk", json={"settings": {"lot2_a": "1", "lot2_b": "1"}})
    assert first.status_code == 200, first.text
    log = _last_audit(admin_db, target_table="site_settings")
    assert log is not None
    assert log.details["anciennes_valeurs"] == {"lot2_a": None, "lot2_b": None}

    second = admin_client.post("/api/admin/settings/bulk", json={"settings": {"lot2_a": "2", "lot2_c": "9"}})
    assert second.status_code == 200, second.text
    log = _last_audit(admin_db, target_table="site_settings")
    assert log.details["anciennes_valeurs"] == {"lot2_a": "1", "lot2_c": None}


# ─── E.2 : mark_duplicate idempotent / garde 409 ──────────────────────


def _mk_offer(db, title: str) -> JobOffer:
    source = _ensure_source(db, "goafrica")
    company = db.scalar(select(Company).limit(1))
    if company is None:
        company = Company(name="Lot2 Co", normalized_name="lot2-co")
        db.add(company)
        db.commit()
    offer = JobOffer(
        title=title,
        normalized_title=title.lower(),
        company_id=company.id,
        source_id=source.id,
        source_url=f"https://example.com/lot2/{title}",
        hash_unique=f"lot2-{title}",
        status=JobOfferStatus.ACTIVE,
        origin=JobOfferOrigin.MANUAL,
    )
    db.add(offer)
    db.commit()
    return offer


def test_mark_duplicate_idempotent_et_garde_409(admin_client: TestClient, admin_db):
    """Re-marquer vers la MEME reference = idempotent ; vers une AUTRE = 409."""
    from services.duplicates import DuplicateServiceError, mark_duplicate

    _clear_audit_logs(admin_db)
    a, b, x = _mk_offer(admin_db, "Alpha"), _mk_offer(admin_db, "Beta"), _mk_offer(admin_db, "Xavier")

    # 1er marquage : nominal.
    result = mark_duplicate(admin_db, offer_b_id=b.id, duplicate_of_id=a.id, admin_id="admin-test")
    assert result["is_duplicate"] is True
    audit_count = admin_db.query(AdminActionLog).filter_by(target_table="job_offers").count()
    assert audit_count == 1

    # Re-marquage vers la meme reference : idempotent, PAS de nouvelle ligne.
    result = mark_duplicate(admin_db, offer_b_id=b.id, duplicate_of_id=a.id, admin_id="admin-test")
    assert result["already_marked"] is True
    audit_count = admin_db.query(AdminActionLog).filter_by(target_table="job_offers").count()
    assert audit_count == 1, "l'idempotence ne doit pas ajouter de ligne d'audit"

    # Re-marquage vers une AUTRE reference : 409, la reference n'est pas ecrasee.
    with pytest.raises(DuplicateServiceError) as exc_info:
        mark_duplicate(admin_db, offer_b_id=b.id, duplicate_of_id=x.id, admin_id="admin-test")
    assert exc_info.value.status_code == 409
    assert a.id in str(exc_info.value)
    admin_db.refresh(b)
    assert b.duplicate_of_id == a.id, "l'ancienne reference ne doit pas etre ecrasee"
    assert b.is_duplicate is True

    # Nettoyage (base vivante) : les offres de test ne doivent pas polluer
    # les scans des autres tests.
    b.duplicate_of_id = None
    b.is_duplicate = False
    for offer in (a, b, x):
        admin_db.delete(offer)
    admin_db.commit()


# ─── A.7 : filtres plage de dates ─────────────────────────────────────


def _naive_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def test_audit_filtre_plage_dates(admin_client: TestClient, admin_db):
    """date_debut/date_fin sur /audit : bornes inclusives, cote SQL."""
    _clear_audit_logs(admin_db)
    now = _naive_now()
    vieux, recent = now - timedelta(days=3), now - timedelta(days=1)
    for created, target_id in ((vieux, "a7-vieux"), (recent, "a7-recent")):
        admin_db.add(
            AdminActionLog(
                admin_id="admin-test",
                action=AdminAction.UPDATE,
                target_table="a7-test",
                target_id=target_id,
                created_at=created,
            )
        )
    admin_db.commit()

    # Plage vide entre les deux : rien.
    plage_vide = (now - timedelta(days=2)).date().isoformat()
    resp = admin_client.get(f"/api/admin/logs/audit?date_debut={plage_vide}&date_fin={plage_vide}")
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 0

    # Plage couvrante : les deux lignes.
    debut = vieux.date().isoformat()
    fin = recent.date().isoformat()
    resp = admin_client.get(f"/api/admin/logs/audit?date_debut={debut}&date_fin={fin}")
    assert resp.json()["total"] == 2

    # Borne gauche seule : seulement le recent ; borne droite seule : le vieux.
    resp = admin_client.get(f"/api/admin/logs/audit?date_debut={plage_vide}")
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["target_id"] == "a7-recent"
    resp = admin_client.get(f"/api/admin/logs/audit?date_fin={plage_vide}")
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["target_id"] == "a7-vieux"

    # Sans filtre : comportement inchange (retrocompatible).
    resp = admin_client.get("/api/admin/logs/audit")
    assert resp.json()["total"] == 2


def test_audit_date_invalide_renvoie_400(admin_client: TestClient, admin_db):
    """Un format non ISO renvoie un 400 explicite, pas une 422 opaque."""
    resp = admin_client.get("/api/admin/logs/audit?date_debut=09-2026")
    assert resp.status_code == 400
    assert "AAAA-MM-JJ" in resp.json()["detail"]


def test_audit_action_deconnexion_filtrable(admin_client: TestClient, admin_db):
    """La nouvelle valeur d'enum passe le filtre action (pas de 400 'inconnue')."""
    _clear_audit_logs(admin_db)
    admin_db.add(
        AdminActionLog(
            admin_id="admin-test",
            action=AdminAction.LOGOUT,
            target_table="administrators",
            target_id="admin-test",
        )
    )
    admin_db.commit()

    resp = admin_client.get("/api/admin/logs/audit?action=deconnexion")
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["action"] == "deconnexion"


def test_events_filtre_plage_dates(admin_client: TestClient, admin_db):
    """date_debut/date_fin sur /events : bornes inclusives, cote SQL."""
    admin_db.query(OfferIngestionEvent).delete()
    admin_db.commit()
    now = _naive_now()
    jour = now - timedelta(days=1)
    # Un event a 23:59 la veille, un autre juste apres minuit le lendemain :
    # la plage [veille, veille] ne doit garder QUE le premier.
    veille_2359 = jour.replace(hour=23, minute=59, second=0, microsecond=0)
    lendemain_0001 = (now + timedelta(days=1)).replace(hour=0, minute=1, second=0, microsecond=0)
    for created, reason in ((now - timedelta(days=3), "a7-vieux"), (veille_2359, "a7-borne"), (lendemain_0001, "a7-hors")):
        admin_db.add(
            OfferIngestionEvent(
                action=IngestionAction.INSERTED,
                reason=reason,
                created_at=created,
            )
        )
    admin_db.commit()

    veille = jour.date().isoformat()
    resp = admin_client.get(f"/api/admin/logs/events?date_debut={veille}&date_fin={veille}")
    assert resp.status_code == 200, resp.text
    reasons = {item["message"] for item in resp.json()}
    assert reasons == {"a7-borne"}, f"bornes inclusives attendues, recus: {reasons}"

    resp = admin_client.get("/api/admin/logs/events")
    assert len(resp.json()) == 3, "sans filtre : comportement inchange"


def test_events_date_invalide_renvoie_400(admin_client: TestClient, admin_db):
    resp = admin_client.get("/api/admin/logs/events?date_fin=pas-une-date")
    assert resp.status_code == 400
    assert "date_fin" in resp.json()["detail"]
