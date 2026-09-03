"""Helpers + fixtures dedies aux tests d'endpoints /api/admin/*.

Pourquoi un fichier dedie plutot que d'etendre tests/conftest.py ?
- Les tests publics (subscriptions, webhooks) n'ont pas besoin de
  fixtures admin (Administrator, JWT, etc.).
- Le seed obligatoire pour les tests admin est plus lourd (au moins 1
  administrateur, des sources, des filieres...).
- L'overhead de bootstrap doit etre paye une seule fois par session
  admin (scope="module" sur le client).

Important : `_database` du conftest principal est autouse=True, donc il
s'execute aussi pour nos tests admin. Comme il drop+create la base
apres chaque test, il casse notre session persistante. Pour eviter ca,
les tests admin sont marques `@pytest.mark.admin_db` et le filtre
`conftest.py` ci-dessous neutralise `_database` pour ces tests via
un `request.keywords`.
"""

from __future__ import annotations

import os
from collections.abc import Iterator

# Forcer l'env de test AVANT tout import applicatif, comme dans conftest.py.
os.environ.setdefault("APP_ENV", "test")
os.environ["DATABASE_URL"] = "sqlite:///./test_admin_enrich.db"
os.environ["EMAIL_CONFIRMATION_REQUIRED"] = "true"
os.environ["CONFIRM_EMAIL_TOKEN_TTL_HOURS"] = "24"
os.environ["PUBLIC_BASE_URL"] = "https://jobalert.ci"
os.environ["REDIS_URL"] = "redis://127.0.0.1:1/0"
os.environ.pop("RESEND_API_KEY", None)

import pytest  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from api.deps import get_current_admin  # noqa: E402
from api.v1 import ingestion as ingestion_route  # noqa: E402
from api.v1.public import subscriptions as subscriptions_route  # noqa: E402
from api.v1.router import api_router  # noqa: E402
from core.security import hash_password  # noqa: E402
from db.base import Base  # noqa: E402
from db.session import SessionLocal, engine  # noqa: E402
from models.admin import Administrator  # noqa: E402
from models.enums import AdminRole  # noqa: E402


admin_db = pytest.mark.admin_db


@pytest.fixture(scope="module")
def admin_client() -> Iterator[TestClient]:
    """Client FastAPI avec TOUS les routers admin montes, et un super_admin mocke.

    Scope module : on evite de remonter toute la stack 1 fois par test.
    `get_current_admin` est override pour bypasser le check JWT ; on garde
    `require_roles` actif pour verifier les 403.
    """
    import models  # noqa: F401

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    fake_admin = Administrator(
        id="admin-test",
        email="ops@jobalert.ci",
        full_name="Admin Tests",
        password_hash=hash_password("Test1234!"),
        role=AdminRole.SUPER_ADMIN,
        is_active=True,
    )

    app = FastAPI()
    app.include_router(api_router)
    app.dependency_overrides[get_current_admin] = lambda: fake_admin

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def admin_db() -> Iterator:
    """Session SQLAlchemy directe (cas ou on a besoin de seed/inspect).

    Le base reste vivante entre tests du meme module grace au scope
    module de `admin_client` (et grace au marker `admin_db` qui empeche
    `_database` du conftest principal de dropper la base entre tests).
    """
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(autouse=True)
def _neutralize_celery(monkeypatch: pytest.MonkeyPatch) -> None:
    """Neutralise les appels Celery pour les tests admin (ils sont declenches
    par certains endpoints et on ne veut pas de broker)."""
    for module in (subscriptions_route, ingestion_route):
        for attr in ("apply_async", "send_task", "delay"):
            if hasattr(module, attr):
                monkeypatch.setattr(getattr(module, attr), lambda *a, **kw: None, raising=False)


__all__ = ["admin_client", "admin_db", "admin_db_marker"]