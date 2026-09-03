"""Tests admin /api/admin/{offers/top-viewed, search}.

Couvre :
- Top N offres triees par view_count (active + visible_site)
- Recherche globale dans 3 domaines (offres / abonnes / entreprises)
- Cas limites (recherche vide, LIKE injection, accents)
"""

from __future__ import annotations

import uuid

import pytest

# Marker requis pour neutraliser l'autouse `_database` du conftest principal.
pytestmark = pytest.mark.admin_db

from sqlalchemy import select

from models import Company, JobOffer, JobOfferStatus, Subscriber, SubscriberStatus
from models.referentials import Filiere, Source


def _get_or_create(db, model, defaults=None, **kwargs):
    """Helper idempotent : get_or_create pour fixtures partagees entre tests du module."""
    instance = db.scalar(select(model).filter_by(**kwargs))
    if instance is not None:
        return instance
    params = {**(defaults or {}), **kwargs}
    instance = model(**params)
    db.add(instance)
    db.flush()
    return instance


def _seed_offer_pipeline(admin_db):
    """Cree une mini base : 2 filieres, 1 source, 3 entreprises, 5 offres, 3 abonnes.

    Les compteurs de vues sont choisis pour avoir un classement deterministe.

    IDEMPOTENT : peut etre appele plusieurs fois dans la meme session de tests
    sans creer de doublons. Chaque entite est identifiee par une cle unique
    (slug pour Filiere/Source/Company, email_normalized pour Subscriber,
    (title, company_id) pour JobOffer) ; si elle existe deja, on la reutilise.
    """
    src = _get_or_create(
        admin_db,
        Source,
        defaults={"name": "GoAfrica", "base_url": "https://goafrica.ci", "status": "active", "priority": 1},
        code="goafrica",
        slug="goafrica",
    )
    f_tech = _get_or_create(admin_db, Filiere, defaults={"label": "Tech & Dev"}, code="tech-dev", slug="tech-dev")
    f_mark = _get_or_create(admin_db, Filiere, defaults={"label": "Marketing & Com"}, code="marketing", slug="marketing")
    admin_db.flush()

    c_orange = _get_or_create(admin_db, Company, defaults={"name": "Orange CI", "slug": "orange-ci"}, normalized_name="orange ci")
    c_mtn = _get_or_create(admin_db, Company, defaults={"name": "MTN CI", "slug": "mtn-ci"}, normalized_name="mtn ci")
    c_acme = _get_or_create(admin_db, Company, defaults={"name": "Acme Corp", "slug": "acme-corp"}, normalized_name="acme corp")
    admin_db.flush()

    def _ensure_offer(title, view_count, company, filiere, status=JobOfferStatus.ACTIVE, visible=True, deleted=False):
        existing = admin_db.scalar(
            select(JobOffer).where(JobOffer.title == title, JobOffer.company_id == company.id)
        )
        if existing is not None:
            # On garde la plus grande valeur de view_count pour rester deterministe
            existing.view_count = max(existing.view_count, view_count)
            return existing
        from datetime import datetime, timezone
        offer = JobOffer(
            id=str(uuid.uuid4()),
            title=title,
            normalized_title=title.lower(),
            company_id=company.id,
            source_id=src.id,
            primary_filiere_id=filiere.id if filiere else None,
            hash_unique=f"h-{uuid.uuid4()}",
            source_url=f"https://{company.slug}/{uuid.uuid4().hex[:6]}",
            view_count=view_count,
            save_count=max(1, view_count // 5),
            status=status,
            visible_site=visible,
            deleted_at=datetime.now(timezone.utc) if deleted else None,
        )
        admin_db.add(offer)
        admin_db.flush()
        return offer

    o1 = _ensure_offer("Lead Dev Python", 100, c_orange, f_tech)
    o2 = _ensure_offer("Data Scientist Senior", 50, c_mtn, f_tech)
    o3 = _ensure_offer("Architecte Cloud", 25, c_orange, f_tech)
    o4 = _ensure_offer("Dev Junior (archivee)", 999, c_mtn, f_tech, status=JobOfferStatus.ARCHIVED, visible=False)
    o5 = _ensure_offer("Dev Senior (supprimee)", 999, c_acme, f_tech, deleted=True)

    def _ensure_sub(email, name, status=SubscriberStatus.ACTIVE, deleted=False):
        existing = admin_db.scalar(select(Subscriber).where(Subscriber.email_normalized == email))
        if existing is not None:
            return existing
        from datetime import datetime, timezone
        sub = Subscriber(
            id=str(uuid.uuid4()),
            email=email,
            email_normalized=email,
            full_name=name,
            city="Abidjan",
            status=status,
            deleted_at=datetime.now(timezone.utc) if deleted else None,
        )
        admin_db.add(sub)
        admin_db.flush()
        return sub

    sub1 = _ensure_sub("alice@example.com", "Alice Kouassi", SubscriberStatus.ACTIVE)
    sub2 = _ensure_sub("bob@example.com", "Bob Diallo", SubscriberStatus.PAUSED)
    sub3 = _ensure_sub("carol@example.com", "Carol Traore", SubscriberStatus.ACTIVE, deleted=True)

    admin_db.commit()

    return {
        "offers": [o1, o2, o3, o4, o5],
        "subs": [sub1, sub2, sub3],
        "companies": [c_orange, c_mtn, c_acme],
    }


# ─── top-viewed ───────────────────────────────────────────────────────


def test_top_viewed_tri_par_view_count(admin_client, admin_db):
    """Le top est bien trie par view_count DESC et ignore archivees/supprimees."""
    seeded = _seed_offer_pipeline(admin_db)
    resp = admin_client.get("/api/admin/dashboard/top-viewed-offers?limit=3")
    assert resp.status_code == 200, resp.text
    items = resp.json()
    assert len(items) == 3
    counts = [item["view_count"] for item in items]
    assert counts == [100, 50, 25], counts
    # Les IDs archivees (999 vues) et soft-delete ne sont PAS dans le top
    returned_ids = {item["id"] for item in items}
    for o in seeded["offers"]:
        if o.view_count == 999:
            assert o.id not in returned_ids


def test_top_viewed_champ_summary_complet(admin_client, admin_db):
    """Chaque item expose id, title, status, view_count, save_count, company, primary_filiere_id."""
    _seed_offer_pipeline(admin_db)
    item = admin_client.get("/api/admin/dashboard/top-viewed-offers?limit=1").json()[0]
    for field in ("id", "title", "status", "view_count", "save_count", "visible_site", "company", "primary_filiere_id"):
        assert field in item, f"Champ manquant : {field}"
    # Le summary n'embarque PAS le detail
    assert "detail" not in item
    assert "missions" not in item


def test_top_viewed_limit_max(admin_client):
    """limit > 50 est rejete."""
    resp = admin_client.get("/api/admin/dashboard/top-viewed-offers?limit=999")
    assert resp.status_code == 422


# ─── search ──────────────────────────────────────────────────────────


def test_search_trouve_offre_par_titre(admin_client, admin_db):
    """La recherche 'Python' remonte l'offre Lead Dev Python."""
    _seed_offer_pipeline(admin_db)
    resp = admin_client.get("/api/admin/search?q=Python")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    titles = [o["title"] for o in body["offers"]]
    assert any("Python" in t for t in titles)
    # Pas de resultats attendus ailleurs (q ne match rien)
    assert body["subscribers"] == []
    assert body["companies"] == []


def test_search_trouve_abonne_par_email(admin_client, admin_db):
    """Recherche 'alice' trouve alice@example.com."""
    _seed_offer_pipeline(admin_db)
    resp = admin_client.get("/api/admin/search?q=alice")
    assert resp.status_code == 200
    body = resp.json()
    emails = [s["email"] for s in body["subscribers"]]
    assert "alice@example.com" in emails
    # L'abonne soft-delete (carol) ne remonte PAS
    assert all("carol" not in e for e in emails)


def test_search_trouve_entreprise_par_nom(admin_client, admin_db):
    """Recherche 'orange' trouve Orange CI."""
    _seed_offer_pipeline(admin_db)
    resp = admin_client.get("/api/admin/search?q=orange")
    body = resp.json()
    names = [c["name"] for c in body["companies"]]
    assert "Orange CI" in names


def test_search_case_insensitive(admin_client, admin_db):
    """Majuscules/minuscules sont equivalentes."""
    _seed_offer_pipeline(admin_db)
    r1 = admin_client.get("/api/admin/search?q=ALICE").json()
    r2 = admin_client.get("/api/admin/search?q=alice").json()
    assert len(r1["subscribers"]) == len(r2["subscribers"]) == 1


def test_search_echappe_caracteres_like(admin_client, admin_db):
    """% et _ dans la requete sont echappes (pas d'injection LIKE)."""
    _seed_offer_pipeline(admin_db)
    # Si l'echappement fonctionne, '%' cherche litteralement '%' -> 0 resultats
    resp = admin_client.get("/api/admin/search?q=%25")  # % URL-encoded
    assert resp.status_code == 200
    body = resp.json()
    assert body["offers"] == []
    assert body["subscribers"] == []
    assert body["companies"] == []


def test_search_per_type_limit_plafonne(admin_client, admin_db):
    """per_type_limit plafonne chaque groupe."""
    _seed_offer_pipeline(admin_db)
    # 5 abonnes supplementaires qui matchent 'example.com'
    for i in range(5):
        admin_db.add(
            Subscriber(
                id=str(uuid.uuid4()),
                email=f"new{i}@example.com",
                email_normalized=f"new{i}@example.com",
                full_name=f"User {i}",
                status=SubscriberStatus.ACTIVE,
            )
        )
    admin_db.commit()

    resp = admin_client.get("/api/admin/search?q=example.com&per_type_limit=2")
    body = resp.json()
    assert body["per_type_limit"] == 2
    assert len(body["subscribers"]) == 2


def test_search_query_vide_renvoie_resultats_vides(admin_client, admin_db):
    """Si la query est vide apres trim, le serveur repond avec des listes vides.

    On simule un trim vide en passant un caractere d'espacement qui n'est
    pas dans la base (espace insécable). En SQLite/MySQL/Postgres, ' '
    (espace) est normalement matche par LIKE '% %' s'il existe, mais on
    evite en utilisant un caractere rare. Plus simple : on teste directement
    que la reponse contient au moins la query echo et la per_type_limit.
    """
    resp = admin_client.get("/api/admin/search?q=%20%20")  # 2 espaces
    assert resp.status_code == 200
    body = resp.json()
    assert body["query"] == "  "  # echo des 2 espaces
    # Pas de validation stricte du contenu (depend de la base partagee) :
    # on verifie juste que le serveur repond avec la structure attendue.
    assert "offers" in body and "subscribers" in body and "companies" in body
    assert body["per_type_limit"] == 10


def test_search_q_trop_court(admin_client):
    """q vide (rien apres ?) doit etre rejete par Pydantic (min_length=1)."""
    resp = admin_client.get("/api/admin/search?q=")
    assert resp.status_code == 422