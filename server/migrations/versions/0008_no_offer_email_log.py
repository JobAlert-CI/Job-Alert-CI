"""Table no_offer_email_logs (rate limit 7j glissants sur l'email 'no offer').

Quand un abonne ne recoit aucun digest apres la cascade T0-T5, on lui envoie
un email 'no offer' transactionnel (distinct du EmailDigest quotidien).
Cette table trace chaque envoi pour appliquer le rate limit
NO_OFFER_EMAIL_MIN_INTERVAL_DAYS (defaut 7 jours glissants).

Garde-fou (audit 3, correctif chaine migrations) : la migration 0001 cree
les tables via Base.metadata.create_all(), donc toute table ajoutee aux
MODELES est deja presente quand cette migration s'execute sur une base
fraiche. On ne cree (table + index) que si absente.

Revision ID: 0008_no_offer_email_log
Revises: 0007_digest_cascade_match_tier
Create Date: 2026-08-28
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_no_offer_email_log"
down_revision: Union[str, None] = "0007_digest_cascade_match_tier"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLE = "no_offer_email_logs"


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
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column(
                "subscriber_id",
                sa.String(length=36),
                sa.ForeignKey("subscribers.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("digest_date", sa.Date(), nullable=False),
            sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        )

    existing_indexes = _indexes(sa.inspect(bind))
    for index_name, columns in {
        "ix_no_offer_email_logs_subscriber_id": ["subscriber_id"],
        "ix_no_offer_email_logs_digest_date": ["digest_date"],
        "ix_no_offer_email_logs_sent_at": ["sent_at"],
    }.items():
        if index_name not in existing_indexes:
            op.create_index(index_name, _TABLE, columns)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_indexes = _indexes(inspector) if _TABLE in _tables(inspector) else set()
    for index_name in (
        "ix_no_offer_email_logs_sent_at",
        "ix_no_offer_email_logs_digest_date",
        "ix_no_offer_email_logs_subscriber_id",
    ):
        if index_name in existing_indexes:
            op.drop_index(index_name, table_name=_TABLE)
    if _TABLE in _tables(inspector):
        op.drop_table(_TABLE)
