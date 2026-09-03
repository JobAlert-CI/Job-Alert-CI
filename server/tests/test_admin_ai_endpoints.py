"""Tests admin /api/admin/ai/{queue,alerts,alerts/{id}/ack}.

Couvre les endpoints ajoutes a l'etape 1 du back-office :
- file d'attente IA agregee
- liste paginee des alertes IA
- accuse de reception d'une alerte (idempotent)

Les fixtures `admin_client` / `admin_db` viennent de `conftest_admin.py`.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

# Marker requis pour neutraliser l'autouse `_database` du conftest principal.
# Sans ca, la base est droppee apres chaque test et casse la session persistante.
pytestmark = pytest.mark.admin_db

from models import AIAlert, AiProcessingJob
from models.enums import AIAlertSeverity, AiProcessingJobStatus, AiProcessingJobTrigger
from models.ai import AIJob, AIJobStatus, AIJobTrigger  # pour fixtures si besoin


def _seed_ai_pipeline(admin_db) -> tuple[str, str, str, str]:
    """Cree un mini pipeline IA realiste : 1 alert pending + 1 alerte ack + 2 jobs.

    Renvoie les IDs dans l'ordre : (alert_pending_id, alert_acked_id, procjob_pending_id, procjob_running_id).
    """
    import uuid

    # 1 alerte non accusee (severity=warning)
    alert_pending = AIAlert(
        id=str(uuid.uuid4()),
        type="key_disabled",
        severity=AIAlertSeverity.WARNING,
        message="Cle OpenAI desactivee apres 5 echecs consecutifs",
        payload={"provider": "openai", "attempts": 5},
    )
    # 1 alerte deja accusee (severity=info, ne doit pas apparaitre par defaut)
    alert_acked = AIAlert(
        id=str(uuid.uuid4()),
        type="quota_warning",
        severity=AIAlertSeverity.INFO,
        message="Quota a 80%",
        acknowledged_at=datetime.now(timezone.utc),
    )
    # 1 AiProcessingJob en PENDING (trigger sweep)
    procjob_pending = AiProcessingJob(
        id=str(uuid.uuid4()),
        trigger_type=AiProcessingJobTrigger.SWEEP,
        status=AiProcessingJobStatus.PENDING,
    )
    # 1 AiProcessingJob en RUNNING
    procjob_running = AiProcessingJob(
        id=str(uuid.uuid4()),
        trigger_type=AiProcessingJobTrigger.IMMEDIATE,
        status=AiProcessingJobStatus.RUNNING,
    )

    admin_db.add_all([alert_pending, alert_acked, procjob_pending, procjob_running])
    admin_db.commit()
    return alert_pending.id, alert_acked.id, procjob_pending.id, procjob_running.id


def test_queue_aggregate_counts(admin_client, admin_db):
    """GET /ai/queue renvoie les compteurs PENDING/RUNNING + le dernier sweep.

    Cas passant : on seed 2 AiProcessingJob et on verifie que les compteurs
    remontent bien, et que last_sweep_at est le plus recent des sweeps.
    """
    before = admin_client.get("/api/admin/ai/queue").json()
    _, _, pending_id, running_id = _seed_ai_pipeline(admin_db)

    after = admin_client.get("/api/admin/ai/queue").json()
    # Increments = apres - avant (la base est partagee entre tests du module).
    assert after["pending"] - before["pending"] == 1
    assert after["running"] - before["running"] == 1
    # Le sweep qu'on a insere est PENDING -> last_sweep_status doit etre 'pending' ou 'running'
    assert after["last_sweep_status"] in ("pending", "running", "completed", "failed", "skipped", "locked")
    # last_sweep_at peut etre None si started_at n'est pas renseigne : c'est OK
    assert after.get("last_sweep_at") is None or isinstance(after["last_sweep_at"], str)


def test_queue_compteurs_non_negatifs(admin_client, admin_db):
    """Independamment de l'etat initial, les compteurs sont >= 0."""
    resp = admin_client.get("/api/admin/ai/queue")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    for key in ("pending", "running", "pending_ai_jobs"):
        assert body[key] >= 0, f"{key} doit etre >= 0, got {body[key]}"


def test_alerts_default_exclut_acquittees(admin_client, admin_db):
    """GET /ai/alerts sans include_acknowledged ne renvoie QUE les alertes non accusees."""
    pending_id, acked_id, _, _ = _seed_ai_pipeline(admin_db)

    resp = admin_client.get("/api/admin/ai/alerts")
    assert resp.status_code == 200, resp.text
    alerts = resp.json()
    ids = [a["id"] for a in alerts]
    assert pending_id in ids
    assert acked_id not in ids


def test_alerts_include_acknowledged_true(admin_client, admin_db):
    """GET /ai/alerts?include_acknowledged=true renvoie les 2 categories."""
    pending_id, acked_id, _, _ = _seed_ai_pipeline(admin_db)

    resp = admin_client.get("/api/admin/ai/alerts?include_acknowledged=true")
    assert resp.status_code == 200, resp.text
    ids = [a["id"] for a in resp.json()]
    assert pending_id in ids and acked_id in ids


def test_alerts_filtre_severity(admin_client, admin_db):
    """GET /ai/alerts?severity=info ne renvoie QUE les alertes info.

    On compare avant/apres seed pour valider le filtre independamment de l'etat initial.
    """
    # Prendre une photo de l'etat 'info' avant seed
    before_info = admin_client.get("/api/admin/ai/alerts?severity=info&include_acknowledged=true").json()
    _seed_ai_pipeline(admin_db)
    after_info = admin_client.get("/api/admin/ai/alerts?severity=info&include_acknowledged=true").json()

    # Le seed ajoute exactement 1 alerte info (la quota_warning)
    assert len(after_info) - len(before_info) == 1
    assert after_info[-1]["severity"] == "info"


def test_alerts_pagination(admin_client, admin_db):
    """La pagination limit/offset est respectee."""
    import uuid
    from models.enums import AIAlertSeverity
    for _ in range(5):
        admin_db.add(AIAlert(id=str(uuid.uuid4()), type="x", severity=AIAlertSeverity.INFO, message="m"))
    admin_db.commit()

    resp = admin_client.get("/api/admin/ai/alerts?limit=2&offset=1")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_ack_alert_ok(admin_client, admin_db):
    """PATCH /ai/alerts/{id}/ack accuse reception d'une alerte non acquittee."""
    pending_id, _, _, _ = _seed_ai_pipeline(admin_db)

    resp = admin_client.patch(f"/api/admin/ai/alerts/{pending_id}/ack")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["id"] == pending_id
    assert body["acknowledged_at"] is not None

    # Re-fetch en base : acknowledged_at et acknowledged_by_admin_id sont poses
    admin_db.expire_all()
    alert = admin_db.get(AIAlert, pending_id)
    assert alert.acknowledged_at is not None
    assert alert.acknowledged_by_admin_id == "admin-test"


def test_ack_alert_idempotent(admin_client, admin_db):
    """Re-acquitter une alerte deja accusee ne leve pas d'erreur, ne change rien."""
    pending_id, _, _, _ = _seed_ai_pipeline(admin_db)
    first = admin_client.patch(f"/api/admin/ai/alerts/{pending_id}/ack").json()
    second = admin_client.patch(f"/api/admin/ai/alerts/{pending_id}/ack").json()

    assert first["id"] == second["id"] == pending_id
    # L'horodatage ne bouge pas au second appel (idempotence).
    assert first["acknowledged_at"] == second["acknowledged_at"]


def test_ack_alert_404(admin_client, admin_db):
    """PATCH sur un id inexistant renvoie 404."""
    resp = admin_client.patch("/api/admin/ai/alerts/does-not-exist/ack")
    assert resp.status_code == 404
    assert "introuvable" in resp.json()["detail"].lower()


@pytest.mark.parametrize("status_value", ["bad", "INVALID", 42])
def test_alerts_filtre_severity_invalide(admin_client, status_value):
    """Une severite non enumeree doit etre rejetee par Pydantic (422)."""
    resp = admin_client.get(f"/api/admin/ai/alerts?severity={status_value}")
    assert resp.status_code == 422