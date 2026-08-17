"""ingestion ai pipeline

Revision ID: 0002_ingestion_ai_pipeline
Revises: 0001_initial_schema
Create Date: 2026-08-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_ingestion_ai_pipeline"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


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
        "brute",
        "processing",
        "rejected",
    )
    ai_offer_status_values = ("pending", "processing", "skipped", "noop", "failed")
    ai_job_trigger_values = ("immediate", "sweep", "manual")
    ai_job_status_values = ("pending", "running", "completed", "failed", "skipped", "locked")

    if dialect != "sqlite":
        _drop_check_if_exists("job_offers", "jobofferstatus_values", "ck_job_offers_jobofferstatus_values")
        op.create_check_constraint("jobofferstatus_values", "job_offers", f"status IN ({', '.join(repr(v) for v in job_status_values)})")

    scrape_run_columns = _columns(inspector, "scrape_runs")
    if dialect != "sqlite":
        op.alter_column("scrape_runs", "triggered_by", existing_type=sa.String(length=80), type_=sa.String(length=160), existing_nullable=False)
    if "external_batch_id" not in scrape_run_columns:
        op.add_column("scrape_runs", sa.Column("external_batch_id", sa.String(length=36), nullable=True))
    if "run_reference" not in scrape_run_columns:
        op.add_column("scrape_runs", sa.Column("run_reference", sa.String(length=255), nullable=True))
    if "scraped_at" not in scrape_run_columns:
        op.add_column("scrape_runs", sa.Column("scraped_at", sa.DateTime(timezone=True), nullable=True))
    if "ix_scrape_runs_external_batch_id" not in _indexes(inspector, "scrape_runs"):
        op.create_index(op.f("ix_scrape_runs_external_batch_id"), "scrape_runs", ["external_batch_id"], unique=True)

    tables = set(inspector.get_table_names())
    if "ai_processing_jobs" not in tables:
        op.create_table(
            "ai_processing_jobs",
        sa.Column("scrape_run_id", sa.String(length=36), nullable=True),
        sa.Column("source_id", sa.String(length=36), nullable=True),
        sa.Column("trigger_type", sa.Enum(*ai_job_trigger_values, name="aiprocessingjobtrigger_values", native_enum=False, length=80, create_constraint=True), nullable=False),
        sa.Column("status", sa.Enum(*ai_job_status_values, name="aiprocessingjobstatus_values", native_enum=False, length=80, create_constraint=True), nullable=False),
        sa.Column("offers_total", sa.Integer(), nullable=False),
        sa.Column("offers_processed", sa.Integer(), nullable=False),
        sa.Column("offers_activated", sa.Integer(), nullable=False),
        sa.Column("offers_rejected", sa.Integer(), nullable=False),
        sa.Column("offers_skipped", sa.Integer(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("celery_task_id", sa.String(length=255), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.CheckConstraint("offers_total >= 0", name=op.f("ck_ai_processing_jobs_ai_processing_job_offers_total_positive")),
        sa.CheckConstraint("offers_processed >= 0", name=op.f("ck_ai_processing_jobs_ai_processing_job_offers_processed_positive")),
        sa.CheckConstraint("offers_activated >= 0", name=op.f("ck_ai_processing_jobs_ai_processing_job_offers_activated_positive")),
        sa.CheckConstraint("offers_rejected >= 0", name=op.f("ck_ai_processing_jobs_ai_processing_job_offers_rejected_positive")),
        sa.CheckConstraint("offers_skipped >= 0", name=op.f("ck_ai_processing_jobs_ai_processing_job_offers_skipped_positive")),
        sa.ForeignKeyConstraint(["scrape_run_id"], ["scrape_runs.id"], name=op.f("fk_ai_processing_jobs_scrape_run_id_scrape_runs"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_id"], ["sources.id"], name=op.f("fk_ai_processing_jobs_source_id_sources"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ai_processing_jobs")),
        )
    ai_indexes = _indexes(sa.inspect(bind), "ai_processing_jobs")
    if "ix_ai_processing_jobs_celery_task_id" not in ai_indexes:
        op.create_index(op.f("ix_ai_processing_jobs_celery_task_id"), "ai_processing_jobs", ["celery_task_id"], unique=False)
    if "ix_ai_processing_jobs_scrape_run_id" not in ai_indexes:
        op.create_index(op.f("ix_ai_processing_jobs_scrape_run_id"), "ai_processing_jobs", ["scrape_run_id"], unique=False)
    if "ix_ai_processing_jobs_source_id" not in ai_indexes:
        op.create_index(op.f("ix_ai_processing_jobs_source_id"), "ai_processing_jobs", ["source_id"], unique=False)
    if "ix_ai_processing_jobs_status" not in ai_indexes:
        op.create_index(op.f("ix_ai_processing_jobs_status"), "ai_processing_jobs", ["status"], unique=False)

    job_offer_columns = _columns(sa.inspect(bind), "job_offers")
    if "source_scrape_run_id" not in job_offer_columns:
        op.add_column("job_offers", sa.Column("source_scrape_run_id", sa.String(length=36), nullable=True))
    if "ai_processing_job_id" not in job_offer_columns:
        op.add_column("job_offers", sa.Column("ai_processing_job_id", sa.String(length=36), nullable=True))
    if "ai_status" not in job_offer_columns:
        op.add_column("job_offers", sa.Column("ai_status", sa.Enum(*ai_offer_status_values, name="aiofferstatus_values", native_enum=False, length=80, create_constraint=True), nullable=False, server_default="pending"))
    if "ai_provider" not in job_offer_columns:
        op.add_column("job_offers", sa.Column("ai_provider", sa.String(length=120), nullable=True))
    if "ai_model" not in job_offer_columns:
        op.add_column("job_offers", sa.Column("ai_model", sa.String(length=160), nullable=True))
    if "ai_task_id" not in job_offer_columns:
        op.add_column("job_offers", sa.Column("ai_task_id", sa.String(length=255), nullable=True))
    if "ai_error_message" not in job_offer_columns:
        op.add_column("job_offers", sa.Column("ai_error_message", sa.Text(), nullable=True))
    if "ai_confidence" not in job_offer_columns:
        op.add_column("job_offers", sa.Column("ai_confidence", sa.Float(), nullable=True))
    if "ai_processed_at" not in job_offer_columns:
        op.add_column("job_offers", sa.Column("ai_processed_at", sa.DateTime(timezone=True), nullable=True))

    if dialect != "sqlite":
        foreign_keys = {fk["name"] for fk in sa.inspect(bind).get_foreign_keys("job_offers")}
        if op.f("fk_job_offers_source_scrape_run_id_source_scrape_runs") not in foreign_keys:
            op.create_foreign_key(op.f("fk_job_offers_source_scrape_run_id_source_scrape_runs"), "job_offers", "source_scrape_runs", ["source_scrape_run_id"], ["id"], ondelete="SET NULL")
        if op.f("fk_job_offers_ai_processing_job_id_ai_processing_jobs") not in foreign_keys:
            op.create_foreign_key(op.f("fk_job_offers_ai_processing_job_id_ai_processing_jobs"), "job_offers", "ai_processing_jobs", ["ai_processing_job_id"], ["id"], ondelete="SET NULL")
    job_indexes = _indexes(sa.inspect(bind), "job_offers")
    if "ix_job_offers_source_scrape_run_id" not in job_indexes:
        op.create_index(op.f("ix_job_offers_source_scrape_run_id"), "job_offers", ["source_scrape_run_id"], unique=False)
    if "ix_job_offers_ai_processing_job_id" not in job_indexes:
        op.create_index(op.f("ix_job_offers_ai_processing_job_id"), "job_offers", ["ai_processing_job_id"], unique=False)
    if "ix_job_offers_ai_status" not in job_indexes:
        op.create_index(op.f("ix_job_offers_ai_status"), "job_offers", ["ai_status"], unique=False)
    if "ix_job_offers_ai_task_id" not in job_indexes:
        op.create_index(op.f("ix_job_offers_ai_task_id"), "job_offers", ["ai_task_id"], unique=False)

    if dialect != "sqlite" and "ai_status" not in job_offer_columns:
        op.alter_column("job_offers", "ai_status", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    op.drop_index(op.f("ix_job_offers_ai_task_id"), table_name="job_offers")
    op.drop_index(op.f("ix_job_offers_ai_status"), table_name="job_offers")
    op.drop_index(op.f("ix_job_offers_ai_processing_job_id"), table_name="job_offers")
    op.drop_index(op.f("ix_job_offers_source_scrape_run_id"), table_name="job_offers")
    op.drop_constraint(op.f("fk_job_offers_ai_processing_job_id_ai_processing_jobs"), "job_offers", type_="foreignkey")
    op.drop_constraint(op.f("fk_job_offers_source_scrape_run_id_source_scrape_runs"), "job_offers", type_="foreignkey")
    for column_name in (
        "ai_processed_at",
        "ai_confidence",
        "ai_error_message",
        "ai_task_id",
        "ai_model",
        "ai_provider",
        "ai_status",
        "ai_processing_job_id",
        "source_scrape_run_id",
    ):
        op.drop_column("job_offers", column_name)

    op.drop_index(op.f("ix_ai_processing_jobs_status"), table_name="ai_processing_jobs")
    op.drop_index(op.f("ix_ai_processing_jobs_source_id"), table_name="ai_processing_jobs")
    op.drop_index(op.f("ix_ai_processing_jobs_scrape_run_id"), table_name="ai_processing_jobs")
    op.drop_index(op.f("ix_ai_processing_jobs_celery_task_id"), table_name="ai_processing_jobs")
    op.drop_table("ai_processing_jobs")

    op.drop_index(op.f("ix_scrape_runs_external_batch_id"), table_name="scrape_runs")
    op.drop_column("scrape_runs", "scraped_at")
    op.drop_column("scrape_runs", "run_reference")
    op.drop_column("scrape_runs", "external_batch_id")
    if dialect != "sqlite":
        op.alter_column("scrape_runs", "triggered_by", existing_type=sa.String(length=160), type_=sa.String(length=80), existing_nullable=False)

    if dialect != "sqlite":
        op.drop_constraint("jobofferstatus_values", "job_offers", type_="check")
    old_values = ("active", "expired", "filled", "archived", "duplicate", "hidden")
    op.create_check_constraint("jobofferstatus_values", "job_offers", f"status IN ({', '.join(repr(v) for v in old_values)})")
