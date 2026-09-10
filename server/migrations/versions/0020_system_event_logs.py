"""Audit 4, Lot 6 (G.1) : journal des evenements systeme unifie.

Revision ID: 0020_system_event_logs
Revises: 0019_ingestion_events_created_at_idx
Create Date: 2026-09-09

Comble le constat G.1 : les echecs de tasks Celery et d'envoi d'emails ne
laissaient aucune trace en base (logs worker uniquement). La table est
faiblement volumineuse (echecs + quelques infos ops) et purgee a 90 jours
par tasks.maintenance.purge_system_events.

Idempotente (pattern 0004) : on inspecte la base avant creation — safe
sur une base deja migree ET sur une base fraiche ou la 0001
(Base.metadata.create_all) a deja pose la table via les modeles.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0020_system_event_logs"
down_revision: str | None = "0019_ingestion_events_created_at_idx"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLE = "system_event_logs"


def _enum(*values: str, name: str) -> sa.Enum:
    """Meme convention que models/types.py::enum_column: CHECK, pas d'ENUM natif."""

    return sa.Enum(*values, name=name, native_enum=False, length=80, create_constraint=True)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if _TABLE in set(inspector.get_table_names()):
        return

    op.create_table(
        _TABLE,
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column(
            "source",
            _enum("celery", "email", "scraping", "ia", "api", name="systemeventsource_values"),
            nullable=False,
        ),
        sa.Column(
            "severity",
            _enum("info", "warning", "error", "critical", name="systemeventseverity_values"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(length=120), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("context", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f(f"pk_{_TABLE}")),
    )
    op.create_index(op.f(f"ix_{_TABLE}_source"), _TABLE, ["source"])
    op.create_index(op.f(f"ix_{_TABLE}_severity"), _TABLE, ["severity"])
    op.create_index(op.f(f"ix_{_TABLE}_event_type"), _TABLE, ["event_type"])
    op.create_index(op.f(f"ix_{_TABLE}_created_at"), _TABLE, ["created_at"])
    op.create_index(f"ix_{_TABLE}_source_created_at", _TABLE, ["source", "created_at"])
    op.create_index(f"ix_{_TABLE}_severity_created_at", _TABLE, ["severity", "created_at"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if _TABLE not in set(inspector.get_table_names()):
        return
    op.drop_table(_TABLE)
