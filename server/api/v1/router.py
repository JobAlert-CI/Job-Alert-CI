from __future__ import annotations

from fastapi import APIRouter

from api.v1 import ingestion, internal_ai
from api.v1.public import articles, contact, filieres, offers, referentials, sources, stats, subscriptions, webhooks_resend
from api.v1.public import sitemap
from api.v1.admin import (
    aggregates as admin_aggregates,
    ai as admin_ai,
    admins,
    auth,
    content,
    dashboard,
    exports as admin_exports,
    logs,
    offers as admin_offers,
    referentials as admin_referentials,
    scraping,
    sending,
    settings,
    subscribers,
    transactional_emails as admin_transactional_emails,
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
api_router.include_router(admin_aggregates.router)
api_router.include_router(admin_exports.router)
api_router.include_router(admin_transactional_emails.router)
