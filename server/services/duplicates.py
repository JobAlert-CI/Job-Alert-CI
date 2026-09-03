from __future__ import annotations

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from models.jobs import Company, JobOffer, JobOfferStatus
from models.rejected_duplicates import RejectedDuplicatePair


def find_potential_duplicates(
    db: Session,
    *,
    company_id: str | None = None,
    min_similarity: int = 80,
) -> list[dict]:
    """Renvoie des paires (A, B) d'offres potentiellement doublons.

    Strategie : offres actives (non supprimees, non archivees) du meme
    entreprise normalisee, avec le meme status, dont le titre normalise
    est proche (meme prefixe ou meme mot-cle dominant). On filtre
    ensuite celles dont `duplicate_of_id` est vide et `is_duplicate` False.

    Note : le calcul de similarite est simplifie (meme entreprise + meme
    premier mot du titre) car une vraie distance de Levenshtein serait
    trop couteuse en SQL pur.
    """
    # 1. Filtre de base : offres actives, non soft-delete, non deja marquees doublon
    base_filter = (
        JobOffer.status.in_([JobOfferStatus.ACTIVE.value]),
        JobOffer.visible_site.is_(True),
        JobOffer.duplicate_of_id.is_(None),
        JobOffer.is_duplicate.is_(False),
    )
    offers = db.scalars(select(JobOffer).where(*base_filter)).all()

    # 2. Groupement par entreprise normalisee + premier mot du titre
    groups: dict = {}
    for o in offers:
        company = o.company
        if not company:
            continue
        norm = company.normalized_name or company.name
        if company_id and company.id != company_id:
            continue
        first_word = (o.normalized_title or o.title).lower().split()[0] if (o.normalized_title or o.title) else ""
        key = (norm, first_word)
        groups.setdefault(key, []).append(o)

    # 3. Paires potentielles
    candidates = []
    for group in groups.values():
        if len(group) < 2:
            continue
        # Prendre la premiere offre comme reference (A) et comparer avec le reste
        for i in range(len(group)):
            a = group[i]
            for b in group[i + 1:]:
                candidates.append({
                    "offer_a_id": a.id,
                    "offer_b_id": b.id,
                    "offer_a_title": a.title,
                    "offer_b_title": b.title,
                    "offer_a_company": a.company.normalized_name if a.company else None,
                    "similarity_score": min_similarity,  # simplifie
                    "reason": f"Meme entreprise ({a.company.normalized_name if a.company else 'N/A'}) et titre proche",
                })
    return candidates


def mark_duplicate(
    db: Session,
    *,
    offer_b_id: str,
    duplicate_of_id: str,
    reason: str | None = None,
    admin_id: str | None = None,
) -> dict:
    b = db.get(JobOffer, offer_b_id)
    if not b:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Offre B introuvable")
    a = db.get(JobOffer, duplicate_of_id)
    if not a:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Offre A (reference) introuvable")

    b.duplicate_of_id = a.id
    b.is_duplicate = True
    b.duplicate_reason = reason or f"Doublon de {a.id}"
    db.commit()
    return {
        "message": f"Offre {offer_b_id} marquee comme doublon de {duplicate_of_id}",
        "duplicate_of_id": a.id,
        "is_duplicate": True,
    }


def reject_duplicate_pair(
    db: Session,
    *,
    offer_a_id: str,
    offer_b_id: str,
    reason: str | None = None,
    admin_id: str | None = None,
) -> dict:
    # Ordonner A < B (constraint base)
    a_id, b_id = (offer_a_id, offer_b_id) if offer_a_id < offer_b_id else (offer_b_id, offer_a_id)
    existing = db.scalar(
        select(RejectedDuplicatePair).where(
            RejectedDuplicatePair.offer_a_id == a_id,
            RejectedDuplicatePair.offer_b_id == b_id,
        )
    )
    if existing:
        return {"message": "Paire deja rejetee", "offer_a_id": a_id, "offer_b_id": b_id}

    pair = RejectedDuplicatePair(
        offer_a_id=a_id,
        offer_b_id=b_id,
        reason=reason,
        reviewed_by_admin_id=admin_id,
        reviewed_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
    )
    db.add(pair)
    db.commit()
    return {"message": "Paire rejetee", "offer_a_id": a_id, "offer_b_id": b_id}
