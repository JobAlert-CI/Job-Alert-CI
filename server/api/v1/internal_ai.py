from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.deps import get_db, require_internal_token
from schemas.ai import AIInternalResultSubmission, AIValidationSummary
from services.ai_results import apply_ai_results

router = APIRouter(prefix="/api/internal/ai", tags=["internal-ai"])


@router.post("/results", response_model=AIValidationSummary)
def submit_ai_results(
    payload: AIInternalResultSubmission,
    db: Session = Depends(get_db),
    _: None = Depends(require_internal_token),
) -> AIValidationSummary:
    summary = apply_ai_results(db, payload)
    db.commit()
    return summary
