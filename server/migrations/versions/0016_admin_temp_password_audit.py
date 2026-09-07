"""cycle 15: admins — mot de passe temporaire + journal preserve

Revision ID: 0016_admin_temp_password_audit
Revises: 0015_daily_tips_multiple
Create Date: 2026-09-07

Deux changements demandes explicitement (cycle 15):
1. `administrators.must_change_password` (bool, defaut 0) : un compte cree
   sans mot de passe recoit un temporaire et DOIT le changer a la premiere
   connexion (flag remis a 0 par PUT /api/admin/auth/me/password).
2. FK `admin_action_logs.admin_id` : CASCADE -> SET NULL + colonne nullable.
   Supprimer un administrateur ne doit JAMAIS effacer ses entrees du journal
   d'activite : les lignes restent, avec admin_id NULL (auteur anonyme).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016_admin_temp_password_audit"
down_revision: Union[str, None] = "0015_daily_tips_multiple"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Flag mot de passe temporaire.
    with op.batch_alter_table("administrators") as batch:
        batch.add_column(sa.Column("must_change_password", sa.Boolean(), server_default="0", nullable=False))

    # 2) Journal preserve : la FK CASCADE devient SET NULL.
    #    batch_alter_table gere SQLite (recreation de table) ET Postgres.
    with op.batch_alter_table("admin_action_logs") as batch:
        batch.drop_constraint("fk_admin_action_logs_admin_id_administrators", type_="foreignkey")
        batch.alter_column("admin_id", existing_type=sa.String(36), nullable=True)
        batch.create_foreign_key(
            "fk_admin_action_logs_admin_id_administrators",
            "administrators",
            ["admin_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    # Retour arriere : les lignes orphelines doivent etre supprimees avant
    # de retablir NOT NULL (sinon la contrainte echoue).
    with op.batch_alter_table("admin_action_logs") as batch:
        batch.drop_constraint("fk_admin_action_logs_admin_id_administrators", type_="foreignkey")
        batch.alter_column("admin_id", existing_type=sa.String(36), nullable=False)
        batch.create_foreign_key(
            "fk_admin_action_logs_admin_id_administrators",
            "administrators",
            ["admin_id"],
            ["id"],
            ondelete="CASCADE",
        )

    with op.batch_alter_table("administrators") as batch:
        batch.drop_column("must_change_password")
