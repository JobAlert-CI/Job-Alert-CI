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


# Audit 4, A.4 : nombre d'IDs d'offres conserves en entier dans les details
# d'une ligne d'audit. Au-dela, on journalise un resume (total + echantillon)
# — une ligne d'audit n'a pas a porter 500 UUID (plusieurs Ko de JSON) pour
# une action de masse dont le contexte (filtres, compteurs) suffit.
IDS_SAMPLE_SIZE = 10


def summarize_ids(key: str, ids: list[str], **extra: object) -> dict:
    """Construit un details compact pour une action portant sur une liste d'IDs.

    - <= 10 IDs : la liste entiere est conservee (petites selections utiles
      au debug, ex. envoi personnalise de 3 offres).
    - > 10 IDs : `{"count": N, "sample": [10 premiers], ...}` — le compte et
      l'echantillon suffisent a identifier l'action sans dupliquer plusieurs
      Ko par ligne.

    Les champs supplementaires (status, filtres, compteurs de resultat)
    passes en kwargs sont merges tels quels.
    """
    if len(ids) <= IDS_SAMPLE_SIZE:
        return {key: list(ids), **extra}
    return {
        f"{key}_count": len(ids),
        f"{key}_sample": ids[:IDS_SAMPLE_SIZE],
        **extra,
    }
