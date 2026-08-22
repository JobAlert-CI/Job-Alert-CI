"""ai module keys jobs results

Revision ID: 0003_ai_module_keys_jobs_results
Revises: 0002_ingestion_ai_pipeline
Create Date: 2026-08-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_ai_module_keys_jobs_results"
down_revision: Union[str, None] = "0002_ingestion_ai_pipeline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tables(inspector) -> set[str]:
    return set(inspector.get_table_names())


def _columns(inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def _indexes(inspector, table_name: str) -> set[str]:
    return {index["name"] for index in inspector.get_indexes(table_name)}


def _drop_check_if_exists(table_name: str, *names: str) -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    for name in names:
        op.execute(sa.text(f'ALTER TABLE "{table_name}" DROP CONSTRAINT IF EXISTS "{name}"'))


def _enum(*values: str, name: str) -> sa.Enum:
    return sa.Enum(*values, name=name, native_enum=False, length=80, create_constraint=True)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    dialect = bind.dialect.name

    job_status_values = (
        "active",
        "expired",
        "filled",
        "archived",
        "duplicate",
        "hidden",
        "brut",
        "ai_processing",
        "pending_review",
        "brute",
        "processing",
        "rejected",
    )
    if dialect != "sqlite":
        _drop_check_if_exists("job_offers", "jobofferstatus_values", "ck_job_offers_jobofferstatus_values")
        op.create_check_constraint("jobofferstatus_values", "job_offers", f"status IN ({', '.join(repr(v) for v in job_status_values)})")

    job_offer_columns = _columns(inspector, "job_offers")
    for column in (
        sa.Column("ai_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ai_last_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("requires_admin_review", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("suggested_filiere_payload", sa.JSON(), nullable=True),
    ):
        if column.name not in job_offer_columns:
            op.add_column("job_offers", column)
    if dialect != "sqlite":
        _drop_check_if_exists(
            "job_offers",
            "job_offer_ai_attempts_positive",
            "job_offer_ai_confidence_range",
            "ck_job_offers_job_offer_ai_attempts_positive",
            "ck_job_offers_job_offer_ai_confidence_range",
        )
        op.create_check_constraint("job_offer_ai_attempts_positive", "job_offers", "ai_attempts >= 0")
        op.create_check_constraint("job_offer_ai_confidence_range", "job_offers", "ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1)")
        op.alter_column("job_offers", "ai_attempts", server_default=None)
        op.alter_column("job_offers", "requires_admin_review", server_default=None)
    if "ix_job_offers_requires_admin_review" not in _indexes(sa.inspect(bind), "job_offers"):
        op.create_index(op.f("ix_job_offers_requires_admin_review"), "job_offers", ["requires_admin_review"], unique=False)

    tables = _tables(sa.inspect(bind))
    if "ai_api_keys" not in tables:
        op.create_table(
            "ai_api_keys",
            sa.Column("name", sa.String(length=160), nullable=False),
            sa.Column("provider_type", _enum("openai_compatible", "openai", "mistral", "groq", "anthropic", "google_gemini", "ollama", "custom_http", "mock", name="aiprovidertype_values"), nullable=False),
            sa.Column("base_url", sa.String(length=1000), nullable=True),
            sa.Column("models", sa.JSON(), nullable=True),
            sa.Column("api_key_encrypted", sa.Text(), nullable=False),
            sa.Column("api_key_last4", sa.String(length=8), nullable=True),
            sa.Column("priority", sa.Integer(), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("max_concurrent_requests", sa.Integer(), nullable=False),
            sa.Column("timeout_seconds", sa.Integer(), nullable=False),
            sa.Column("max_retries", sa.Integer(), nullable=False),
            sa.Column("retry_backoff_seconds", sa.Integer(), nullable=False),
            sa.Column("rate_limit_per_minute", sa.Integer(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_error_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("disabled_until", sa.DateTime(timezone=True), nullable=True),
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.CheckConstraint("priority >= 0", name=op.f("ck_ai_api_keys_ai_api_key_priority_positive")),
            sa.CheckConstraint("max_concurrent_requests >= 1", name=op.f("ck_ai_api_keys_ai_api_key_max_concurrent_positive")),
            sa.CheckConstraint("timeout_seconds >= 1", name=op.f("ck_ai_api_keys_ai_api_key_timeout_positive")),
            sa.CheckConstraint("max_retries >= 0", name=op.f("ck_ai_api_keys_ai_api_key_max_retries_positive")),
            sa.CheckConstraint("retry_backoff_seconds >= 0", name=op.f("ck_ai_api_keys_ai_api_key_retry_backoff_positive")),
            sa.CheckConstraint("rate_limit_per_minute IS NULL OR rate_limit_per_minute >= 1", name=op.f("ck_ai_api_keys_ai_api_key_rate_limit_positive")),
            sa.PrimaryKeyConstraint("id", name=op.f("pk_ai_api_keys")),
        )
    ai_key_indexes = _indexes(sa.inspect(bind), "ai_api_keys")
    for index_name, columns in {
        "ix_ai_api_keys_provider_type": ["provider_type"],
        "ix_ai_api_keys_priority": ["priority"],
        "ix_ai_api_keys_is_active": ["is_active"],
        "ix_ai_api_keys_last_error_at": ["last_error_at"],
        "ix_ai_api_keys_disabled_until": ["disabled_until"],
        "ix_ai_api_keys_deleted_at": ["deleted_at"],
        "ix_ai_api_keys_selection": ["is_active", "priority", "last_error_at", "created_at"],
    }.items():
        if index_name not in ai_key_indexes:
            op.create_index(index_name, "ai_api_keys", columns, unique=False)

    if "ai_jobs" not in _tables(sa.inspect(bind)):
        op.create_table(
            "ai_jobs",
            sa.Column("trigger_type", _enum("auto", "manual", "delayed_check", "sweep", name="aijobtrigger_values"), nullable=False),
            sa.Column("status", _enum("pending", "running", "completed", "partial_failure", "failed", name="aijobstatus_values"), nullable=False),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("offers_total", sa.Integer(), nullable=False),
            sa.Column("offers_activated", sa.Integer(), nullable=False),
            sa.Column("offers_pending_review", sa.Integer(), nullable=False),
            sa.Column("offers_rejected", sa.Integer(), nullable=False),
            sa.Column("offers_reprocess_required", sa.Integer(), nullable=False),
            sa.Column("primary_api_key_id", sa.String(length=36), nullable=True),
            sa.Column("fallback_count", sa.Integer(), nullable=False),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("celery_task_id", sa.String(length=255), nullable=True),
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.CheckConstraint("offers_total >= 0", name=op.f("ck_ai_jobs_ai_job_offers_total_positive")),
            sa.CheckConstraint("offers_activated >= 0", name=op.f("ck_ai_jobs_ai_job_offers_activated_positive")),
            sa.CheckConstraint("offers_pending_review >= 0", name=op.f("ck_ai_jobs_ai_job_offers_pending_review_positive")),
            sa.CheckConstraint("offers_rejected >= 0", name=op.f("ck_ai_jobs_ai_job_offers_rejected_positive")),
            sa.CheckConstraint("offers_reprocess_required >= 0", name=op.f("ck_ai_jobs_ai_job_offers_reprocess_required_positive")),
            sa.CheckConstraint("fallback_count >= 0", name=op.f("ck_ai_jobs_ai_job_fallback_count_positive")),
            sa.ForeignKeyConstraint(["primary_api_key_id"], ["ai_api_keys.id"], name=op.f("fk_ai_jobs_primary_api_key_id_ai_api_keys"), ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id", name=op.f("pk_ai_jobs")),
        )
    ai_job_indexes = _indexes(sa.inspect(bind), "ai_jobs")
    for index_name, columns in {
        "ix_ai_jobs_trigger_type": ["trigger_type"],
        "ix_ai_jobs_status": ["status"],
        "ix_ai_jobs_primary_api_key_id": ["primary_api_key_id"],
        "ix_ai_jobs_celery_task_id": ["celery_task_id"],
    }.items():
        if index_name not in ai_job_indexes:
            op.create_index(index_name, "ai_jobs", columns, unique=False)

    if "ai_offer_attempts" not in _tables(sa.inspect(bind)):
        op.create_table(
            "ai_offer_attempts",
            sa.Column("offer_id", sa.String(length=36), nullable=False),
            sa.Column("ai_job_id", sa.String(length=36), nullable=True),
            sa.Column("ai_api_key_id", sa.String(length=36), nullable=True),
            sa.Column("attempt_number", sa.Integer(), nullable=False),
            sa.Column("status", _enum("pending", "success", "invalid", "failed", "review_required", name="aiofferattemptstatus_values"), nullable=False),
            sa.Column("error_type", _enum("timeout", "network_error", "rate_limit", "authentication_error", "quota_exceeded", "model_not_found", "server_error", "invalid_json_response", "content_policy_error", "unknown_error", name="aierrortype_values"), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("response_metadata", sa.JSON(), nullable=True),
            sa.Column("duration_ms", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.CheckConstraint("attempt_number >= 1", name=op.f("ck_ai_offer_attempts_ai_offer_attempt_number_positive")),
            sa.CheckConstraint("duration_ms IS NULL OR duration_ms >= 0", name=op.f("ck_ai_offer_attempts_ai_offer_attempt_duration_positive")),
            sa.ForeignKeyConstraint(["ai_api_key_id"], ["ai_api_keys.id"], name=op.f("fk_ai_offer_attempts_ai_api_key_id_ai_api_keys"), ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["ai_job_id"], ["ai_jobs.id"], name=op.f("fk_ai_offer_attempts_ai_job_id_ai_jobs"), ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["offer_id"], ["job_offers.id"], name=op.f("fk_ai_offer_attempts_offer_id_job_offers"), ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id", name=op.f("pk_ai_offer_attempts")),
        )
    attempt_indexes = _indexes(sa.inspect(bind), "ai_offer_attempts")
    for index_name, columns in {
        "ix_ai_offer_attempts_offer_id": ["offer_id"],
        "ix_ai_offer_attempts_ai_job_id": ["ai_job_id"],
        "ix_ai_offer_attempts_ai_api_key_id": ["ai_api_key_id"],
        "ix_ai_offer_attempts_status": ["status"],
    }.items():
        if index_name not in attempt_indexes:
            op.create_index(index_name, "ai_offer_attempts", columns, unique=False)

    if "ai_alerts" not in _tables(sa.inspect(bind)):
        op.create_table(
            "ai_alerts",
            sa.Column("job_id", sa.String(length=36), nullable=True),
            sa.Column("type", sa.String(length=120), nullable=False),
            sa.Column("severity", _enum("info", "warning", "error", "critical", name="aialertseverity_values"), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("payload", sa.JSON(), nullable=True),
            sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("acknowledged_by_admin_id", sa.String(length=36), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.ForeignKeyConstraint(["acknowledged_by_admin_id"], ["administrators.id"], name=op.f("fk_ai_alerts_acknowledged_by_admin_id_administrators"), ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["job_id"], ["ai_jobs.id"], name=op.f("fk_ai_alerts_job_id_ai_jobs"), ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id", name=op.f("pk_ai_alerts")),
        )
    alert_indexes = _indexes(sa.inspect(bind), "ai_alerts")
    for index_name, columns in {
        "ix_ai_alerts_job_id": ["job_id"],
        "ix_ai_alerts_type": ["type"],
        "ix_ai_alerts_severity": ["severity"],
    }.items():
        if index_name not in alert_indexes:
            op.create_index(index_name, "ai_alerts", columns, unique=False)

    if "ai_filiere_suggestions" not in _tables(sa.inspect(bind)):
        op.create_table(
            "ai_filiere_suggestions",
            sa.Column("offer_id", sa.String(length=36), nullable=True),
            sa.Column("job_id", sa.String(length=36), nullable=True),
            sa.Column("code", sa.String(length=120), nullable=False),
            sa.Column("label", sa.String(length=160), nullable=False),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("status", _enum("pending", "approved", "rejected", name="aifilieresuggestionstatus_values"), nullable=False),
            sa.Column("reviewed_by_admin_id", sa.String(length=36), nullable=True),
            sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["job_id"], ["ai_jobs.id"], name=op.f("fk_ai_filiere_suggestions_job_id_ai_jobs"), ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["offer_id"], ["job_offers.id"], name=op.f("fk_ai_filiere_suggestions_offer_id_job_offers"), ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["reviewed_by_admin_id"], ["administrators.id"], name=op.f("fk_ai_filiere_suggestions_reviewed_by_admin_id_administrators"), ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id", name=op.f("pk_ai_filiere_suggestions")),
        )
    suggestion_indexes = _indexes(sa.inspect(bind), "ai_filiere_suggestions")
    for index_name, columns in {
        "ix_ai_filiere_suggestions_offer_id": ["offer_id"],
        "ix_ai_filiere_suggestions_job_id": ["job_id"],
        "ix_ai_filiere_suggestions_status": ["status"],
    }.items():
        if index_name not in suggestion_indexes:
            op.create_index(index_name, "ai_filiere_suggestions", columns, unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    for table_name in ("ai_filiere_suggestions", "ai_alerts", "ai_offer_attempts", "ai_jobs", "ai_api_keys"):
        if table_name in _tables(sa.inspect(bind)):
            op.drop_table(table_name)

    if "ix_job_offers_requires_admin_review" in _indexes(sa.inspect(bind), "job_offers"):
        op.drop_index(op.f("ix_job_offers_requires_admin_review"), table_name="job_offers")
    for column_name in ("suggested_filiere_payload", "requires_admin_review", "ai_last_attempt_at", "ai_attempts"):
        if column_name in _columns(sa.inspect(bind), "job_offers"):
            op.drop_column("job_offers", column_name)

    if dialect != "sqlite":
        _drop_check_if_exists("job_offers", "jobofferstatus_values", "ck_job_offers_jobofferstatus_values")
        old_values = ("active", "expired", "filled", "archived", "duplicate", "hidden", "brute", "processing", "rejected")
        op.create_check_constraint("jobofferstatus_values", "job_offers", f"status IN ({', '.join(repr(v) for v in old_values)})")
