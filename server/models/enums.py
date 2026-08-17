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
    DUPLICATE = "duplicate"
    HIDDEN = "hidden"
    BRUTE = "brute"
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


class ContentStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


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
