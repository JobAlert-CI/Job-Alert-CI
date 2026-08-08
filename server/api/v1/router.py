from __future__ import annotations

from fastapi import APIRouter

from api.v1.public import articles, contact, filieres, offers, referentials, sources, stats, subscriptions
from api.v1.admin import (
    admins,
    auth,
    content,
    dashboard,
    logs,
    offers as admin_offers,
    referentials as admin_referentials,
    scraping,
    sending,
    settings,
    subscribers,
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
api_router.include_router(stats.router)

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