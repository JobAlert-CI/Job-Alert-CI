from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from schemas.base import TimestampRead


class AdminActionLogRead(BaseModel):
    id: str
    admin_id: str
    action: str
    target_table: str
    target_id: str | None = None
    details: dict | None = None
    created_at: datetime


class ContactStatusUpdate(BaseModel):
    status: Literal["new", "read", "replied", "archived"]


class ContactMessageAdminRead(TimestampRead):
    id: str
    full_name: str
    email: str
    subject_code: str
    subject_label: str
    message: str
    status: str
    ip_hash: str | None = None
    user_agent: str | None = None
    replied_at: datetime | None = None


class EventLogRead(TimestampRead):
    """Evenement technique derive du suivi d'ingestion des offres (scraping).

    Ce backend n'a pas de table generique `logs_evenements`: les evenements
    exploitables les plus proches sont les `OfferIngestionEvent` (un par offre
    traitee lors d'un run de scraping), qu'on expose ici sous une forme
    compatible avec un futur écran "Journal des erreurs".
    """

    id: str
    module: str = "scraping"
    niveau: str
    action: str
    offer_id: str | None = None
    source_scrape_run_id: str | None = None
    hash_unique: str | None = None
    raw_url: str | None = None
    message: str | None = None
