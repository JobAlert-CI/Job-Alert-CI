from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class RejectedDuplicatePair(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "rejected_duplicate_pairs"

    offer_a_id: Mapped[str] = mapped_column(
        ForeignKey("job_offers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    offer_b_id: Mapped[str] = mapped_column(
        ForeignKey("job_offers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reviewed_by_admin_id: Mapped[str | None] = mapped_column(
        ForeignKey("administrators.id", ondelete="SET NULL"), nullable=True, index=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "offer_a_id < offer_b_id", name="chk_duplicate_order"
        ),  # evite (A,B) et (B,A) comme deux lignes
    )
