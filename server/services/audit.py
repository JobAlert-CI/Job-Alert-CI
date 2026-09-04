from __future__ import annotations

from sqlalchemy.orm import Session

from models.admin import AdminActionLog
from models.enums import AdminAction

"""Journalisation des actions admin (audit log).

Chaque action realisee depuis l'espace d'administration (creation,
modification, suppression, envoi, connexion) doit generer une ligne dans
`admin_action_logs`. On ne commit pas ici: l'appelant est deja dans une
transaction (creation/edition de l'objet) et fait un seul `db.commit()`.
"""


def log_admin_action(
    db: Session,
    *,
    admin_id: str,
    action: AdminAction,
    target_table: str,
    target_id: str | None = None,
    details: dict | None = None,
) -> AdminActionLog:
    entry = AdminActionLog(
        admin_id=admin_id,
        action=action,
        target_table=target_table,
        target_id=target_id,
        details=details,
    )
    db.add(entry)
    return entry
