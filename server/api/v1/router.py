from __future__ import annotations

from fastapi import APIRouter

from api.v1 import ingestion, internal_ai
from api.v1.admin import (
    admins,
    auth,
    content,
    dashboard,
    logs,
    scraping,
    sending,
    settings,
    subscribers,
)
from api.v1.admin import (
    aggregates as admin_aggregates,
)
from api.v1.admin import (
    ai as admin_ai,
)
from api.v1.admin import (
    ai_suggestions as admin_ai_suggestions,
)
from api.v1.admin import (
    companies as admin_companies,
)
from api.v1.admin import (
    exports as admin_exports,
)
from api.v1.admin import (
    offers as admin_offers,
)
from api.v1.admin import (
    referentials as admin_referentials,
)
from api.v1.admin import (
    sending_preview as admin_sending_preview,
)
from api.v1.admin import (
    system_health as admin_system_health,
)
from api.v1.admin import (
    transactional_emails as admin_transactional_emails,
)
from api.v1.public import (
    articles,
    contact,
    filieres,
    offers,
    referentials,
    sitemap,
    sources,
    stats,
    subscriptions,
    webhooks_resend,
)

api_router = APIRouter()

# ─── Routes publiques ────────────────────────────────────
api_router.include_router(referentials.router)
api_router.include_router(offers.router)
api_router.include_router(filieres.router)
api_router.include_router(sources.router)
api_router.include_router(articles.router)
api_router.include_router(subscriptions.router)
api_router.include_router(contact.router)
api_router.include_router(webhooks_resend.router)
api_router.include_router(stats.router)
api_router.include_router(sitemap.router)
api_router.include_router(ingestion.router)
api_router.include_router(internal_ai.router)

# ─── Routes admin protégées ──────────────────────────────
api_router.include_router(auth.router)
api_router.include_router(dashboard.router)
api_router.include_router(admin_offers.router)
api_router.include_router(subscribers.router)
api_router.include_router(admin_referentials.router)
api_router.include_router(content.router)
api_router.include_router(scraping.router)
api_router.include_router(sending.router)
api_router.include_router(admins.router)
api_router.include_router(logs.router)
api_router.include_router(settings.router)
api_router.include_router(admin_ai.router)
api_router.include_router(admin_ai_suggestions.router)
api_router.include_router(admin_system_health.router)
api_router.include_router(admin_sending_preview.router)
api_router.include_router(admin_companies.router)
api_router.include_router(admin_aggregates.router)
api_router.include_router(admin_exports.router)
api_router.include_router(admin_transactional_emails.router)
