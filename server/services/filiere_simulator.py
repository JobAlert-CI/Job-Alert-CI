"""Simulation du matching de mots-clés d'une filière.

Prend une liste de mots-clés (candidats) et renvoie le nombre d'offres des
7 derniers jours qui seraient taguées différemment, SANS appliquer la
modification (pas d'écriture en base).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from models.referentials import Filiere, FiliereKeyword
from models.jobs import JobOffer


def simulate_filiere_matching(
    db: Session,
    filiere_code: str,
    keywords: list[dict],
    days: int = 7,
) -> dict:
    """Simule le matching avec de nouveaux mots-clés sans sauvegarder.

    Renvoie un rapport contenant :
    - nombre actuel de mots-clés
    - nombre proposé
    - nombre d'offres des 7 derniers jours qui seraient affectées
    (c'est-à-dire dont le titre contient au moins un des mots-clés proposés
     mais aucun des mots-clés actuels, ou inversement)
    """
    filiere = db.scalar(select(Filiere).where(Filiere.code == filiere_code))
    if not filiere:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Filière {filiere_code} non trouvée")

    # Mots-clés actuels
    current = db.scalars(select(FiliereKeyword).where(FiliereKeyword.filiere_id == filiere.id)).all()
    current_words = {k.normalized_keyword for k in current}

    proposed_words = set()
    for item in keywords:
        word = (item.get("keyword", "")).lower().strip()
        if word:
            proposed_words.add(word)

    # Offres des 7 derniers jours liées à cette filière (via primary_filiere ou tags)
    since = datetime.now(timezone.utc) - timedelta(days=days)
    offers_stmt = (
        select(JobOffer)
        .where(
            JobOffer.primary_filiere_id == filiere.id,
            JobOffer.collected_at >= since,
        )
    )
    offers = db.scalars(offers_stmt.execution_options(yield_per=200)).all()

    affected = 0
    for offer in offers:
        title_words = set((offer.normalized_title or offer.title or "").lower().split())
        current_match = bool(title_words & current_words)
        proposed_match = bool(title_words & proposed_words)
        if current_match != proposed_match:
            affected += 1

    return {
        "filiere_code": filiere.code,
        "filiere_label": filiere.label,
        "current_keyword_count": len(current_words),
        "proposed_keyword_count": len(proposed_words),
        "offers_affected_7_days": affected,
        "message": (
            f"{affected} offre(s) des 7 derniers jours seraient affectées"
            f" (sur {len(offers)} liées à cette filière)."
        ),
    }
