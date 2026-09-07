"""cycle 15 option B: purpose admin_welcome

Revision ID: 0017_admin_welcome_email
Revises: 0016_admin_temp_password_audit
Create Date: 2026-09-07

Nouveau purpose transactionnel `admin_welcome` (email de bienvenue a la
creation d'un compte admin, avec le mot de passe temporaire — option B
validee par l'utilisateur). La colonne `transactional_email_events.purpose`
est un Enum non natif avec contrainte CHECK : il faut recree la contrainte
avec la valeur ajoutee, sinon PostgreSQL refuse l'insertion.

⚠️ Le nom reel de la contrainte varie selon sa creation (create_all posait
`ck_<table>_transactionalemailpurpose_values`, alembic `create_check_-
constraint` peut poser `<table>_<nom>` tronque avec suffixe de hachage) :
on passe par du SQL brut `DROP CONSTRAINT IF EXISTS` sur les DEUX formes
(pattern eprouve de la migration 0002 `_drop_check_if_exists` — op.drop_-
constraint subirait la naming convention du metadata et doublerait le
prefixe).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017_admin_welcome_email"
down_revision: Union[str, None] = "0016_admin_temp_password_audit"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_PURPOSE_VALUES = (
    "confirm_email",
    "resend_confirmation",
    "manage_alert",
    "unsubscribe",
    "reset_password",
    "admin_welcome",
)
_LEGACY_PURPOSE_VALUES = _PURPOSE_VALUES[:-1]

_TABLE = "transactional_email_events"


def _values_sql(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{v}'" for v in values)


def _drop_purpose_checks() -> None:
    """Supprime la contrainte CHECK du purpose, quelle que soit la forme
    de son nom (create_all OU alembic, avec ou sans suffixe de hachage).

    On ne peut pas enumerer les noms a l'avance (hash tronque variable) :
    on recupere les contraintes CHECK de la table et on drop celles dont
    la definition porte sur la colonne purpose.
    """
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            "SELECT conname FROM pg_constraint "
            f"WHERE conrelid = '{_TABLE}'::regclass AND contype = 'c' "
            "AND pg_get_constraintdef(oid) ILIKE :pattern"
        ),
        {"pattern": "%purpose%"},
    ).fetchall()
    for (name,) in rows:
        op.execute(sa.text(f'ALTER TABLE "{_TABLE}" DROP CONSTRAINT IF EXISTS "{name}"'))


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        # SQLite : les tables de test sont recreees par Base.metadata (la
        # contrainte y est deja a jour) — rien a faire.
        return
    _drop_purpose_checks()
    op.execute(
        sa.text(
            f'ALTER TABLE "{_TABLE}" ADD CONSTRAINT '
            f'"ck_{_TABLE}_transactionalemailpurpose_values" '
            f"CHECK (purpose IN ({_values_sql(_PURPOSE_VALUES)}))"
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        return
    # Retirer d'abord les lignes admin_welcome (sinon la contrainte echoue).
    op.execute(sa.text(f"DELETE FROM {_TABLE} WHERE purpose = 'admin_welcome'"))
    _drop_purpose_checks()
    op.execute(
        sa.text(
            f'ALTER TABLE "{_TABLE}" ADD CONSTRAINT '
            f'"ck_{_TABLE}_transactionalemailpurpose_values" '
            f"CHECK (purpose IN ({_values_sql(_LEGACY_PURPOSE_VALUES)}))"
        )
    )
