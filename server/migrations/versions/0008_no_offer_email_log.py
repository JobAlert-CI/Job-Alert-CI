"""Table no_offer_email_logs (rate limit 7j glissants sur l'email 'no offer').

Quand un abonne ne recoit aucun digest apres la cascade T0-T5, on lui envoie
un email 'no offer' transactionnel (distinct du EmailDigest quotidien).
Cette table trace chaque envoi pour appliquer le rate limit
NO_OFFER_EMAIL_MIN_INTERVAL_DAYS (defaut 7 jours glissants).

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


def upgrade() -> None:
    op.create_table(
        "no_offer_email_logs",
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
    op.create_index("ix_no_offer_email_logs_subscriber_id", "no_offer_email_logs", ["subscriber_id"])
    op.create_index("ix_no_offer_email_logs_digest_date", "no_offer_email_logs", ["digest_date"])
    op.create_index("ix_no_offer_email_logs_sent_at", "no_offer_email_logs", ["sent_at"])


def downgrade() -> None:
    op.drop_index("ix_no_offer_email_logs_sent_at", table_name="no_offer_email_logs")
    op.drop_index("ix_no_offer_email_logs_digest_date", table_name="no_offer_email_logs")
    op.drop_index("ix_no_offer_email_logs_subscriber_id", table_name="no_offer_email_logs")
    op.drop_table("no_offer_email_logs")
