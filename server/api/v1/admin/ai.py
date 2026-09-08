from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.deps import get_current_admin, get_db, require_roles
from models import AIAlert, AIApiKey, AIJob, AiProcessingJob
from models.admin import AdminAction, Administrator
from models.enums import AIAlertSeverity, AIJobStatus, AiProcessingJobStatus
from schemas.ai import (
    AIAlertAckResponse,
    AIAlertRead,
    AIApiKeyCreate,
    AIApiKeyRead,
    AIApiKeyUpdate,
    AIJobRead,
    AIQueueRead,
    AIRunRequest,
    AIStatsRead,
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

    # Audit P1 #29: empecher la desactivation de la derniere cle IA active.
    will_be_inactive = (
        ("is_active" in data and data["is_active"] is False)
        or ("max_concurrent_requests" in data and data["max_concurrent_requests"] == 0)
    )
    if will_be_inactive:
        other_active_count = db.scalar(
            select(func.count(AIApiKey.id)).where(
                AIApiKey.id != item.id,
                AIApiKey.is_active.is_(True),
                AIApiKey.deleted_at.is_(None),
            )
        )
        if (other_active_count or 0) == 0:
            raise HTTPException(
                status_code=400,
                detail="Impossible de desactiver la derniere cle IA active.",
            )

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

    # Audit P1 #29: ne pas supprimer la derniere cle active.
    if item.is_active:
        other_active_count = db.scalar(
            select(func.count(AIApiKey.id)).where(
                AIApiKey.id != item.id,
                AIApiKey.is_active.is_(True),
                AIApiKey.deleted_at.is_(None),
            )
        )
        if (other_active_count or 0) == 0:
            raise HTTPException(
                status_code=400,
                detail="Impossible de supprimer la derniere cle IA active.",
            )

    item.deleted_at = datetime.now(UTC)
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
        item.last_error_at = datetime.now(UTC)
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
      (file d'attente post-ingestion immediate)
    - `pending_ai_jobs` : nombre de AIJob (cles) en attente
    - `last_sweep_at` / `last_sweep_status` : dernier job de trigger SWEEP
      sur AIJob — c'est LA que le sweep ecrit (le task sans ai_job_id ne
      touche jamais AiProcessingJob ; avant ce fix, last_sweep_at etait
      systematiquement null en production, verifie live cycle 19)

    Pas de cache : chiffres toujours frais (lecture directe SQL).
    """
    from models.enums import AIJobTrigger

    counters = dict(
        db.execute(
            select(AiProcessingJob.status, func.count(AiProcessingJob.id)).group_by(AiProcessingJob.status)
        ).all()
    )
    pending_ai_jobs = db.scalar(select(func.count(AIJob.id)).where(AIJob.status == "pending")) or 0

    last_sweep = db.scalar(
        select(AIJob)
        .where(AIJob.trigger_type == AIJobTrigger.SWEEP)
        .order_by(AIJob.created_at.desc())
        .limit(1)
    )

    def _statut(valeur):
        return valeur.value if hasattr(valeur, "value") else valeur

    return AIQueueRead(
        pending=counters.get(_statut(AiProcessingJobStatus.PENDING), 0),
        running=counters.get(_statut(AiProcessingJobStatus.RUNNING), 0),
        pending_ai_jobs=pending_ai_jobs,
        last_sweep_at=last_sweep.created_at if last_sweep else None,
        last_sweep_status=_statut(last_sweep.status) if last_sweep else None,
    )


@router.get("/stats", response_model=AIStatsRead)
def ai_stats(
    db: Session = Depends(get_db),
    days: int = Query(30, ge=1, le=365, description="Fenetre des axes jobs (C1, C3, C4)"),
):
    """Stats du pipeline IA (cycle 19) — compteurs IA1-IA6 + charts C1-C5.

    Source jobs : AIJob (ai_jobs) — c'est la table que le pipeline ecrit
    reellement (sweep ET runs manuels y creent une ligne ; AiProcessingJob
    n'est rempli que par l'ingestion immediate, verifie live cycle 19).
    La table /jobs affichee par l'onglet Pipeline sert la meme : compteurs,
    charts et table restent coherents.

    Pieges respectes :
    - COUNT = 0 sur base vide ; SUM/volumes calcules en Python avec
      fallback 0 (pattern SUM NULL documente) ;
    - duree moyenne : jobs TERMINES seulement (started_at + finished_at
      non null) — un job running n'entend pas fausser la moyenne ;
    - taux d'activation : jobs termines seulement (un job running n'a
      pas ses volumes finaux) ;
    - func.date() portable SQLite (tests) ET PostgreSQL (prod).
    """
    from datetime import UTC, datetime, timedelta

    from models import AIFiliereSuggestion, JobOffer, JobOfferStatus

    maintenant = datetime.now(UTC)
    depuis = maintenant - timedelta(days=days)

    # ── IA1 : backlog brut (global) ──
    backlog_brut = (
        db.scalar(select(func.count(JobOffer.id)).where(JobOffer.status == JobOfferStatus.BRUT)) or 0
    )

    # ── IA2 + C2 : jobs fenetre par statut (vocabulaire AIJobStatus) ──
    jobs_par_statut = {}
    for statut, total in db.execute(
        select(AIJob.status, func.count())
        .where(AIJob.created_at >= depuis)
        .group_by(AIJob.status)
    ).all():
        cle = statut.value if hasattr(statut, "value") else str(statut)
        jobs_par_statut[cle] = total
    jobs_fenetre = sum(jobs_par_statut.values())

    # ── IA3 : taux d'activation sur la fenetre (jobs TERMINES seulement) ──
    statuts_termines = (AIJobStatus.COMPLETED, AIJobStatus.PARTIAL_FAILURE, AIJobStatus.FAILED)
    ligne_activation = db.execute(
        select(
            func.sum(AIJob.offers_total),
            func.sum(AIJob.offers_activated),
        )
        .where(
            AIJob.created_at >= depuis,
            AIJob.status.in_(statuts_termines),
        )
    ).one()
    total_offres = int(ligne_activation[0] or 0)
    total_activees = int(ligne_activation[1] or 0)
    taux_activation = round(100.0 * total_activees / total_offres, 1) if total_offres else None

    # ── IA4 : suggestions par statut ──
    suggestions_par_statut = {}
    for statut, total in db.execute(
        select(AIFiliereSuggestion.status, func.count()).group_by(AIFiliereSuggestion.status)
    ).all():
        cle = statut.value if hasattr(statut, "value") else str(statut)
        suggestions_par_statut[cle] = total

    # ── IA5 : alertes NON acquittees par severite ──
    alertes_non_acquittees = {}
    for severite, total in db.execute(
        select(AIAlert.severity, func.count())
        .where(AIAlert.acknowledged_at.is_(None))
        .group_by(AIAlert.severity)
    ).all():
        cle = severite.value if hasattr(severite, "value") else str(severite)
        alertes_non_acquittees[cle] = total

    # ── IA6 : cles actives / total (soft-deleted exclus) ──
    cles_total = db.scalar(select(func.count(AIApiKey.id)).where(AIApiKey.deleted_at.is_(None))) or 0
    cles_actives = (
        db.scalar(
            select(func.count(AIApiKey.id)).where(
                AIApiKey.deleted_at.is_(None), AIApiKey.is_active.is_(True)
            )
        )
        or 0
    )

    # ── C1 : volumes/jour empilables (fenetre) — les 4 compteurs d'AIJob ──
    lignes_jour = db.execute(
        select(
            func.date(AIJob.created_at),
            func.sum(AIJob.offers_activated),
            func.sum(AIJob.offers_rejected),
            func.sum(AIJob.offers_pending_review),
            func.sum(AIJob.offers_reprocess_required),
            func.count(AIJob.id),
        )
        .where(AIJob.created_at >= depuis)
        .group_by(func.date(AIJob.created_at))
        .order_by(func.date(AIJob.created_at))
    ).all()
    jobs_par_jour = [
        {
            "jour": str(jour),
            "activees": int(activees or 0),
            "rejetees": int(rejetees or 0),
            "revue": int(revue or 0),
            "retraiter": int(retraiter or 0),
            "jobs": int(nb_jobs or 0),
        }
        for jour, activees, rejetees, revue, retraiter, nb_jobs in lignes_jour
    ]

    # ── C3 : duree moyenne des jobs termines par jour (secondes) ──
    # Calcul PYTHON portable (pas func.julianday — SQLite only) : on lit
    # started_at/finished_at des jobs termines de la fenetre (volumes
    # faibles, quelques lignes) et on moyenne en Python.
    lignes_duree = db.execute(
        select(AIJob.started_at, AIJob.finished_at)
        .where(
            AIJob.created_at >= depuis,
            AIJob.finished_at.is_not(None),
            AIJob.started_at.is_not(None),
        )
        .order_by(AIJob.finished_at)
    ).all()
    durees_par_jour: dict[str, list[float]] = {}
    for started_at, finished_at in lignes_duree:
        if started_at is None or finished_at is None:
            continue
        secondes = (finished_at - started_at).total_seconds()
        if secondes < 0:
            continue
        jour = str(finished_at.date())
        durees_par_jour.setdefault(jour, []).append(secondes)
    duree_moyenne_par_jour = [
        {"jour": jour, "secondes": round(sum(valeurs) / len(valeurs), 1)}
        for jour, valeurs in sorted(durees_par_jour.items())
    ]

    # ── C4 : jobs par trigger (fenetre, vocabulaire AIJobTrigger) ──
    jobs_par_trigger = {}
    for trigger, total in db.execute(
        select(AIJob.trigger_type, func.count())
        .where(AIJob.created_at >= depuis)
        .group_by(AIJob.trigger_type)
    ).all():
        cle = trigger.value if hasattr(trigger, "value") else str(trigger)
        jobs_par_trigger[cle] = total

    return AIStatsRead(
        backlog_brut=backlog_brut,
        jobs_fenetre=jobs_fenetre,
        jobs_par_statut=jobs_par_statut,
        taux_activation=taux_activation,
        suggestions_par_statut=suggestions_par_statut,
        alertes_non_acquittees=alertes_non_acquittees,
        cles_actives=cles_actives,
        cles_total=cles_total,
        jobs_par_jour=jobs_par_jour,
        duree_moyenne_par_jour=duree_moyenne_par_jour,
        jobs_par_trigger=jobs_par_trigger,
        days=days,
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

    now = datetime.now(UTC)
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
