from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.deps import get_db, require_roles
from models.emails import EmailDigest
from models.enums import JobOfferStatus
from models.jobs import JobOffer
from models.referentials import ContractType, Filiere
from models.subscriptions import Subscriber, SubscriberContractPreference, SubscriberFiliere

router = APIRouter(
    prefix="/api/admin/subscribers/stats",
    tags=["admin-subscribers-stats"],
    dependencies=[Depends(require_roles("super_admin", "gestionnaire_utilisateurs"))],
)

# L'anonymisation RGPD conserve subscribed_at et l'historique d'envois :
# les agregats restent coherents apres suppression (doc v3 section 8).

# Statuts API -> statut interne attendu dans la base (bouncing != bounced).
_API_STATUS_ORDER = ("active", "unsubscribed", "bouncing", "paused", "pending", "deleted")


@router.get("/overview")
def subscribers_overview(db: Session = Depends(get_db)) -> dict:
    """Compteurs par statut (vocabulaire API) + sources + sans filiere.

    Trois GROUP BY en une route, chaque axe en une seule requete :
    - by_status : traduit l'enum interne (bounced) vers l'API (bouncing) ;
    - by_source : provenance des inscriptions ;
    - without_filiere : abonnes sans aucun lien de filiere — un abonne
      sans filiere ne recevra jamais d'offres utiles (indicateur de
      qualite actionnable).
    """
    status_rows = db.execute(
        select(Subscriber.status, func.count(Subscriber.id))
        .where(Subscriber.deleted_at.is_(None))
        .group_by(Subscriber.status)
    ).all()
    by_status: dict[str, int] = {s: 0 for s in _API_STATUS_ORDER}
    for status, count in status_rows:
        valeur = status.value if hasattr(status, "value") else str(status)
        by_status["bouncing" if valeur == "bounced" else valeur] = int(count)

    source_rows = db.execute(
        select(Subscriber.source, func.count(Subscriber.id))
        .where(Subscriber.deleted_at.is_(None))
        .group_by(Subscriber.source)
    ).all()
    by_source = {(s or "inconnu"): int(c) for s, c in source_rows}

    with_filiere = db.scalar(
        select(func.count(func.distinct(SubscriberFiliere.subscriber_id)))
    ) or 0
    total = sum(by_status.values())

    return {
        "total": total,
        "by_status": by_status,
        "by_source": by_source,
        "without_filiere": max(int(total - int(with_filiere)), 0),
    }


@router.get("/subscriptions-by-day")
def subscriptions_by_day(
    db: Session = Depends(get_db),
    days: int = Query(30, ge=1, le=365),
) -> list[dict]:
    """Inscriptions par jour sur la periode (GROUP BY date).

    Les jours sans inscription sont omis de la reponse : le frontend
    complete l'axe des temps (pas de jours inventes cote serveur).
    """
    since = datetime.now(UTC) - timedelta(days=days)
    rows = db.execute(
        select(
            func.date(Subscriber.subscribed_at).label("day"),
            func.count(Subscriber.id).label("count"),
        )
        .where(
            Subscriber.deleted_at.is_(None),
            Subscriber.subscribed_at >= since,
        )
        .group_by(func.date(Subscriber.subscribed_at))
        .order_by(func.date(Subscriber.subscribed_at).asc())
    ).all()
    return [{"day": str(r.day), "count": int(r.count)} for r in rows]


@router.get("/top-filieres")
def top_filieres(
    db: Session = Depends(get_db),
    limit: int = Query(10, ge=1, le=50),
) -> list[dict]:
    """Filieres les plus choisies (par liens d'abonnement, 1 a 3 par abonne).

    JOIN + GROUP BY en une requete ; les abonnes anonymises ne comptent
    pas (sinon une filiere serait classee sur des comptes effaces).
    """
    stmt = (
        select(Filiere.id, Filiere.code, Filiere.label, func.count(SubscriberFiliere.id).label("count"))
        .join(SubscriberFiliere, SubscriberFiliere.filiere_id == Filiere.id)
        .join(Subscriber, Subscriber.id == SubscriberFiliere.subscriber_id)
        .where(Subscriber.deleted_at.is_(None))
        .group_by(Filiere.id)
        .order_by(func.count(SubscriberFiliere.id).desc())
        .limit(limit)
    )
    rows = db.execute(stmt).all()
    return [
        {"filiere_id": r.id, "code": r.code, "label": r.label, "subscribers_count": int(r.count)}
        for r in rows
    ]


@router.get("/growth")
def subscribers_growth(
    db: Session = Depends(get_db),
    days: int = Query(90, ge=1, le=730),
) -> list[dict]:
    """Croissance cumulee : total d'abonnes (tous statuts, hors anonymises)
    atteint a la fin de chaque jour de la fenetre.

    Le cumul demarre au total historique AVANT la fenetre : la courbe ne
    redemarre pas a zero, elle continue l'historique.
    """
    since = datetime.now(UTC) - timedelta(days=days)

    # Total historique avant la fenetre (amorce de la courbe).
    base_total = int(
        db.scalar(
            select(func.count(Subscriber.id)).where(
                Subscriber.deleted_at.is_(None),
                Subscriber.subscribed_at < since,
            )
        )
        or 0
    )

    rows = db.execute(
        select(
            func.date(Subscriber.subscribed_at).label("day"),
            func.count(Subscriber.id).label("count"),
        )
        .where(
            Subscriber.deleted_at.is_(None),
            Subscriber.subscribed_at >= since,
        )
        .group_by(func.date(Subscriber.subscribed_at))
        .order_by(func.date(Subscriber.subscribed_at).asc())
    ).all()

    points: list[dict] = []
    cumul = base_total
    for r in rows:
        cumul += int(r.count)
        points.append({"day": str(r.day), "cumulative_count": cumul})
    return points


@router.get("/by-city")
def subscribers_by_city(
    db: Session = Depends(get_db),
    limit: int = Query(10, ge=1, le=50),
) -> list[dict]:
    """Repartition geographique des abonnes (top villes).

    Les abonnes sans ville sont comptes sous 'Non renseignee' — utile
    pour mesurer la completude du profil (meme indicateur que les
    filieres manquantes).

    Note SQL : le GROUP BY porte sur la colonne brute (Postgres exige
    la colonne source, pas une copie de l'expression coalesce du SELECT).
    """
    city_label = func.coalesce(func.nullif(Subscriber.city, ""), "Non renseignee")
    rows = db.execute(
        select(city_label.label("city"), func.count(Subscriber.id).label("count"))
        .where(Subscriber.deleted_at.is_(None))
        .group_by(Subscriber.city)
        .order_by(func.count(Subscriber.id).desc())
        .limit(limit)
    ).all()
    return [{"city": str(r.city), "count": int(r.count)} for r in rows]


@router.get("/top-contract-types")
def top_contract_types(
    db: Session = Depends(get_db),
    limit: int = Query(10, ge=1, le=50),
) -> list[dict]:
    """Types de contrat les plus preferes par les abonnes.

    JOIN + GROUP BY en une requete ; abonnes anonymises exclus.
    """
    stmt = (
        select(ContractType.id, ContractType.code, ContractType.label, func.count(SubscriberContractPreference.id).label("count"))
        .join(SubscriberContractPreference, SubscriberContractPreference.contract_type_id == ContractType.id)
        .join(Subscriber, Subscriber.id == SubscriberContractPreference.subscriber_id)
        .where(Subscriber.deleted_at.is_(None))
        .group_by(ContractType.id)
        .order_by(func.count(SubscriberContractPreference.id).desc())
        .limit(limit)
    )
    rows = db.execute(stmt).all()
    return [
        {"contract_type_id": r.id, "code": r.code, "label": r.label, "subscribers_count": int(r.count)}
        for r in rows
    ]


@router.get("/sends-by-day")
def sends_by_day(
    db: Session = Depends(get_db),
    days: int = Query(30, ge=1, le=365),
) -> list[dict]:
    """Digests par jour, ventiles par statut (envoye/echoue/saute/en file).

    Une requete GROUP BY (jour, statut). Meme convention que les autres
    agregats : jours absents omis, le frontend complete l'axe.
    """
    since = datetime.now(UTC) - timedelta(days=days)
    rows = db.execute(
        select(
            func.date(EmailDigest.scheduled_for).label("day"),
            EmailDigest.status,
            func.count(EmailDigest.id).label("count"),
        )
        .where(EmailDigest.scheduled_for >= since)
        .group_by(func.date(EmailDigest.scheduled_for), EmailDigest.status)
        .order_by(func.date(EmailDigest.scheduled_for).asc())
    ).all()

    par_jour: dict[str, dict] = {}
    for day, status, count in rows:
        key = str(day)
        par_jour.setdefault(key, {"sent": 0, "failed": 0, "skipped_empty": 0, "queued": 0})
        valeur = status.value if hasattr(status, "value") else str(status)
        if valeur in ("sending", "cancelled"):
            continue
        if valeur in par_jour[key]:
            par_jour[key][valeur] += int(count)
        else:
            par_jour[key]["queued"] += int(count)

    return [
        {"day": jour, **compteurs}
        for jour, compteurs in sorted(par_jour.items())
    ]


@router.get("/matching-offers-count/{subscriber_id}")
def matching_offers_count(subscriber_id: str, db: Session = Depends(get_db)) -> dict:
    """Nombre d'offres actives et visibles correspondant aux filieres de
    l'abonne (toutes priorites confondues, hors anonymises).

    Reponse au cas support n1 : « pourquoi est-ce que je ne recois rien ? »
    — si le compte est 0, le digest vide n'est pas un bug d'envoi mais un
    manque d'offres sur ses filieres.

    Deux COUNT en une route : par filiere (detail) et total (somme — une
    offre peut matcher plusieurs filieres de l'abonne, le total compte
    les offres DISTINCTES).
    """
    abonne = db.scalar(select(Subscriber).where(Subscriber.id == subscriber_id))
    if not abonne:
        raise HTTPException(status_code=404, detail="Abonne introuvable")

    filiere_ids = [lien.filiere_id for lien in abonne.filiere_links]

    if not filiere_ids:
        return {"total": 0, "by_filiere": []}

    offres_actives = (
        JobOffer.status == JobOfferStatus.ACTIVE.value,
        JobOffer.visible_site.is_(True),
        JobOffer.deleted_at.is_(None),
        JobOffer.primary_filiere_id.in_(filiere_ids),
    )

    total = int(
        db.scalar(
            select(func.count(func.distinct(JobOffer.id))).where(*offres_actives)
        )
        or 0
    )

    by_filiere_rows = db.execute(
        select(
            JobOffer.primary_filiere_id,
            func.count(JobOffer.id),
        )
        .where(*offres_actives)
        .group_by(JobOffer.primary_filiere_id)
    ).all()

    return {
        "total": total,
        "by_filiere": [
            {"filiere_id": filiere_id, "active_offers_count": int(count)}
            for filiere_id, count in by_filiere_rows
        ],
    }
