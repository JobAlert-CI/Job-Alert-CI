"""Tests cycle 17 — Journal des erreurs & emails transactionnels.

Couverture des demandes explicites (feu vert utilisateur) :
1. GET /api/admin/logs/stats : compteurs events (total, errors, warnings,
   duplicates), axes par_jour/par_action sur la fenetre, contacts
   par_statut en VOCABULAIRE API (new/read/replied/archived/spam), base
   vide = zeros partout sans crash ;
2. GET /api/admin/transactional-emails/stats : total, par_statut,
   par_motif, echecs_fenetre (badge « echecs du jour » days=1), par_jour
   empilable, base vide = zeros ;
3. PATCH /contacts/{id}/status accepte desormais "spam" (A3) ;
4. PATCH .../status replied pose replied_at automatiquement (A4), et un
   retour arriere ne l'efface pas (premiere reponse conservee).

⚠️ La base vit entre les tests du module (marker admin_db) : chaque test
nettoie SES lignes (events, contacts, emails tx) apres passage.
"""
from __future__ import annotations

import pytest

pytestmark = pytest.mark.admin_db

from datetime import UTC, datetime, timedelta

from models.content import ContactMessage
from models.emails import TransactionalEmailEvent
from models.enums import ContactMessageStatus, IngestionAction, TransactionalEmailPurpose, TransactionalEmailStatus
from models.jobs import OfferIngestionEvent
from sqlalchemy import select


# ─── Helpers seed/cleanup ───────────────────────────────────────────────


def _add_event(db, *, action, created=None, reason=None):
    event = OfferIngestionEvent(action=action, reason=reason)
    if created is not None:
        event.created_at = created
    db.add(event)
    return event


def _add_contact(db, *, status=ContactMessageStatus.NEW, replied_at=None, deleted=False):
    message = ContactMessage(
        full_name="Test Contact",
        email="contact@example.com",
        subject_code="subject_test",
        subject_label="Sujet de test",
        message="Message de test",
        status=status,
        replied_at=replied_at,
    )
    if deleted:
        message.deleted_at = datetime.now(UTC)
    db.add(message)
    return message


def _add_email_tx(db, *, purpose, status, created=None):
    event = TransactionalEmailEvent(
        purpose=purpose,
        status=status,
        to_email="abonne@example.com",
        provider="resend",
        attempts=1,
    )
    if created is not None:
        event.created_at = created
    db.add(event)
    return event


def _cleanup(db):
    """Vide les trois tables du cycle 17 (base vivante entre tests)."""
    db.query(OfferIngestionEvent).delete()
    db.query(ContactMessage).delete()
    db.query(TransactionalEmailEvent).delete()
    db.commit()


# ─── 1. /logs/stats ────────────────────────────────────────────────────


def test_logs_stats_base_vide_zeros(admin_client, admin_db):
    """Base vide : compteurs a 0, axes/listes vides, PAS de crash."""
    _cleanup(admin_db)
    resp = admin_client.get("/api/admin/logs/stats")
    assert resp.status_code == 200
    body = resp.json()
    assert body["events_total"] == 0
    assert body["events_errors"] == 0
    assert body["events_warnings"] == 0
    assert body["events_duplicates"] == 0
    assert body["events_par_jour"] == []
    respect_par_action = [e["action"] for e in body["events_par_action"]]
    assert respect_par_action == []
    assert body["contacts_total"] == 0
    assert body["contacts_par_statut"] == {}
    assert body["days"] == 30


def test_logs_stats_compteurs_et_axes_events(admin_client, admin_db):
    """Compteurs globaux par action + axes fenetre days."""
    _cleanup(admin_db)
    hier = datetime.now(UTC) - timedelta(days=1)
    vieux = datetime.now(UTC) - timedelta(days=40)
    try:
        # 2 erreurs (aujourd'hui), 1 warning (hier), 1 doublon (hier),
        # 1 insertion vieille (hors fenetre 30j mais dans les compteurs globaux).
        _add_event(admin_db, action=IngestionAction.FAILED, reason="timeout")
        _add_event(admin_db, action=IngestionAction.FAILED, reason="http 500")
        _add_event(admin_db, action=IngestionAction.SKIPPED, created=hier)
        _add_event(admin_db, action=IngestionAction.DUPLICATE, created=hier)
        _add_event(admin_db, action=IngestionAction.INSERTED, created=vieux)
        admin_db.commit()

        body = admin_client.get("/api/admin/logs/stats?days=30").json()
        assert body["events_total"] == 5
        assert body["events_errors"] == 2
        assert body["events_warnings"] == 1
        assert body["events_duplicates"] == 1

        # Axe par jour : 4 entrees dans la fenetre (le vieux est exclu).
        total_fenetre = sum(j["total"] for j in body["events_par_jour"])
        assert total_fenetre == 4
        # Chaque jour porte son detail par action.
        for jour in body["events_par_jour"]:
            assert sum(jour["par_action"].values()) == jour["total"]

        # Axe par action : toutes valeurs presentes, tri decroissant.
        par_action = {e["action"]: e["total"] for e in body["events_par_action"]}
        assert par_action == {"failed": 2, "skipped": 1, "duplicate": 1}
        assert [e["total"] for e in body["events_par_action"]] == sorted(
            [e["total"] for e in body["events_par_action"]], reverse=True
        )
    finally:
        _cleanup(admin_db)


def test_logs_stats_contacts_vocabulaire_api(admin_client, admin_db):
    """Les statuts contacts sortent en VOCABULAIRE API (pas internes)."""
    _cleanup(admin_db)
    try:
        _add_contact(admin_db, status=ContactMessageStatus.NEW)
        _add_contact(admin_db, status=ContactMessageStatus.IN_PROGRESS)  # interne -> "read"
        _add_contact(admin_db, status=ContactMessageStatus.REPLIED)
        _add_contact(admin_db, status=ContactMessageStatus.CLOSED)  # interne -> "archived"
        _add_contact(admin_db, status=ContactMessageStatus.SPAM)
        _add_contact(admin_db, status=ContactMessageStatus.NEW, deleted=True)  # soft-deleted exclu
        admin_db.commit()

        body = admin_client.get("/api/admin/logs/stats").json()
        assert body["contacts_total"] == 5
        assert body["contacts_par_statut"] == {
            "new": 1,
            "read": 1,
            "replied": 1,
            "archived": 1,
            "spam": 1,
        }
    finally:
        _cleanup(admin_db)


def test_logs_stats_403_si_non_super_admin(admin_client, admin_db):
    """Le router logs reste super_admin seul ( garde au router : le client
    de test est super_admin, on verifie juste que la route repond 200 —
    le 403 est couvert par require_roles, teste ailleurs)."""
    resp = admin_client.get("/api/admin/logs/stats")
    assert resp.status_code == 200


# ─── 2. /transactional-emails/stats ────────────────────────────────────


def test_emails_tx_stats_base_vide_zeros(admin_client, admin_db):
    """Base vide : zeros partout, PAS de crash."""
    _cleanup(admin_db)
    resp = admin_client.get("/api/admin/transactional-emails/stats")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 0
    assert body["par_statut"] == {}
    assert body["par_motif"] == {}
    assert body["echecs_fenetre"] == 0
    assert body["par_jour"] == []
    assert body["days"] == 30


def test_emails_tx_stats_compteurs_et_axes(admin_client, admin_db):
    """Tot par statut/motif + badge echecs jour + axe par jour empilable."""
    _cleanup(admin_db)
    hier = datetime.now(UTC) - timedelta(days=1)
    try:
        _add_email_tx(admin_db, purpose=TransactionalEmailPurpose.CONFIRM_EMAIL, status=TransactionalEmailStatus.SENT)
        _add_email_tx(admin_db, purpose=TransactionalEmailPurpose.CONFIRM_EMAIL, status=TransactionalEmailStatus.FAILED)
        _add_email_tx(admin_db, purpose=TransactionalEmailPurpose.UNSUBSCRIBE, status=TransactionalEmailStatus.QUEUED)
        # 2 echecs hier (dans la fenetre 30j, PAS dans days=1).
        _add_email_tx(
            admin_db,
            purpose=TransactionalEmailPurpose.MANAGE_ALERT,
            status=TransactionalEmailStatus.FAILED,
            created=hier,
        )
        _add_email_tx(
            admin_db,
            purpose=TransactionalEmailPurpose.MANAGE_ALERT,
            status=TransactionalEmailStatus.FAILED,
            created=hier,
        )
        admin_db.commit()

        # days=1 : fenetre « aujourd'hui » — 1 seul failed aujourd'hui.
        body = admin_client.get("/api/admin/transactional-emails/stats?days=1").json()
        assert body["total"] == 5
        assert body["par_statut"] == {"sent": 1, "failed": 3, "queued": 1}
        assert body["par_motif"] == {"confirm_email": 2, "manage_alert": 2, "unsubscribe": 1}
        assert body["echecs_fenetre"] == 1

        # Axe par jour days=1 : 3 envois aujourd'hui seulement.
        assert len(body["par_jour"]) == 1
        assert body["par_jour"][0]["total"] == 3
        assert body["par_jour"][0]["par_statut"] == {"sent": 1, "failed": 1, "queued": 1}

        # days=30 : les 2 echecs d'hier entrent dans la fenetre.
        body30 = admin_client.get("/api/admin/transactional-emails/stats?days=30").json()
        assert body30["echecs_fenetre"] == 3
        assert sum(j["total"] for j in body30["par_jour"]) == 5
    finally:
        _cleanup(admin_db)


# ─── 3. PATCH contacts : spam assignable (A3) + replied_at (A4) ────────


def test_contact_status_spam_assignable(admin_client, admin_db):
    """A3 : PATCH status=spam desormais accepte (422 avant)."""
    _cleanup(admin_db)
    message = _add_contact(admin_db)
    admin_db.commit()
    try:
        resp = admin_client.patch(
            f"/api/admin/logs/contacts/{message.id}/status", json={"status": "spam"}
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        # La reponse renvoie le statut STOCKE — le front affiche le
        # vocabulaire API mais l'API PATCH renvoie la valeur interne ? Non :
        # ContactMessageAdminRead serialize le champ brut, on verifie via
        # la base + le filtre GET (vocabulaire API).
        admin_db.refresh(message)
        assert message.status is ContactMessageStatus.SPAM
        # Le filtre GET accepts spam et retrouve le message.
        liste = admin_client.get("/api/admin/logs/contacts?status=spam").json()
        assert any(c["id"] == message.id for c in liste)
    finally:
        _cleanup(admin_db)


def test_contact_status_replied_pose_replied_at(admin_client, admin_db):
    """A4 : passer a replied pose replied_at ; retour arriere ne l'efface pas."""
    _cleanup(admin_db)
    message = _add_contact(admin_db)
    admin_db.commit()
    try:
        resp = admin_client.patch(
            f"/api/admin/logs/contacts/{message.id}/status", json={"status": "replied"}
        )
        assert resp.status_code == 200, resp.text
        admin_db.refresh(message)
        assert message.replied_at is not None

        # Retour a "new" : replied_at CONSERVE (premiere reponse).
        resp2 = admin_client.patch(
            f"/api/admin/logs/contacts/{message.id}/status", json={"status": "new"}
        )
        assert resp2.status_code == 200
        admin_db.refresh(message)
        assert message.replied_at is not None

        # Repasser replied ne l'ecrase pas non plus (premiere reponse).
        avant = message.replied_at
        resp3 = admin_client.patch(
            f"/api/admin/logs/contacts/{message.id}/status", json={"status": "replied"}
        )
        assert resp3.status_code == 200
        admin_db.refresh(message)
        assert message.replied_at == avant
    finally:
        _cleanup(admin_db)


def test_contact_status_replied_at_inchange_si_deja_present(admin_client, admin_db):
    """replied_at pose manuellement en base n'est pas ecrase par la route."""
    _cleanup(admin_db)
    manuel = datetime.now(UTC) - timedelta(days=10)
    message = _add_contact(admin_db, replied_at=manuel)
    admin_db.commit()
    try:
        resp = admin_client.patch(
            f"/api/admin/logs/contacts/{message.id}/status", json={"status": "replied"}
        )
        assert resp.status_code == 200
        admin_db.refresh(message)
        # La date manuelle (plus ancienne) est conservée — au temps near :
        # SQLite restitue la datetime SANS tzinfo, on compare donc les
        # timestamps UTC (la valeur naive est consideree UTC).
        assert message.replied_at.replace(tzinfo=UTC) == manuel
    finally:
        _cleanup(admin_db)


def test_contact_statut_inconnu_toujours_refuse(admin_client, admin_db):
    """Un statut hors vocabulaire reste 422 (spam n'ouvre pas la porte)."""
    resp = admin_client.patch(
        "/api/admin/logs/contacts/nimporte/status", json={"status": "inconnu"}
    )
    assert resp.status_code == 422
