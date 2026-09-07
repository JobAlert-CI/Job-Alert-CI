"""Service metier : email de bienvenue a la creation d'un compte admin.

Cycle 15, option B validee par l'utilisateur : quand un super_admin cree
un administrateur SANS mot de passe, le temporaire genere est envoye
automatiquement par email au nouvel admin (en plus de l'affichage unique
dans la reponse 201). Pattern copie de `services/admin_password_reset` :
- l'envoi passe par `provider.send(EmailMessage)` (protocole reel) ;
- l'evenement est journalise dans `transactional_email_events`
  (purpose `admin_welcome`) avec son statut (sent/failed) ;
- le mot de passe temporaire n'est JAMAIS stocke dans `request_payload`
  (convention de securite du projet : pas de secret en base claire) ;
- un echec d'envoi ne fait pas echouer la creation du compte : le
  temporaire reste affiche dans la reponse 201 (le super_admin createur
  peut le transmettre manuellement) — l'evenement FAILED garde la trace.

Ce service ne connait pas FastAPI : la route l'appelle apres le commit
de creation.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

from sqlalchemy.orm import Session

from models import TransactionalEmailEvent, TransactionalEmailPurpose, TransactionalEmailStatus
from models.admin import Administrator, AdminRole
from services.email.email_provider import EmailMessage, EmailProviderProtocol

logger = logging.getLogger(__name__)

_WELCOME_SUBJECT = "Votre compte administrateur JobAlert CI"

# Libelles des roles pour le corps du message (miroir de ROLE_LABELS client).
_ROLE_LABELS = {
    AdminRole.SUPER_ADMIN: "Super administrateur",
    AdminRole.OFFER_MANAGER: "Gestionnaire des offres",
    AdminRole.USER_MANAGER: "Gestionnaire des utilisateurs",
    AdminRole.MODERATOR: "Modérateur",
}


@dataclass(slots=True)
class AdminWelcomeResult:
    """Resultat de l'envoi (jamais une erreur bloquante)."""

    sent: bool
    event_id: str | None
    error_message: str | None = None


def send_admin_welcome(
    db: Session,
    *,
    admin: Administrator,
    temporary_password: str,
    provider: EmailProviderProtocol,
) -> AdminWelcomeResult:
    """Envoie l'email de bienvenue AVEC le mot de passe temporaire.

    Ne leve jamais : un echec provider (cle absente, domaine non verifie,
    reseau) est journalise dans l'event (status=failed, last_error) et
    rendu dans le result — la creation du compte reste un succes.
    """
    role_label = _ROLE_LABELS.get(admin.role, admin.role.value)

    text = (
        f"Bonjour {admin.full_name},\n\n"
        f"Un compte administrateur ({role_label}) vient d'etre cree pour vous "
        "sur le back-office JobAlert CI.\n\n"
        f"Email de connexion : {admin.email}\n"
        f"Mot de passe temporaire : {temporary_password}\n\n"
        "IMPORTANT : ce mot de passe est temporaire. A votre premiere "
        "connexion, vous devrez obligatoirement en definir un nouveau avant "
        "de pouvoir acceder au back-office.\n\n"
        "Si vous n'attendiez pas ce compte, ignorez ce message."
    )
    html = (
        f"<p>Bonjour <strong>{admin.full_name}</strong>,</p>"
        f"<p>Un compte administrateur (<em>{role_label}</em>) vient d'etre "
        "cree pour vous sur le back-office JobAlert CI.</p>"
        f"<p>Email de connexion : <strong>{admin.email}</strong></p>"
        f"<p>Mot de passe temporaire : <code>{temporary_password}</code></p>"
        "<p><strong>Important :</strong> ce mot de passe est temporaire. A "
        "votre premiere connexion, vous devrez obligatoirement en definir un "
        "nouveau avant de pouvoir acceder au back-office.</p>"
        "<p>Si vous n'attendiez pas ce compte, ignorez ce message.</p>"
    )

    event = TransactionalEmailEvent(
        purpose=TransactionalEmailPurpose.ADMIN_WELCOME,
        to_email=admin.email,
        status=TransactionalEmailStatus.QUEUED,
        # Aucun secret ici : le temporaire ne figure JAMAIS dans le payload
        # (seule la mention qu'un temporaire a ete emis est conservee).
        request_payload={"temporary_password_issued": True, "role": admin.role.value},
    )
    db.add(event)
    db.commit()

    message = EmailMessage(to_email=admin.email, subject=_WELCOME_SUBJECT, text=text, html=html)
    result = provider.send(message)
    if result.success:
        event.status = TransactionalEmailStatus.SENT
        event.provider_email_id = result.provider_email_id
        event.response_payload = {"provider": "resend", "id": result.provider_email_id}
    else:
        event.status = TransactionalEmailStatus.FAILED
        event.last_error = result.error_message
        logger.warning(
            "Email de bienvenue admin echoue (to=%s) : %s",
            admin.email,
            result.error_message,
        )
    db.commit()

    return AdminWelcomeResult(
        sent=result.success,
        event_id=event.id,
        error_message=None if result.success else result.error_message,
    )


__all__ = ["AdminWelcomeResult", "send_admin_welcome"]
