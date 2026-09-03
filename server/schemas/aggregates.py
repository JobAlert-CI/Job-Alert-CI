from __future__ import annotations

"""Schemas legers pour les agregations du tableau de bord admin.

Objectif : eviter de renvoyer la fiche complete (JobOfferDetailRead) quand on
n'a besoin que d'un resume (top, recherche globale...).
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CompanySummary(BaseModel):
    """Sous-ensemble de CompanyRead : juste assez pour identifier une entreprise."""

    id: str
    name: str
    slug: Optional[str] = None


class OfferSummaryRead(BaseModel):
    """Vue compacte d'une offre pour les listes agregees.

    Distinct de `JobOfferRead` : ici on n'embarque ni les relations
    contract_type/experience_level/..., ni le detail, ni les timestamps
    fins (collected_at, last_seen_at...). Ce qu'on garde : les champs
    utiles pour un widget dashboard ('Top 10', resultats de recherche).
    """

    id: str
    title: str
    status: str
    visible_site: bool
    view_count: int
    save_count: int
    published_at: Optional[datetime] = None
    company: CompanySummary
    primary_filiere_id: Optional[str] = None


class SearchResultsRead(BaseModel):
    """Reponse de la recherche globale : resultats groupes par type.

    Chaque liste est plafonnee (`per_type_limit`) pour eviter qu'une
    recherche tres large ne sature la reponse.
    """

    query: str = Field(description="La chaine recherchee, renvoyee telle quelle pour echo cote UI")
    per_type_limit: int = Field(description="Le plafond applique a chaque groupe")
    offers: list[OfferSummaryRead] = Field(default_factory=list)
    subscribers: list["SubscriberSummaryRead"] = Field(default_factory=list)
    companies: list["CompanySummary"] = Field(default_factory=list)


class SubscriberSummaryRead(BaseModel):
    """Vue compacte d'un abonne pour la recherche globale / listes support."""

    id: str
    email: str
    full_name: Optional[str] = None
    status: str
    city: Optional[str] = None


__all__ = [
    "CompanySummary",
    "OfferSummaryRead",
    "SearchResultsRead",
    "SubscriberSummaryRead",
]