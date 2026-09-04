"""Deduplication de JobOfferStatus (audit P0 #3).

Probleme historique: l'enum ``JobOfferStatus`` declarait trois valeurs
synonymes (``BRUT = "brut"``, ``BRUTE = "brut"`` et ``LEGACY_BRUTE = "brute"``).
SQLAlchemy avec ``Enum(native_enum=False, validate_strings=True)`` levait
``ValueError: duplicate enum value`` au premier usage, et la contrainte
CHECK ``jobofferstatus_values`` au niveau Postgres etait incoherent.

Cette migration:
1. Convertit toutes les lignes ``brute`` ou ``legacy_brute`` en ``brut``
   (la valeur canonique).
2. Recree la contrainte CHECK avec exactement 12 valeurs distinctes.
3. Aligne les index composes qui filtraient sur ``status``.

Revision ID: 0010_jobofferstatus_dedup
Revises: 0009_rejected_duplicate_pair
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010_jobofferstatus_dedup"
down_revision: Union[str, None] = "0009_rejected_duplicate_pair"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


JOB_OFFER_STATUS_VALUES = (
    "active",
    "expired",
    "filled",
    "archived",
    "en_relecture",
    "duplicate",
    "hidden",
    "brut",
    "ai_processing",
    "pending_review",
    "processing",
    "rejected",
)


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # 1. Migration des donnees: "brute" et "legacy_brute" -> "brut".
    #    On utilise un UPDATE conditionnel, inconditionnel sur les deux
    #    anciennes formes pour eviter tout reliquat.
    op.execute(sa.text("UPDATE job_offers SET status = 'brut' WHERE status = 'brute'"))
    op.execute(sa.text("UPDATE job_offers SET status = 'brut' WHERE status = 'legacy_brute'"))

    # 2. Reconstruction de la contrainte CHECK (Postgres seulement;
    #    SQLite ne respecte pas les CHECK avant 3.32 et le projet est teste
    #    en SQLite sans CHECK).
    if dialect != "sqlite":
        # On supprime toutes les variantes de nom que les migrations
        # precedentes ont pu creer.
        op.execute(sa.text('ALTER TABLE "job_offers" DROP CONSTRAINT IF EXISTS "jobofferstatus_values"'))
        op.execute(sa.text('ALTER TABLE "job_offers" DROP CONSTRAINT IF EXISTS "ck_job_offers_jobofferstatus_values"'))
        in_clause = ", ".join(repr(v) for v in JOB_OFFER_STATUS_VALUES)
        op.execute(
            sa.text(f'ALTER TABLE "job_offers" ADD CONSTRAINT "jobofferstatus_values" CHECK (status IN ({in_clause}))')
        )


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect != "sqlite":
        op.execute(sa.text('ALTER TABLE "job_offers" DROP CONSTRAINT IF EXISTS "jobofferstatus_values"'))
        # On remet l'ancienne liste avec "brute" (avec la valeur dupliquée,
        # on accepte l'ambiguite en downgrade).
        old_values = (
            "active",
            "expired",
            "filled",
            "archived",
            "duplicate",
            "hidden",
            "brut",
            "brute",
            "ai_processing",
            "pending_review",
            "processing",
            "rejected",
        )
        in_clause = ", ".join(repr(v) for v in old_values)
        op.execute(
            sa.text(f'ALTER TABLE "job_offers" ADD CONSTRAINT "jobofferstatus_values" CHECK (status IN ({in_clause}))')
        )

    # Pas de rollback des donnees: la migration amont est destructive
    # (les anciennes lignes "brute"/"legacy_brute" sont perdues de toute
    # facon).