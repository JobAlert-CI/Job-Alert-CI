"""Table rejected_duplicate_pairs (rejet explicite de paires de doublons).

Permet d'eviter de re-proposer la meme paire (offre A, offre B) comme doublon
potentiel apres que l'admin a rejete le matching.

Garde-fou (audit 3, correctif chaine migrations) : la migration 0001 cree
les tables via Base.metadata.create_all(), donc toute table ajoutee aux
MODELES est deja presente quand cette migration s'execute sur une base
fraiche. On ne cree (table + index) que si absente.

Revision: 0009_rejected_duplicate_pair
Revises: 0008_no_offer_email_log
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009_rejected_duplicate_pair"
down_revision: Union[str, None] = "0008_no_offer_email_log"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLE = "rejected_duplicate_pairs"


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
            sa.Column("offer_a_id", sa.String(36), sa.ForeignKey("job_offers.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("offer_b_id", sa.String(36), sa.ForeignKey("job_offers.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("reason", sa.String(255), nullable=True),
            sa.Column("reviewed_by_admin_id", sa.String(36), sa.ForeignKey("administrators.id", ondelete="SET NULL"), nullable=True, index=True),
            sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.CheckConstraint("offer_a_id < offer_b_id", name="chk_duplicate_order"),
        )

    existing_indexes = _indexes(sa.inspect(bind))
    if "ix_rejected_duplicate_pair_order" not in existing_indexes:
        op.create_index("ix_rejected_duplicate_pair_order", _TABLE, ["offer_a_id", "offer_b_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if _TABLE in _tables(inspector):
        op.drop_table(_TABLE)
