"""Colonnes dediees reset_token_hash / reset_token_used_at (audit 3, W1).

Remplace le scan JSON des 200 derniers events RESET_PASSWORD par un lookup
index direct. Le backfill copie les hash des payloads existants pour que les
tokens emis avant la migration restent consommables.

Revision ID: 0013_reset_token_hash_column
Revises: 0012_indexes_and_refresh_purge
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013_reset_token_hash_column"
down_revision: Union[str, None] = "0012_indexes_and_refresh_purge"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLE = "transactional_email_events"


def _columns(inspector) -> set[str]:
    return {column["name"] for column in inspector.get_columns(_TABLE)}


def _indexes(inspector) -> set[str]:
    return {index["name"] for index in inspector.get_indexes(_TABLE)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if _TABLE not in inspector.get_table_names():
        # Base fraiche : la table sera creee par le modele (ou 0004).
        return

    existing = _columns(inspector)

    if "reset_token_hash" not in existing:
        op.add_column(_TABLE, sa.Column("reset_token_hash", sa.String(length=128), nullable=True))

    if "reset_token_used_at" not in existing:
        op.add_column(_TABLE, sa.Column("reset_token_used_at", sa.DateTime(timezone=True), nullable=True))

    existing_indexes = _indexes(inspector)
    if "ix_transactional_email_events_reset_token_hash" not in existing_indexes:
        op.create_index(
            "ix_transactional_email_events_reset_token_hash",
            _TABLE,
            ["reset_token_hash"],
            unique=False,
        )

    # Backfill : les tokens RESET_PASSWORD emis avant la migration ont leur
    # hash uniquement dans request_payload JSON. On les copie en colonne pour
    # qu'ils restent consommables via le nouvel index.
    # Syntaxe dialect-aware : ->> en PostgreSQL, json_extract en SQLite.
    if bind.dialect.name == "postgresql":
        op.execute(
            sa.text(
                "UPDATE transactional_email_events "
                "SET reset_token_hash = request_payload->>'reset_token_hash' "
                "WHERE purpose = 'reset_password' AND reset_token_hash IS NULL "
                "AND request_payload IS NOT NULL"
            )
        )
    else:
        op.execute(
            sa.text(
                "UPDATE transactional_email_events "
                "SET reset_token_hash = json_extract(request_payload, '$.reset_token_hash') "
                "WHERE purpose = 'reset_password' AND reset_token_hash IS NULL "
                "AND request_payload IS NOT NULL"
            )
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if _TABLE not in inspector.get_table_names():
        return

    existing_indexes = _indexes(inspector)
    if "ix_transactional_email_events_reset_token_hash" in existing_indexes:
        op.drop_index("ix_transactional_email_events_reset_token_hash", table_name=_TABLE)

    existing = _columns(inspector)
    if "reset_token_used_at" in existing:
        op.drop_column(_TABLE, "reset_token_used_at")
    if "reset_token_hash" in existing:
        op.drop_column(_TABLE, "reset_token_hash")
