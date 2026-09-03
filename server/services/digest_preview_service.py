"""Apercu du digest (document 8 — 1.6).

Genere un rendu HTML simplifie (pas d'envoi SMTP) a partir d'une selection
d'offres et d'un abonne, sans creer de EmailDigest persistant.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from models import EmailDigest, JobOffer, Subscriber
from services.digest_builder_service import DigestBuildResult


def render_digest_preview(
    db: Session,
    subscriber_id: str,
    offer_ids: list[str] | None = None,
) -> dict:
    """Construit un apercu HTML (sans persister) pour un abonne donne.

    Reutilise la logique du builder (`payload_preview`) et retourne un
    rendu simplifie (titre de chaque offre, nom de l'abonne, nombre d'offres).
    """
    subscriber = db.scalar(select(Subscriber).where(Subscriber.id == subscriber_id))
    if not subscriber:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Abonne non trouve")

    offers = []
    if offer_ids:
        for oid in offer_ids:
            offer = db.get(JobOffer, oid)
            if offer:
                offers.append(offer)
    else:
        # Pas de selection explicite : on recupere 5 offres actives liees aux filieres
        from sqlalchemy import and_
        filiere_ids = [link.filiere_id for link in subscriber.filiere_links]
        if filiere_ids:
            stmt = select(JobOffer).where(
                JobOffer.primary_filiere_id.in_(filiere_ids),
                JobOffer.visible_site.is_(True),
                JobOffer.status == "active",
            ).limit(5)
            offers = db.scalars(stmt).all()

    titles = [getattr(o, "title", "") for o in offers]
    preview = {
        "subscriber_name": subscriber.full_name or subscriber.email,
        "subscriber_email": subscriber.email,
        "offer_titles": titles,
        "offer_count": len(titles),
        "subject_preview": f"{len(titles)} nouvelles offres pour vous",
        "html_snippet": f"<h2>Bonjour {subscriber.full_name or subscriber.email},</h2><ul>{''.join(f'<li>{t}</li>' for t in titles)}</ul>",
    }
    return preview
