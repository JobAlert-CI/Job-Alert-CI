"""transactional email events

Revision ID: 0004_transactional_email_events
Revises: 0003_ai_module_keys_jobs_results
Create Date: 2026-08-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_transactional_email_events"
down_revision: Union[str, None] = "0003_ai_module_keys_jobs_results"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tables(inspector) -> set[str]:
    return set(inspector.get_table_names())


def _indexes(inspector, table_name: str) -> set[str]:
    return {index["name"] for index in inspector.get_indexes(table_name)}


def _enum(*values: str, name: str) -> sa.Enum:
    """Meme convention que models/types.py::enum_column: CHECK, pas d'ENUM natif."""

    return sa.Enum(*values, name=name, native_enum=False, length=80, create_constraint=True)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "transactional_email_events" not in _tables(inspector):
        op.create_table(
            "transactional_email_events",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("subscriber_id", sa.String(length=36), nullable=True),
            sa.Column(
                "purpose",
                _enum(
                    "confirm_email",
                    "resend_confirmation",
                    "manage_alert",
                    "unsubscribe",
                    name="transactionalemailpurpose_values",
                ),
                nullable=False,
            ),
            sa.Column("to_email", sa.String(length=320), nullable=False),
            sa.Column("provider", sa.String(length=40), server_default="resend", nullable=False),
            sa.Column("provider_email_id", sa.String(length=255), nullable=True),
            sa.Column(
                "status",
                _enum("queued", "sent", "failed", name="transactionalemailstatus_values"),
                server_default="queued",
                nullable=False,
            ),
            sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
            sa.Column("last_error", sa.Text(), nullable=True),
            sa.Column("request_payload", sa.JSON(), nullable=True),
            sa.Column("response_payload", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(
                ["subscriber_id"],
                ["subscribers.id"],
                name=op.f("fk_transactional_email_events_subscriber_id_subscribers"),
                ondelete="SET NULL",
            ),
            sa.PrimaryKeyConstraint("id", name=op.f("pk_transactional_email_events")),
            sa.CheckConstraint(
                "attempts >= 0",
                name=op.f("ck_transactional_email_events_attempts_positive"),
            ),
        )

    existing_indexes = _indexes(sa.inspect(bind), "transactional_email_events")
    for index_name, columns in {
        "ix_transactional_email_events_subscriber_id": ["subscriber_id"],
        "ix_transactional_email_events_purpose": ["purpose"],
        "ix_transactional_email_events_status": ["status"],
        "ix_transactional_email_events_to_email": ["to_email"],
        "ix_transactional_email_events_created_at": ["created_at"],
    }.items():
        if index_name not in existing_indexes:
            op.create_index(index_name, "transactional_email_events", columns, unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    if "transactional_email_events" in _tables(sa.inspect(bind)):
        op.drop_table("transactional_email_events")