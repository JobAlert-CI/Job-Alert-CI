from __future__ import annotations

from pydantic import BaseModel


class OfferStatsSummaryRead(BaseModel):
    total_offers: int
    new_offers: int


class OfferStatsBucketRead(BaseModel):
    id: str
    code: str
    label: str
    total_offers: int
    new_offers: int
    color_hex: str | None = None
