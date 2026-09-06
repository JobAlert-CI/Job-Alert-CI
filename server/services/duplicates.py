from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from models.admin import AdminAction
from models.jobs import JobOffer, JobOfferStatus
from models.rejected_duplicates import RejectedDuplicatePair
from services.audit import log_admin_action
from services.normalization import normalize_text


class DuplicateServiceError(Exception):
    """Erreur metier portant le code HTTP a renvoyer par la route."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


# Audit 2, R2/F2: plafond memoire + selectinload pour eviter le lazy-load N+1.
MAX_OFFERS_FOR_DUPLICATE_SCAN = 1000
# Audit 2, R3: profondeur maximale du parcours anti-cycles.
MAX_DUPLICATE_CHAIN_DEPTH = 10

# Mots trop frequents pour distinguer deux titres d'offres.
_STOPWORDS_FR = frozenset(
    ["a", "au", "aux", "avec", "ce", "cet", "cette", "des", "du", "en", "et", "il", "elle", "je", "la", "le", "les", "leur", "lui", "ma", "mes", "mon", "nos", "notre", "on", "ou", "par", "pour", "qu", "que", "qui", "sa", "se", "ses", "sur", "te", "tes", "ton", "tous", "tout", "trop", "tu", "un", "une", "vos", "votre", "vous", "d", "l", "m", "n", "s", "t", "y", "etre", "afrique", "africaine", "ci", "cote", "d", "ivoire", "offre", "emploi", "poste", "job", "mission", "missions"]
)


def _similarity_tokens(title: str | None) -> set[str]:
    """Tokens normalises et significatifs d'un titre (stopwords retires)."""

    tokens = normalize_text(title).split()
    return {t for t in tokens if len(t) > 1 and t not in _STOPWORDS_FR}


def _title_similarity(title_a: str | None, title_b: str | None) -> int:
    """Score de similarite 0-100 entre deux titres (Dice sur tokens).

    Formule: 2 x |A n B| / (|A| + |B|) — le coefficient de Dice, qui
    recompense les quasi-subsets: « Developpeur React » vs « Developpeur
    React Junior » donne ~80 (vs 67 en Jaccard pur), plus proche de
    l'intuition d'un doublon reposte avec un detail en plus.
    100 = titres identiques apres normalisation. Retourne un entier:
    c'est ce score qui est affiche et compare au seuil admin.
    """

    ta, tb = _similarity_tokens(title_a), _similarity_tokens(title_b)
    if not ta or not tb:
        return 0
    inter = len(ta & tb)
    total = len(ta) + len(tb)
    if total == 0 or inter == 0:
        return 0
    return round(2 * inter / total * 100)


def _pair_key(offer_a_id: str, offer_b_id: str) -> tuple[str, str]:
    """Cle ordonnee d'une paire d'IDs (canonique, insensible au sens A/B)."""

    a, b = offer_a_id, offer_b_id
    return (a, b) if a < b else (b, a)


def find_potential_duplicates(
    db: Session,
    *,
    company_id: str | None = None,
    min_similarity: int = 80,
) -> tuple[list[dict], bool]:
    """Renvoie (paires potentiellement doublons, scan_tronque).

    Strategie en deux temps:
    1. Groupes candidats = memes entreprise normalisee + premier mot du
       titre (pre-filtre peu couteux qui limite les comparaisons).
    2. Score reel de similarite (Jaccard sur tokens) calcule par paire;
       seules les paires au-dessus du seuil demandees sont renvoyees.

    Paires explicitement rejetees par un admin (RejectedDuplicatePair):
    filtrees en amont — une paire jugée non-doublon ne reapparait pas
    dans les scans suivants (promesse de la doc v3 section 5).

    Corrections audit 2:
    - R2: plus de dict `_warning` melange aux candidates — un bool
      `truncated` est renvoye a part, la route le met en header HTTP.
    - F2: `selectinload(JobOffer.company)` evite 1 requete par offre.
    """
    base_filter = (
        JobOffer.status.in_([JobOfferStatus.ACTIVE.value]),
        JobOffer.visible_site.is_(True),
        JobOffer.duplicate_of_id.is_(None),
        JobOffer.is_duplicate.is_(False),
    )

    rows = db.scalars(
        select(JobOffer)
        .options(selectinload(JobOffer.company))
        .where(*base_filter)
        .limit(MAX_OFFERS_FOR_DUPLICATE_SCAN)
    ).all()
    truncated = len(rows) >= MAX_OFFERS_FOR_DUPLICATE_SCAN

    # Paires rejetees par un admin: chargees une seule fois, comparees
    # par cle ordonnee (le rejet est stocke trié, insensible au sens).
    rejected = {
        _pair_key(p.offer_a_id, p.offer_b_id)
        for p in db.scalars(select(RejectedDuplicatePair)).all()
    }

    groups: dict = {}
    for o in rows:
        company = o.company
        if not company:
            continue
        norm = company.normalized_name or company.name
        if company_id and company.id != company_id:
            continue
        first_word = (o.normalized_title or o.title).lower().split()[0] if (o.normalized_title or o.title) else ""
        key = (norm, first_word)
        groups.setdefault(key, []).append(o)

    candidates = []
    for group in groups.values():
        if len(group) < 2:
            continue
        for i in range(len(group)):
            a = group[i]
            for b in group[i + 1 :]:
                pair = _pair_key(a.id, b.id)
                if pair in rejected:
                    continue
                score = _title_similarity(a.normalized_title or a.title, b.normalized_title or b.title)
                if score < min_similarity:
                    continue
                candidates.append(
                    {
                        "offer_a_id": a.id,
                        "offer_b_id": b.id,
                        "offer_a_title": a.title,
                        "offer_b_title": b.title,
                        "offer_a_company": a.company.normalized_name if a.company else None,
                        "similarity_score": score,
                        "reason": f"Meme entreprise ({a.company.normalized_name if a.company else 'N/A'}) et titre proche",
                    }
                )
    # Tri par score decroissant: l'admin traite d'abord les cas evidents.
    candidates.sort(key=lambda c: c["similarity_score"], reverse=True)
    return candidates, truncated


def _would_create_cycle(db: Session, source: JobOffer, target: JobOffer) -> bool:
    """Detecte un cycle en remontant la chaine duplicate_of depuis `target`.

    Audit 2, R3: la garde a 1 niveau laissait passer a->c->b. On parcourt
    la chaine avec une borne pour eviter les boucles infinies sur donnees
    deja corrompues.
    """
    current = target
    for _ in range(MAX_DUPLICATE_CHAIN_DEPTH):
        if current is None:
            return False
        if current.id == source.id:
            return True
        next_id = current.duplicate_of_id
        if next_id is None:
            return False
        current = db.get(JobOffer, next_id)
    # Chaine plus longue que la borne: on refuse par prudence.
    return True


def mark_duplicate(
    db: Session,
    *,
    offer_b_id: str,
    duplicate_of_id: str,
    reason: str | None = None,
    admin_id: str | None = None,
) -> dict:
    """Marque B comme doublon de A. Refuse cycles (profonds) + a == b.

    Audit 2, R4: action tracee via `log_admin_action` (elle change la
    visibilite publique d'une offre).
    """
    if offer_b_id == duplicate_of_id:
        raise DuplicateServiceError("Une offre ne peut pas etre son propre doublon", status_code=400)

    b = db.get(JobOffer, offer_b_id)
    if not b:
        raise DuplicateServiceError("Offre B introuvable", status_code=404)
    a = db.get(JobOffer, duplicate_of_id)
    if not a:
        raise DuplicateServiceError("Offre A (reference) introuvable", status_code=404)

    # Audit 2, R3: detection de cycles par parcours borne (a->c->b compris).
    if _would_create_cycle(db, source=b, target=a):
        raise DuplicateServiceError(
            "Cycle detecte: A est deja (directement ou indirectement) un doublon de B.",
            status_code=409,
        )

    b.duplicate_of_id = a.id
    b.is_duplicate = True
    b.duplicate_reason = reason or f"Doublon de {a.id}"

    if admin_id:
        log_admin_action(
            db,
            admin_id=admin_id,
            action=AdminAction.UPDATE,
            target_table="job_offers",
            target_id=b.id,
            details={"marked_duplicate_of": a.id, "reason": reason},
        )
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
    """Marque la paire comme explicitement NON doublon (trace dans l'audit)."""
    if offer_a_id == offer_b_id:
        raise DuplicateServiceError("Paire invalide (a == b)", status_code=400)

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
        reviewed_at=datetime.now(UTC),
    )
    db.add(pair)

    if admin_id:
        log_admin_action(
            db,
            admin_id=admin_id,
            action=AdminAction.UPDATE,
            target_table="rejected_duplicate_pairs",
            target_id=a_id,
            details={"rejected_pair_with": b_id, "reason": reason},
        )
    db.commit()
    return {"message": "Paire rejetee", "offer_a_id": a_id, "offer_b_id": b_id}


__all__ = [
    "MAX_DUPLICATE_CHAIN_DEPTH",
    "MAX_OFFERS_FOR_DUPLICATE_SCAN",
    "DuplicateServiceError",
    "find_potential_duplicates",
    "mark_duplicate",
    "reject_duplicate_pair",
]
