from __future__ import annotations

from dataclasses import dataclass
from html import escape
from urllib.parse import quote

from core.config import Settings, get_settings

"""Templates de l'email de confirmation (HTML + texte brut).

Aucun moteur de template externe: le projet n'en embarque pas et une
f-string echappee suffit pour un email transactionnel. Toutes les valeurs
dynamiques passent par `html.escape` cote HTML pour eviter toute injection
via `full_name` (donnee saisie par l'utilisateur).

Le token brut n'apparait que dans l'URL de confirmation; il n'est jamais
journalise ni stocke en clair (cf. services/token_service.py).
"""

DEFAULT_SUBJECT = "Confirmez votre inscription à JobAlert CI"


@dataclass(slots=True)
class ConfirmationEmailContext:
    """Variables disponibles dans le template de confirmation."""

    full_name: str | None
    email: str
    confirmation_url: str
    expiry_hours: int
    site_name: str
    support_email: str


@dataclass(slots=True)
class RenderedEmail:
    subject: str
    html: str
    text: str


def build_confirmation_url(raw_token: str, *, settings: Settings | None = None) -> str:
    """Construit le lien de confirmation destine au frontend.

    Format: `{PUBLIC_BASE_URL}/inscription/confirmation/{token}`. Le token est
    URL-encode par securite meme s'il est deja URL-safe.
    """

    resolved = settings or get_settings()
    base = resolved.public_base_url.rstrip("/")
    return f"{base}/inscription/confirmation/{quote(raw_token, safe='')}"


def build_confirmation_context(
    *,
    email: str,
    full_name: str | None,
    raw_token: str,
    settings: Settings | None = None,
) -> ConfirmationEmailContext:
    resolved = settings or get_settings()
    return ConfirmationEmailContext(
        full_name=full_name,
        email=email,
        confirmation_url=build_confirmation_url(raw_token, settings=resolved),
        expiry_hours=resolved.confirm_email_token_ttl_hours,
        site_name=resolved.email_from_name,
        support_email=resolved.support_email,
    )


def render_confirmation_email(
    context: ConfirmationEmailContext,
    *,
    subject: str | None = None,
) -> RenderedEmail:
    """Rend le couple HTML/texte de l'email de confirmation."""

    greeting = f"Bonjour {context.full_name.strip()}" if context.full_name and context.full_name.strip() else "Bonjour"

    text = "\n".join(
        [
            f"{greeting},",
            "",
            f"Merci de votre inscription à {context.site_name}.",
            "",
            "Confirmez votre adresse email en ouvrant ce lien :",
            context.confirmation_url,
            "",
            f"Ce lien expire dans {context.expiry_hours} heures et ne peut être utilisé qu'une seule fois.",
            "",
            "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.",
            "",
            f"Besoin d'aide ? Écrivez-nous à {context.support_email}.",
            f"— L'équipe {context.site_name}",
        ]
    )

    safe_greeting = escape(greeting)
    safe_site = escape(context.site_name)
    safe_url = escape(context.confirmation_url, quote=True)
    safe_support = escape(context.support_email)
    safe_email = escape(context.email)

    html = f"""<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{escape(subject or DEFAULT_SUBJECT)}</title>
  </head>
  <body style="margin:0;padding:24px;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <tr>
        <td style="font-size:20px;font-weight:bold;color:#0b6b3a;padding-bottom:16px;">{safe_site}</td>
      </tr>
      <tr>
        <td style="font-size:22px;font-weight:bold;padding-bottom:12px;">Confirmez votre inscription</td>
      </tr>
      <tr>
        <td style="font-size:15px;line-height:22px;padding-bottom:24px;">
          {safe_greeting},<br /><br />
          Merci de votre inscription à {safe_site} avec l'adresse <strong>{safe_email}</strong>.
          Cliquez sur le bouton ci-dessous pour activer vos alertes emploi.
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-bottom:24px;">
          <a href="{safe_url}" style="display:inline-block;background:#0b6b3a;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:8px;font-size:15px;">Confirmer mon email</a>
        </td>
      </tr>
      <tr>
        <td style="font-size:13px;line-height:20px;color:#52606d;padding-bottom:16px;">
          Le bouton ne fonctionne pas ? Copiez ce lien dans votre navigateur :<br />
          <a href="{safe_url}" style="color:#0b6b3a;word-break:break-all;">{safe_url}</a>
        </td>
      </tr>
      <tr>
        <td style="font-size:13px;line-height:20px;color:#52606d;padding-bottom:24px;">
          Ce lien expire dans {context.expiry_hours} heures et ne peut être utilisé qu'une seule fois.
          Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
        </td>
      </tr>
      <tr>
        <td style="border-top:1px solid #e4e7eb;padding-top:16px;font-size:12px;color:#7b8794;">
          Besoin d'aide ? <a href="mailto:{safe_support}" style="color:#0b6b3a;">{safe_support}</a><br />
          {safe_site} — veille emploi en Côte d'Ivoire
        </td>
      </tr>
    </table>
  </body>
</html>"""

    return RenderedEmail(subject=subject or DEFAULT_SUBJECT, html=html, text=text)


__all__ = [
    "DEFAULT_SUBJECT",
    "ConfirmationEmailContext",
    "RenderedEmail",
    "build_confirmation_context",
    "build_confirmation_url",
    "render_confirmation_email",
]
