"""Cascade de matching T0-T5 : match_tier (digest) et match_kind (offer).

Ajoute deux colonnes strictement additives pour tracer le palier de
selection utilise par le digest quotidien :

- `email_digests.match_tier` (String(8), default 'T0', index) : palier
  final atteint. Valeurs : T0 (strict), T1 (filiere secondaire),
  T2 (contrat ouvert), T3 (fraicheur elargie), T4 (experience elargie),
  T5 (ville fallback). Defaut T0 = comportement actuel du pipeline.
- `email_digest_offers.match_kind` (String(32), default 'primary') :
  facon dont chaque offre a ete recuperee. Valeurs : 'primary' (T0),
  'secondary' (T1), 'fallback_contract' (T2), 'fallback_freshness' (T3),
  'fallback_experience' (T4), 'fallback_city' (T5). Defaut 'primary'.

Ces colonnes sont lues par l'email digest pour distinguer la section
"Selectionnees pour vous" de la section "Pourrait aussi vous interesser"
(voir tranche 4).

Revision ID: 0007_digest_cascade_match_tier
Revises: 0006_editorial_color_hex
Create Date: 2026-08-28
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007_digest_cascade_match_tier"
down_revision: Union[str, None] = "0006_editorial_color_hex"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns(inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    with op.batch_alter_table("email_digests") as batch:
        columns = _columns(inspector, "email_digests")
        if "match_tier" not in columns:
            # server_default='T0' pour que les lignes existantes heritent du
            # palier strict (comportement du pipeline avant cette migration).
            batch.add_column(
                sa.Column(
                    "match_tier",
                    sa.String(8),
                    nullable=False,
                    server_default=sa.text("'T0'"),
                )
            )
            batch.create_index("ix_email_digests_match_tier", ["match_tier"])

    with op.batch_alter_table("email_digest_offers") as batch:
        columns = _columns(inspector, "email_digest_offers")
        if "match_kind" not in columns:
            batch.add_column(
                sa.Column(
                    "match_kind",
                    sa.String(32),
                    nullable=False,
                    server_default=sa.text("'primary'"),
                )
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    with op.batch_alter_table("email_digest_offers") as batch:
        columns = _columns(inspector, "email_digest_offers")
        if "match_kind" in columns:
            batch.drop_column("match_kind")

    with op.batch_alter_table("email_digests") as batch:
        columns = _columns(inspector, "email_digests")
        if "match_tier" in columns:
            batch.drop_index("ix_email_digests_match_tier")
            batch.drop_column("match_tier")
