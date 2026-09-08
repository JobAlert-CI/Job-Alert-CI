"""Tests cycle 16 — Journal d'activite.

Couverture des 3 demandes explicites:
1. /api/admin/logs/audit pagine cote serveur : enveloppe {items, total,
   limit, offset}, total exact SOUS FILTRES, tri created_at DESC;
2. /api/admin/logs/audit/stats : total global, by_action, par_jour,
   top_auteurs (dont lignes orphelines admin_id NULL affichees
   « Admin supprime »), base vide = zeros partout (pas de crash);
3. Connexion journalisee : admin_login ecrit une ligne action=connexion
   dans la meme transaction que last_login_at.

⚠️ La base vit entre les tests du module (marker admin_db) : chaque test
nettoie SES lignes d'audit (les autres tests du module creent des logs).
"""
from __future__ import annotations

import pytest

pytestmark = pytest.mark.admin_db

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from models.admin import AdminAction, AdminActionLog, AdminRole, Administrator
from models.enums import AdminAction as AdminActionEnum


def _ensure_admin(admin_db, email: str, **kwargs) -> Administrator:
    admin = admin_db.scalar(select(Administrator).where(Administrator.email == email))
    if admin is None:
        admin = Administrator(
            email=email,
            password_hash="x",
            full_name=kwargs.get("full_name", email.split("@")[0].title()),
            role=kwargs.get("role", AdminRole.SUPER_ADMIN),
            is_active=kwargs.get("is_active", True),
        )
        admin_db.add(admin)
        admin_db.commit()
    return admin


def _cleanup_logs(admin_db, needle: str | None = None) -> None:
    """Supprime les logs de test (par cible ou par auteur email inconnu).

    Sans needle : vide TOUTE la table audit (usage limite aux tests
    d'agregats, qui remettent la base a zero pour leurs assertions puis
    doivent rester coherents avec les tests suivants — on ne peut pas
    restaurer l'etat d'origine, donc on ne l'utilise que pour verifier
    des valeurs RELATIVES issues des logs que le test vient d'ecrire).
    """
    if needle is None:
        admin_db.query(AdminActionLog).delete()
    else:
        for log in admin_db.scalars(select(AdminActionLog)).all():
            if needle in str(log.details or "") or needle in str(log.target_id or ""):
                admin_db.delete(log)
    admin_db.commit()


def _add_log(admin_db, *, admin_id, action, target_table="job_offers", target_id="t", created=None, details=None):
    log = AdminActionLog(
        admin_id=admin_id,
        action=action,
        target_table=target_table,
        target_id=target_id,
        details=details,
    )
    if created is not None:
        log.created_at = created
    admin_db.add(log)
    return log


# ─── 1. Pagination serveur /audit ───────────────────────────────────────


def test_audit_pagine_enveloppe_et_total(admin_client, admin_db):
    """La reponse est {items, total, limit, offset} avec total exact."""
    _cleanup_logs(admin_db)
    auteur = _ensure_admin(admin_db, "audit-page@example.com")
    try:
        for i in range(5):
            _add_log(
                admin_db,
                admin_id=auteur.id,
                action=AdminActionEnum.UPDATE,
                target_id=f"page-{i}",
            )
        admin_db.commit()

        resp = admin_client.get("/api/admin/logs/audit?limit=2&offset=0")
        assert resp.status_code == 200
        body = resp.json()
        assert set(body.keys()) == {"items", "total", "limit", "offset"}
        assert body["total"] >= 5
        assert body["limit"] == 2
        assert body["offset"] == 0
        assert len(body["items"]) == 2

        # Page 3 : offset=4, il reste au moins 1 item.
        resp2 = admin_client.get("/api/admin/logs/audit?limit=2&offset=4")
        body2 = resp2.json()
        assert body2["total"] == body["total"]
        assert len(body2["items"]) >= 1

        # Tri DESC : la 1re page est la plus recente.
        assert body["items"][0]["created_at"] >= body["items"][1]["created_at"]
    finally:
        _cleanup_logs(admin_db)
        # nettoyage doux : on garde la base exploitable pour les autres tests
        admin = admin_db.scalar(select(Administrator).where(Administrator.email == "audit-page@example.com"))
        if admin:
            for log in admin_db.scalars(select(AdminActionLog).where(AdminActionLog.admin_id == admin.id)).all():
                admin_db.delete(log)
            admin_db.delete(admin)
            admin_db.commit()


def test_audit_total_respecte_les_filtres(admin_client, admin_db):
    """Le total suit le WHERE : filtrer par action/admin change total ET items."""
    _cleanup_logs(admin_db)
    a1 = _ensure_admin(admin_db, "filtre-a1@example.com", full_name="Filtre Un")
    a2 = _ensure_admin(admin_db, "filtre-a2@example.com", full_name="Filtre Deux")
    try:
        _add_log(admin_db, admin_id=a1.id, action=AdminActionEnum.CREATE, target_table="administrators")
        _add_log(admin_db, admin_id=a1.id, action=AdminActionEnum.DELETE, target_table="companies")
        _add_log(admin_db, admin_id=a2.id, action=AdminActionEnum.CREATE, target_table="job_offers")
        admin_db.commit()

        total_tout = admin_client.get("/api/admin/logs/audit").json()["total"]
        total_create = admin_client.get("/api/admin/logs/audit?action=creation").json()
        assert total_create["total"] == 2
        assert all(item["action"] == "creation" for item in total_create["items"])

        total_a1 = admin_client.get(f"/api/admin/logs/audit?admin_id={a1.id}").json()["total"]
        assert total_a1 == 2

        total_croise = admin_client.get(
            f"/api/admin/logs/audit?admin_id={a1.id}&action=creation"
        ).json()
        assert total_croise["total"] == 1

        # Filtre table cible.
        total_table = admin_client.get("/api/admin/logs/audit?target_table=companies").json()
        assert total_table["total"] == 1
        assert total_table["items"][0]["target_table"] == "companies"
        assert total_tout >= 3
    finally:
        for log in admin_db.scalars(select(AdminActionLog).where(AdminActionLog.admin_id.in_([a1.id, a2.id]))).all():
            admin_db.delete(log)
        admin_db.delete(a1)
        admin_db.delete(a2)
        admin_db.commit()


def test_audit_action_invalide_400(admin_client, admin_db):
    """Une action hors enum reste refusee (400), pas de 500."""
    resp = admin_client.get("/api/admin/logs/audit?action=action-inconnue")
    assert resp.status_code == 400


# ─── 2. Stats /audit/stats ─────────────────────────────────────────────


def test_stats_base_vide_zeros(admin_client, admin_db):
    """Base vide : total=0, dictionnaires/listes vides, PAS de crash."""
    _cleanup_logs(admin_db)
    try:
        resp = admin_client.get("/api/admin/logs/audit/stats")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 0
        assert body["by_action"] == {}
        assert body["par_jour"] == []
        assert body["top_auteurs"] == []
    finally:
        pass  # on laisse la base vide (etat de depart du test)


def test_stats_par_jour_et_top_auteurs(admin_client, admin_db):
    """Axe par jour + top auteurs sur la fenetre, orphelins = Admin supprime."""
    _cleanup_logs(admin_db)
    auteur = _ensure_admin(admin_db, "stats-auteur@example.com", full_name="Stats Auteur")
    hier = datetime.now(UTC) - timedelta(days=1)
    try:
        # 3 actions d'un auteur vivant (2 aujourd'hui, 1 hier).
        _add_log(admin_db, admin_id=auteur.id, action=AdminActionEnum.CREATE)
        _add_log(admin_db, admin_id=auteur.id, action=AdminActionEnum.UPDATE)
        _add_log(admin_db, admin_id=auteur.id, action=AdminActionEnum.SEND, created=hier)
        # 1 orpheline (admin supprime, FK SET NULL cycle 15).
        _add_log(admin_db, admin_id=None, action=AdminActionEnum.DELETE)
        admin_db.commit()

        resp = admin_client.get("/api/admin/logs/audit/stats?days=30")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 4
        assert body["by_action"].get("creation") == 1
        assert body["by_action"].get("modification") == 1

        jours = {p["jour"]: p["total"] for p in body["par_jour"]}
        assert sum(jours.values()) == 4
        assert len(jours) >= 1  # au moins le jour courant

        # Top auteurs : l'auteur vivant ET la ligne orpheline regroupée.
        tops = {t["admin_id"]: t for t in body["top_auteurs"]}
        assert auteur.id in tops
        assert tops[auteur.id]["total"] == 3
        assert tops[auteur.id]["nom"] == "Stats Auteur"
        orphelins = [t for t in body["top_auteurs"] if t["admin_id"] is None]
        assert orphelins and orphelins[0]["nom"] == "Admin supprimé"
        assert orphelins[0]["total"] == 1
    finally:
        _cleanup_logs(admin_db)
        for log in admin_db.scalars(select(AdminActionLog).where(AdminActionLog.admin_id == auteur.id)).all():
            admin_db.delete(log)
        admin_db.delete(auteur)
        admin_db.commit()


def test_stats_fenetre_days_limite_par_jour(admin_client, admin_db):
    """days=1 : une action d'il y a 3 jours n'entre PAS dans par_jour/top
    mais reste comptee dans total (global) et by_action (global)."""
    _cleanup_logs(admin_db)
    vieux = datetime.now(UTC) - timedelta(days=3)
    _add_log(admin_db, admin_id=None, action=AdminActionEnum.SCRAPE, created=vieux)
    admin_db.commit()
    try:
        body = admin_client.get("/api/admin/logs/audit/stats?days=1").json()
        assert body["total"] == 1
        assert body["by_action"].get("scraping") == 1
        # La fenetre par_jour ne contient PAS le jour d'il y a 3 jours.
        assert body["par_jour"] == []
        assert body["top_auteurs"] == []
    finally:
        _cleanup_logs(admin_db)


# ─── 3. Journalisation de la connexion ─────────────────────────────────


def test_login_journalise_action_connexion(admin_client, admin_db):
    """admin_login ecrit une ligne action=connexion, meme transaction que
    last_login_at (les deux sont visibles apres le POST /login)."""
    from core.security import hash_password

    _cleanup_logs(admin_db, needle="login-journal@example.com")
    admin_db.query(Administrator).filter(Administrator.email == "login-journal@example.com").delete()
    admin = Administrator(
        email="login-journal@example.com",
        password_hash=hash_password("MotDePasse123"),
        full_name="Login Journal",
        role=AdminRole.SUPER_ADMIN,
        is_active=True,
    )
    admin_db.add(admin)
    admin_db.commit()
    try:
        # Les conftests bypassent get_current_admin mais PAS /login : la
        # route POST /api/admin/auth/login reste reelle (TestClient complet).
        resp = admin_client.post(
            "/api/admin/auth/login",
            json={"email": "login-journal@example.com", "password": "MotDePasse123"},
        )
        assert resp.status_code == 200, resp.text

        logs = [
            log
            for log in admin_db.scalars(
                select(AdminActionLog).where(AdminActionLog.admin_id == admin.id)
            ).all()
            if log.action == AdminActionEnum.LOGIN
        ]
        assert logs, "le login doit ecrire une ligne action=connexion"
        assert logs[0].target_table == "administrators"
        assert logs[0].details.get("email") == "login-journal@example.com"
        admin_db.refresh(admin)
        assert admin.last_login_at is not None
    finally:
        _cleanup_logs(admin_db, needle="login-journal@example.com")
        admin_db.query(Administrator).filter(Administrator.email == "login-journal@example.com").delete()
        admin_db.commit()


def test_echec_login_non_journalise(admin_client, admin_db):
    """Un login RATE n'ecrit RIEN (pas de ligne connexion sans session)."""
    from core.security import hash_password

    _cleanup_logs(admin_db, needle="login-ko@example.com")
    admin_db.query(Administrator).filter(Administrator.email == "login-ko@example.com").delete()
    admin = Administrator(
        email="login-ko@example.com",
        password_hash=hash_password("MotDePasse123"),
        full_name="Login Ko",
        role=AdminRole.SUPER_ADMIN,
        is_active=True,
    )
    admin_db.add(admin)
    admin_db.commit()
    try:
        resp = admin_client.post(
            "/api/admin/auth/login",
            json={"email": "login-ko@example.com", "password": "MAUVAIS"},
        )
        assert resp.status_code == 401

        logs = admin_db.scalars(
            select(AdminActionLog).where(AdminActionLog.admin_id == admin.id)
        ).all()
        assert logs == [], "aucune ligne de journal pour un echec de connexion"
    finally:
        _cleanup_logs(admin_db, needle="login-ko@example.com")
        admin_db.query(Administrator).filter(Administrator.email == "login-ko@example.com").delete()
        admin_db.commit()
