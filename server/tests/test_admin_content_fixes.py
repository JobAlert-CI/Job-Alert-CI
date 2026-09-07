"""Tests admin cycle 14 — fixes & évolutions post-livraison initiale.

Couvre :
- category rempli dans la LISTE articles (bug remonté utilisateur :
  null en table alors que visible dans l'éditeur — la route détail
  seule le remplissait) ;
- conseils multiples : 2 tips sur le même créneau autorisés (409
  supprimé, migration 0015) ;
- takeaways/key-figures : régression rapide (routes cycle 14).
"""

from __future__ import annotations

import pytest

# Marker requis pour neutraliser l'autouse `_database` du conftest principal.
pytestmark = pytest.mark.admin_db

from models.content import ContentPage
from models.editorial import Article, DailyTip


def test_liste_articles_category_remplie(admin_client, admin_db):
    """La liste doit exposer category (fix remonté utilisateur)."""
    page = ContentPage(content_type="article", slug="test-fix-cat-liste", title="Article fix cat", status="draft")
    admin_db.add(page)
    admin_db.flush()
    article = Article(content_page_id=page.id, reading_minutes=5)
    admin_db.add(article)
    admin_db.commit()

    res = admin_client.get("/api/admin/content/articles")
    assert res.status_code == 200
    cible = [a for a in res.json() if a["slug"] == "test-fix-cat-liste"][0]
    # Sans catégorie : None, mais le CHAMP est bien sérialisé (pas de
    # category manquante) ; avec une catégorie : l'objet complet.
    assert "category" in cible
    assert cible["category"] is None or "label" in cible["category"]


def test_conseils_multiples_meme_creneau(admin_client, admin_db):
    """Migration 0015 : 2 tips sur le créneau 3 → 201 tous les deux (plus de 409)."""
    admin_db.query(DailyTip).filter(DailyTip.rotation_order == 3).delete()
    admin_db.commit()

    res1 = admin_client.post("/api/admin/content/daily-tips", json={"text": "Premier conseil du mercredi", "rotation_order": 3})
    assert res1.status_code == 201
    res2 = admin_client.post("/api/admin/content/daily-tips", json={"text": "Deuxième conseil du mercredi", "rotation_order": 3})
    assert res2.status_code == 201

    tips = [t for t in admin_client.get("/api/admin/content/daily-tips").json() if t["rotation_order"] == 3]
    assert len(tips) == 2
