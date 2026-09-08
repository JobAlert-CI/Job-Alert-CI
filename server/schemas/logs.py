from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from schemas.base import TimestampRead

class AdminActionLogRead(BaseModel):
    id: str
    # Cycle 15: nullable — supprimer un admin preserve ses entrees du
    # journal (FK SET NULL) : les lignes orphelines portent admin_id NULL.
    admin_id: str | None = None
    action: str
    target_table: str
    target_id: str | None = None
    details: dict | None = None
    created_at: datetime


class AuditLogPageRead(BaseModel):
    """Enveloppe paginee du journal d'audit (cycle 16).

    Avant : liste plate sans total (le front paginait a l'aveugle via
    l'heuristique len == limit). Le total exact permet une vraie
    pagination servable et les compteurs globaux (G).
    """

    items: list[AdminActionLogRead]
    total: int
    limit: int
    offset: int


class AuditStatsRead(BaseModel):
    """Stats du journal d'activite (cycle 16) : compteurs globaux + axe
    par jour (chart H) + top auteurs (chart I).

    `distinct_admins` inclut les lignes orphelines (admin_id NULL apres
    la suppression d'un admin, FK SET NULL cycle 15) : on distingue
    `authors_known` (admin encore en base) de `orphan_rows`.
    """

    total: int
    by_action: dict[str, int] = {}
    par_jour: list[dict] = []
    top_auteurs: list[dict] = []


class ContactStatusUpdate(BaseModel):
    # Cycle 17 : "spam" devient assignable (demande explicite) — le filtre GET
    # l'acceptait deja via les aliases, la creation de statut etait asymetrique.
    status: Literal["new", "read", "replied", "archived", "spam"]


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

    Ce backend n'a pas une table generique `logs_evenements`: les evenements
    exploitables les plus proches sont les `OfferIngestionEvent` (un par offre
    traitee lors d'un run de scraping), qu'on expose ici sous une forme
    compatible avec un futur ecran "Journal des erreurs".
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


class LogsStatsRead(BaseModel):
    """Stats du journal technique (cycle 17) : evenements d'ingestion +
    messages de contact, pour les compteurs et graphiques de /admin/logs.

    Les compteurs `events_*` sont globaux (toutes dates) sauf mention
    contraire ; les axes `events_par_jour`/`events_par_action` respectent la
    fenetre `days`. Cote contacts, on expose le vocabulaire API (new, read,
    replied, archived, spam) — PAS les valeurs internes stockees.
    """

    # Evenements d'ingestion (toutes dates confondues).
    events_total: int
    events_errors: int
    events_warnings: int
    events_duplicates: int
    # Axes sur la fenetre demandee.
    events_par_jour: list[dict] = []
    events_par_action: list[dict] = []
    # Messages de contact (soft-deleted exclus, comme la liste).
    contacts_total: int
    contacts_par_statut: dict[str, int] = {}
    # fenetre effective utilisee pour les axes (echo, aide au debug).
    days: int
