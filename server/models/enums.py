from enum import StrEnum

"""Enums metier partages par ORM, services et schemas API."""


class SourceStatus(StrEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    ERROR = "error"
    DISABLED = "disabled"


class ScrapeRunStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    PARTIAL_FAILURE = "partial_failure"
    FAILED = "failed"


class JobOfferStatus(StrEnum):
    ACTIVE = "active"
    EXPIRED = "expired"
    FILLED = "filled"
    ARCHIVED = "archived"
    EN_RELECTURE = "en_relecture"
    DUPLICATE = "duplicate"
    HIDDEN = "hidden"
    BRUT = "brut"
    BRUTE = "brut"
    LEGACY_BRUTE = "brute"
    AI_PROCESSING = "ai_processing"
    PENDING_REVIEW = "pending_review"
    PROCESSING = "processing"
    REJECTED = "rejected"


class JobOfferOrigin(StrEnum):
    SCRAPING = "scraping"
    MANUAL = "manual"
    IMPORT = "import"


class IngestionAction(StrEnum):
    INSERTED = "inserted"
    UPDATED = "updated"
    DUPLICATE = "duplicate"
    SKIPPED = "skipped"
    FAILED = "failed"


class AiOfferStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    SKIPPED = "skipped"
    NOOP = "noop"
    FAILED = "failed"


class AiProcessingJobTrigger(StrEnum):
    IMMEDIATE = "immediate"
    SWEEP = "sweep"
    MANUAL = "manual"


class AiProcessingJobStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    LOCKED = "locked"


class AIProviderType(StrEnum):
    OPENAI_COMPATIBLE = "openai_compatible"
    OPENAI = "openai"
    MISTRAL = "mistral"
    GROQ = "groq"
    ANTHROPIC = "anthropic"
    GOOGLE_GEMINI = "google_gemini"
    OLLAMA = "ollama"
    CUSTOM_HTTP = "custom_http"
    MOCK = "mock"


class AIJobTrigger(StrEnum):
    AUTO = "auto"
    MANUAL = "manual"
    DELAYED_CHECK = "delayed_check"
    SWEEP = "sweep"


class AIJobStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    PARTIAL_FAILURE = "partial_failure"
    FAILED = "failed"


class AIOfferAttemptStatus(StrEnum):
    PENDING = "pending"
    SUCCESS = "success"
    INVALID = "invalid"
    FAILED = "failed"
    REVIEW_REQUIRED = "review_required"


class AIErrorType(StrEnum):
    TIMEOUT = "timeout"
    NETWORK_ERROR = "network_error"
    RATE_LIMIT = "rate_limit"
    AUTHENTICATION_ERROR = "authentication_error"
    QUOTA_EXCEEDED = "quota_exceeded"
    MODEL_NOT_FOUND = "model_not_found"
    SERVER_ERROR = "server_error"
    INVALID_JSON_RESPONSE = "invalid_json_response"
    CONTENT_POLICY_ERROR = "content_policy_error"
    UNKNOWN_ERROR = "unknown_error"


class AIAlertSeverity(StrEnum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AIFiliereSuggestionStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class SubscriberStatus(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    PAUSED = "paused"
    UNSUBSCRIBED = "unsubscribed"
    BOUNCED = "bounced"
    DELETED = "deleted"


class NotificationChannel(StrEnum):
    EMAIL = "email"
    WHATSAPP = "whatsapp"
    SMS = "sms"


class TokenPurpose(StrEnum):
    CONFIRM_EMAIL = "confirm_email"
    MANAGE_ALERT = "manage_alert"
    UNSUBSCRIBE = "unsubscribe"


class DigestStatus(StrEnum):
    QUEUED = "queued"
    SKIPPED_EMPTY = "skipped_empty"
    SENDING = "sending"
    SENT = "sent"
    FAILED = "failed"
    CANCELLED = "cancelled"


class EmailAttemptStatus(StrEnum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"


class TransactionalEmailPurpose(StrEnum):
    """Motif d'un email transactionnel (distinct de TokenPurpose: RESEND_CONFIRMATION
    n'a pas de token dedie, c'est un renvoi du meme purpose CONFIRM_EMAIL)."""

    CONFIRM_EMAIL = "confirm_email"
    RESEND_CONFIRMATION = "resend_confirmation"
    MANAGE_ALERT = "manage_alert"
    UNSUBSCRIBE = "unsubscribe"


class TransactionalEmailStatus(StrEnum):
    QUEUED = "queued"
    SENT = "sent"
    FAILED = "failed"


class ContentStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    EN_RELECTURE = "en_relecture"


class ContentType(StrEnum):
    ARTICLE = "article"
    FAQ = "faq"
    STATIC_PAGE = "static_page"
    LEGAL_PAGE = "legal_page"


class ContactMessageStatus(StrEnum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    REPLIED = "replied"
    CLOSED = "closed"
    SPAM = "spam"


class AdminRole(StrEnum):
    SUPER_ADMIN = "super_admin"
    OFFER_MANAGER = "gestionnaire_offres"
    USER_MANAGER = "gestionnaire_utilisateurs"
    MODERATOR = "moderateur"


class AdminAction(StrEnum):
    CREATE = "creation"
    UPDATE = "modification"
    DELETE = "suppression"
    SEND = "envoi"
    LOGIN = "connexion"
    SCRAPE = "scraping"