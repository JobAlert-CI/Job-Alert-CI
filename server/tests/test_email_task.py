from __future__ import annotations

import pytest
from celery.exceptions import Retry

from celery_app import celery_app
from schemas.subscriptions import SubscriberCreate
from services.email.email_provider import EmailSendResult
from services.email_confirmation_service import register_subscriber
from models import TransactionalEmailEvent, TransactionalEmailStatus
from tasks import emails as emails_task
from tests.conftest import subscription_payload

"""Tests de la tache Celery d'envoi (mode eager, aucun broker, aucune cle API)."""


@pytest.fixture(autouse=True)
def _eager():
    celery_app.conf.task_always_eager = True
    celery_app.conf.task_eager_propagates = True
    yield
    celery_app.conf.task_always_eager = False
    celery_app.conf.task_eager_propagates = False


@pytest.fixture()
def pending(db):
    registration = register_subscriber(db, SubscriberCreate(**subscription_payload()))
    assert registration.pending is not None
    return registration.pending


def _run(pending, monkeypatch, provider):
    monkeypatch.setattr(emails_task, "get_email_provider", lambda: provider)
    return emails_task.send_confirmation_email_task.apply(
        kwargs={
            "subscriber_id": pending.subscriber_id,
            "raw_token": pending.raw_token,
            "event_id": pending.event_id,
            "purpose": "confirm_email",
        }
    )


def test_task_marks_event_sent(pending, db, fake_provider, monkeypatch):
    result = _run(pending, monkeypatch, fake_provider)

    assert result.result["success"] is True
    db.expire_all()
    event = db.get(TransactionalEmailEvent, pending.event_id)
    assert event.status == TransactionalEmailStatus.SENT
    assert event.provider_email_id == "fake-1"
    assert len(fake_provider.sent) == 1


def test_task_does_not_retry_on_permanent_error(pending, db, fake_provider, monkeypatch):
    fake_provider.queue_result(
        EmailSendResult(
            success=False,
            provider="resend",
            error_message="Domaine non vérifié",
            status_code=403,
            retryable=False,
        )
    )
    result = _run(pending, monkeypatch, fake_provider)

    assert result.result["success"] is False
    assert result.result["attempts"] == 1
    db.expire_all()
    assert db.get(TransactionalEmailEvent, pending.event_id).status == TransactionalEmailStatus.FAILED


def test_task_retries_on_transient_error(pending, fake_provider, monkeypatch):
    fake_provider.queue_result(
        EmailSendResult(
            success=False, provider="resend", error_message="rate limited", status_code=429, retryable=True
        )
    )
    with pytest.raises(Retry):
        _run(pending, monkeypatch, fake_provider)


def test_task_stops_after_max_attempts(pending, fake_provider, monkeypatch):
    """Au-dela de EMAIL_MAX_RETRIES tentatives, on abandonne au lieu de boucler."""

    fake_provider.queue_result(
        EmailSendResult(success=False, provider="resend", error_message="5xx", status_code=500, retryable=True)
    )
    monkeypatch.setattr(emails_task, "get_email_provider", lambda: fake_provider)

    task = emails_task.send_confirmation_email_task
    monkeypatch.setattr(type(task.request), "retries", 2, raising=False)
    outcome = task.apply(
        kwargs={
            "subscriber_id": pending.subscriber_id,
            "raw_token": pending.raw_token,
            "event_id": pending.event_id,
        },
        retries=2,
    )

    assert outcome.result["success"] is False
    assert outcome.result["attempts"] == 3
