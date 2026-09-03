from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

from pydantic import BaseModel, Field, StringConstraints, computed_field, field_validator, model_validator

from models.enums import AIAlertSeverity, AIJobStatus, AIJobTrigger, AIProviderType
from schemas.base import TimestampRead

CodeStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120, pattern=r"^[a-z0-9][a-z0-9_-]*$")]
ShortStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
ListItemStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class AIApiKeyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    provider_type: AIProviderType = AIProviderType.OPENAI_COMPATIBLE
    base_url: str | None = Field(default=None, max_length=1000)
    models: list[str] | dict[str, Any] | None = None
    api_key: str = Field(min_length=1, max_length=4096, repr=False)
    priority: int = Field(default=100, ge=0)
    is_active: bool = True
    max_concurrent_requests: int = Field(default=1, ge=1)
    timeout_seconds: int = Field(default=60, ge=1)
    max_retries: int = Field(default=2, ge=0)
    retry_backoff_seconds: int = Field(default=5, ge=0)
    rate_limit_per_minute: int | None = Field(default=None, ge=1)
    notes: str | None = None


class AIApiKeyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    provider_type: AIProviderType | None = None
    base_url: str | None = Field(default=None, max_length=1000)
    models: list[str] | dict[str, Any] | None = None
    api_key: str | None = Field(default=None, min_length=1, max_length=4096, repr=False)
    priority: int | None = Field(default=None, ge=0)
    is_active: bool | None = None
    max_concurrent_requests: int | None = Field(default=None, ge=1)
    timeout_seconds: int | None = Field(default=None, ge=1)
    max_retries: int | None = Field(default=None, ge=0)
    retry_backoff_seconds: int | None = Field(default=None, ge=0)
    rate_limit_per_minute: int | None = Field(default=None, ge=1)
    notes: str | None = None
    disabled_until: datetime | None = None


class AIApiKeyRead(TimestampRead):
    id: UUID
    name: str
    provider_type: AIProviderType
    base_url: str | None = None
    models: list[str] | dict[str, Any] | None = None
    api_key_last4: str | None = Field(default=None, exclude=True)
    priority: int
    is_active: bool
    max_concurrent_requests: int
    timeout_seconds: int
    max_retries: int
    retry_backoff_seconds: int
    rate_limit_per_minute: int | None = None
    notes: str | None = None
    last_used_at: datetime | None = None
    last_error_at: datetime | None = None
    disabled_until: datetime | None = None
    deleted_at: datetime | None = None

    @computed_field
    @property
    def api_key_masked(self) -> str | None:
        if not self.api_key_last4:
            return None
        return f"****{self.api_key_last4}"


class AIReferentialSpecialty(BaseModel):
    code: CodeStr
    label: ShortStr


class AIReferentialItem(BaseModel):
    code: CodeStr
    label: ShortStr
    specialties: list[AIReferentialSpecialty] = Field(default_factory=list)


class AIBatchOfferInput(BaseModel):
    offer_id: UUID
    title: str = Field(min_length=1, max_length=300)
    company_name: str | None = Field(default=None, max_length=255)
    source_code: str = Field(min_length=1, max_length=80)
    source_url: str | None = Field(default=None, max_length=1000)
    location_raw: str | None = Field(default=None, max_length=255)
    salary_raw: str | None = Field(default=None, max_length=255)
    description: str | None = None
    source_text: str | None = None
    raw_payload: dict[str, Any] | None = None
    published_at: datetime | None = None
    contract_type_code: CodeStr | None = None
    experience_level_code: CodeStr | None = None
    education_level_code: CodeStr | None = None
    primary_filiere_code: CodeStr | None = None


class AIBatchRequest(BaseModel):
    job_id: UUID | None = None
    offers: list[AIBatchOfferInput] = Field(min_length=1)
    filieres: list[AIReferentialItem] = Field(default_factory=list)
    contract_types: list[AIReferentialItem] = Field(default_factory=list)
    experience_levels: list[AIReferentialItem] = Field(default_factory=list)
    education_levels: list[AIReferentialItem] = Field(default_factory=list)
    schema_hint: dict[str, Any] | None = None


class AISuggestedFiliere(BaseModel):
    code: CodeStr
    label: ShortStr
    reason: str | None = None


class AIProcessedOfferDetail(BaseModel):
    intro: str = Field(min_length=1)
    missions: list[ListItemStr] = Field(default_factory=list)
    profile_requirements: list[ListItemStr] = Field(default_factory=list)
    benefits: list[ListItemStr] = Field(default_factory=list)
    tags: list[ListItemStr] = Field(default_factory=list)

    @field_validator("intro", "missions", "profile_requirements", "benefits", "tags")
    @classmethod
    def reject_markdown_blocks(cls, value):
        values = value if isinstance(value, list) else [value]
        if any("```" in item for item in values):
            raise ValueError("markdown code blocks are not allowed in structured AI fields")
        return value


class AIProcessedOfferResult(BaseModel):
    offer_id: UUID
    primary_filiere_code: CodeStr | None = None
    specialty_code: CodeStr | None = None
    filiere_confidence: float = Field(ge=0, le=1)
    requires_admin_review: bool = False
    suggested_filiere: AISuggestedFiliere | None = None
    contract_type_code: CodeStr | None = None
    experience_level_code: CodeStr | None = None
    education_level_code: CodeStr | None = None
    detail: AIProcessedOfferDetail

    @model_validator(mode="after")
    def validate_review_rules(self):
        if not self.requires_admin_review and not self.primary_filiere_code:
            raise ValueError("primary_filiere_code is required when requires_admin_review is false")
        if self.requires_admin_review and not self.primary_filiere_code and self.suggested_filiere is None:
            raise ValueError("suggested_filiere is required when no existing filiere is selected")
        return self


class AIJobResultPayload(BaseModel):
    job_id: UUID
    provider_key_id: UUID | None = None
    results: list[AIProcessedOfferResult] = Field(min_length=1)


class AIProviderBatchResponse(BaseModel):
    results: list[AIProcessedOfferResult] = Field(default_factory=list)


class AIInternalResultSubmission(AIJobResultPayload):
    pass


class AIValidationErrorItem(BaseModel):
    offer_id: UUID | None = None
    message: str = Field(min_length=1)


class AIValidationSummary(BaseModel):
    job_id: UUID
    processed: int = Field(ge=0)
    activated: int = Field(ge=0)
    pending_review: int = Field(ge=0)
    rejected: int = Field(ge=0)
    reprocess_required: int = Field(ge=0)
    reprocess_offer_ids: list[UUID] = Field(default_factory=list)
    errors: list[AIValidationErrorItem] = Field(default_factory=list)


class AIRunRequest(BaseModel):
    force: bool = False
    trigger_type: AIJobTrigger = AIJobTrigger.MANUAL


class AITestConnectionRead(BaseModel):
    ok: bool
    provider: str | None = None
    model: str | None = None
    message: str | None = None


class AIAlertRead(TimestampRead):
    id: UUID
    job_id: UUID | None = None
    type: str
    severity: AIAlertSeverity
    message: str
    payload: dict[str, Any] | None = None
    acknowledged_at: datetime | None = None
    acknowledged_by_admin_id: UUID | None = None
    created_at: datetime


class AIJobRead(TimestampRead):
    id: UUID
    trigger_type: AIJobTrigger
    status: AIJobStatus
    started_at: datetime | None = None
    finished_at: datetime | None = None
    offers_total: int
    offers_activated: int
    offers_pending_review: int
    offers_rejected: int
    offers_reprocess_required: int
    primary_api_key_id: UUID | None = None
    fallback_count: int
    error_message: str | None = None
    celery_task_id: str | None = None


# ─── Enrichissement admin (etape 1 — dashboard / file IA / alertes) ───


class AIAlertAckResponse(BaseModel):
    """Reponse apres accuse de reception d'une alerte IA.

    `acknowledged_by_admin_id` reste en str (pas UUID) pour rester aligne
    avec le type des autres endpoints (les administrateurs utilisent un UUID,
    mais on accepte aussi un identifiant logique pour les tests / seeds).
    """

    id: str
    acknowledged_at: datetime
    acknowledged_by_admin_id: str | None = None


class AIQueueRead(BaseModel):
    """Etat agrege de la file d'attente du pipeline IA pour le tableau de bord.

    Compteurs en lecture directe sur `ai_processing_jobs` (status PENDING/RUNNING)
    et `ai_jobs` (idem). Le dernier sweep designe le job de trigger SWEEP le plus
    recent, tous status confondus, ce qui permet de distinguer 'pas de sweep
    depuis longtemps' de 'sweep recent mais vide'.

    Pourquoi pas l'ORM directement : on expose plusieurs compteurs en un seul
    appel pour economiser un round-trip cote front.
    """

    pending: int = Field(ge=0, description="Nombre de AiProcessingJob en statut PENDING")
    running: int = Field(ge=0, description="Nombre de AiProcessingJob en statut RUNNING")
    pending_ai_jobs: int = Field(ge=0, description="Nombre de AIJob en statut PENDING")
    last_sweep_at: datetime | None = Field(
        default=None, description="Horodatage du dernier AiProcessingJob de trigger SWEEP (tous status)"
    )
    last_sweep_status: AIProcessingJobStatusLiteral | None = Field(
        default=None, description="Statut du dernier sweep"
    )


AIProcessingJobStatusLiteral = Annotated[
    str,
    StringConstraints(pattern=r"^(pending|running|completed|failed|skipped|locked)$"),
]
