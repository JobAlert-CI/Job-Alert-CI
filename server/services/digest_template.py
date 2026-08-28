from __future__ import annotations

from dataclasses import dataclass, field
from html import escape

"""Templates du digest quotidien (HTML + texte brut).

Meme approche que services/email/templates.py: aucune dependance externe,
echappement HTML systematique des valeurs dynamiques. Le token brut n'apparaît
que dans les URLs signees; il n'est jamais journalise.

Depuis la cascade T0-T5 (cf. services/digest_cascade_selector.py), un
digest peut contenir des offres "primary" (match parfait, filiere
principale) et des offres "secondary" (repli via T1-T5). Le template
les affiche dans deux sections distinctes pour ne pas melanger
silencieusement une offre parfaite et une offre de repli.
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
    # Comment cette offre a ete obtenue: 'primary' (T0) ou un match_kind
    # de repli ('secondary', 'fallback_contract', 'fallback_freshness',
    # 'fallback_experience', 'fallback_city'). Defaut 'primary' pour
    # conserver la retrocompat avec les tests et appels existants.
    match_kind: str = "primary"


# Libelles utilisateur pour chaque match_kind de repli (affiches comme
# badge dans la section "Pourrait aussi vous interesser").
_MATCH_KIND_BADGES: dict[str, str] = {
    "secondary": "filiere secondaire",
    "fallback_contract": "type de contrat different de vos preferences",
    "fallback_freshness": "offre plus ancienne (relaxation de la fraicheur)",
    "fallback_experience": "niveau d'experience elargi",
    "fallback_city": "ville differente (fallback)",
}


def _badge_for_kind(match_kind: str) -> str | None:
    """Retourne le libelle utilisateur d'un match_kind de repli, ou None
    si le kind n'a pas de badge a afficher (ex: 'primary')."""
    if match_kind == "primary":
        return None
    return _MATCH_KIND_BADGES.get(match_kind, "suggestion alternative")


@dataclass(slots=True)
class DigestEmailContext:
    full_name: str | None
    email: str
    digest_date_str: str
    # Liste complete conservee pour retrocompat (les anciens tests/builders
    # ne passent que `offers`). Quand `primary_offers`/`secondary_offers`
    # sont fournis, ils prennent le pas sur `offers` pour l'affichage.
    offers: list[DigestOfferView]
    manage_preferences_url: str
    unsubscribe_url: str
    site_name: str = "JobAlert CI"
    support_email: str = "support@jobalert.ci"
    daily_tip: str | None = None
    # Split introduit pour la cascade T0-T5 (cf. tranche 4.1).
    primary_offers: list[DigestOfferView] = field(default_factory=list)
    secondary_offers: list[DigestOfferView] = field(default_factory=list)


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
    badge_html = ""
    badge = _badge_for_kind(view.match_kind)
    if badge:
        badge_html = (
            f'<div style="margin-top:6px;"><span style="display:inline-block;'
            f'background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;'
            f'font-size:11px;">{escape(badge)}</span></div>'
        )
    return (
        '<tr><td style="padding:12px 0;border-bottom:1px solid #e5e7eb;">'
        f'<a href="{escape(view.offer_url)}" style="font-size:16px;font-weight:bold;color:#111827;'
        f'text-decoration:none;">{escape(view.title)}</a>'
        f'<div style="color:#6b7280;font-size:13px;margin-top:4px;">{meta_line}</div>'
        f"{badge_html}"
        f'<div style="margin-top:8px;"><a href="{escape(view.offer_url)}" '
        'style="background:#2563eb;color:#ffffff;padding:8px 14px;border-radius:6px;'
        'text-decoration:none;font-size:13px;display:inline-block;">Voir l\'offre</a>'
        f"&nbsp;&nbsp;{source_link}</div>"
        "</td></tr>"
    )


def _section_html(title: str, emoji: str, views: list[DigestOfferView]) -> str:
    """Rend une section (titre emoji + tableau d'offres). Vide si views == []."""
    if not views:
        return ""
    rows_html = "".join(_offer_row_html(view) for view in views)
    return (
        f'<h2 style="font-size:16px;color:#111827;margin-top:24px;">'
        f"{emoji} {escape(title)} ({len(views)})</h2>"
        f'<table style="width:100%;border-collapse:collapse;">{rows_html}</table>'
    )


def render_digest_email(context: DigestEmailContext) -> tuple[str, str, str]:
    """Rend (subject, html, text) pour le digest.

    HTML simple et responsive (table unique, largeur fluide), compatible avec
    les clients email courants. Texte brut equivalent pour les clients texte.

    Depuis la cascade T0-T5: si `primary_offers`/`secondary_offers` sont
    fournis, le digest affiche deux sections distinctes:
    - "Selectionnees pour vous" (match_kind='primary', filiere fiable)
    - "Pourrait aussi vous interesser" (match_kind='secondary' ou fallback_*)
    Si les deux listes sont vides, fallback sur `offers` (retrocompat).
    """

    # Resolution du split: si primary/secondary sont explicitement passes,
    # on les utilise. Sinon on considere que toutes les offres sont primary
    # (cas T0 strict, chemin historique).
    primary = context.primary_offers or context.offers
    secondary = context.secondary_offers
    if context.primary_offers or context.secondary_offers:
        # Mode split: primary/secondary sont la verite, on ignore `offers`.
        primary = context.primary_offers
        secondary = context.secondary_offers
    total = len(primary) + len(secondary)

    subject = digest_subject(total, context.digest_date_str)
    greeting_name = escape(context.full_name) if context.full_name else ""

    primary_section = _section_html(
        "Selectionnees pour vous", "🟢", primary
    ) if primary else ""
    secondary_section = _section_html(
        "Pourrait aussi vous interesser", "🟡", secondary
    ) if secondary else ""

    tip_block_html = ""
    if context.daily_tip:
        tip_block_html = (
            f'<p style="color:#374151;font-size:14px;">💡 {escape(context.daily_tip)}</p>'
        )

    html = (
        '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">'
        f'<h1 style="font-size:20px;color:#111827;">Bonjour {greeting_name}, voici vos offres du jour</h1>'
        f'<p style="color:#374151;font-size:14px;">Veille du {escape(context.digest_date_str)} — '
        f"{total} offre(s) selectionnee(s) pour vos preferences.</p>"
        f"{tip_block_html}"
        f"{primary_section}"
        f"{secondary_section}"
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
    if primary:
        lines_text.append(f"--- Selectionnees pour vous ({len(primary)}) ---")
        for index, view in enumerate(primary, start=1):
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
    if secondary:
        lines_text.append(
            f"--- Pourrait aussi vous interesser ({len(secondary)}) ---"
        )
        for index, view in enumerate(secondary, start=1):
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
            badge = _badge_for_kind(view.match_kind)
            lines_text.append(f"{index}. {view.title} [{badge}]" if badge else f"{index}. {view.title}")
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
