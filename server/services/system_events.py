"""Journalisation des evenements systeme (audit 4, G.1 — Lot 6).

`log_system_event()` est le point d'entree unique pour tracer en base les
echecs de tasks Celery, d'envois d'emails et les evenements ops — ce que
les logs worker (Render) ne permettent pas de requeter depuis l'admin.

Principes :
- Ne JAMAIS faire planter l'appelant : on journalise un echec, l'echec de
  la journalisation ne doit pas le masquer (d'ou le try/except large et
  le logger.warning de secours).
- Volume faible : appele uniquement sur les chemins d'echec (severity
  error/warning) ou pour quelques evenements ops ponctuels (info). Les
  compteurs metier des succes vivent deja dans ScrapeRun / EmailDigest /
  AIJob — pas de doublon.
- Pas de secret dans `context` : task_id, digest_id, day_key, compteurs.
"""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from models import SystemEventLog, SystemEventSeverity, SystemEventSource

logger = logging.getLogger(__name__)

# Retention du journal (constate aussi par tasks.maintenance.purge_system_events).
SYSTEM_EVENT_RETENTION_DAYS = 90


def log_system_event(
    *,
    source: SystemEventSource,
    severity: SystemEventSeverity,
    event_type: str,
    message: str,
    context: dict | None = None,
    db: Session | None = None,
    commit: bool = False,
) -> SystemEventLog | None:
    """Ecrit un evenement dans system_event_logs.

    - `db` fourni : la ligne suit la transaction de l'appelant (pattern
      log_admin_action). Si l'appelant rollback, l'event disparait —
      attendu quand l'event decrit une action annulee.
    - `db=None` : transaction dediee (session_scope), pour les chemins
      ou la session de l'appelant est deja compromise (except de task).
    - `commit=True` : force le flush+commit dans la session fournie —
      reserve aux tasks dont la suite releve immediatement (retry).

    Retourne l'event ou None si l'ecriture a echoue (jamais d'exception).
    """
    try:
        entry = SystemEventLog(
            source=source,
            severity=severity,
            event_type=event_type[:120],
            message=str(message)[:2000],
            context=context,
        )
        if db is None:
            from db.session import session_scope

            with session_scope() as session:
                session.add(entry)
        else:
            db.add(entry)
            if commit:
                db.flush()
                db.commit()
        return entry
    except Exception as exc:
        logger.warning("log_system_event a echoue (%s/%s): %s", source.value, event_type, exc)
        return None
