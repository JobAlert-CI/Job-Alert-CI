"""Tests admin /api/admin/scraping/stats/summary.

Couvre :
- Agrégats all-time (SUM volumes, total runs) sur un jeu seedé ;
- success_rate : success / runs TERMINES uniquement (pending/running
  exclus du denominateur) ;
- Base vide : success_rate=None, volumes 0 (pas de division par zero).
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import pytest

# Marker requis pour neutraliser l'autouse `_database` du conftest principal.
pytestmark = pytest.mark.admin_db

from models.enums import ScrapeRunStatus
from models.scraping import ScrapeRun


def _seed_runs(admin_db, specs):
    """Cree des ScrapeRun a partir de specs (status, raw, inserted).

    IDEMPOTENT par run_date unique (contrainte uq_scrape_runs_date_triggered_by
    impose d'ailleurs l'unicite (run_date, triggered_by)).
    """
    for i, (status, raw, inserted) in enumerate(specs):
        run_date = date(2026, 9, 1 + i)
        existing = admin_db.query(ScrapeRun).filter_by(run_date=run_date).one_or_none()
        if existing is not None:
            continue
        run = ScrapeRun(
            run_date=run_date,
            status=status,
            triggered_by="beat:schedule",
            started_at=datetime(2026, 9, 1 + i, 6, 0, tzinfo=UTC),
            finished_at=datetime(2026, 9, 1 + i, 6, 12, tzinfo=UTC) if status not in (ScrapeRunStatus.PENDING, ScrapeRunStatus.RUNNING) else None,
            total_raw=raw,
            total_inserted=inserted,
        )
        admin_db.add(run)
    admin_db.commit()


def test_summary_agregats_et_taux(admin_client, admin_db):
    """2 success + 1 failed + 1 running : taux = 2/3 = 66.7 %, volumes cumulés."""
    _seed_runs(
        admin_db,
        [
            (ScrapeRunStatus.SUCCESS, 80, 10),
            (ScrapeRunStatus.SUCCESS, 50, 5),
            (ScrapeRunStatus.FAILED, 7, 0),
            (ScrapeRunStatus.RUNNING, 0, 0),
        ],
    )
    res = admin_client.get("/api/admin/scraping/stats/summary")
    assert res.status_code == 200
    body = res.json()

    assert body["total_runs"] == 4
    assert body["success_rate"] == 66.7  # 2 success / 3 termines, pas 4
    assert body["total_raw_all_time"] == 137
    assert body["total_inserted_all_time"] == 15


def test_summary_base_vide(admin_client, admin_db):
    """Aucun run : success_rate None (pas de division par zero), volumes 0.

    La base vit entre les tests du module (scope module d'admin_client) :
    ce test vide explicitement scrape_runs pour rester independant de
    l'ordre d'execution.
    """
    admin_db.query(ScrapeRun).delete()
    admin_db.commit()

    res = admin_client.get("/api/admin/scraping/stats/summary")
    assert res.status_code == 200
    body = res.json()
    assert body["total_runs"] == 0
    assert body["success_rate"] is None
    assert body["total_raw_all_time"] == 0
    assert body["total_inserted_all_time"] == 0
