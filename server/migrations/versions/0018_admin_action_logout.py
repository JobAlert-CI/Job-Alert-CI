"""Audit 4, Lot 2 (A.2) : extension de l'enum AdminAction avec LOGOUT.

Revision ID: 0018_admin_action_logout
Revises: 0017_admin_welcome_email
Create Date: 2026-09-09

La deconnexion serveur (POST /api/admin/auth/logout, revocation de la
famille de refresh tokens) est desormais journalisee avec la valeur
`deconnexion` (AdminAction.LOGOUT). La colonne `admin_action_logs.action`
porte une contrainte CHECK (enum non natif) : il faut recree la contrainte
avec la valeur ajoutee, sinon PostgreSQL refuse l'insertion.

Meme pattern eprouve que la 0017 : drop par DEFINITION de contrainte (le
nom reel varie selon l'origine create_all vs alembic), puis recreation
nommee. Sur SQLite (tests), la table est recreee par Base.metadata et la
contrainte y est deja a jour : rien a faire.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0018_admin_action_logout"
down_revision: str | None = "0017_admin_welcome_email"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Valeurs apres cette migration (reflete models.enums.AdminAction).
_ACTION_VALUES = ("creation", "modification", "suppression", "envoi", "connexion", "scraping", "deconnexion")
# Valeurs avant cette migration.
_LEGACY_ACTION_VALUES = _ACTION_VALUES[:-1]

_TABLE = "admin_action_logs"


def _values_sql(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{v}'" for v in values)


def _drop_action_checks() -> None:
    """Supprime la contrainte CHECK sur la colonne action, quelle que soit
    la forme de son nom (create_all OU alembic, avec ou sans suffixe).

    On recupere les contraintes CHECK de la table et on drop celles dont
    la definition porte sur la colonne action (cf. 0017 `_drop_purpose_checks`).
    """
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            "SELECT conname FROM pg_constraint "
            f"WHERE conrelid = '{_TABLE}'::regclass AND contype = 'c' "
            "AND pg_get_constraintdef(oid) ILIKE :pattern"
        ),
        {"pattern": "%action%"},
    ).fetchall()
    for (name,) in rows:
        op.execute(sa.text(f'ALTER TABLE "{_TABLE}" DROP CONSTRAINT IF EXISTS "{name}"'))


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        # SQLite : les tables de test sont recreees par Base.metadata (la
        # contrainte y est deja a jour) — rien a faire.
        return
    _drop_action_checks()
    op.execute(
        sa.text(
            f'ALTER TABLE "{_TABLE}" ADD CONSTRAINT '
            f'"ck_{_TABLE}_adminaction_values" '
            f"CHECK (action IN ({_values_sql(_ACTION_VALUES)}))"
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        return
    # Retirer d'abord les lignes deconnexion (sinon la contrainte echoue).
    op.execute(sa.text(f"DELETE FROM {_TABLE} WHERE action = 'deconnexion'"))
    _drop_action_checks()
    op.execute(
        sa.text(
            f'ALTER TABLE "{_TABLE}" ADD CONSTRAINT '
            f'"ck_{_TABLE}_adminaction_values" '
            f"CHECK (action IN ({_values_sql(_LEGACY_ACTION_VALUES)}))"
        )
    )
