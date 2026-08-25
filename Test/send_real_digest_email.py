"""Test d'envoi reel d'un digest d'offres par email.

Usage (depuis la racine du repo):
    server\\.venv\\Scripts\\python.exe Test/send_real_digest_email.py [email]

- Utilise le VRAI provider email (Resend) avec la cle de server/.env.
- Recalcule le digest du jour pour l'abonne en mode force (les offres deja
  envoyees ne sont jamais renvoyees; un digest skipped_empty est remplace).
- DIGEST_INITIAL_LOOKBACK_HOURS est force a 8760 (1 an) pour que le premier
  digest d'un abonné fraichement inscrit contienne les offres recentes.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "server"))

# Env AVANT tout import applicatif (core.config lit l'environnement au premier acces).
os.environ.setdefault("APP_ENV", "development")
os.environ["DIGEST_INITIAL_LOOKBACK_HOURS"] = "8760"

from sqlalchemy import select  # noqa: E402
from sqlalchemy.orm import selectinload  # noqa: E402

from core.config import get_settings  # noqa: E402

get_settings.cache_clear()
settings = get_settings()

from db.session import SessionLocal  # noqa: E402
from models import DigestStatus, Subscriber, SubscriberStatus  # noqa: E402
from services.digest_builder_service import build_and_queue_digest_sync  # noqa: E402
from services.digest_sender_service import send_digest_now  # noqa: E402
from services.email.resend_provider import get_email_provider  # noqa: E402

EMAIL_CIBLE = (sys.argv[1] if len(sys.argv) > 1 else "gbohouroueuloge@gmail.com").strip().lower()


def main() -> int:
    print(f"=== Test envoi reel digest -> {EMAIL_CIBLE} ===")
    print(f"provider={settings.email_provider} from={settings.email_from}")
    if not settings.resend_api_key:
        print("ERREUR: RESEND_API_KEY absente de server/.env — aucun envoi possible.")
        return 1

    db = SessionLocal()
    try:
        subscriber = db.scalar(
            select(Subscriber)
            .options(
                selectinload(Subscriber.filiere_links),
                selectinload(Subscriber.contract_preferences),
                selectinload(Subscriber.experience_level),
            )
            .where(Subscriber.email_normalized == EMAIL_CIBLE)
        )
        if subscriber is None:
            print(f"ERREUR: aucun abonne '{EMAIL_CIBLE}' en base. Inscris-toi d'abord via le site.")
            return 1
        if subscriber.status != SubscriberStatus.ACTIVE:
            print(f"ERREUR: l'abonne est en statut {subscriber.status.value} (active requis).")
            return 1
        print(
            f"Abonne OK: {subscriber.email} city={subscriber.city!r} "
            f"filiere_links={len(subscriber.filiere_links)} contrats={len(subscriber.contract_preferences)}"
        )

        digest_day = datetime.now(timezone.utc).date()

        # Phase 1: recalcul force du digest du jour.
        result = build_and_queue_digest_sync(db, subscriber_id=subscriber.id, digest_day=digest_day, force=True)
        db.commit()
        print(f"[phase 1] statut={result.status} offres={result.offer_count} detail={result.detail}")

        if result.status != "queued":
            print("Aucune offre retenue: rien a envoyer. Verifie filieres/contrats/ville ou les offres actives.")
            return 1

        digest = db.get(__import__("models").EmailDigest, result.digest_id)
        titles = (digest.payload_preview or {}).get("titles", [])
        for index, title in enumerate(titles, start=1):
            print(f"   {index}. {title}")

        # Phase 2: envoi via le VRAI provider Resend.
        provider = get_email_provider()
        outcome = send_digest_now(db, digest_id=result.digest_id, provider=provider)
        db.commit()
        print(
            f"[phase 2] success={outcome.success} statut={outcome.status} "
            f"tentative={outcome.attempt_no} erreur={outcome.error_message}"
        )

        if outcome.success:
            print(f"\nOK: email envoye a {subscriber.email} (verifie ta boite + spams).")
            return 0
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
