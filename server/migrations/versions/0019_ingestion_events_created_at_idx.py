"""Audit 4, Lot 5 (A.3) : index created_at sur offer_ingestion_events.

Revision ID: 0019_ingestion_events_created_at_idx
Revises: 0018_admin_action_logout
Create Date: 2026-09-09

La purge purge_ingestion_events (15 j payload NULL / 90 j DELETE, tache
maintenance) et les agregations fenetrees /admin/logs filtrent sur
created_at. La table etant la plus volumineuse du systeme, sans index chaque
purge est un scan complet.

Idempotente (pattern 0004/0008/0011/0012) : on inspecte les index existants
avant creation — safe sur une base deja migree ET sur une base fraiche ou
la 0001 (Base.metadata.create_all) a deja pose l'index via les modeles.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0019_ingestion_events_created_at_idx"
down_revision: str | None = "0018_admin_action_logout"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLE = "offer_ingestion_events"
_INDEX = "ix_offer_ingestion_events_created_at"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {index["name"] for index in inspector.get_indexes(_TABLE)}
    if _INDEX not in existing:
        op.create_index(_INDEX, _TABLE, ["created_at"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {index["name"] for index in inspector.get_indexes(_TABLE)}
    if _INDEX in existing:
        op.drop_index(_INDEX, table_name=_TABLE)
