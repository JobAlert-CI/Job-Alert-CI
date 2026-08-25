"""categories/series/faq : color_hex remplace hue, suppression icon_name

Même bascule que les filières (0005) pour les tables éditoriales :
article_categories, article_series et faq_categories passent de `hue`
(nom de teinte) à `color_hex` (couleur exacte). icon_name est supprimé
de article_categories.

Revision ID: 0006_editorial_color_hex
Revises: 0005_filiere_color_hex
Create Date: 2026-08-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_editorial_color_hex"
down_revision: Union[str, None] = "0005_filiere_color_hex"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns(inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Les anciennes valeurs non hex ("sky"…) restent en place : le front
    # applique une palette par défaut quand color_hex n'est pas un hex valide.
    with op.batch_alter_table("article_categories") as batch:
        columns = _columns(inspector, "article_categories")
        if "hue" in columns and "color_hex" not in columns:
            batch.alter_column("hue", new_column_name="color_hex", existing_type=sa.String(40))
        if "icon_name" in columns:
            batch.drop_column("icon_name")

    with op.batch_alter_table("article_series") as batch:
        columns = _columns(inspector, "article_series")
        if "hue" in columns and "color_hex" not in columns:
            batch.alter_column("hue", new_column_name="color_hex", existing_type=sa.String(40))

    with op.batch_alter_table("faq_categories") as batch:
        columns = _columns(inspector, "faq_categories")
        if "hue" in columns and "color_hex" not in columns:
            batch.alter_column("hue", new_column_name="color_hex", existing_type=sa.String(40))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    with op.batch_alter_table("article_categories") as batch:
        columns = _columns(inspector, "article_categories")
        if "color_hex" in columns and "hue" not in columns:
            batch.alter_column("color_hex", new_column_name="hue", existing_type=sa.String(16))
        if "icon_name" not in columns:
            batch.add_column(sa.Column("icon_name", sa.String(80), nullable=True))

    with op.batch_alter_table("article_series") as batch:
        columns = _columns(inspector, "article_series")
        if "color_hex" in columns and "hue" not in columns:
            batch.alter_column("color_hex", new_column_name="hue", existing_type=sa.String(16))

    with op.batch_alter_table("faq_categories") as batch:
        columns = _columns(inspector, "faq_categories")
        if "color_hex" in columns and "hue" not in columns:
            batch.alter_column("color_hex", new_column_name="hue", existing_type=sa.String(16))
