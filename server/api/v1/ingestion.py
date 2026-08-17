from __future__ import annotations

import logging
import time

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.deps import get_db, require_scraper_token
from schemas.ingestion import IngestBatchCreate, IngestBatchSummaryRead
from services.ingestion import IngestionError, ingest_offer_batch

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ingest", tags=["ingestion"])


@router.post("/offers", response_model=IngestBatchSummaryRead, status_code=status.HTTP_201_CREATED)
def ingest_offers(
    payload: IngestBatchCreate,
    db: Session = Depends(get_db),
    _: None = Depends(require_scraper_token),
) -> IngestBatchSummaryRead:
    started = time.perf_counter()
    try:
        summary = ingest_offer_batch(db, payload)
    except IngestionError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    duration_ms = int((time.perf_counter() - started) * 1000)
    logger.info(
        "Batch ingestion traite",
        extra={
            "route": "/api/ingest/offers",
            "source_code": payload.source_code,
            "batch_id": str(payload.batch_id),
            "duration_ms": duration_ms,
            "status": summary.status,
        },
    )
    return summary
