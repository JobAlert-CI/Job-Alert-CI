"""Tests cycle 15 — Gestion des administrateurs.

Couverture des 3 demandes explicites:
1. GET /api/admin/admins?q= : recherche ilike email/nom;
2. Suppression d'un admin -> journal d'activite PRESERVE (FK SET NULL,
   admin_action_logs.admin_id devient NULL, pas de CASCADE);
3. Creation sans mot de passe -> mot de passe TEMPORAIRE renvoye une seule
   fois (201), must_change_password=True, remis a False par PUT /me/password.

Plus les garde-fous anti auto-sabotage (400) re-verifies.

Note: le fake_admin de conftest_admin n'est JAMAIS commité en base (il ne
sert qu'a l'override get_current_admin) — chaque test cree ses propres
enregistrements avec des emails uniques et nettoie apres (base vivante
entre les tests du module).
"""
from __future__ import annotations

import pytest

pytestmark = pytest.mark.admin_db

from sqlalchemy import select

from core.security import generate_temporary_password, verify_password
from models.admin import AdminAction, AdminActionLog, AdminRole, Administrator


def _ensure_admin(admin_db, email: str, **kwargs) -> Administrator:
    """Cree (ou reutilise) un admin de test — email unique par test."""
    admin = admin_db.scalar(select(Administrator).where(Administrator.email == email))
    if admin is None:
        admin = Administrator(
            email=email,
            password_hash="x",
            full_name=kwargs.get("full_name", email.split("@")[0].title()),
            role=kwargs.get("role", AdminRole.MODERATOR),
            is_active=kwargs.get("is_active", True),
            must_change_password=kwargs.get("must_change_password", False),
        )
        admin_db.add(admin)
        admin_db.commit()
    return admin


def _cleanup(admin_db, email: str) -> None:
    """Nettoie un admin de test ET ses logs (base vivante entre tests)."""
    admin = admin_db.scalar(select(Administrator).where(Administrator.email == email))
    if admin is not None:
        for log in admin_db.scalars(
            select(AdminActionLog).where(AdminActionLog.admin_id == admin.id)
        ).all():
            admin_db.delete(log)
        admin_db.delete(admin)
        admin_db.commit()


def _cleanup_logs_by_detail(admin_db, needle: str) -> None:
    """Supprime les logs de suppression portant ce marqueur dans details."""
    for log in admin_db.scalars(select(AdminActionLog)).all():
        if log.details and needle in str(log.details):
            admin_db.delete(log)
    admin_db.commit()


# ─── 1. Recherche q ─────────────────────────────────────────────────────


def test_list_admins_recherche_q_email(admin_client, admin_db):
    """q= filtre sur l'email, insensible a la casse, partiel."""
    _cleanup(admin_db, "recherche-email@example.com")
    _ensure_admin(admin_db, "recherche-email@example.com", full_name="Un Nom Quelconque")
    try:
        resp = admin_client.get("/api/admin/admins?q=recherche-email")
        assert resp.status_code == 200
        emails = [a["email"] for a in resp.json()]
        assert "recherche-email@example.com" in emails
        # Insensible a la casse.
        resp2 = admin_client.get("/api/admin/admins?q=RECHERCHE-EMAIL@EXAMPLE")
        assert "recherche-email@example.com" in [a["email"] for a in resp2.json()]
        # Un email absent ne renvoie rien.
        assert admin_client.get("/api/admin/admins?q=zzzz-inexistant").json() == []
    finally:
        _cleanup(admin_db, "recherche-email@example.com")


def test_list_admins_recherche_q_nom(admin_client, admin_db):
    """q= filtre aussi sur le nom complet (ilike)."""
    _cleanup(admin_db, "marc@example.com")
    _ensure_admin(admin_db, "marc@example.com", full_name="Marc Kouassi")
    try:
        resp = admin_client.get("/api/admin/admins?q=kouassi")
        assert resp.status_code == 200
        assert any(a["email"] == "marc@example.com" for a in resp.json())
        # Insensible a la casse.
        resp2 = admin_client.get("/api/admin/admins?q=KOUASSI")
        assert any(a["email"] == "marc@example.com" for a in resp2.json())
        # Un nom absent ne renvoie rien.
        assert admin_client.get("/api/admin/admins?q=nom-qui-nexiste-pas").json() == []
    finally:
        _cleanup(admin_db, "marc@example.com")


def test_list_admins_filtres_role_et_actif(admin_client, admin_db):
    """role= et is_active= continuent de fonctionner avec q present."""
    _cleanup(admin_db, "filtre-role@example.com")
    _ensure_admin(admin_db, "filtre-role@example.com", role=AdminRole.OFFER_MANAGER)
    try:
        resp = admin_client.get(
            "/api/admin/admins", params={"role": "gestionnaire_offres", "is_active": "true"}
        )
        assert any(a["email"] == "filtre-role@example.com" for a in resp.json())
        resp2 = admin_client.get("/api/admin/admins", params={"role": "moderateur"})
        assert all(a["email"] != "filtre-role@example.com" for a in resp2.json())
    finally:
        _cleanup(admin_db, "filtre-role@example.com")


# ─── 2. Suppression preserve le journal ─────────────────────────────────


def test_delete_admin_preserve_ses_logs(admin_client, admin_db):
    """Demande explicite cycle 15: supprimer un admin NE DOIT PAS effacer
    ses entrees admin_action_logs (SET NULL, pas CASCADE)."""
    _cleanup(admin_db, "victime@example.com")
    victime = _ensure_admin(admin_db, "victime@example.com", full_name="Victime Journal")

    # Des entrees de journal ecrites PAR la victime.
    for i in range(3):
        admin_db.add(
            AdminActionLog(
                admin_id=victime.id,
                action=AdminAction.UPDATE,
                target_table="job_offers",
                target_id=f"offer-{i}",
            )
        )
    admin_db.commit()
    log_ids = [
        log.id
        for log in admin_db.scalars(
            select(AdminActionLog).where(AdminActionLog.admin_id == victime.id)
        ).all()
    ]
    assert len(log_ids) == 3

    # Suppression via l'API (par le super_admin mocke).
    resp = admin_client.delete(f"/api/admin/admins/{victime.id}")
    assert resp.status_code == 204

    # Le compte est bien parti...
    assert (
        admin_db.scalar(select(Administrator).where(Administrator.email == "victime@example.com"))
        is None
    )
    # ...mais ses 3 lignes de journal EXISTENT toujours avec admin_id NULL.
    survivors = [admin_db.get(AdminActionLog, lid) for lid in log_ids]
    assert all(s is not None for s in survivors), "les logs doivent survivre"
    assert all(s.admin_id is None for s in survivors), "admin_id doit devenir NULL"
    # Nettoyage des logs orphelins + log DELETE de la suppression.
    _cleanup_logs_by_detail(admin_db, "victime@example.com")
    for lid in log_ids:
        log = admin_db.get(AdminActionLog, lid)
        if log is not None:
            admin_db.delete(log)
    admin_db.commit()


def test_delete_admin_consigne_l_identite_dans_le_log(admin_client, admin_db):
    """Le log DELETE de la suppression garde email/nom/role de l'admin
    supprime (trace lisible apres la mise a NULL)."""
    _cleanup(admin_db, "traced@example.com")
    _cleanup_logs_by_detail(admin_db, "traced@example.com")
    traced = _ensure_admin(
        admin_db, "traced@example.com", full_name="Trace Me", role=AdminRole.OFFER_MANAGER
    )
    resp = admin_client.delete(f"/api/admin/admins/{traced.id}")
    assert resp.status_code == 204
    try:
        log = admin_db.scalar(
            select(AdminActionLog)
            .where(AdminActionLog.action == AdminAction.DELETE)
            .order_by(AdminActionLog.created_at.desc())
        )
        assert log is not None
        assert log.details["admin_supprime_email"] == "traced@example.com"
        assert log.details["admin_supprime_nom"] == "Trace Me"
        assert log.details["admin_supprime_role"] == "gestionnaire_offres"
    finally:
        _cleanup_logs_by_detail(admin_db, "traced@example.com")


def test_journal_lecture_ne_plante_pas_sur_admin_null(admin_client, admin_db):
    """GET /api/admin/logs/audit doit reussir meme avec des lignes
    admin_id NULL (AdminActionLogRead.admin_id desormais nullable)."""
    _cleanup(admin_db, "orpheline@example.com")
    admin_db.add(
        AdminActionLog(
            admin_id=None,
            action=AdminAction.UPDATE,
            target_table="job_offers",
            target_id="offer-x",
        )
    )
    admin_db.commit()
    try:
        resp = admin_client.get("/api/admin/logs/audit?limit=200")
        assert resp.status_code == 200
        # Cycle 16 : la route renvoie une ENVELOPPE {items, total, ...} —
        # la ligne orpheline est presente avec admin_id null.
        body = resp.json()
        assert any(entry.get("admin_id") is None for entry in body["items"])
    finally:
        for log in admin_db.scalars(
            select(AdminActionLog).where(AdminActionLog.admin_id.is_(None))
        ).all():
            admin_db.delete(log)
        admin_db.commit()


# ─── 3. Creation avec mot de passe temporaire ──────────────────────────


def test_create_admin_sans_mot_de_passe_genere_temporaire(admin_client, admin_db):
    """password absent -> 201 avec temporary_password + flag a True."""
    _cleanup(admin_db, "nouveau@example.com")
    try:
        resp = admin_client.post(
            "/api/admin/admins",
            json={
                "email": "nouveau@example.com",
                "full_name": "Nouveau Test",
                "role": "moderateur",
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["temporary_password"], "le temporaire doit etre renvoye"
        assert len(body["temporary_password"]) >= 8
        assert body["must_change_password"] is True

        # La lecture NE doit PAS re-exposer le temporaire.
        listing = admin_client.get("/api/admin/admins?q=nouveau@example.com").json()
        assert listing and "temporary_password" not in listing[0]
        assert listing[0]["must_change_password"] is True

        # Le hash en base correspond bien au temporaire renvoye.
        created = admin_db.scalar(
            select(Administrator).where(Administrator.email == "nouveau@example.com")
        )
        assert verify_password(body["temporary_password"], created.password_hash)
    finally:
        _cleanup(admin_db, "nouveau@example.com")


def test_create_admin_avec_mot_de_passe_explicite_pas_de_temporaire(admin_client, admin_db):
    """password fourni -> temporary_password null + flag a False (comportement historique)."""
    _cleanup(admin_db, "classique@example.com")
    try:
        resp = admin_client.post(
            "/api/admin/admins",
            json={
                "email": "classique@example.com",
                "password": "MotDePasse123",
                "full_name": "Classique Test",
                "role": "gestionnaire_offres",
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["temporary_password"] is None
        assert body["must_change_password"] is False
    finally:
        _cleanup(admin_db, "classique@example.com")


def test_admin_read_expose_must_change_password(admin_client, admin_db):
    """AdminRead liste/detail expose bien le nouveau flag."""
    _cleanup(admin_db, "tempflag@example.com")
    _ensure_admin(admin_db, "tempflag@example.com", must_change_password=True)
    try:
        listing = admin_client.get("/api/admin/admins?q=tempflag@example.com").json()
        assert listing and listing[0]["must_change_password"] is True

        # Bascule a False (ce que fait PUT /me/password) -> la lecture suit.
        admin = admin_db.scalar(
            select(Administrator).where(Administrator.email == "tempflag@example.com")
        )
        admin.must_change_password = False
        admin_db.commit()
        listing2 = admin_client.get("/api/admin/admins?q=tempflag@example.com").json()
        assert listing2[0]["must_change_password"] is False
    finally:
        _cleanup(admin_db, "tempflag@example.com")


def test_generate_temporary_password_est_robuste():
    """Alphabet sans caracteres ambigus, longueur minimale, unicite de tirage."""
    alphabet = set("ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789")
    for _ in range(20):
        pwd = generate_temporary_password()
        assert len(pwd) == 16
        assert set(pwd) <= alphabet
    # Les caracteres ambigus sont exclus.
    assert "O" not in alphabet and "0" not in alphabet and "l" not in alphabet and "1" not in alphabet
    # Deux generations differentes.
    assert generate_temporary_password() != generate_temporary_password()
    # Longueur trop courte refusee.
    with pytest.raises(ValueError):
        generate_temporary_password(length=4)


# ─── Garde-fous anti auto-sabotage (re-verifies) ────────────────────────


def test_auto_sabotage_toujours_bloque(admin_client, admin_db):
    """Les 4 garde-fous serveur restent intacts apres le cycle 15.

    Le dependency override renvoie le fake_admin (id "admin-test") qui
    n'est PAS en base : on insere une ligne de MEME id pour que les
    routes la trouvent et declenchent les 400 self-reference.
    """
    me = admin_db.scalar(select(Administrator).where(Administrator.id == "admin-test"))
    if me is None:
        me = Administrator(
            id="admin-test",
            email="ops@jobalert.ci",
            password_hash="x",
            full_name="Admin Tests",
            role=AdminRole.SUPER_ADMIN,
            is_active=True,
        )
        admin_db.add(me)
        admin_db.commit()

    # 1. Se desactiver via PUT -> 400.
    resp = admin_client.put(f"/api/admin/admins/{me.id}", json={"is_active": False})
    assert resp.status_code == 400

    # 2. Se retirer super_admin via PATCH role -> 400.
    resp = admin_client.patch(f"/api/admin/admins/{me.id}/role", json={"role": "moderateur"})
    assert resp.status_code == 400

    # 3. Changer son propre statut via PATCH status -> 400.
    resp = admin_client.patch(f"/api/admin/admins/{me.id}/status")
    assert resp.status_code == 400

    # 4. Se supprimer -> 400.
    resp = admin_client.delete(f"/api/admin/admins/{me.id}")
    assert resp.status_code == 400


def test_create_admin_email_doublon_409(admin_client, admin_db):
    """Un email deja pris reste refuse (409)."""
    _cleanup(admin_db, "doublon@example.com")
    _ensure_admin(admin_db, "doublon@example.com")
    try:
        resp = admin_client.post(
            "/api/admin/admins",
            json={
                "email": "doublon@example.com",
                "full_name": "Doublon Test",
                "role": "moderateur",
            },
        )
        assert resp.status_code == 409
    finally:
        _cleanup(admin_db, "doublon@example.com")


# ─── Option B : email de bienvenue automatique ─────────────────────────


class _FakeProvider:
    """Provider in-memory (pattern test_audit2_fixes) : capture sans HTTP."""

    def __init__(self, success: bool = True):
        self.sent = []
        self.success = success

    def send(self, message):
        from services.email.email_provider import EmailSendResult

        self.sent.append(message)
        if not self.success:
            return EmailSendResult(
                success=False, provider="fake", error_message="simulated failure", retryable=True
            )
        return EmailSendResult(
            success=True, provider="fake", provider_email_id=f"fake-{len(self.sent)}", status_code=200
        )


def test_send_admin_welcome_service_succes(admin_client, admin_db):
    """Le service journalise l'event admin_welcome avec le bon contenu,
    SANS jamais stocker le temporaire dans le payload."""
    from models.emails import TransactionalEmailEvent
    from models.enums import TransactionalEmailPurpose
    from services.admin_welcome_email import send_admin_welcome

    _cleanup(admin_db, "bienvenue@example.com")
    admin = _ensure_admin(admin_db, "bienvenue@example.com", full_name="Bien Venue")
    try:
        provider = _FakeProvider()
        result = send_admin_welcome(
            admin_db, admin=admin, temporary_password="TempTest123456", provider=provider
        )

        assert result.sent is True
        assert len(provider.sent) == 1
        # Le temporaire figure dans le CORPS du message (option B)...
        assert "TempTest123456" in provider.sent[0].text
        assert admin.email in provider.sent[0].to_email

        # ...mais JAMAIS dans le payload journalise (convention projet).
        event = admin_db.scalar(
            select(TransactionalEmailEvent).where(
                TransactionalEmailEvent.to_email == "bienvenue@example.com"
            )
        )
        assert event is not None
        assert event.purpose == TransactionalEmailPurpose.ADMIN_WELCOME
        assert event.status.value == "sent"
        assert "TempTest123456" not in str(event.request_payload)

        # Nettoyage de l'event de test.
        admin_db.delete(event)
        admin_db.commit()
    finally:
        _cleanup(admin_db, "bienvenue@example.com")


def test_send_admin_welcome_service_echec_non_bloquant(admin_client, admin_db):
    """Provider KO : l'event passe en failed avec l'erreur, aucune exception."""
    from models.emails import TransactionalEmailEvent
    from services.admin_welcome_email import send_admin_welcome

    _cleanup(admin_db, "bienvenue-ko@example.com")
    admin = _ensure_admin(admin_db, "bienvenue-ko@example.com")
    try:
        provider = _FakeProvider(success=False)
        result = send_admin_welcome(
            admin_db, admin=admin, temporary_password="TempKO1234567", provider=provider
        )

        assert result.sent is False
        assert "simulated failure" in result.error_message
        event = admin_db.scalar(
            select(TransactionalEmailEvent).where(
                TransactionalEmailEvent.to_email == "bienvenue-ko@example.com"
            )
        )
        assert event is not None
        assert event.status.value == "failed"
        assert event.last_error == "simulated failure"

        admin_db.delete(event)
        admin_db.commit()
    finally:
        _cleanup(admin_db, "bienvenue-ko@example.com")


def test_create_admin_envoie_l_email_et_expose_le_flag(admin_client, admin_db, monkeypatch):
    """POST sans password → l'email part (provider factice via override
    FastAPI) ET la reponse 201 porte welcome_email_sent=True."""
    from models.emails import TransactionalEmailEvent
    from services.email.resend_provider import get_email_provider

    _cleanup(admin_db, "optionb@example.com")
    provider = _FakeProvider()

    # Override de la dependance provider (pattern conftest_admin) : la
    # route recupere le provider via get_email_provider().
    from fastapi.applications import FastAPI

    # admin_client encapsule l'app ; on patche get_email_provider directement
    # dans le module de la route (elle l'importe par son nom).
    import api.v1.admin.admins as admins_route

    monkeypatch.setattr(admins_route, "get_email_provider", lambda: provider)
    try:
        resp = admin_client.post(
            "/api/admin/admins",
            json={
                "email": "optionb@example.com",
                "full_name": "Option B Test",
                "role": "moderateur",
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["temporary_password"]
        assert body["welcome_email_sent"] is True
        assert len(provider.sent) == 1
        # Le temporaire renvoye dans la 201 est bien celui envoye par mail.
        assert body["temporary_password"] in provider.sent[0].text

        # L'event existe avec le purpose admin_welcome.
        event = admin_db.scalar(
            select(TransactionalEmailEvent).where(
                TransactionalEmailEvent.to_email == "optionb@example.com"
            )
        )
        assert event is not None
        assert event.purpose.value == "admin_welcome"

        admin_db.delete(event)
        admin_db.commit()
    finally:
        monkeypatch.undo()
        _cleanup(admin_db, "optionb@example.com")


def test_create_admin_password_explicite_pas_d_email(admin_client, admin_db, monkeypatch):
    """POST AVEC password explicite → AUCUN email de bienvenue (le
    createur connait deja le mot de passe qu'il a defini)."""
    import api.v1.admin.admins as admins_route

    provider = _FakeProvider()
    monkeypatch.setattr(admins_route, "get_email_provider", lambda: provider)
    _cleanup(admin_db, "pasdemail@example.com")
    try:
        resp = admin_client.post(
            "/api/admin/admins",
            json={
                "email": "pasdemail@example.com",
                "password": "MotDePasse123",
                "full_name": "Pas De Mail",
                "role": "moderateur",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["welcome_email_sent"] is False
        assert provider.sent == []  # aucun envoi
    finally:
        monkeypatch.undo()
        _cleanup(admin_db, "pasdemail@example.com")
