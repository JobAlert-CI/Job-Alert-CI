from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from api.deps import get_current_admin, get_db, require_roles
from schemas.aggregates import OfferSummaryRead, SearchResultsRead
from services.admin_aggregates import global_search, top_viewed_offers

# Dashboard et widgets transverses (top, recherche globale).
# Acces : tous les admins auth (lecture seule, pas de modification).
router = APIRouter(
    prefix="/api/admin",
    tags=["admin-aggregates"],
    dependencies=[Depends(require_roles("super_admin", "gestionnaire_offres", "gestionnaire_utilisateurs"))],
)


@router.get("/dashboard/top-viewed-offers", response_model=list[OfferSummaryRead])
def get_top_viewed_offers(
    db: Session = Depends(get_db),
    _: object = Depends(get_current_admin),
    days: int = Query(7, ge=1, le=90, description="Fenetre temporelle en jours (info, pas encore filtree sur last_seen_at)"),
    limit: int = Query(10, ge=1, le=50),
):
    """Top N offres par nombre de vues (active + visible_site=True seulement).

    Placee sous `/api/admin/dashboard/...` et non `/api/admin/offers/...`
    pour eviter un conflit avec `GET /api/admin/offers/{offer_id}` qui
    capturerait `/offers/top-viewed` avec `offer_id="top-viewed"`.

    Note : le parametre `days` est reserve pour evolution future. Aujourd'hui
    on tri par `view_count DESC` sur toutes les offres actives. Le filtre sera
    branche quand on aura un `last_view_at` fiable.
    """
    return top_viewed_offers(db, days=days, limit=limit)


@router.get("/search", response_model=SearchResultsRead)
def admin_global_search(
    db: Session = Depends(get_db),
    _: object = Depends(get_current_admin),
    q: str = Query(..., min_length=1, description="Terme de recherche (1 caractere minimum)"),
    per_type_limit: int = Query(10, ge=1, le=50, description="Plafond par groupe (offres, abonnes, entreprises)"),
):
    """Recherche transverse : offres (titre), abonnes (email/nom), entreprises (nom).

    Les resultats sont groupes par type dans la reponse pour faciliter
    l'affichage cote front. Chaque groupe est plafonne par `per_type_limit`.
    """
    return global_search(db, query=q, per_type_limit=per_type_limit)


__all__ = ["router"]
