from __future__ import annotations

import os
from collections.abc import Iterator

import pytest

# La configuration est lue au moment de l'import (core.config). On force donc un
# environnement de test AVANT tout import applicatif: base SQLite en fichier
# temporaire, Redis desactive (fallback), aucune vraie cle Resend.
os.environ.setdefault("APP_ENV", "test")
os.environ["DATABASE_URL"] = "sqlite:///./test_confirmation.db"
os.environ["EMAIL_CONFIRMATION_REQUIRED"] = "true"
os.environ["CONFIRM_EMAIL_TOKEN_TTL_HOURS"] = "24"
os.environ["PUBLIC_BASE_URL"] = "https://jobalert.ci"
os.environ["REDIS_URL"] = "redis://127.0.0.1:1/0"  # injoignable -> mode fallback
os.environ.pop("RESEND_API_KEY", None)

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from api.v1.public import subscriptions as subscriptions_route  # noqa: E402
from core.config import get_settings  # noqa: E402
from db.base import Base  # noqa: E402
from db.session import SessionLocal, engine  # noqa: E402
from models import ContractType, ExperienceLevel, Filiere  # noqa: E402
from services.email.email_provider import EmailMessage, EmailSendResult  # noqa: E402


class FakeEmailProvider:
    """Mock du provider: aucun appel reseau, aucune cle API.

    `queue_result` permet de simuler un succes, un 401, un 429, un 5xx ou un
    timeout sans toucher a l'API Resend.
    """

    def __init__(self) -> None:
        self.sent: list[EmailMessage] = []
        self.results: list[EmailSendResult] = []

    def queue_result(self, result: EmailSendResult) -> None:
        self.results.append(result)

    def send(self, message: EmailMessage) -> EmailSendResult:
        self.sent.append(message)
        if self.results:
            return self.results.pop(0)
        return EmailSendResult(
            success=True, provider="resend", provider_email_id=f"fake-{len(self.sent)}", status_code=200
        )


@pytest.fixture()
def fake_provider() -> FakeEmailProvider:
    return FakeEmailProvider()


@pytest.fixture(autouse=True)
def _database() -> Iterator[None]:
    import models  # noqa: F401  (enregistre toutes les tables)

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        db.add(Filiere(code="tech-dev", slug="tech-dev", label="Tech & Dev"))
        db.add(ContractType(code="cdi", label="CDI"))
        db.add(ExperienceLevel(code="junior", label="Junior"))
        db.commit()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(autouse=True)
def _no_celery(monkeypatch: pytest.MonkeyPatch) -> Iterator[list]:
    """Neutralise la publication Celery et capture les envois demandes."""

    dispatched: list = []
    monkeypatch.setattr(
        subscriptions_route,
        "dispatch_confirmation_email",
        lambda pending: dispatched.append(pending),
    )
    yield dispatched


@pytest.fixture()
def dispatched(_no_celery: list) -> list:
    return _no_celery


@pytest.fixture()
def client() -> Iterator[TestClient]:
    app = FastAPI()
    app.include_router(subscriptions_route.router)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def settings():
    get_settings.cache_clear()
    return get_settings()


def subscription_payload(email: str = "demo@example.com") -> dict:
    return {
        "email": email,
        "full_name": "Utilisateur Démo",
        "city": "Abidjan",
        "filieres": ["tech-dev"],
        "experience": None,
        "contract_types": [],
        "wants_career_tips": True,
        "source": "site",
    }


__all__ = ["FakeEmailProvider", "subscription_payload", "select"]
