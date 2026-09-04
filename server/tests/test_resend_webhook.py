from __future__ import annotations

import base64
import dataclasses
import hashlib
import hmac
import json
import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select

from api.v1.public import webhooks_resend
from core.config import get_settings
from models import Subscriber, SubscriberStatus, TransactionalEmailEvent, TransactionalEmailStatus
from schemas.subscriptions import SubscriberCreate
from services.email_confirmation_service import register_subscriber
from tests.conftest import subscription_payload

SECRET = "whsec_" + base64.b64encode(b"secret-de-test-jobalert").decode()


@pytest.fixture()
def webhook_client(monkeypatch):
    monkeypatch.setattr(
        webhooks_resend,
        "get_settings",
        lambda: dataclasses.replace(get_settings(), resend_webhook_secret=SECRET, email_bounce_threshold=2),
    )
    app = FastAPI()
    app.include_router(webhooks_resend.router)
    with TestClient(app) as client:
        yield client


def _signed_headers(body: bytes, timestamp: str | None = None) -> dict[str, str]:
    """Signe avec un timestamp frais (audit P1 #17: tolerance 5 min).

    `timestamp` peut etre surcharge pour tester le cas "timestamp obsolete".
    """
    svix_id = "msg_1"
    svix_timestamp = timestamp if timestamp is not None else str(int(time.time()))
    secret_bytes = base64.b64decode(SECRET.removeprefix("whsec_"))
    signed = f"{svix_id}.{svix_timestamp}.".encode() + body
    signature = base64.b64encode(hmac.new(secret_bytes, signed, hashlib.sha256).digest()).decode()
    return {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": f"v1,{signature}",
        "content-type": "application/json",
    }


def _sent_event(db) -> TransactionalEmailEvent:
    registration = register_subscriber(db, SubscriberCreate(**subscription_payload()))
    event = db.get(TransactionalEmailEvent, registration.pending.event_id)
    event.provider_email_id = "email-abc"
    event.status = TransactionalEmailStatus.SENT
    db.commit()
    return event


def test_webhook_rejects_invalid_signature(webhook_client):
    response = webhook_client.post("/api/webhooks/resend", json={"type": "email.delivered"})
    assert response.status_code == 401


def test_webhook_marks_delivered(webhook_client, db):
    event = _sent_event(db)
    body = json.dumps({"type": "email.delivered", "data": {"email_id": "email-abc"}}).encode()

    response = webhook_client.post("/api/webhooks/resend", content=body, headers=_signed_headers(body))
    assert response.status_code == 200
    assert response.json() == {"received": True}

    db.expire_all()
    assert db.get(TransactionalEmailEvent, event.id).status == TransactionalEmailStatus.SENT


def test_webhook_bounce_increments_and_is_idempotent(webhook_client, db):
    event = _sent_event(db)
    body = json.dumps({"type": "email.bounced", "data": {"email_id": "email-abc"}}).encode()
    headers = _signed_headers(body)

    webhook_client.post("/api/webhooks/resend", content=body, headers=headers)
    webhook_client.post("/api/webhooks/resend", content=body, headers=headers)

    db.expire_all()
    subscriber = db.scalar(select(Subscriber))
    assert subscriber.bounce_count == 1  # idempotent: le 2e appel ne recompte pas
    assert db.get(TransactionalEmailEvent, event.id).status == TransactionalEmailStatus.FAILED
    assert subscriber.status == SubscriberStatus.PENDING


def test_webhook_unknown_email_id_is_ignored(webhook_client, db):
    body = json.dumps({"type": "email.delivered", "data": {"email_id": "inconnu"}}).encode()
    response = webhook_client.post("/api/webhooks/resend", content=body, headers=_signed_headers(body))
    assert response.status_code == 200


def test_webhook_rejects_stale_timestamp(webhook_client):
    """Audit P1 #17: un timestamp de +5 min doit etre rejete (anti-replay)."""
    body = json.dumps({"type": "email.delivered", "data": {"email_id": "x"}}).encode()
    stale_ts = str(int(time.time()) - 3600)  # 1 heure dans le passe
    response = webhook_client.post("/api/webhooks/resend", content=body, headers=_signed_headers(body, timestamp=stale_ts))
    assert response.status_code == 401
    assert "Timestamp" in response.json()["detail"]
