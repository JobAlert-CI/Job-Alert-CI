from __future__ import annotations

from collections.abc import Generator, Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from core.config import get_settings

settings = get_settings()

engine_kwargs = {
    "echo": settings.database_echo,
    "future": True,
    # Evite de reutiliser une connexion morte apres redemarrage PostgreSQL.
    "pool_pre_ping": settings.db_pool_pre_ping,
}

if settings.is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs.update(
        {
            "pool_size": settings.db_pool_size,
            "max_overflow": settings.db_max_overflow,
            "pool_timeout": settings.db_pool_timeout,
            "pool_recycle": settings.db_pool_recycle,
        }
    )

engine = create_engine(settings.database_url, **engine_kwargs)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
    class_=Session,
)


def get_db() -> Generator[Session, None, None]:
    """Une session courte par requete HTTP."""

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope() -> Iterator[Session]:
    """Transaction pour scripts de seed, scraping ou envoi email."""

    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db() -> None:
    import models  # noqa: F401  (side-effect: enregistre les tables dans Base.metadata)
    from db.base import Base

    settings = get_settings()
    # Audit P1 #22: defense en profondeur, on refuse drop_all en prod.
    if settings.is_production:
        raise RuntimeError(
            "init_db() refuse de dropper en production. "
            "Utilisez Alembic (alembic upgrade head)."
        )
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
