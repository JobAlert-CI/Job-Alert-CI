"""Table admin_refresh_tokens (audit #13).

Persist le hash SHA-256 des refresh tokens JWT admin pour implementer
une rotation effective : un refresh consomme est marque `used_at`, tout
reuse detecte entraine la revocation de toute la famille de l'admin.

Garde-fou (audit 3, correctif chaine migrations) : la migration 0001 cree
les tables via Base.metadata.create_all(), donc toute table ajoutee aux
MODELES est deja presente quand cette migration s'execute sur une base
fraiche. On ne cree (table + index) que si absent.

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

_TABLE = "admin_refresh_tokens"


def _tables(inspector) -> set[str]:
    return set(inspector.get_table_names())


def _indexes(inspector) -> set[str]:
    return {index["name"] for index in inspector.get_indexes(_TABLE)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _TABLE not in _tables(inspector):
        op.create_table(
            _TABLE,
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("admin_id", sa.String(36), sa.ForeignKey("administrators.id", ondelete="CASCADE"), nullable=False),
            sa.Column("token_hash", sa.String(128), nullable=False, unique=True),
            sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    existing_indexes = _indexes(sa.inspect(bind))
    for index_name, columns in {
        "ix_admin_refresh_tokens_admin_id": ["admin_id"],
        "ix_admin_refresh_tokens_used_at": ["used_at"],
    }.items():
        if index_name not in existing_indexes:
            op.create_index(index_name, _TABLE, columns)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_indexes = _indexes(inspector) if _TABLE in _tables(inspector) else set()
    for index_name in ("ix_admin_refresh_tokens_used_at", "ix_admin_refresh_tokens_admin_id"):
        if index_name in existing_indexes:
            op.drop_index(index_name, table_name=_TABLE)
    if _TABLE in _tables(inspector):
        op.drop_table(_TABLE)
