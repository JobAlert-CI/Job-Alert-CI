from __future__ import annotations

from pydantic import BaseModel

from schemas.base import TimestampRead

"""Schemas lies aux emails transactionnels (confirmation, renvoi...).

Separes de `schemas/subscriptions.py` car ils concernent le journal
`transactional_email_events`, pas l'abonne lui-meme.
"""


class TransactionalEmailEventRead(TimestampRead):
    """Vue admin d'une tentative d'envoi transactionnel.

    `request_payload`/`response_payload` sont volontairement exclus par
    defaut: ils peuvent contenir des details bruts de la reponse Resend et
    ne doivent etre exposes que via une route admin dediee qui filtre
    explicitement tout secret avant de les renvoyer.
    """

    id: str
    subscriber_id: str | None = None
    purpose: str
    to_email: str
    provider: str
    provider_email_id: str | None = None
    status: str
    attempts: int
    last_error: str | None = None


class EmailSendResultRead(BaseModel):
    """Representation API-safe du resultat d'un envoi (jamais la cle API)."""

    success: bool
    provider: str
    provider_email_id: str | None = None
    error_message: str | None = None


class TransactionalEmailStatsRead(BaseModel):
    """Stats des emails transactionnels (cycle 17) pour /admin/logs.

    Compteurs globaux + fenetre temporelle pour le badge « echecs du jour »
    et les graphiques. `echecs_aujourdhui` utilise la date SERVEUR (UTC) :
    le front affiche tel quel, pas de re-fenetrage client.
    """

    total: int
    par_statut: dict[str, int] = {}
    par_motif: dict[str, int] = {}
    # Echecs sur la fenetre demandee (defaut : 1 jour = « aujourd'hui »).
    echecs_fenetre: int
    # Envois par jour sur la fenetre graphique, separes par statut —
    # le front empile sent/failed/queued en barres.
    par_jour: list[dict] = []
    # fenetre effective (echo).
    days: int
