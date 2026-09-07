"""Index unique partiel pour les digests (cycle 9 : envoi personnalise).

L'envoi manuel (doc v3 section 9 — relance apres reclamation, offre
speciale negociee) doit pouvoir creer PLUSIEURS digests le meme jour
pour un meme abonne, alors que le digest quotidien automatique reste
unique par (subscriber_id, digest_date).

Avant : UniqueConstraint stricte (subscriber_id, digest_date) → le 2e
envoi manuel du jour plantait en UniqueViolation 500.

Apres : index unique PARTIEL PostgreSQL WHERE template_version <> 'manual'
— le digest auto reste unique, les manuels sont libres.
Le modele est mis en coherence (models/emails.py).

Revision ID: 0014_digests_partial_unique
Revises: 0013_reset_token_hash_column
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014_digests_partial_unique"
down_revision: str | None = "0013_reset_token_hash_column"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLE = "email_digests"
_OLD_CONSTRAINT = "uq_email_digests_subscriber_date"
_NEW_INDEX = "uq_email_digests_subscriber_date_auto"


def upgrade() -> None:
    # Contrainte stricte → index unique partiel (digests auto seulement).
    op.drop_constraint(_OLD_CONSTRAINT, _TABLE, type_="unique")
    op.create_index(
        _NEW_INDEX,
        _TABLE,
        ["subscriber_id", "digest_date"],
        unique=True,
        postgresql_where=sa.text("template_version <> 'manual'"),
    )


def downgrade() -> None:
    op.drop_index(_NEW_INDEX, table_name=_TABLE)
    op.create_unique_constraint(_OLD_CONSTRAINT, _TABLE, ["subscriber_id", "digest_date"])
