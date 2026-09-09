"""Tests du Lot 1 (audit 4) : pipeline de scraping admin relie au reel.

Couvre :
- C.2 : 409 metier sur double trigger (pre-check (run_date, triggered_by)) ;
- C.1/C.3 : le trigger dispatche reellement les tasks Celery avec le
  run_reference, et le batch d'ingestion ADOPTE le run admin PENDING ;
- C.4 : PATCH /runs/{id} notes (journalise via log_admin_action) ;
- C.6 : pagination + filtre level sur /runs/{id}/logs ;
- M.1 : requalify_stale_runs conclut les zombies PENDING/RUNNING ;
- recompute du parent multi-sources (ne passe terminal que quand toutes les
  sources ont conclu).

Base vivante entre tests du module (marker admin_db). Chaque test nettoie
ses lignes scrape_runs/offer_ingestion_events pour rester independant.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

pytestmark = pytest.mark.admin_db

from models import IngestionAction, ScrapeRun, ScrapeRunStatus, Source, SourceScrapeRun
from models.jobs import OfferIngestionEvent
from schemas.ingestion import IngestBatchCreate, IngestOfferItemCreate
from services.ingestion import ingest_offer_batch

# ─── Helpers ──────────────────────────────────────────────────────────


def _ensure_source(db, code: str = "goafrica") -> Source:
    source = db.scalar(Source.__table__.select())  # placeholder pour mypy
    source = db.query(Source).filter_by(code=code).one_or_none()
    if source is not None:
        return source
    source = Source(code=code, name=code.title(), slug=code, base_url="https://example.com")
    db.add(source)
    db.commit()
    return source


def _cleanup_scraping(db) -> None:
    db.query(OfferIngestionEvent).delete()
    db.query(SourceScrapeRun).delete()
    db.query(ScrapeRun).delete()
    db.commit()


def _batch(source_code: str, batch_id: str, run_reference: str | None = None, n: int = 1) -> IngestBatchCreate:
    from uuid import UUID

    return IngestBatchCreate(
        batch_id=UUID(batch_id),
        source_code=source_code,
        run_reference=run_reference,
        offers=[
            IngestOfferItemCreate(
                title=f"Offre test {i}",
                company_name="Entreprise Test",
                source_url=f"https://example.com/{source_code}/{batch_id}/{i}",
            )
            for i in range(n)
        ],
    )


# ─── C.2 : double trigger ─────────────────────────────────────────────


def test_trigger_double_renvoie_409(admin_client, admin_db, monkeypatch):
    """Deux POST /trigger le meme jour pour le meme admin -> 409 le 2e."""
    _cleanup_scraping(admin_db)
    _ensure_source(admin_db, "goafrica")

    dispatched: list = []
    monkeypatch.setattr(
        "tasks.scrapers.run_source_scraper.apply_async",
        lambda *a, **kw: dispatched.append(kw) or type("R", (), {"id": "task-1"})(),
        raising=False,
    )

    first = admin_client.post("/api/admin/scraping/trigger", json={"source_code": "goafrica"})
    assert first.status_code == 201, first.text

    # Le run existe en base, PENDING, avec sous-run et run_reference.
    run = admin_db.query(ScrapeRun).order_by(ScrapeRun.created_at.desc()).first()
    assert run.status == ScrapeRunStatus.PENDING
    assert run.run_reference == f"admin-trigger:{run.run_date.isoformat()}:admin-test"
    assert len(run.source_runs) == 1
    assert dispatched, "le trigger doit dispatch une task Celery par source"

    second = admin_client.post("/api/admin/scraping/trigger", json={"source_code": "goafrica"})
    assert second.status_code == 409
    assert "deja ete declenche" in second.json()["detail"]


# ─── C.1/C.3 : trigger -> dispatch -> adoption ─────────────────────────


def test_batch_adopte_le_run_admin_pending(admin_db):
    """Un batch portant le run_reference du trigger adopte le run admin.

    Verifie : pas de nouveau ScrapeRun cree, le sous-run admin est rempli
    (raw_count/inserted_count), le parent recompute a SUCCESS (1 source,
    insertion OK, 0 erreur).
    """
    _cleanup_scraping(admin_db)
    source = _ensure_source(admin_db, "goafrica")

    run = ScrapeRun(
        run_date=datetime.now(UTC).date(),
        status=ScrapeRunStatus.PENDING,
        triggered_by="admin:admin-test",
        run_reference="admin-trigger:2026-09-08:admin-test",
    )
    run.source_runs.append(SourceScrapeRun(source_id=source.id, status=ScrapeRunStatus.PENDING))
    admin_db.add(run)
    admin_db.commit()
    before = admin_db.query(ScrapeRun).count()

    summary = ingest_offer_batch(admin_db, _batch("goafrica", "11111111-1111-1111-1111-111111111111",
                                                  run_reference="admin-trigger:2026-09-08:admin-test", n=2))

    assert summary.status == "completed"
    assert admin_db.query(ScrapeRun).count() == before, "aucun nouveau run ne doit etre cree (adoption)"
    admin_db.refresh(run)
    assert run.status == ScrapeRunStatus.SUCCESS
    assert run.total_inserted == 2
    assert run.total_raw == 2
    assert run.external_batch_id == "11111111-1111-1111-1111-111111111111"
    sr = run.source_runs[0]
    assert sr.status == ScrapeRunStatus.SUCCESS
    assert sr.inserted_count == 2
    assert sr.raw_count == 2


def test_batch_sans_run_reference_cree_son_run(admin_db):
    """Chemin beat classique : pas de run_reference -> run cree par le batch."""
    _cleanup_scraping(admin_db)
    _ensure_source(admin_db, "goafrica")
    before = admin_db.query(ScrapeRun).count()

    summary = ingest_offer_batch(admin_db, _batch("goafrica", "22222222-2222-2222-2222-222222222222"))

    assert summary.status == "completed"
    assert admin_db.query(ScrapeRun).count() == before + 1


# ─── C.3 : recompute parent multi-sources ──────────────────────────────


def test_parent_multi_sources_ne_termine_pas_trop_tot(admin_db):
    """2 sources : la 1re conclut SUCCESS, le parent reste RUNNING jusqu'a la 2e."""
    _cleanup_scraping(admin_db)
    s1 = _ensure_source(admin_db, "goafrica")
    s2 = _ensure_source(admin_db, "jobivoire")

    run = ScrapeRun(
        run_date=datetime.now(UTC).date(),
        status=ScrapeRunStatus.PENDING,
        triggered_by="admin:admin-test",
        run_reference="admin-trigger:multi:admin-test",
    )
    run.source_runs.append(SourceScrapeRun(source_id=s1.id, status=ScrapeRunStatus.PENDING))
    run.source_runs.append(SourceScrapeRun(source_id=s2.id, status=ScrapeRunStatus.PENDING))
    admin_db.add(run)
    admin_db.commit()

    # 1re source : le parent ne doit PAS passer terminal (2e encore PENDING).
    ingest_offer_batch(admin_db, _batch("goafrica", "33333333-3333-3333-3333-333333333333",
                                        run_reference="admin-trigger:multi:admin-test"))
    admin_db.refresh(run)
    assert run.status == ScrapeRunStatus.RUNNING

    # 2e source : le parent conclut SUCCESS.
    ingest_offer_batch(admin_db, _batch("jobivoire", "44444444-4444-4444-4444-444444444444",
                                        run_reference="admin-trigger:multi:admin-test"))
    admin_db.refresh(run)
    assert run.status == ScrapeRunStatus.SUCCESS


# ─── A.1 : events d'abandon ────────────────────────────────────────────


def test_abandon_source_inactive_trace_en_base(admin_db):
    """run_source_scraper sur source inactive -> event SKIPPED + sous-run FAILED."""
    _cleanup_scraping(admin_db)
    source = _ensure_source(admin_db, "educarriere")
    source.status = __import__("models.enums", fromlist=["SourceStatus"]).SourceStatus.PAUSED
    admin_db.commit()

    run = ScrapeRun(
        run_date=datetime.now(UTC).date(),
        status=ScrapeRunStatus.PENDING,
        triggered_by="admin:admin-test",
        run_reference="admin-trigger:abandon:admin-test",
    )
    run.source_runs.append(SourceScrapeRun(source_id=source.id, status=ScrapeRunStatus.PENDING))
    admin_db.add(run)
    admin_db.commit()

    from tasks.scrapers import run_source_scraper

    result = run_source_scraper.run("educarriere", "admin-trigger:abandon:admin-test")

    assert result["status"] == "skipped"
    assert "source_inactive" in result["reason"]
    admin_db.refresh(run)
    assert run.source_runs[0].status == ScrapeRunStatus.FAILED
    events = admin_db.query(OfferIngestionEvent).filter_by(action=IngestionAction.SKIPPED).all()
    assert events, "l'abandon doit etre journalise en base"


# ─── M.1 : requalification zombies ─────────────────────────────────────


def test_requalify_stale_runs_conclut_les_zombies(admin_client, admin_db, monkeypatch):
    """PENDING/RUNNING depuis plus de STALE_RUN_HOURS -> FAILED + event."""
    _cleanup_scraping(admin_db)
    source = _ensure_source(admin_db, "goafrica")
    from tasks.maintenance import STALE_RUN_HOURS

    old = datetime.now(UTC) - timedelta(hours=STALE_RUN_HOURS + 2)
    zombie_sr = SourceScrapeRun(
        scrape_run_id=None,  # pose apres flush du parent
        source_id=source.id,
        status=ScrapeRunStatus.RUNNING,
        started_at=old,
    )
    zombie_parent = ScrapeRun(
        run_date=datetime.now(UTC).date() - timedelta(days=1),
        status=ScrapeRunStatus.RUNNING,
        triggered_by="admin:zombie",
        started_at=old,
    )
    zombie_parent.source_runs.append(zombie_sr)
    admin_db.add(zombie_parent)
    admin_db.commit()

    # Un run sain (recent) ne doit PAS etre touche.
    fresh = ScrapeRun(
        run_date=datetime.now(UTC).date(),
        status=ScrapeRunStatus.RUNNING,
        triggered_by="admin:fresh",
        started_at=datetime.now(UTC),
    )
    admin_db.add(fresh)
    admin_db.commit()

    from tasks.maintenance import requalify_stale_runs

    result = requalify_stale_runs.run()

    assert result["requalified"] >= 1
    admin_db.refresh(zombie_parent)
    assert zombie_parent.status == ScrapeRunStatus.FAILED
    assert zombie_parent.finished_at is not None
    zombie_sr = zombie_parent.source_runs[0]
    assert zombie_sr.status == ScrapeRunStatus.FAILED
    assert zombie_sr.error_message == "zombie_requalifie_par_maintenance"
    admin_db.refresh(fresh)
    assert fresh.status == ScrapeRunStatus.RUNNING


# ─── C.4 : PATCH notes ─────────────────────────────────────────────────


def test_patch_notes_journalise(admin_client, admin_db):
    """PATCH /runs/{id} ecrit les notes + ligne AdminActionLog."""
    _cleanup_scraping(admin_db)
    run = ScrapeRun(
        run_date=datetime.now(UTC).date() - timedelta(days=2),
        status=ScrapeRunStatus.FAILED,
        triggered_by="admin:admin-test",
    )
    admin_db.add(run)
    admin_db.commit()

    resp = admin_client.patch(f"/api/admin/scraping/runs/{run.id}", json={"notes": "Source down, on relancera demain"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["notes"] == "Source down, on relancera demain"

    from models.admin import AdminActionLog

    log = admin_db.query(AdminActionLog).filter_by(target_id=run.id).order_by(AdminActionLog.created_at.desc()).first()
    assert log is not None
    assert log.details["nouveau"] == "Source down, on relancera demain"


# ─── C.6 : pagination / filtre level ───────────────────────────────────


def test_run_logs_pagines_et_filtrables(admin_client, admin_db):
    """limit/offset bornes + filtre level=error ne renvoie que les FAILED."""
    _cleanup_scraping(admin_db)
    source = _ensure_source(admin_db, "goafrica")

    run = ScrapeRun(
        run_date=datetime.now(UTC).date(),
        status=ScrapeRunStatus.SUCCESS,
        triggered_by="admin:admin-test",
    )
    sr = SourceScrapeRun(scrape_run_id=None, source_id=source.id, status=ScrapeRunStatus.SUCCESS)
    run.source_runs.append(sr)
    admin_db.add(run)
    admin_db.commit()

    for i in range(5):
        admin_db.add(OfferIngestionEvent(source_scrape_run_id=sr.id, action=IngestionAction.INSERTED,
                                         reason=f"offre {i}"))
    admin_db.add(OfferIngestionEvent(source_scrape_run_id=sr.id, action=IngestionAction.FAILED,
                                     reason="offre fautive"))
    admin_db.commit()

    # Pagination seule.
    resp = admin_client.get(f"/api/admin/scraping/runs/{run.id}/logs?limit=2&offset=0")
    assert resp.status_code == 200
    assert len(resp.json()) == 2

    # Filtre error -> uniquement les FAILED.
    resp = admin_client.get(f"/api/admin/scraping/runs/{run.id}/logs?level=error")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["action"] == "failed"
    assert body[0]["niveau"] == "error"
