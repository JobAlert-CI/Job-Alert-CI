"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-08-07
"""

from typing import Sequence, Union

from alembic import op

from db.base import Base
import models  # noqa: F401

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Migration initiale: on cree toutes les tables declarees par les modeles.
    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    # Audit P1 #23: defense en profondeur, on refuse de dropper en prod.
    from core.config import get_settings

    if get_settings().is_production:
        raise RuntimeError(
            "downgrade 0001 refuse de dropper en production. "
            "Utilisez une migration dediee (alembic downgrade -1 avec une migration non destructive)."
        )
    # Drop dans l'ordre inverse des dependances SQLAlchemy.
    Base.metadata.drop_all(bind=op.get_bind())
