"""Index composes + purge refresh tokens (audit 2, Q6/F1).

1. Index `ix_job_offers_status_view_count` sur (status, view_count DESC)
   pour accelerer `top_viewed_offers` (tri par vues des offres actives) —
   signale des l'audit 1 (§2.3) et toujours absent.
2. Index `ix_admin_refresh_tokens_expires_at` pour la purge periodique
   des refresh tokens expires (tache beat `purge-expired-refresh-tokens`).

Revision ID: 0012_indexes_and_refresh_purge
Revises: 0011_admin_refresh_tokens
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012_indexes_and_refresh_purge"
down_revision: Union[str, None] = "0011_admin_refresh_tokens"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _indexes(inspector, table_name: str) -> set[str]:
    return {index["name"] for index in inspector.get_indexes(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    job_indexes = _indexes(inspector, "job_offers")
    if "ix_job_offers_status_view_count" not in job_indexes:
        # DESC explicite: le widget top-vues trie par view_count descendant.
        op.create_index(
            "ix_job_offers_status_view_count",
            "job_offers",
            [sa.text("status"), sa.text("view_count DESC")],
            unique=False,
        )

    refresh_indexes = _indexes(inspector, "admin_refresh_tokens")
    if "ix_admin_refresh_tokens_expires_at" not in refresh_indexes:
        op.create_index(
            "ix_admin_refresh_tokens_expires_at",
            "admin_refresh_tokens",
            ["expires_at"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "ix_admin_refresh_tokens_expires_at" in _indexes(inspector, "admin_refresh_tokens"):
        op.drop_index("ix_admin_refresh_tokens_expires_at", table_name="admin_refresh_tokens")
    if "ix_job_offers_status_view_count" in _indexes(inspector, "job_offers"):
        op.drop_index("ix_job_offers_status_view_count", table_name="job_offers")