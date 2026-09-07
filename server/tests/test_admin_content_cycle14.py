"""Tests admin /api/admin/content (cycle 14 — schémas pages + takeaways/key-figures).

Couvre :
- Pages statiques : POST avec ContentPageCreate (slug unique 409, type
  refusé hors static_page/legal_page), PATCH status (published_at figé),
  PUT avec ContentPageUpdate (exclude_unset).
- Takeaways / key-figures : ajout fin de liste, insertion à position
  (décalage), suppression + recompactage des positions.
"""

from __future__ import annotations

import pytest

# Marker requis pour neutraliser l'autouse `_database` du conftest principal.
pytestmark = pytest.mark.admin_db

from models.content import ContentPage
from models.editorial import Article, ArticleTakeaway


def _seed_article(admin_db) -> str:
    """Crée (ou réutilise) un article de test — retourne son id."""
    page = admin_db.query(ContentPage).filter_by(slug="test-cycle14-article").one_or_none()
    if page is None:
        page = ContentPage(
            content_type="article",
            slug="test-cycle14-article",
            title="Article test cycle 14",
            status="draft",
        )
        admin_db.add(page)
        admin_db.flush()
        article = Article(content_page_id=page.id, reading_minutes=5)
        admin_db.add(article)
        admin_db.commit()
    article = admin_db.query(Article).join(ContentPage).filter(ContentPage.slug == "test-cycle14-article").one()
    return article.id


def test_page_create_statut_initial_draft(admin_client):
    res = admin_client.post(
        "/api/admin/content/pages",
        json={"content_type": "legal_page", "slug": "test-mentions-legales", "title": "Mentions légales", "body": {"paragraphs": ["Test."]}},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "draft"
    assert body["published_at"] is None


def test_page_create_slug_duplique_409(admin_client):
    admin_client.post(
        "/api/admin/content/pages",
        json={"content_type": "legal_page", "slug": "test-doublon-slug", "title": "Page 1"},
    )
    res = admin_client.post(
        "/api/admin/content/pages",
        json={"content_type": "static_page", "slug": "test-doublon-slug", "title": "Page 2"},
    )
    assert res.status_code == 409


def test_page_create_type_refuse_422(admin_client):
    res = admin_client.post(
        "/api/admin/content/pages",
        json={"content_type": "article", "slug": "test-type-refuse", "title": "Pas une page"},
    )
    assert res.status_code == 422


def test_page_status_publication_date_figee(admin_client):
    created = admin_client.post(
        "/api/admin/content/pages",
        json={"content_type": "legal_page", "slug": "test-publication-page", "title": "Confidentialité"},
    ).json()
    # Publie
    res = admin_client.patch(f"/api/admin/content/pages/{created['id']}/status", json={"status": "published"})
    assert res.status_code == 200
    published_at = res.json()
    assert published_at["status"] == "published"
    # Repasse en brouillon puis republie : published_at ne bouge plus
    admin_client.patch(f"/api/admin/content/pages/{created['id']}/status", json={"status": "draft"})
    republie = admin_client.patch(f"/api/admin/content/pages/{created['id']}/status", json={"status": "published"}).json()
    page = admin_client.get("/api/admin/content/pages").json()
    cible = [p for p in page if p["id"] == created["id"]][0]
    assert cible["published_at"] is not None
    assert republie["status"] == "published"


def test_page_update_champs_fournis(admin_client):
    created = admin_client.post(
        "/api/admin/content/pages",
        json={"content_type": "static_page", "slug": "test-update-page", "title": "Titre initial"},
    ).json()
    res = admin_client.put(f"/api/admin/content/pages/{created['id']}", json={"title": "Nouveau titre", "seo_title": "SEO"})
    assert res.status_code == 200
    assert res.json()["title"] == "Nouveau titre"
    assert res.json()["seo_title"] == "SEO"
    # slug inchangé (absent du payload)
    assert res.json()["slug"] == "test-update-page"


def test_takeaway_ajout_fin_puis_insertion(admin_client, admin_db):
    article_id = _seed_article(admin_db)
    res = admin_client.post(f"/api/admin/content/articles/{article_id}/takeaways", json={"text": "Premier point"})
    assert res.status_code == 201
    res = admin_client.post(f"/api/admin/content/articles/{article_id}/takeaways", json={"text": "Deuxième point"})
    assert res.status_code == 201
    # Insertion en position 1 : les suivants sont décalés
    res = admin_client.post(f"/api/admin/content/articles/{article_id}/takeaways", json={"text": "Inséré en tête", "position": 1})
    assert res.status_code == 201
    textes = [t["text"] for t in res.json()["takeaways"]]
    positions = [t["position"] for t in res.json()["takeaways"]]
    assert textes[0] == "Inséré en tête"
    assert positions == [1, 2, 3]


def test_takeaway_suppression_recompacte(admin_client, admin_db):
    article_id = _seed_article(admin_db)
    # Nettoie les takeaways de test précédents pour ce scénario
    admin_db.query(ArticleTakeaway).filter(ArticleTakeaway.article_id == article_id).delete()
    admin_db.commit()

    premier = admin_client.post(f"/api/admin/content/articles/{article_id}/takeaways", json={"text": "A garder 1"}).json()
    admin_client.post(f"/api/admin/content/articles/{article_id}/takeaways", json={"text": "A supprimer"})
    troisieme = admin_client.post(f"/api/admin/content/articles/{article_id}/takeaways", json={"text": "A garder 2"}).json()

    # Supprime le milieu → positions recompactées 1..2
    a_supprimer = [t for t in admin_client.get(f"/api/admin/content/articles/{article_id}").json()["takeaways"] if t["text"] == "A supprimer"][0]
    res = admin_client.delete(f"/api/admin/content/takeaways/{a_supprimer['id']}")
    assert res.status_code == 204

    takeaways = admin_client.get(f"/api/admin/content/articles/{article_id}").json()["takeaways"]
    assert sorted(t["position"] for t in takeaways) == [1, 2]
    assert {t["text"] for t in takeaways} == {"A garder 1", "A garder 2"}
    assert premier and troisieme


def test_key_figure_ajout_et_suppression(admin_client, admin_db):
    article_id = _seed_article(admin_db)
    res = admin_client.post(
        f"/api/admin/content/articles/{article_id}/key-figures",
        json={"value": 72, "label": "des recruteurs", "suffix": "%"},
    )
    assert res.status_code == 201
    figures = res.json()["key_figures"]
    assert len(figures) == 1
    assert figures[0]["suffix"] == "%"
    assert figures[0]["value"] == 72

    res = admin_client.delete(f"/api/admin/content/key-figures/{figures[0]['id']}")
    assert res.status_code == 204
    assert admin_client.get(f"/api/admin/content/articles/{article_id}").json()["key_figures"] == []
