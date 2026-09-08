"""Tests cycle 18 — Parametres du site : branchement runtime + auteur.

Couverture (feu vert utilisateur : S1 + S2 + compteurs P1-P4) :
1. resolve_runtime_settings : table vide -> valeurs env ; ligne valide
   -> override ; valeur INVALIDE (mauvais type / hors bornes) -> fallback
   env SANS crash (une inscription ne doit jamais echouer pour ca) ;
   cle inconnue ignoree au runtime ;
2. get_confirmation_subject : cle admin > constante, vide -> constante,
   absente -> constante ;
3. register_subscriber CONSOMME le parametre admin : confirmation
   requise desactivable via site_settings (inscription PENDING -> pas
   de confirmation requise) ;
4. S2 : SiteSettingRead expose updated_by_admin_id (ORM brut, pas de
   piege « champ calcule » cycle 6) et la route GET /settings le
   renvoie ; PUT pose l'auteur.

⚠️ La base vit entre les tests du module (marker admin_db) : chaque
test nettoie SES lignes site_settings.
"""
from __future__ import annotations

import pytest

pytestmark = pytest.mark.admin_db

from datetime import UTC, datetime, timedelta

from core.config import get_settings
from models import SiteSetting, Subscriber, SubscriberStatus
from schemas.settings import SiteSettingRead
from schemas.subscriptions import SubscriberCreate
from services.site_settings_service import get_confirmation_subject, resolve_runtime_settings
from sqlalchemy import select


# ─── Helpers ───────────────────────────────────────────────────────────


def _set(db, key: str, value: str, description: str | None = None):
    """Upsert d'une ligne site_settings (sans commit)."""
    ligne = db.scalar(select(SiteSetting).where(SiteSetting.key == key))
    if ligne is None:
        ligne = SiteSetting(key=key, value=value, description=description)
        db.add(ligne)
    else:
        ligne.value = value
    return ligne


def _cleanup(db):
    db.query(SiteSetting).delete()
    db.commit()


def _filiere_test(db):
    """Filiere de test (SubscriberCreate exige >= 1 filiere)."""
    from models import Filiere

    filiere = db.scalar(select(Filiere).where(Filiere.code == "cycle18-test"))
    if filiere is None:
        filiere = Filiere(code="cycle18-test", label="Cycle 18 Test", slug="cycle18-test")
        db.add(filiere)
        db.commit()
    return filiere


# ─── 1. resolve_runtime_settings ───────────────────────────────────────


def test_table_vide_retombe_sur_env(admin_client, admin_db):
    _cleanup(admin_db)
    resolved = resolve_runtime_settings(admin_db)
    env = get_settings()
    assert resolved.email_confirmation_required == env.email_confirmation_required
    assert resolved.confirm_email_token_ttl_hours == env.confirm_email_token_ttl_hours
    assert resolved.support_email == env.support_email


def test_ligne_valide_prevaut_sur_env(admin_client, admin_db):
    _cleanup(admin_db)
    env = get_settings()
    try:
        _set(admin_db, "email_confirmation_required", "false")
        _set(admin_db, "confirm_email_token_ttl_hours", "48")
        _set(admin_db, "support_email", "aide@jobalert.ci")
        _set(admin_db, "email_from_name", "JobAlert CI Test")
        admin_db.commit()

        resolved = resolve_runtime_settings(admin_db)
        assert resolved.email_confirmation_required is False
        assert env.email_confirmation_required is True or resolved.email_confirmation_required is False
        assert resolved.confirm_email_token_ttl_hours == 48
        assert resolved.support_email == "aide@jobalert.ci"
        assert resolved.email_from_name == "JobAlert CI Test"
    finally:
        _cleanup(admin_db)


def test_valeur_invalide_retombe_sur_env_sans_crash(admin_client, admin_db):
    """TTL = « vingt-quatre » (non numerique) ou 999999 (hors bornes) ->
    valeur d'environnement CONSERVEE, aucune exception."""
    _cleanup(admin_db)
    env = get_settings()
    try:
        _set(admin_db, "confirm_email_token_ttl_hours", "vingt-quatre")
        _set(admin_db, "email_confirmation_required", "peut-etre")
        admin_db.commit()

        resolved = resolve_runtime_settings(admin_db)
        assert resolved.confirm_email_token_ttl_hours == env.confirm_email_token_ttl_hours
        assert resolved.email_confirmation_required == env.email_confirmation_required
    finally:
        _cleanup(admin_db)


def test_ttl_hors_bornes_ignore(admin_client, admin_db):
    """TTL borne 1-720 : 0 et 100000 sont rejetes, 720 accepte."""
    _cleanup(admin_db)
    env = get_settings()
    try:
        _set(admin_db, "confirm_email_token_ttl_hours", "0")
        admin_db.commit()
        assert resolve_runtime_settings(admin_db).confirm_email_token_ttl_hours == env.confirm_email_token_ttl_hours

        _set(admin_db, "confirm_email_token_ttl_hours", "100000")
        admin_db.commit()
        assert resolve_runtime_settings(admin_db).confirm_email_token_ttl_hours == env.confirm_email_token_ttl_hours

        _set(admin_db, "confirm_email_token_ttl_hours", "720")
        admin_db.commit()
        assert resolve_runtime_settings(admin_db).confirm_email_token_ttl_hours == 720
    finally:
        _cleanup(admin_db)


def test_cle_inconnue_ignoree_runtime(admin_client, admin_db):
    """Une cle sans champ Settings reste stockee mais non consommee."""
    _cleanup(admin_db)
    try:
        _set(admin_db, "future_cle_documentaire", "valeur")
        admin_db.commit()
        resolved = resolve_runtime_settings(admin_db)
        # Pas de crash, pas de changement : la cle est juste ignoree.
        assert resolved.support_email == get_settings().support_email
    finally:
        _cleanup(admin_db)


# ─── 2. Sujet de confirmation ──────────────────────────────────────────


def test_sujet_admin_prevaut_sur_constante(admin_client, admin_db):
    _cleanup(admin_db)
    try:
        _set(admin_db, "email_confirmation_subject", "Bienvenue chez JobAlert !")
        admin_db.commit()
        assert get_confirmation_subject(admin_db) == "Bienvenue chez JobAlert !"
    finally:
        _cleanup(admin_db)


def test_sujet_vide_ou_absent_retombe_constante(admin_client, admin_db):
    _cleanup(admin_db)
    from services.email.templates import DEFAULT_SUBJECT

    assert get_confirmation_subject(admin_db) == DEFAULT_SUBJECT
    try:
        _set(admin_db, "email_confirmation_subject", "   ")
        admin_db.commit()
        assert get_confirmation_subject(admin_db) == DEFAULT_SUBJECT
    finally:
        _cleanup(admin_db)


# ─── 3. register_subscriber consomme le parametre admin ────────────────


def test_inscription_sans_confirmation_quand_desactivee(admin_client, admin_db):
    """Desactiver email_confirmation_required dans site_settings rend
    l'inscription IMMEDIATEMENT confirmee (statut ACTIVE, pas de token
    CONFIRM_EMAIL emis)."""
    _cleanup(admin_db)
    email = f"cycle18-{datetime.now(UTC).strftime('%H%M%S')}@example.com"
    try:
        _set(admin_db, "email_confirmation_required", "false")
        admin_db.commit()

        from services.email_confirmation_service import register_subscriber

        _filiere_test(admin_db)
        registration = register_subscriber(
            admin_db,
            SubscriberCreate(
                email=email, full_name="Cycle 18", city="Abidjan", filieres=["cycle18-test"]
            ),
        )
        admin_db.commit()

        abonne = db_subscriber = admin_db.scalar(
            select(Subscriber).where(Subscriber.email == email)
        )
        assert abonne is not None
        assert abonne.status is SubscriberStatus.ACTIVE, (
            f"la confirmation desactivee doit activer l'abonne, statut={abonne.status}"
        )
        assert registration.requires_confirmation is False
    finally:
        # Nettoyage : abonne de test + parametres restaures (seed d'origine).
        abonne = admin_db.scalar(select(Subscriber).where(Subscriber.email == email))
        if abonne is not None:
            admin_db.delete(abonne)
            admin_db.commit()
        _set(admin_db, "email_confirmation_required", "true")
        admin_db.commit()


def test_inscription_avec_confirmation_par_defaut(admin_client, admin_db):
    """Parametre absent de la table : comportement env (requis par defaut
    en dev) -> inscription PENDING + confirmation demandee."""
    _cleanup(admin_db)
    email = f"cycle18b-{datetime.now(UTC).strftime('%H%M%S')}@example.com"
    try:
        from services.email_confirmation_service import register_subscriber

        _filiere_test(admin_db)
        registration = register_subscriber(
            admin_db,
            SubscriberCreate(
                email=email, full_name="Cycle 18 B", city="Abidjan", filieres=["cycle18-test"]
            ),
        )
        admin_db.commit()
        abonne = admin_db.scalar(select(Subscriber).where(Subscriber.email == email))
        assert abonne.status is SubscriberStatus.PENDING
        assert registration.requires_confirmation is True
    finally:
        abonne = admin_db.scalar(select(Subscriber).where(Subscriber.email == email))
        if abonne is not None:
            admin_db.delete(abonne)
            admin_db.commit()


# ─── 4. S2 : auteur expose ─────────────────────────────────────────────


def test_route_get_expose_auteur(admin_client, admin_db):
    """GET /settings renvoie updated_by_admin_id ; PUT en pose un."""
    _cleanup(admin_db)
    try:
        # PUT via la route : l'admin mocke du conftest devient l'auteur.
        resp = admin_client.put(
            "/api/admin/settings/test_auteur_key", json={"value": "42"}
        )
        assert resp.status_code == 200, resp.text
        corps = resp.json()
        assert corps["updated_by_admin_id"] == "admin-test"  # fake_admin du conftest

        # La liste le renvoie aussi.
        liste = admin_client.get("/api/admin/settings").json()
        cible = [s for s in liste if s["key"] == "test_auteur_key"]
        assert cible and cible[0]["updated_by_admin_id"] == "admin-test"
    finally:
        _cleanup(admin_db)


def test_ligne_seed_sans_auteur_null(admin_client, admin_db):
    """Une ligne posee SANS auteur (pattern seed) expose null proprement."""
    _cleanup(admin_db)
    try:
        _set(admin_db, "email_from_name", "JobAlert CI")
        admin_db.commit()
        liste = admin_client.get("/api/admin/settings").json()
        cible = [s for s in liste if s["key"] == "email_from_name"]
        assert cible and cible[0]["updated_by_admin_id"] is None
    finally:
        _cleanup(admin_db)


def test_validation_put_value_trop_longue_422(admin_client, admin_db):
    """value > 10000 caracteres -> 422 propre (validation Pydantic)."""
    resp = admin_client.put(
        "/api/admin/settings/ma_cle", json={"value": "x" * 10001}
    )
    assert resp.status_code == 422
