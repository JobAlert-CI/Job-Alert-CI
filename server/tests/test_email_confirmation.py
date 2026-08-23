from __future__ import annotations

import dataclasses
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from sqlalchemy import select

from core.config import get_settings
from models import (
    Subscriber,
    SubscriberStatus,
    SubscriberToken,
    TokenPurpose,
    TransactionalEmailEvent,
    TransactionalEmailStatus,
)
from schemas.subscriptions import SubscriberCreate
from services.email.email_provider import EmailMessage, EmailSendResult
from services.email.resend_provider import ResendEmailProvider
from services.email.templates import build_confirmation_context, render_confirmation_email
from services.email_confirmation_service import (
    MESSAGE_ALREADY_CONFIRMED,
    MESSAGE_CONFIRMATION_RESENT,
    MESSAGE_GENERIC_RESEND,
    create_queued_event,
    prepare_confirmation_email,
    register_subscriber,
    send_confirmation_email_now,
)
from models.enums import TransactionalEmailPurpose
from services.normalization import token_hash
from tests.conftest import subscription_payload


# ─── 1. Inscription avec confirmation activee ─────────────────────────────


def test_subscribe_creates_pending_subscriber_token_and_queued_email(client, db, dispatched):
    response = client.post("/api/subscriptions", json=subscription_payload())

    assert response.status_code == 201
    body = response.json()
    assert body["requires_confirmation"] is True
    assert "confirmation" in body["confirmation_message"].lower()
    assert body["status"] == "pending"

    subscriber = db.scalar(select(Subscriber).where(Subscriber.email_normalized == "demo@example.com"))
    assert subscriber is not None
    assert subscriber.status == SubscriberStatus.PENDING
    assert subscriber.confirmed_at is None

    tokens = db.scalars(
        select(SubscriberToken).where(
            SubscriberToken.subscriber_id == subscriber.id,
            SubscriberToken.purpose == TokenPurpose.CONFIRM_EMAIL,
        )
    ).all()
    assert len(tokens) == 1
    assert tokens[0].expires_at is not None

    events = db.scalars(select(TransactionalEmailEvent)).all()
    assert len(events) == 1
    assert events[0].status == TransactionalEmailStatus.QUEUED
    assert len(dispatched) == 1
    # Le token brut ne doit jamais etre stocke en clair.
    assert tokens[0].token_hash == token_hash(dispatched[0].raw_token)
    assert dispatched[0].raw_token not in (events[0].request_payload or {}).values()


# ─── 2. Inscription avec confirmation desactivee ──────────────────────────


def test_subscribe_without_confirmation_activates_immediately(db):
    settings = dataclasses.replace(get_settings(), email_confirmation_required=False)
    registration = register_subscriber(db, SubscriberCreate(**subscription_payload()), settings=settings)

    assert registration.requires_confirmation is False
    assert registration.pending is None
    assert registration.subscriber.status == SubscriberStatus.ACTIVE
    assert registration.subscriber.confirmed_at is not None
    assert db.scalars(select(TransactionalEmailEvent)).all() == []


# ─── 3. Email deja existant, statut pending ───────────────────────────────


def test_subscribe_twice_pending_revokes_previous_token(client, db, dispatched):
    client.post("/api/subscriptions", json=subscription_payload())
    first_token = dispatched[0].raw_token

    response = client.post("/api/subscriptions", json=subscription_payload())
    assert response.status_code == 201
    assert response.json()["confirmation_message"] == MESSAGE_CONFIRMATION_RESENT

    subscribers = db.scalars(select(Subscriber)).all()
    assert len(subscribers) == 1  # pas de doublon

    tokens = db.scalars(
        select(SubscriberToken).where(SubscriberToken.purpose == TokenPurpose.CONFIRM_EMAIL)
    ).all()
    assert len(tokens) == 2
    revoked = [t for t in tokens if t.revoked_at is not None]
    assert len(revoked) == 1
    assert revoked[0].token_hash == token_hash(first_token)
    assert len(dispatched) == 2


# ─── 4. Email deja existant, statut active ────────────────────────────────


def test_subscribe_when_already_confirmed_sends_nothing(client, db, dispatched):
    client.post("/api/subscriptions", json=subscription_payload())
    confirm = client.get(f"/api/subscriptions/confirm/{dispatched[0].raw_token}")
    assert confirm.status_code == 200
    dispatched.clear()

    response = client.post("/api/subscriptions", json=subscription_payload())
    assert response.status_code == 201
    body = response.json()
    assert body["requires_confirmation"] is False
    assert body["confirmation_message"] == MESSAGE_ALREADY_CONFIRMED
    assert dispatched == []
    assert len(db.scalars(select(Subscriber)).all()) == 1


def test_subscribe_refused_when_bounced(client, db, dispatched):
    client.post("/api/subscriptions", json=subscription_payload())
    subscriber = db.scalar(select(Subscriber))
    subscriber.status = SubscriberStatus.BOUNCED
    db.commit()

    response = client.post("/api/subscriptions", json=subscription_payload())
    assert response.status_code == 409
    assert "support" in response.json()["detail"].lower()


# ─── 5-8. Confirmation ────────────────────────────────────────────────────


def test_confirm_valid_token_activates_subscriber(client, db, dispatched):
    client.post("/api/subscriptions", json=subscription_payload())
    raw_token = dispatched[0].raw_token

    response = client.get(f"/api/subscriptions/confirm/{raw_token}")
    assert response.status_code == 200
    assert response.json() == {"message": "Inscription confirmée", "email": "demo@example.com"}

    subscriber = db.scalar(select(Subscriber))
    assert subscriber.status == SubscriberStatus.ACTIVE
    assert subscriber.confirmed_at is not None

    token = db.scalar(select(SubscriberToken).where(SubscriberToken.token_hash == token_hash(raw_token)))
    assert token.used_at is not None


def test_confirm_expired_token_returns_410(client, db, dispatched):
    client.post("/api/subscriptions", json=subscription_payload())
    raw_token = dispatched[0].raw_token
    token = db.scalar(select(SubscriberToken).where(SubscriberToken.token_hash == token_hash(raw_token)))
    token.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
    db.commit()

    response = client.get(f"/api/subscriptions/confirm/{raw_token}")
    assert response.status_code == 410
    assert "expiré" in response.json()["detail"]

    db.expire_all()
    assert db.scalar(select(Subscriber)).status == SubscriberStatus.PENDING


def test_confirm_used_token_is_idempotent_when_active(client, dispatched):
    client.post("/api/subscriptions", json=subscription_payload())
    raw_token = dispatched[0].raw_token
    client.get(f"/api/subscriptions/confirm/{raw_token}")

    response = client.get(f"/api/subscriptions/confirm/{raw_token}")
    assert response.status_code == 200
    assert response.json()["message"] == MESSAGE_ALREADY_CONFIRMED


def test_confirm_used_token_errors_when_not_active(client, db, dispatched):
    client.post("/api/subscriptions", json=subscription_payload())
    raw_token = dispatched[0].raw_token
    token = db.scalar(select(SubscriberToken).where(SubscriberToken.token_hash == token_hash(raw_token)))
    token.used_at = datetime.now(timezone.utc)
    db.commit()

    response = client.get(f"/api/subscriptions/confirm/{raw_token}")
    assert response.status_code == 400
    assert "déjà été utilisé" in response.json()["detail"]


def test_confirm_revoked_token_errors(client, dispatched):
    client.post("/api/subscriptions", json=subscription_payload())
    first_token = dispatched[0].raw_token
    client.post("/api/subscriptions", json=subscription_payload())  # revoque le premier

    response = client.get(f"/api/subscriptions/confirm/{first_token}")
    assert response.status_code == 400

    latest = client.get(f"/api/subscriptions/confirm/{dispatched[1].raw_token}")
    assert latest.status_code == 200


def test_confirm_unknown_token_returns_400(client):
    response = client.get("/api/subscriptions/confirm/token-inexistant")
    assert response.status_code == 400


# ─── 9-10. Renvoi et rate limiting ────────────────────────────────────────


def test_resend_confirmation_for_pending_subscriber(client, db, dispatched):
    client.post("/api/subscriptions", json=subscription_payload())
    dispatched.clear()

    response = client.post("/api/subscriptions/resend-confirmation", json={"email": "demo@example.com"})
    assert response.status_code == 200
    assert response.json()["message"] == MESSAGE_GENERIC_RESEND
    assert len(dispatched) == 1

    events = db.scalars(
        select(TransactionalEmailEvent).where(
            TransactionalEmailEvent.purpose == TransactionalEmailPurpose.RESEND_CONFIRMATION
        )
    ).all()
    assert len(events) == 1


def test_resend_confirmation_when_already_confirmed(client, dispatched):
    client.post("/api/subscriptions", json=subscription_payload())
    client.get(f"/api/subscriptions/confirm/{dispatched[0].raw_token}")
    dispatched.clear()

    response = client.post("/api/subscriptions/resend-confirmation", json={"email": "demo@example.com"})
    assert response.status_code == 200
    assert response.json()["message"] == MESSAGE_ALREADY_CONFIRMED
    assert dispatched == []


def test_resend_confirmation_unknown_email_is_generic(client, dispatched):
    response = client.post("/api/subscriptions/resend-confirmation", json={"email": "inconnu@example.com"})
    assert response.status_code == 200
    assert response.json()["message"] == MESSAGE_GENERIC_RESEND
    assert dispatched == []


def test_resend_confirmation_is_rate_limited(client, db, dispatched):
    """Redis est injoignable dans les tests: le fallback `last_email_sent_at`
    doit bloquer un second renvoi dans les 60 secondes."""

    client.post("/api/subscriptions", json=subscription_payload())
    subscriber = db.scalar(select(Subscriber))
    subscriber.last_email_sent_at = datetime.now(timezone.utc)
    db.commit()
    dispatched.clear()

    response = client.post("/api/subscriptions/resend-confirmation", json={"email": "demo@example.com"})
    assert response.status_code == 429
    assert response.headers.get("Retry-After") is not None
    assert dispatched == []


# ─── 11. Provider Resend (mock HTTP, aucune vraie cle) ────────────────────


def _message() -> EmailMessage:
    return EmailMessage(to_email="demo@example.com", subject="Sujet", html="<p>x</p>", text="x")


def _provider() -> ResendEmailProvider:
    return ResendEmailProvider(api_key="re_test_key", from_address="a@b.ci", from_name="JobAlert CI", timeout_seconds=1)


@pytest.mark.parametrize(
    ("status_code", "expected_success", "expected_retryable"),
    [(200, True, False), (401, False, False), (403, False, False), (429, False, True), (500, False, True)],
)
def test_resend_provider_status_handling(monkeypatch, status_code, expected_success, expected_retryable):
    body = {"id": "email-123"} if expected_success else {"message": "erreur simulée"}

    def fake_post(url, json=None, headers=None, timeout=None):
        assert headers["Authorization"].startswith("Bearer ")
        return httpx.Response(status_code, json=body)

    monkeypatch.setattr(httpx, "post", fake_post)
    result = _provider().send(_message())

    assert result.success is expected_success
    assert result.retryable is expected_retryable
    assert "re_test_key" not in (result.error_message or "")
    if expected_success:
        assert result.provider_email_id == "email-123"


def test_resend_provider_timeout_is_retryable(monkeypatch):
    def fake_post(*args, **kwargs):
        raise httpx.TimeoutException("timeout")

    monkeypatch.setattr(httpx, "post", fake_post)
    result = _provider().send(_message())

    assert result.success is False
    assert result.retryable is True


def test_resend_provider_without_api_key_does_not_retry():
    provider = ResendEmailProvider(api_key=None, from_address="a@b.ci", from_name="X", timeout_seconds=1)
    result = provider.send(_message())

    assert result.success is False
    assert result.retryable is False


# ─── 12. Journalisation ───────────────────────────────────────────────────


def test_event_records_provider_email_id_on_success(db, fake_provider):
    registration = register_subscriber(db, SubscriberCreate(**subscription_payload()))
    pending = registration.pending
    assert pending is not None

    result = send_confirmation_email_now(
        db,
        subscriber_id=pending.subscriber_id,
        raw_token=pending.raw_token,
        provider=fake_provider,
        event_id=pending.event_id,
    )
    db.commit()

    assert result.success is True
    event = db.get(TransactionalEmailEvent, pending.event_id)
    assert event.status == TransactionalEmailStatus.SENT
    assert event.provider_email_id == "fake-1"
    assert event.attempts == 1
    assert db.scalar(select(Subscriber)).last_email_sent_at is not None
    assert pending.raw_token not in str(event.request_payload) + str(event.response_payload)


def test_event_records_failure_without_api_key_leak(db, fake_provider):
    registration = register_subscriber(db, SubscriberCreate(**subscription_payload()))
    pending = registration.pending
    fake_provider.queue_result(
        EmailSendResult(
            success=False,
            provider="resend",
            error_message="API key is invalid",
            status_code=401,
            retryable=False,
            raw_response={"message": "API key is invalid"},
        )
    )

    send_confirmation_email_now(
        db,
        subscriber_id=pending.subscriber_id,
        raw_token=pending.raw_token,
        provider=fake_provider,
        event_id=pending.event_id,
    )
    db.commit()

    event = db.get(TransactionalEmailEvent, pending.event_id)
    assert event.status == TransactionalEmailStatus.FAILED
    assert event.last_error == "API key is invalid"
    assert "re_" not in str(event.response_payload)


def test_no_send_for_bounced_subscriber(db, fake_provider):
    registration = register_subscriber(db, SubscriberCreate(**subscription_payload()))
    pending = registration.pending
    registration.subscriber.status = SubscriberStatus.BOUNCED
    db.commit()

    result = send_confirmation_email_now(
        db,
        subscriber_id=pending.subscriber_id,
        raw_token=pending.raw_token,
        provider=fake_provider,
        event_id=pending.event_id,
    )

    assert result.success is False
    assert result.retryable is False
    assert fake_provider.sent == []


# ─── Templates ────────────────────────────────────────────────────────────


def test_confirmation_template_contains_url_and_expiry():
    context = build_confirmation_context(email="demo@example.com", full_name="Awa <b>", raw_token="abc123")
    rendered = render_confirmation_email(context)

    assert "https://jobalert.ci/inscription/confirmation/abc123" in rendered.html
    assert "https://jobalert.ci/inscription/confirmation/abc123" in rendered.text
    assert "24 heures" in rendered.text
    assert "<b>" not in rendered.html.split("Confirmer mon email")[0].split("Bonjour")[-1]


def test_queued_event_payload_has_no_secret(db):
    registration = register_subscriber(db, SubscriberCreate(**subscription_payload()))
    event = create_queued_event(
        db, subscriber=registration.subscriber, purpose=TransactionalEmailPurpose.CONFIRM_EMAIL
    )
    db.commit()

    serialized = str(event.request_payload)
    assert "Bearer" not in serialized
    assert "api_key" not in serialized
