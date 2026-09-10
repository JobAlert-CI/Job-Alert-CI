from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base, UUIDPrimaryKeyMixin
from models.enums import SystemEventSeverity, SystemEventSource
from models.types import enum_column

"""Journal des evenements systeme (audit 4, G.1).

Comble le trou central d'observabilite : les echecs de tasks Celery
(digests, emails de confirmation, maintenance), les echecs d'envoi en
masse et les evenements ops ne laissaient RIEN en base — uniquement des
lignes de log worker (Render), non requetables depuis l'admin.

Volume faible par construction : le helper log_system_event() n'est
appele que sur les chemins d'echec (et quelques evenements ops info),
jamais sur les succes (les compteurs metier existent deja via
ScrapeRun/EmailDigest/AIJob). Retention purgee a 90 jours (tache
maintenance purge_system_events, cf. Lot 6).
"""


class SystemEventLog(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "system_event_logs"

    # Origine de l'evenement : univers technique qui a echoue/emis.
    source: Mapped[SystemEventSource] = mapped_column(enum_column(SystemEventSource), index=True, nullable=False)
    severity: Mapped[SystemEventSeverity] = mapped_column(enum_column(SystemEventSeverity), index=True, nullable=False)
    # Type fin et stable (ex. task_failure, digest_send_failed, queue_depth).
    event_type: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    # Contexte debug JSON (task_id, digest_id, day_key...) — sans secret.
    context: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    __table_args__ = (
        # Les filtres de l'endpoint /admin/system/events combinent
        # source+severity et date ; l'ordre (source, created_at) sert la
        # vue par defaut "n derniers evenements d'une source".
        Index("ix_system_event_logs_source_created_at", "source", "created_at"),
        Index("ix_system_event_logs_severity_created_at", "severity", "created_at"),
    )
