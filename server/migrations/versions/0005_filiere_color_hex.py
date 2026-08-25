"""filiere color_hex remplace hue, suppression icon_name

Revision ID: 0005_filiere_color_hex
Revises: 0004_transactional_email_events
Create Date: 2026-08-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_filiere_color_hex"
down_revision: Union[str, None] = "0004_transactional_email_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns(inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = _columns(inspector, "filieres")

    with op.batch_alter_table("filieres") as batch:
        # hue (nom de teinte type "sky") -> color_hex (couleur exacte).
        # Les anciennes valeurs non hex restent en place : le front applique
        # une palette par defaut quand color_hex n'est pas un hex valide.
        if "hue" in columns and "color_hex" not in columns:
            batch.alter_column("hue", new_column_name="color_hex", existing_type=sa.String(40))
        if "icon_name" in columns:
            batch.drop_column("icon_name")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = _columns(inspector, "filieres")

    with op.batch_alter_table("filieres") as batch:
        if "color_hex" in columns and "hue" not in columns:
            batch.alter_column("color_hex", new_column_name="hue", existing_type=sa.String(16))
        if "icon_name" not in columns:
            batch.add_column(sa.Column("icon_name", sa.String(80), nullable=True))
