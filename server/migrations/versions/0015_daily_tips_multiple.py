"""Multiples conseils par créneau (cycle 14, feu vert utilisateur).

Avant : UniqueConstraint stricte rotation_order → un seul conseil par
jour de la semaine ; en créer un deuxième déclenchait un 409 (comportement
voulue initialement, doc v3 14.3).

Après : contrainte supprimée — plusieurs conseils peuvent partager un
créneau. La route publique /daily-tip choisit DÉTERMINISTEMENT dans le
créneau via day_of_year % nb (rotation parfaite au fil des jours).
Le modele est mis en coherence (models/editorial.py : __table_args__
réduit au CheckConstraint 0-6).

Revision ID: 0015_daily_tips_multiple
Revises: 0014_digests_partial_unique
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015_daily_tips_multiple"
down_revision: str | None = "0014_digests_partial_unique"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLE = "daily_tips"
_CONSTRAINT = "uq_daily_tips_rotation"


def upgrade() -> None:
    op.drop_constraint(_CONSTRAINT, _TABLE, type_="unique")


def downgrade() -> None:
    # Recréer l'unicité peut échouer si plusieurs tips partagent déjà un
    # créneau — on garde le créneau du plus ancien (created_at) et on
    # signale manuellement les autres.
    op.create_unique_constraint(_CONSTRAINT, _TABLE, ["rotation_order"])
