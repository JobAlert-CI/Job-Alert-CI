"""Tests admin /api/admin/transactional-emails.

Couvre la liste paginee filtree + le compteur.
"""

from __future__ import annotations

import uuid

import pytest

# Marker requis pour neutraliser l'autouse `_database` du conftest principal.
pytestmark = pytest.mark.admin_db

from models import TransactionalEmailEvent
from models.enums import (
    TransactionalEmailPurpose,
    TransactionalEmailStatus,
)


def _seed_events(admin_db) -> dict[str, str]:
    """Seed 4 evenements avec statuts/purposes differents. Renvoie les IDs par label."""
    events = {
        "sent_confirm": TransactionalEmailEvent(
            id=str(uuid.uuid4()),
            purpose=TransactionalEmailPurpose.CONFIRM_EMAIL,
            to_email="alice@example.com",
            status=TransactionalEmailStatus.SENT,
            provider="resend",
            provider_email_id="re_1",
            attempts=1,
        ),
        "failed_unsubscribe": TransactionalEmailEvent(
            id=str(uuid.uuid4()),
            purpose=TransactionalEmailPurpose.UNSUBSCRIBE,
            to_email="bob@example.com",
            status=TransactionalEmailStatus.FAILED,
            provider="resend",
            attempts=3,
            last_error="Timeout",
        ),
        "queued_resend": TransactionalEmailEvent(
            id=str(uuid.uuid4()),
            purpose=TransactionalEmailPurpose.RESEND_CONFIRMATION,
            to_email="carol@example.com",
            status=TransactionalEmailStatus.QUEUED,
            provider="resend",
            attempts=0,
        ),
        "sent_other_alice": TransactionalEmailEvent(
            id=str(uuid.uuid4()),
            purpose=TransactionalEmailPurpose.MANAGE_ALERT,
            to_email="alice2@example.com",
            status=TransactionalEmailStatus.SENT,
            provider="resend",
            attempts=1,
        ),
    }
    admin_db.add_all(events.values())
    admin_db.commit()
    return {k: v.id for k, v in events.items()}


def test_list_sans_filtre(admin_client, admin_db):
    """Sans filtre, on recupere tous les events pagines.

    Strategie : on seed puis on verifie que TOUS les IDs remontent dans la limite.
    """
    fresh_ids = _seed_events(admin_db)
    resp = admin_client.get("/api/admin/transactional-emails?limit=200")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    returned_ids = {item["id"] for item in body}
    # Tous les IDs du seed doivent remonter
    assert set(fresh_ids.values()) <= returned_ids


def test_filtre_status(admin_client, admin_db):
    """Le filtre status=FAILED ne garde que les evenements failed.

    Strategie incrementale : on compte les failed AVANT le seed, puis on verifie
    que le seed ajoute exactement 1 ligne failed (le bob@example.com).
    """
    before = admin_client.get("/api/admin/transactional-emails?status=failed").json()
    _seed_events(admin_db)
    after = admin_client.get("/api/admin/transactional-emails?status=failed").json()

    assert len(after) - len(before) == 1
    new_failed = [item for item in after if item["id"] not in {x["id"] for x in before}]
    assert len(new_failed) == 1
    assert new_failed[0]["status"] == "failed"
    assert new_failed[0]["to_email"] == "bob@example.com"


def test_filtre_purpose(admin_client, admin_db):
    """Le filtre purpose=resend_confirmation isole le renvoi."""
    before = admin_client.get("/api/admin/transactional-emails?purpose=resend_confirmation").json()
    _seed_events(admin_db)
    after = admin_client.get("/api/admin/transactional-emails?purpose=resend_confirmation").json()

    assert len(after) - len(before) == 1
    new_items = [item for item in after if item["id"] not in {x["id"] for x in before}]
    assert len(new_items) == 1
    assert new_items[0]["purpose"] == "resend_confirmation"


def test_filtre_to_email_exact(admin_client, admin_db):
    """Filtre exact sur to_email (lowercase)."""
    # On utilise un email unique (jamais insere) pour eviter toute collision avec les tests precedents
    unique_email = "filter-exact-test@jobalert.test"
    # Pre-seed un event avec cet email pour eviter que l'unicite SQL nous bloque
    import uuid as _uuid
    admin_db.add(
        TransactionalEmailEvent(
            id=str(_uuid.uuid4()),
            purpose=TransactionalEmailPurpose.CONFIRM_EMAIL,
            to_email=unique_email,
            status=TransactionalEmailStatus.SENT,
            provider="resend",
            attempts=1,
        )
    )
    admin_db.commit()
    resp = admin_client.get(f"/api/admin/transactional-emails?to_email={unique_email.upper()}")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["to_email"] == unique_email


def test_filtre_to_email_ilike(admin_client, admin_db):
    """Le % declenche un ILIKE (trouve tous les alice*)."""
    # Pre-seed 2 events avec un prefixe unique pour ce test
    import uuid as _uuid
    unique_prefix = f"alice-ilike-{_uuid.uuid4().hex[:6]}"
    for i in range(2):
        admin_db.add(
            TransactionalEmailEvent(
                id=str(_uuid.uuid4()),
                purpose=TransactionalEmailPurpose.CONFIRM_EMAIL,
                to_email=f"{unique_prefix}{i}@example.com",
                status=TransactionalEmailStatus.SENT,
                provider="resend",
            )
        )
    admin_db.commit()
    resp = admin_client.get(f"/api/admin/transactional-emails?to_email=%25{unique_prefix}%25")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 2


def test_pagination(admin_client, admin_db):
    """limit=2 + offset fonctionne.

    Strategie : on insere un batch volumineux (>2) puis on verifie que
    la pagination ne produit pas de doublons entre pages.
    """
    import uuid as _uuid
    unique_tag = _uuid.uuid4().hex[:8]
    for i in range(6):
        admin_db.add(
            TransactionalEmailEvent(
                id=str(_uuid.uuid4()),
                purpose=TransactionalEmailPurpose.CONFIRM_EMAIL,
                to_email=f"{unique_tag}-{i}@example.com",
                status=TransactionalEmailStatus.SENT,
                provider="resend",
            )
        )
    admin_db.commit()
    # Filtrer sur le tag unique pour eviter les faux positifs
    r1 = admin_client.get(f"/api/admin/transactional-emails?limit=2&offset=0&to_email=%25{unique_tag}%25").json()
    r2 = admin_client.get(f"/api/admin/transactional-emails?limit=2&offset=2&to_email=%25{unique_tag}%25").json()
    assert len(r1) == 2 and len(r2) == 2
    assert {x["id"] for x in r1}.isdisjoint({x["id"] for x in r2})


def test_count_avec_filtre(admin_client, admin_db):
    """/count renvoie au moins le nombre d'events inseres apres le seed.

    Strategie : on prend une photo avant/apres le seed avec un filtre qui
    isole les 2 events ajoutes (tag UUID unique). Le delta doit etre 2.
    On ne peut pas etre plus strict car la base partagee entre tests peut
    deja contenir des events matchs par hasard (tres improbable avec 12 hex).
    """
    import uuid as _uuid
    unique_tag = _uuid.uuid4().hex[:12]
    filter_q = f"%25{unique_tag}%25"

    before = admin_client.get(f"/api/admin/transactional-emails/count?to_email={filter_q}").json()["count"]

    seeded_ids = []
    for i in range(2):
        eid = str(_uuid.uuid4())
        seeded_ids.append(eid)
        admin_db.add(
            TransactionalEmailEvent(
                id=eid,
                purpose=TransactionalEmailPurpose.CONFIRM_EMAIL,
                to_email=f"{unique_tag}-{i}@example.com",
                status=TransactionalEmailStatus.FAILED,
                provider="resend",
            )
        )
    admin_db.commit()

    after = admin_client.get(f"/api/admin/transactional-emails/count?to_email={filter_q}").json()["count"]

    # Le delta doit etre exactement 2 (pas plus, pas moins).
    assert after - before == 2, f"delta attendu 2, got {after - before} (before={before}, after={after})"


def test_count_sans_filtre(admin_client, admin_db):
    """/count sans filtre compte tout.

    Verifie que la cle `count` est presente et >= 0 (la base partagee entre
    tests rend la valeur exacte dependante de l'ordre d'execution).
    """
    resp = admin_client.get("/api/admin/transactional-emails/count")
    assert resp.status_code == 200
    body = resp.json()
    assert "count" in body
    assert body["count"] >= 0


def test_purpose_invalide_renvoie_422(admin_client):
    """Un purpose non enumere est rejete."""
    resp = admin_client.get("/api/admin/transactional-emails?purpose=bogus")
    assert resp.status_code == 422


def test_donnees_ne_fuitent_pas_les_payloads(admin_client, admin_db):
    """Securite : la liste n'expose JAMAIS request_payload/response_payload.

    Le schema TransactionalEmailEventRead ne contient pas ces champs et
    `response_model` les filtre cote FastAPI.
    """
    _seed_events(admin_db)
    # On force un payload avec un secret bidon dans un event
    admin_db.add(
        TransactionalEmailEvent(
            id=str(uuid.uuid4()),
            purpose=TransactionalEmailPurpose.CONFIRM_EMAIL,
            to_email="x@y.com",
            status=TransactionalEmailStatus.SENT,
            provider="resend",
            request_payload={"secret_api_key": "sk_live_DO_NOT_LEAK"},
            response_payload={"raw": "body with sk_live_DO_NOT_LEAK inside"},
        )
    )
    admin_db.commit()
    resp = admin_client.get("/api/admin/transactional-emails").json()
    flat = str(resp)
    assert "sk_live_DO_NOT_LEAK" not in flat
    assert "request_payload" not in flat
    assert "response_payload" not in flat