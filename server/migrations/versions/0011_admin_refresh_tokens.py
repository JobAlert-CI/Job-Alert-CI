"""Table admin_refresh_tokens (audit #13).

Persist le hash SHA-256 des refresh tokens JWT admin pour implementer
une rotation effective : un refresh consomme est marque `used_at`, tout
reuse detecte entraine la revocation de toute la famille de l'admin.

Revision ID: 0011_admin_refresh_tokens
Revises: 0010_jobofferstatus_dedup
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011_admin_refresh_tokens"
down_revision: Union[str, None] = "0010_jobofferstatus_dedup"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "admin_refresh_tokens",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("admin_id", sa.String(36), sa.ForeignKey("administrators.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(128), nullable=False, unique=True),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_admin_refresh_tokens_admin_id", "admin_refresh_tokens", ["admin_id"])
    op.create_index("ix_admin_refresh_tokens_used_at", "admin_refresh_tokens", ["used_at"])


def downgrade() -> None:
    op.drop_index("ix_admin_refresh_tokens_used_at", table_name="admin_refresh_tokens")
    op.drop_index("ix_admin_refresh_tokens_admin_id", table_name="admin_refresh_tokens")
    op.drop_table("admin_refresh_tokens")