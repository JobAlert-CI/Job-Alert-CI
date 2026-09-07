from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field

from schemas.base import TimestampRead


class EmailDigestOfferRead(TimestampRead):
    id: str
    offer_id: str
    position: int
    # Comment l'offre a été récupérée pour ce digest (doc v3 §8 :
    # afficher le palier de matching atteint). Valeurs du modèle :
    # primary | secondary | fallback_contract | fallback_freshness |
    # fallback_experience | fallback_city.
    match_kind: str = "primary"


class EmailDigestRead(TimestampRead):
    id: str
    subscriber_id: str
    scrape_run_id: str | None = None
    digest_date: date
    scheduled_for: datetime
    status: str
    subject: str | None = None
    offer_count: int
    skipped_reason: str | None = None
    sent_at: datetime | None = None
    template_version: str
    offer_links: list[EmailDigestOfferRead] = []


class SendTrigger(BaseModel):
    subscriber_id: str | None = Field(
        default=None,
        description="ID d'un abonné spécifique. Si None, déclenche pour tous les abonnés actifs.",
    )
    filiere_code: str | None = Field(
        default=None,
        description="Limiter à une filière.",
        max_length=120,
    )
    date_override: date | None = Field(
        default=None,
        description="Date du digest à générer (défaut : aujourd'hui).",
    )


class CustomSendCreate(BaseModel):
    offer_ids: list[str] = Field(min_length=1, description="IDs des offres à inclure.")
    subject: str | None = Field(default=None, max_length=255)


class SendingStatsRead(BaseModel):
    period_days: int
    total_sent: int
    total_failed: int
    total_skipped: int
    success_rate: float
