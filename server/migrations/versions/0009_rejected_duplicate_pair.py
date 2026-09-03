"""Table rejected_duplicate_pairs (rejet explicite de paires de doublons).

Permet d'eviter de re-proposer la meme paire (offre A, offre B) comme doublon
potentiel apres que l'admin a rejete le matching.

Revision: 0009_rejected_duplicate_pair
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0009_rejected_duplicate_pair"
down_revision: Union[str, None] = "0008_no_offer_email_log"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rejected_duplicate_pairs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("offer_a_id", sa.String(36), sa.ForeignKey("job_offers.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("offer_b_id", sa.String(36), sa.ForeignKey("job_offers.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("reason", sa.String(255), nullable=True),
        sa.Column("reviewed_by_admin_id", sa.String(36), sa.ForeignKey("administrators.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("offer_a_id < offer_b_id", name="chk_duplicate_order"),
    )
    op.create_index("ix_rejected_duplicate_pair_order", "rejected_duplicate_pairs", ["offer_a_id", "offer_b_id"])
