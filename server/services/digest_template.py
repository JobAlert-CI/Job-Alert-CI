from __future__ import annotations

from dataclasses import dataclass
from html import escape

"""Templates du digest quotidien (HTML + texte brut).

Meme approche que services/email/templates.py: aucune dependance externe,
echappement HTML systematique des valeurs dynamiques. Le token brut n'apparaît
que dans les URLs signees; il n'est jamais journalise.
"""

DIGEST_TEMPLATE_VERSION = "v1"


def digest_subject(offer_count: int, digest_date_str: str) -> str:
    if offer_count <= 0:
        return f"JobAlert CI — votre veille du {digest_date_str}"
    return f"{offer_count} nouvelles offres pour vous sur JobAlert CI"


@dataclass(slots=True)
class DigestOfferView:
    """Donnees affichables d'une offre du digest."""

    title: str
    company_name: str
    location_label: str | None
    contract_label: str | None
    experience_label: str | None
    filiere_label: str | None
    published_at_str: str | None
    offer_url: str
    source_url: str | None


@dataclass(slots=True)
class DigestEmailContext:
    full_name: str | None
    email: str
    digest_date_str: str
    offers: list[DigestOfferView]
    manage_preferences_url: str
    unsubscribe_url: str
    site_name: str = "JobAlert CI"
    support_email: str = "support@jobalert.ci"
    daily_tip: str | None = None


def _offer_row_html(view: DigestOfferView) -> str:
    meta_parts = [
        part
        for part in (
            escape(view.company_name) if view.company_name else None,
            escape(view.location_label) if view.location_label else None,
            escape(view.contract_label) if view.contract_label else None,
            escape(view.experience_label) if view.experience_label else None,
            escape(view.filiere_label) if view.filiere_label else None,
            escape(view.published_at_str) if view.published_at_str else None,
        )
        if part
    ]
    meta_line = " &middot; ".join(meta_parts)
    source_link = (
        f'<a href="{escape(view.source_url)}">Offre source</a>'
        if view.source_url and view.source_url != view.offer_url
        else ""
    )
    return (
        '<tr><td style="padding:12px 0;border-bottom:1px solid #e5e7eb;">'
        f'<a href="{escape(view.offer_url)}" style="font-size:16px;font-weight:bold;color:#111827;'
        f'text-decoration:none;">{escape(view.title)}</a>'
        f'<div style="color:#6b7280;font-size:13px;margin-top:4px;">{meta_line}</div>'
        f'<div style="margin-top:8px;"><a href="{escape(view.offer_url)}" '
        'style="background:#2563eb;color:#ffffff;padding:8px 14px;border-radius:6px;'
        'text-decoration:none;font-size:13px;display:inline-block;">Voir l\'offre</a>'
        f"&nbsp;&nbsp;{source_link}</div>"
        "</td></tr>"
    )


def render_digest_email(context: DigestEmailContext) -> tuple[str, str, str]:
    """Rend (subject, html, text) pour le digest.

    HTML simple et responsive (table unique, largeur fluide), compatible avec
    les clients email courants. Texte brut equivalent pour les clients texte.
    """

    subject = digest_subject(len(context.offers), context.digest_date_str)
    greeting_name = escape(context.full_name) if context.full_name else ""

    rows_html = "".join(_offer_row_html(view) for view in context.offers)

    tip_block_html = ""
    if context.daily_tip:
        tip_block_html = (
            f'<p style="color:#374151;font-size:14px;">💡 {escape(context.daily_tip)}</p>'
        )

    html = (
        '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">'
        f'<h1 style="font-size:20px;color:#111827;">Bonjour {greeting_name}, voici vos offres du jour</h1>'
        f'<p style="color:#374151;font-size:14px;">Veille du {escape(context.digest_date_str)} — '
        f"{len(context.offers)} offre(s) selectionnee(s) pour vos preferences.</p>"
        f"{tip_block_html}"
        f'<table style="width:100%;border-collapse:collapse;">{rows_html}</table>'
        '<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:13px;">'
        f'<a href="{escape(context.manage_preferences_url)}" style="color:#2563eb;">Gérer mes préférences</a>'
        f'&nbsp;&middot;&nbsp;<a href="{escape(context.unsubscribe_url)}" style="color:#6b7280;">Se désinscrire</a>'
        "</div>"
        f'<p style="color:#9ca3af;font-size:12px;margin-top:16px;">{escape(context.site_name)} — '
        f"Besoin d'aide ? Écrivez à {escape(context.support_email)}</p>"
        "</div>"
    )

    lines_text = [f"Bonjour {context.full_name or ''},".rstrip(), ""]
    lines_text.append(f"Vos offres du jour ({context.digest_date_str}) :")
    lines_text.append("")
    for index, view in enumerate(context.offers, start=1):
        details = " | ".join(
            part
            for part in (
                view.company_name,
                view.location_label,
                view.contract_label,
                view.published_at_str,
            )
            if part
        )
        lines_text.append(f"{index}. {view.title}")
        if details:
            lines_text.append(f"   {details}")
        lines_text.append(f"   {view.offer_url}")
        lines_text.append("")
    lines_text.append(f"Gérer mes préférences : {context.manage_preferences_url}")
    lines_text.append(f"Se désinscrire : {context.unsubscribe_url}")
    lines_text.append("")
    lines_text.append(f"{context.site_name} — support : {context.support_email}")
    text = "\n".join(lines_text)

    return subject, html, text
