from __future__ import annotations

from sqlalchemy import select

from db.session import session_scope
from models import SiteSetting

"""Seed idempotent des parametres non sensibles du flux de confirmation.

Aucun secret ici: `RESEND_API_KEY` et `RESEND_WEBHOOK_SECRET` restent
exclusivement dans les variables d'environnement.

    python -m scripts.seed_email_settings
"""

EMAIL_SETTINGS: list[tuple[str, str, str]] = [
    ("email_from_name", "JobAlert CI", "Nom affiche comme expediteur des emails transactionnels."),
    (
        "email_confirmation_subject",
        "Confirmez votre inscription à JobAlert CI",
        "Objet de l'email de confirmation d'inscription.",
    ),
    ("confirm_email_token_ttl_hours", "24", "Duree de validite du lien de confirmation, en heures."),
    ("email_confirmation_required", "true", "Exiger la confirmation d'email avant d'activer un abonne."),
    ("support_email", "support@jobalert.ci", "Adresse de support affichee dans les emails."),
]


def seed_email_settings() -> int:
    created = 0
    with session_scope() as db:
        for key, value, description in EMAIL_SETTINGS:
            existing = db.scalar(select(SiteSetting).where(SiteSetting.key == key))
            if existing is not None:
                # Ne jamais ecraser une valeur reglee par un admin.
                continue
            db.add(SiteSetting(key=key, value=value, description=description))
            created += 1
    return created


if __name__ == "__main__":
    count = seed_email_settings()
    print(f"Parametres email seedes: {count} nouveau(x).")
