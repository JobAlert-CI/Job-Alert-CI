from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.deps import get_current_admin, get_db, require_roles
from models import AIApiKey, AIAlert, AIJob, AiProcessingJob
from models.admin import AdminAction, Administrator
from models.enums import AIAlertSeverity, AiProcessingJobStatus, AiProcessingJobTrigger
from schemas.ai import (
    AIAlertAckResponse,
    AIAlertRead,
    AIApiKeyCreate,
    AIApiKeyRead,
    AIApiKeyUpdate,
    AIJobRead,
    AIQueueRead,
    AIRunRequest,
    AITestConnectionRead,
)
from services.ai_crypto import api_key_last4, decrypt_api_key, encrypt_api_key
from services.ai_errors import AIProviderError
from services.ai_providers import AIProviderFactory
from services.audit import log_admin_action

router = APIRouter(
    prefix="/api/admin/ai",
    tags=["admin-ai"],
    dependencies=[Depends(require_roles("super_admin"))],
)


def _require_key(db: Session, key_id: str) -> AIApiKey:
    item = db.get(AIApiKey, key_id)
    if item is None or item.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Cle IA introuvable")
    return item


@router.get("/keys", response_model=list[AIApiKeyRead])
def list_ai_keys(db: Session = Depends(get_db)):
    stmt = select(AIApiKey).where(AIApiKey.deleted_at.is_(None)).order_by(AIApiKey.priority, AIApiKey.created_at)
    return list(db.scalars(stmt))


@router.post("/keys", response_model=AIApiKeyRead, status_code=status.HTTP_201_CREATED)
def create_ai_key(
    payload: AIApiKeyCreate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    item = AIApiKey(
        name=payload.name.strip(),
        provider_type=payload.provider_type,
        base_url=payload.base_url,
        models=payload.models,
        api_key_encrypted=encrypt_api_key(payload.api_key),
        api_key_last4=api_key_last4(payload.api_key),
        priority=payload.priority,
        is_active=payload.is_active,
        max_concurrent_requests=payload.max_concurrent_requests,
        timeout_seconds=payload.timeout_seconds,
        max_retries=payload.max_retries,
        retry_backoff_seconds=payload.retry_backoff_seconds,
        rate_limit_per_minute=payload.rate_limit_per_minute,
        notes=payload.notes,
    )
    db.add(item)
    db.flush()
    log_admin_action(
        db,
        admin_id=admin.id,
        action=AdminAction.CREATE,
        target_table="ai_api_keys",
        target_id=item.id,
        details={"name": item.name, "provider_type": item.provider_type.value, "priority": item.priority},
    )
    db.commit()
    db.refresh(item)
    return item


@router.patch("/keys/{key_id}", response_model=AIApiKeyRead)
def update_ai_key(
    key_id: str,
    payload: AIApiKeyUpdate,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    item = _require_key(db, key_id)
    data = payload.model_dump(exclude_unset=True)
    api_key = data.pop("api_key", None)
    for field_name, value in data.items():
        setattr(item, field_name, value)
    if api_key is not None:
        item.api_key_encrypted = encrypt_api_key(api_key)
        item.api_key_last4 = api_key_last4(api_key)
    log_admin_action(
        db,
        admin_id=admin.id,
        action=AdminAction.UPDATE,
        target_table="ai_api_keys",
        target_id=item.id,
        details={"updated_fields": sorted([*data.keys(), *(["api_key"] if api_key is not None else [])])},
    )
    db.commit()
    db.refresh(item)
    return item


@router.delete("/keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ai_key(
    key_id: str,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    item = _require_key(db, key_id)
    item.deleted_at = datetime.now(timezone.utc)
    item.is_active = False
    log_admin_action(db, admin_id=admin.id, action=AdminAction.DELETE, target_table="ai_api_keys", target_id=item.id)
    db.commit()


@router.post("/keys/{key_id}/test", response_model=AITestConnectionRead)
def test_ai_key(key_id: str, db: Session = Depends(get_db)):
    item = _require_key(db, key_id)
    try:
        provider = AIProviderFactory.build(item, decrypt_api_key(item.api_key_encrypted) if item.provider_type.value != "mock" else "")
        result = provider.test_connection()
        return AITestConnectionRead(ok=bool(result.get("ok")), provider=result.get("provider"), model=result.get("model"))
    except AIProviderError as exc:
        item.last_error_at = datetime.now(timezone.utc)
        db.commit()
        return AITestConnectionRead(ok=False, message=str(exc))


@router.get("/jobs", response_model=list[AIJobRead])
def list_ai_jobs(db: Session = Depends(get_db), limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    stmt = select(AIJob).order_by(AIJob.created_at.desc()).limit(limit).offset(offset)
    return list(db.scalars(stmt))


@router.get("/queue", response_model=AIQueueRead)
def get_ai_queue(db: Session = Depends(get_db)):
    """Vue agregee de la file d'attente IA pour le tableau de bord admin.

    - `pending` / `running` : nombre de AiProcessingJob dans chaque statut
    - `pending_ai_jobs` : nombre de AIJob (cles) en attente
    - `last_sweep_at` / `last_sweep_status` : dernier sweep tous status confondus,
      pour distinguer 'pas de sweep depuis longtemps' de 'sweep recent mais vide'

    Pas de cache : chiffres toujours frais (lecture directe SQL).
    """
    counters = dict(
        db.execute(
            select(AiProcessingJob.status, func.count(AiProcessingJob.id)).group_by(AiProcessingJob.status)
        ).all()
    )
    pending_ai_jobs = db.scalar(select(func.count(AIJob.id)).where(AIJob.status == "pending")) or 0

    last_sweep = db.scalar(
        select(AiProcessingJob)
        .where(AiProcessingJob.trigger_type == AiProcessingJobTrigger.SWEEP)
        .order_by(AiProcessingJob.started_at.desc().nullslast(), AiProcessingJob.created_at.desc())
        .limit(1)
    )

    return AIQueueRead(
        pending=counters.get(AiProcessingJobStatus.PENDING.value if hasattr(AiProcessingJobStatus.PENDING, "value") else AiProcessingJobStatus.PENDING, 0),
        running=counters.get(AiProcessingJobStatus.RUNNING.value if hasattr(AiProcessingJobStatus.RUNNING, "value") else AiProcessingJobStatus.RUNNING, 0),
        pending_ai_jobs=pending_ai_jobs,
        last_sweep_at=last_sweep.started_at if last_sweep and last_sweep.started_at else None,
        last_sweep_status=last_sweep.status.value if last_sweep and hasattr(last_sweep.status, "value") else (last_sweep.status if last_sweep else None),
    )


@router.get("/alerts", response_model=list[AIAlertRead])
def list_ai_alerts(
    db: Session = Depends(get_db),
    include_acknowledged: bool = Query(False, description="Inclure les alertes deja accusees (defaut: non)"),
    severity: AIAlertSeverity | None = Query(None, description="Filtrer par severite (info/warning/error/critical)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Liste paginee des alertes IA, avec filtre acknowledged + severity."""
    stmt = select(AIAlert).order_by(AIAlert.created_at.desc())
    if not include_acknowledged:
        stmt = stmt.where(AIAlert.acknowledged_at.is_(None))
    if severity is not None:
        sev_value = severity.value if hasattr(severity, "value") else severity
        stmt = stmt.where(AIAlert.severity == sev_value)
    stmt = stmt.limit(limit).offset(offset)
    return list(db.scalars(stmt))


@router.patch("/alerts/{alert_id}/ack", response_model=AIAlertAckResponse)
def acknowledge_ai_alert(
    alert_id: str,
    db: Session = Depends(get_db),
    admin: Administrator = Depends(get_current_admin),
):
    """Accuse reception d'une alerte (idempotent : re-acquitter est sans effet).

    - 404 si l'alerte n'existe pas
    - Si deja accusee, on retourne l'horodatage existant (pas d'erreur)
    """
    alert = db.get(AIAlert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alerte IA introuvable")

    now = datetime.now(timezone.utc)
    if alert.acknowledged_at is None:
        alert.acknowledged_at = now
        alert.acknowledged_by_admin_id = admin.id
        log_admin_action(
            db,
            admin_id=admin.id,
            action=AdminAction.UPDATE,
            target_table="ai_alerts",
            target_id=alert.id,
            details={"acknowledged_at": now.isoformat()},
        )
        db.commit()
        db.refresh(alert)

    return AIAlertAckResponse(
        id=alert.id,
        acknowledged_at=alert.acknowledged_at,
        acknowledged_by_admin_id=alert.acknowledged_by_admin_id,
    )


@router.post("/run", status_code=status.HTTP_202_ACCEPTED)
def run_ai_processing(
    payload: AIRunRequest,
    admin: Administrator = Depends(get_current_admin),
):
    from tasks.ai_processing import process_raw_offers

    async_result = process_raw_offers.apply_async(
        kwargs={"trigger_type": payload.trigger_type.value, "force": payload.force},
        queue="ai",
    )
    return {"status": "queued", "task_id": async_result.id, "triggered_by": admin.id}
