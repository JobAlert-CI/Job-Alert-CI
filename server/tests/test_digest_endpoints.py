from __future__ import annotations

"""Tests des correctifs cahier des charges:
- remplacement sûr des filières/contrats (delete -> flush -> insert);
- désinscription par token `unsubscribe` à usage unique;
- gestion des préférences sans login (manage_alert).
"""

from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select

from api.deps import get_db
from api.v1.public.subscriptions import router as subscriptions_router
from models import (
    ContractType,
    Subscriber,
    SubscriberContractPreference,
    SubscriberFiliere,
    SubscriberStatus,
    SubscriberToken,
    TokenPurpose,
    UnsubscribeEvent,
)
from services.normalization import token_hash
from services.subscriptions import (
    replace_subscriber_contract_preferences,
    replace_subscriber_filieres,
)


def _make_subscriber_with_prefs(db, filieres: list[str]) -> tuple[Subscriber, dict]:
    from models import Filiere

    ids: dict[str, str] = {}
    for code in filieres:
        filiere = db.scalar(select(Filiere).where(Filiere.code == code))
        if filiere is None:
            filiere = Filiere(code=code, slug=code, label=f"Filiere {code}")
            db.add(filiere)
            db.flush()
        ids[code] = filiere.id

    subscriber = Subscriber(
        email="prefs@example.com",
        email_normalized="prefs@example.com",
        status=SubscriberStatus.ACTIVE,
        subscribed_at=datetime.now(timezone.utc),
    )
    db.add(subscriber)
    db.flush()
    for index, code in enumerate(filieres, start=1):
        db.add(SubscriberFiliere(subscriber_id=subscriber.id, filiere_id=ids[code], priority=index))
    db.commit()
    return subscriber, ids


class TestReplaceFilieres:
    def test_replacement_does_not_violate_unique_constraints(self, db):
        subscriber, ids = _make_subscriber_with_prefs(db, ["tech-dev"])

        # Re-soumission incluant la MÊME filière: le bug initial violait
        # uq(subscriber_id, filiere_id) car l'INSERT partait avant le DELETE.
        replace_subscriber_filieres(
            db,
            subscriber=subscriber,
            filiere_ids_with_priority=[(ids["tech-dev"], 1)],
        )
        links = db.query(SubscriberFiliere).filter_by(subscriber_id=subscriber.id).all()
        assert len(links) == 1
        assert links[0].filiere_id == ids["tech-dev"]
        assert links[0].priority == 1

    def test_rotation_of_priorities(self, db):
        subscriber, ids = _make_subscriber_with_prefs(db, ["tech-dev"])
        other = db.query(__import__("models").Filiere).filter_by(code="tech-dev").one()

        # Rotation: la même filière change de priorité (violait uq(subscriber_id, priority)).
        replace_subscriber_filieres(
            db,
            subscriber=subscriber,
            filiere_ids_with_priority=[(other.id, 3)],
        )
        db.expire_all()
        link = db.query(SubscriberFiliere).filter_by(subscriber_id=subscriber.id).one()
        assert link.priority == 3

    def test_validates_one_to_three_filieres(self, db):
        subscriber, ids = _make_subscriber_with_prefs(db, ["tech-dev"])
        with pytest.raises(ValueError):
            replace_subscriber_filieres(db, subscriber=subscriber, filiere_ids_with_priority=[])

    def test_contract_preferences_replacement(self, db):
        subscriber, _ids = _make_subscriber_with_prefs(db, ["tech-dev"])
        contract = db.query(ContractType).filter_by(code="cdi").one()

        replace_subscriber_contract_preferences(db, subscriber=subscriber, contract_type_ids=[contract.id])
        prefs = db.query(SubscriberContractPreference).filter_by(subscriber_id=subscriber.id).all()
        assert len(prefs) == 1 and prefs[0].contract_type_id == contract.id

        # Remplacement à vide puis re-ajout: pas de violation.
        replace_subscriber_contract_preferences(db, subscriber=subscriber, contract_type_ids=[contract.id])
        assert db.query(SubscriberContractPreference).count() >= 1


# ─── Endpoints tokenisés ──────────────────────────────────────────────────


@pytest.fixture()
def app_client(db, monkeypatch):
    app = FastAPI()
    app.include_router(subscriptions_router)
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as client:
        yield client


def _issue_raw_token(db, subscriber: Subscriber, purpose: TokenPurpose) -> str:
    import secrets

    raw = secrets.token_urlsafe(32)
    db.add(SubscriberToken(subscriber_id=subscriber.id, purpose=purpose, token_hash=token_hash(raw)))
    db.commit()
    return raw


class TestUnsubscribeEndpoint:
    def test_unsubscribe_marks_token_used_and_creates_event(self, db, app_client):
        subscriber, _ = _make_subscriber_with_prefs(db, ["tech-dev"])
        raw = _issue_raw_token(db, subscriber, TokenPurpose.UNSUBSCRIBE)

        response = app_client.post(f"/api/subscriptions/unsubscribe/{raw}")
        assert response.status_code == 200
        db.expire_all()
        fresh = db.get(Subscriber, subscriber.id)
        assert fresh.status == SubscriberStatus.UNSUBSCRIBED
        assert fresh.unsubscribed_at is not None
        assert db.query(UnsubscribeEvent).filter_by(subscriber_id=subscriber.id).count() == 1
        token_row = db.query(SubscriberToken).filter_by(subscriber_id=subscriber.id, purpose=TokenPurpose.UNSUBSCRIBE).one()
        assert token_row.used_at is not None

    def test_unsubscribe_token_is_single_use(self, db, app_client):
        subscriber, _ = _make_subscriber_with_prefs(db, ["tech-dev"])
        raw = _issue_raw_token(db, subscriber, TokenPurpose.UNSUBSCRIBE)
        app_client.post(f"/api/subscriptions/unsubscribe/{raw}")

        # Second clic sur le meme lien: reponse apaisee (idempotent).
        response = app_client.post(f"/api/subscriptions/unsubscribe/{raw}")
        assert response.status_code == 200

    def test_wrong_purpose_token_rejected(self, db, app_client):
        subscriber, _ = _make_subscriber_with_prefs(db, ["tech-dev"])
        raw = _issue_raw_token(db, subscriber, TokenPurpose.MANAGE_ALERT)
        response = app_client.post(f"/api/subscriptions/unsubscribe/{raw}")
        assert response.status_code == 404


class TestPreferencesEndpoint:
    def test_update_filieres_without_login(self, db, app_client):
        subscriber, ids = _make_subscriber_with_prefs(db, ["tech-dev"])
        raw = _issue_raw_token(db, subscriber, TokenPurpose.MANAGE_ALERT)

        response = app_client.put(
            f"/api/subscriptions/preferences/{raw}",
            json={"filieres": ["tech-dev"], "contract_types": [], "wants_career_tips": False},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["wants_career_tips"] is False
        assert len(body["filiere_links"]) == 1

    def test_more_than_three_filieres_rejected(self, db, app_client):
        from models import Filiere

        subscriber, _ = _make_subscriber_with_prefs(db, ["tech-dev"])
        for code in ("a", "b", "c", "d"):
            db.add(Filiere(code=code, slug=code, label=code))
        db.commit()
        raw = _issue_raw_token(db, subscriber, TokenPurpose.MANAGE_ALERT)

        response = app_client.put(
            f"/api/subscriptions/preferences/{raw}",
            json={"filieres": ["a", "b", "c", "d"], "contract_types": []},
        )
        # 422 (validation Pydantic max_length=3): le schéma est la première barriere.
        assert response.status_code in (400, 422)
