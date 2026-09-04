"""Apercu du digest (document 8 — 1.6).

Genere un rendu HTML simplifie (pas d'envoi SMTP) a partir d'une selection
d'offres et d'un abonne, sans creer de EmailDigest persistant.

Securite (audit 2, N1): toute valeur dynamique inseree dans `html_snippet`
passe par `html.escape` — les titres d'offres proviennent du scraping
(champ controle par des sites tiers) et `full_name`/`email` de l'abonne.
Alignement sur la convention du module email (services/email/templates.py).
"""
from __future__ import annotations

import html
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from models import JobOffer, Subscriber


class DigestPreviewError(Exception):
    """Erreur metier portant le code HTTP a renvoyer par la route.

    Le service ne connait pas FastAPI (couche service pure) : la route
    traduit en HTTPException.
    """

    def __init__(self, message: str, *, status_code: int = 404) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def render_digest_preview(
    db: Session,
    subscriber_id: str,
    offer_ids: list[str] | None = None,
) -> dict[str, Any]:
    """Construit un apercu HTML (sans persister) pour un abonne donne.

    Reutilise la logique du builder et retourne un rendu simplifie
    (titre de chaque offre, nom de l'abonne, nombre d'offres).
    """
    subscriber = db.scalar(select(Subscriber).where(Subscriber.id == subscriber_id))
    if not subscriber:
        raise DigestPreviewError("Abonne non trouve", status_code=404)

    offers: list[JobOffer] = []
    if offer_ids:
        # Une seule requete IN au lieu d'un db.get par offre.
        offers = list(db.scalars(select(JobOffer).where(JobOffer.id.in_(offer_ids))))
    else:
        # Pas de selection explicite : 5 offres actives liees aux filieres.
        filiere_ids = [link.filiere_id for link in subscriber.filiere_links]
        if filiere_ids:
            stmt = (
                select(JobOffer)
                .where(
                    JobOffer.primary_filiere_id.in_(filiere_ids),
                    JobOffer.visible_site.is_(True),
                    JobOffer.status == "active",
                )
                .limit(5)
            )
            offers = list(db.scalars(stmt))

    # ─── Echappement systematique (audit 2, N1) ─────────────────────
    # `title` vient du scraping (controle par des sites tiers), `full_name`
    # et `email` de l'abonne : tous potentiellement porteurs de HTML/script.
    safe_name = html.escape(subscriber.full_name or subscriber.email)
    titles = [getattr(o, "title", "") or "" for o in offers]
    items_html = "".join(f"<li>{html.escape(t)}</li>" for t in titles)

    return {
        "subscriber_name": subscriber.full_name or subscriber.email,
        "subscriber_email": subscriber.email,
        "offer_titles": titles,
        "offer_count": len(titles),
        "subject_preview": f"{len(titles)} nouvelles offres pour vous",
        "html_snippet": f"<h2>Bonjour {safe_name},</h2><ul>{items_html}</ul>",
    }


__all__ = ["DigestPreviewError", "render_digest_preview"]
