"""Tests cycle 19 — Normalisation IA : stats pipeline + api_key_last4.

Couverture (feu vert utilisateur : A1 stats + A2 last4 + 2 onglets) :
1. GET /api/admin/ai/stats : base vide = zeros partout sans crash ;
   seed reel -> compteurs IA1-IA6 + axes C1/C3/C4 coherents (fenetre
   days respectee, taux d'activation, duree moyenne en secondes) ;
2. A2 : GET /keys expose api_key_last4 (le masque ****ab12 devient
   affichable — la doc v3 §19 l'exigeait, exclude=True le bloquait) ;
   la cle complete n'est JAMAIS exposee (pas de champ api_key_encrypted).

Source jobs = AIJob (ai_jobs) : c'est la table que le pipeline ecrit
reellement (sweep ET manuel y creent une ligne, verifie live cycle 19 ;
AiProcessingJob n'est rempli que par l'ingestion immediate).

⚠️ La base vit entre les tests du module (marker admin_db) : chaque
test nettoie SES lignes IA.
"""
from __future__ import annotations

import pytest

pytestmark = pytest.mark.admin_db

from datetime import UTC, datetime, timedelta

from models import AIApiKey, AIAlert, AIJob
from models.enums import (
    AIAlertSeverity,
    AIJobStatus,
    AIJobTrigger,
    AIProviderType,
)
from models.referentials import Filiere
from sqlalchemy import select


# ─── Helpers ───────────────────────────────────────────────────────────


def _cleanup(db):
    """Vide les tables IA du cycle 19 (base vivante entre tests)."""
    db.query(AIJob).delete()
    db.query(AIAlert).delete()
    db.query(AIApiKey).delete()
    db.commit()


def _add_job(db, *, status, trigger=AIJobTrigger.SWEEP, created=None,
             started=None, finished=None, total=10, activated=0, rejected=0,
             review=0, reprocess=0):
    job = AIJob(
        trigger_type=trigger,
        status=status,
        offers_total=total,
        offers_activated=activated,
        offers_rejected=rejected,
        offers_pending_review=review,
        offers_reprocess_required=reprocess,
        started_at=started,
        finished_at=finished,
    )
    if created is not None:
        job.created_at = created
    db.add(job)
    return job


# ─── 1. /ai/stats ─────────────────────────────────────────────────────


def test_stats_base_vide_zeros(admin_client, admin_db):
    _cleanup(admin_db)
    resp = admin_client.get("/api/admin/ai/stats")
    assert resp.status_code == 200
    body = resp.json()
    assert body["backlog_brut"] == 0
    assert body["jobs_fenetre"] == 0
    assert body["jobs_par_statut"] == {}
    assert body["taux_activation"] is None
    assert body["suggestions_par_statut"] == {}
    assert body["alertes_non_acquittees"] == {}
    assert body["cles_actives"] == 0
    assert body["cles_total"] == 0
    assert body["jobs_par_jour"] == []
    assert body["duree_moyenne_par_jour"] == []
    assert body["jobs_par_trigger"] == {}
    assert body["days"] == 30


def test_stats_compteurs_et_axes(admin_client, admin_db):
    """Seed : 2 jobs termines (1 today 60 % activation, 1 hier 100 %),
    1 running, 2 alertes (1 non acquittee warning), 1 cle active."""
    _cleanup(admin_db)
    now = datetime.now(UTC)
    hier = now - timedelta(days=1)
    try:
        # Job 1 : aujourd'hui, terminé en 90 s, 10 offres, 5 activées.
        _add_job(
            admin_db,
            status=AIJobStatus.COMPLETED,
            created=now,
            started=now - timedelta(seconds=90),
            finished=now - timedelta(seconds=1),
            total=10, activated=5, rejected=3, review=2,
        )
        # Job 2 : hier, terminé en 30 s, 4 offres, 4 activées.
        _add_job(
            admin_db,
            status=AIJobStatus.COMPLETED,
            trigger=AIJobTrigger.MANUAL,
            created=hier,
            started=hier - timedelta(seconds=30),
            finished=hier,
            total=4, activated=4,
        )
        # Job 3 : running (ne doit PAS fausser la durée moyenne ni le taux).
        _add_job(admin_db, status=AIJobStatus.RUNNING, created=now, started=now, total=99)
        # Alertes : 1 warning non acquittée + 1 info acquittée (exclue).
        admin_db.add(AIAlert(type="key_disabled", severity=AIAlertSeverity.WARNING, message="cle KO"))
        admin_db.add(
            AIAlert(
                type="quota",
                severity=AIAlertSeverity.INFO,
                message="ok",
                acknowledged_at=now,
            )
        )
        admin_db.commit()

        body = admin_client.get("/api/admin/ai/stats?days=30").json()
        assert body["jobs_fenetre"] == 3
        assert body["jobs_par_statut"] == {"completed": 2, "running": 1}
        # Taux : (5+4) / (10+4) = 64.3 % — le running (99 offres) est EXCLU.
        assert body["taux_activation"] == 64.3
        assert body["alertes_non_acquittees"] == {"warning": 1}

        # C1 : 2 jours présents, volumes cohérents (activees + rejetees + revue).
        jours = {j["jour"]: j for j in body["jobs_par_jour"]}
        assert len(jours) == 2
        total_activees = sum(j["activees"] for j in body["jobs_par_jour"])
        assert total_activees == 9
        assert sum(j["rejetees"] for j in body["jobs_par_jour"]) == 3
        assert sum(j["revue"] for j in body["jobs_par_jour"]) == 2

        # C3 : durée moyenne — job running EXCLU. Jour de hier : 30 s.
        durees = {d["jour"]: d["secondes"] for d in body["duree_moyenne_par_jour"]}
        assert len(durees) == 2  # les 2 jobs terminés

        # C4 : triggers.
        assert body["jobs_par_trigger"] == {"sweep": 2, "manual": 1}
    finally:
        _cleanup(admin_db)


def test_stats_fenetre_days_limite_jobs(admin_client, admin_db):
    """days=1 : le job d'il y a 3 jours sort des axes fenetre."""
    _cleanup(admin_db)
    vieux = datetime.now(UTC) - timedelta(days=3)
    try:
        _add_job(admin_db, status=AIJobStatus.COMPLETED, created=vieux, total=7, activated=7)
        admin_db.commit()
        body = admin_client.get("/api/admin/ai/stats?days=1").json()
        assert body["jobs_fenetre"] == 0
        assert body["jobs_par_jour"] == []
    finally:
        _cleanup(admin_db)


def test_stats_partial_failure_compte_dans_le_taux(admin_client, admin_db):
    """partial_failure est un statut TERMINÉ : ses volumes comptent au
    taux d'activation (le running seul est exclu)."""
    _cleanup(admin_db)
    try:
        _add_job(
            admin_db,
            status=AIJobStatus.PARTIAL_FAILURE,
            created=datetime.now(UTC),
            started=datetime.now(UTC) - timedelta(seconds=10),
            finished=datetime.now(UTC),
            total=10, activated=2, reprocess=8,
        )
        admin_db.commit()
        body = admin_client.get("/api/admin/ai/stats?days=30").json()
        assert body["jobs_par_statut"] == {"partial_failure": 1}
        assert body["taux_activation"] == 20.0
    finally:
        _cleanup(admin_db)


def test_stats_cles_actives_vs_total(admin_client, admin_db):
    _cleanup(admin_db)
    now = datetime.now(UTC)
    try:
        active = AIApiKey(
            name="cle-active",
            provider_type=AIProviderType.OPENAI,
            api_key_encrypted="x",
            api_key_last4="ab12",
            is_active=True,
        )
        inactive = AIApiKey(
            name="cle-inactive",
            provider_type=AIProviderType.OPENAI,
            api_key_encrypted="y",
            api_key_last4="cd34",
            is_active=False,
        )
        supprimee = AIApiKey(
            name="cle-supprimee",
            provider_type=AIProviderType.OPENAI,
            api_key_encrypted="z",
            api_key_last4="ef56",
            deleted_at=now,
        )
        admin_db.add_all([active, inactive, supprimee])
        admin_db.commit()

        body = admin_client.get("/api/admin/ai/stats").json()
        assert body["cles_total"] == 2  # soft-deleted EXCLUE
        assert body["cles_actives"] == 1
    finally:
        _cleanup(admin_db)


# ─── 2. A2 : api_key_last4 exposé ──────────────────────────────────────


def test_keys_exposent_last4_jamais_la_cle(admin_client, admin_db):
    """GET /keys renvoie api_key_last4 (****ab12 affichable) mais AUCUNE
    trace de la clé chiffrée ou complète."""
    _cleanup(admin_db)
    try:
        from services.ai_crypto import encrypt_api_key

        admin_db.add(
            AIApiKey(
                name="cle-cycle19",
                provider_type=AIProviderType.OPENAI,
                api_key_encrypted=encrypt_api_key("sk-cycle19-secret-value"),
                api_key_last4="b12c",
                is_active=True,
            )
        )
        admin_db.commit()

        corps = admin_client.get("/api/admin/ai/keys").json()
        assert len(corps) == 1
        cible = corps[0]
        assert cible["api_key_last4"] == "b12c"
        assert cible["api_key_masked"] == "****b12c"
        # La clé complète/chiffrée ne doit JAMAIS fuiter dans la réponse.
        brut = admin_client.get("/api/admin/ai/keys").text
        assert "sk-cycle19-secret-value" not in brut
        assert "api_key_encrypted" not in cible
    finally:
        _cleanup(admin_db)
