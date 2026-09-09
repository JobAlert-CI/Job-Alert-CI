from __future__ import annotations

import logging
import os
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import httpx
from celery import Task, chord, group
from sqlalchemy import select

from celery_app import celery_app
from core.config import get_settings
from db.session import session_scope
from models import (
    IngestionAction,
    ScrapeRun,
    ScrapeRunStatus,
    Source,
    SourceScrapeRun,
    SourceStatus,
)
from services.scrape_runs import finish_source_run, mark_source_run_running, record_run_event
from tasks.locks import redis_lock

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRAPER_SCRIPTS = {
    "goafrica": REPO_ROOT / "scrapers" / "GoAfrica" / "script.py",
    "jobivoire": REPO_ROOT / "scrapers" / "JobIvoire" / "script.py",
    "educarriere": REPO_ROOT / "scrapers" / "Educarriere" / "script.py",
}


def _sanitize_output(text: str | None) -> str:
    """Neutralise les secrets connus avant journalisation (audit 3, S32).

    Les scrapers tournent avec SCRAPER_API_TOKEN dans l'environnement ; un
    print() malheureux du script enfant (ou d'une lib) ne doit pas finir en
    clair dans les logs du worker. Le jeton est masque, pas supprime, pour
    garder le contexte de debug.
    """
    if not text:
        return ""
    sanitized = text
    settings = get_settings()
    secrets = [settings.scraper_api_token, settings.internal_api_token, settings.admin_api_key]
    for secret in secrets:
        if secret and len(secret) >= 8:
            sanitized = sanitized.replace(secret, "[REDACTED]")
    return sanitized


def _load_env_file(path: Path, env: dict[str, str]) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip().removeprefix("export ").strip()
        value = value.split("#", 1)[0].strip().strip('"').strip("'")
        if key and key not in env:
            env[key] = value


def _demo_scrape(source_code: str, count: int = 2) -> list[dict]:
    now = datetime.now(UTC).replace(microsecond=0)
    return [
        {
            "source_reference": f"demo-{source_code}-{now:%Y%m%d%H%M}-{index}",
            "title": f"Offre demo {index + 1} {source_code}",
            "company_name": "JobAlert CI Demo",
            "source_url": f"https://example.com/{source_code}/jobs/{now:%Y%m%d%H%M}-{index}",
            "published_at": now.isoformat(),
            "location_raw": "Abidjan",
            "description": "Offre de demonstration pour tester la chaine ingestion.",
            "raw_data": {"demo": True, "source_code": source_code, "index": index},
        }
        for index in range(count)
    ]


def _run_local_scraper_script(source_code: str, task_id: str | None, run_reference: str | None = None) -> dict | None:
    script_path = SCRAPER_SCRIPTS.get(source_code)
    if script_path is None or not script_path.exists():
        return None

    settings = get_settings()
    scraper_venv_python = REPO_ROOT / "scrapers" / ".venv" / "Scripts" / "python.exe"
    python_executable = os.getenv("SCRAPER_PYTHON") or (
        str(scraper_venv_python) if scraper_venv_python.exists() else sys.executable
    )
    env = os.environ.copy()
    _load_env_file(REPO_ROOT / "scrapers" / ".env", env)
    env.update(
        {
            "SCRAPER_SEND_TO_API": "1",
            "SCRAPER_API_BASE_URL": settings.api_base_url,
            "SCRAPER_API_TOKEN": settings.scraper_api_token or "",
            # Audit 4, C.3 : le run_reference du trigger admin transite vers
            # le script enfant — le batch d'ingestion adoptera le run PENDING.
            "SCRAPER_RUN_REFERENCE": run_reference or f"celery:{task_id or source_code}",
        }
    )
    completed = subprocess.run(
        [python_executable, str(script_path)],
        cwd=str(script_path.parent),
        env=env,
        text=True,
        capture_output=True,
        timeout=int(os.getenv("SCRAPER_SUBPROCESS_TIMEOUT_SECONDS", "3600")),
    )
    if completed.returncode != 0:
        # Audit 3, S32 : stdout/stderr sanitises avant logging (secrets masques).
        sanitized_err = _sanitize_output(completed.stderr)
        sanitized_out = _sanitize_output(completed.stdout)
        logger.error(
            "Scraper local en erreur: %s",
            sanitized_err[-4000:] or sanitized_out[-4000:],
            extra={
                "source_code": source_code,
                "returncode": completed.returncode,
                "stdout": sanitized_out[-2000:],
                "stderr": sanitized_err[-4000:],
            },
        )
        raise RuntimeError(f"Scraper {source_code} termine avec le code {completed.returncode}")
    # Audit 3, S32 : idem cote succes — le stdout du scraper peut contenir
    # des echoes d'environnement malencontreux.
    sanitized_out = _sanitize_output(completed.stdout)
    sanitized_err = _sanitize_output(completed.stderr)
    logger.info(
        "Scraper local termine",
        extra={"source_code": source_code, "stdout": sanitized_out[-1000:], "stderr": sanitized_err[-1000:]},
    )
    return {"status": "completed", "source_code": source_code, "mode": "local_script"}


def _matching_source_runs(db, source_code: str, run_reference: str | None) -> list[SourceScrapeRun]:
    """Sous-runs du run admin identifie par `run_reference` (audit 4, C.1).

    Chemin beat (run_reference None) : aucun sous-run n'existe encore —
    c'est le batch d'ingestion qui cree le run de toutes pieces.
    """
    if not run_reference:
        return []
    stmt = (
        select(SourceScrapeRun)
        .join(SourceScrapeRun.source)
        .join(SourceScrapeRun.scrape_run)
        .where(
            Source.code == source_code,
            ScrapeRun.run_reference == run_reference,
        )
    )
    return list(db.scalars(stmt))


def _abandon_source(
    db,
    *,
    source_code: str,
    run_reference: str | None,
    action: IngestionAction,
    reason: str,
) -> None:
    """Trace un abandon en base et conclut les sous-runs admin (audit 4, A.1).

    - L'evenement est rattache au premier sous-run admin connu (visible dans
      /admin/scraping/runs/{id}/logs), sinon ecrit au niveau run (champ
      source_scrape_run_id NULL, visible dans /admin/logs/events).
    - Les sous-runs PENDING/RUNNING du run admin passent FAILED : le parent
      sera recompute par finish_source_run — plus de zombies PENDING.
    """
    matching = _matching_source_runs(db, source_code, run_reference)
    record_run_event(db, source_run=matching[0] if matching else None, action=action, reason=reason)
    for source_run in matching:
        if source_run.status in {ScrapeRunStatus.PENDING, ScrapeRunStatus.RUNNING}:
            finish_source_run(source_run, ScrapeRunStatus.FAILED, error_message=reason[:500])


class _ScraperTask(Task):
    """Task base qui conclut les runs admin meme quand tout a echoue (C.1).

    `on_failure` ne declenche qu'une fois les retries epuises (ou sur une
    erreur non retryable) : sans lui, un crash du script laisserait le run
    admin RUNNING jusqu'au filet zombie 6 h de la maintenance (M.1).
    """

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        source_code = args[0] if args else kwargs.get("source_code")
        run_reference = kwargs.get("run_reference")
        if run_reference and source_code:
            try:
                with session_scope() as db:
                    _abandon_source(
                        db,
                        source_code=source_code,
                        run_reference=run_reference,
                        action=IngestionAction.FAILED,
                        reason=f"task_scraper_echouee: {str(exc)[:180]}",
                    )
            except Exception:
                logger.exception("Conclusion du run admin impossible apres echec task", extra={"task_id": task_id})
        return super().on_failure(exc, task_id, args, kwargs, einfo)


@celery_app.task(
    name="tasks.scrapers.run_source_scraper",
    bind=True,
    base=_ScraperTask,
    # Audit 3, C4 (heritage audit 1) : un scraper qui depasse son timeout
    # subprocess ne doit pas marquer la tache FAILED definitive — on retente
    # avec backoff comme pour les erreurs transport HTTP.
    autoretry_for=(httpx.TransportError, subprocess.TimeoutExpired),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def run_source_scraper(self, source_code: str, run_reference: str | None = None) -> dict:
    """Scrape une source et pousse son batch vers /api/ingest/offers.

    Audit 4 :
    - C.1/C.3 : `run_reference` (fourni par le trigger admin) relie la task
      aux lignes de supervision PENDING — elles passent RUNNING ici, puis
      terminales quand le batch d'ingestion est adopte/conclu.
    - A.1 : chaque abandon (source inactive/inconnue, demo refusee, echec
      d'envoi) est journalise EN BASE, plus seulement en log worker.
    - E.4 : ALLOW_DEMO_SCRAPER est ignore en production.
    """
    settings = get_settings()
    lock_name = f"scraper:{source_code}"
    with redis_lock(lock_name, ttl_seconds=1800) as acquired:
        if not acquired:
            return {"status": "locked", "source_code": source_code, "run_reference": run_reference}

        with session_scope() as db:
            source = db.scalar(select(Source).where(Source.code == source_code))
            if source is None or source.status != SourceStatus.ACTIVE or not source.supports_scraping:
                # A.1 : abandon trace en base, pas seulement en log worker.
                if source is None:
                    reason = "source_inconnue"
                elif source.status != SourceStatus.ACTIVE:
                    reason = f"source_inactive:{source.status.value}"
                else:
                    reason = "source_sans_scraping"
                _abandon_source(
                    db, source_code=source_code, run_reference=run_reference,
                    action=IngestionAction.SKIPPED, reason=reason,
                )
                return {"status": "skipped", "source_code": source_code, "reason": reason}

            # C.1 : avancer les sous-runs PENDING du run admin vers RUNNING.
            for source_run in _matching_source_runs(db, source.code, run_reference):
                if source_run.status == ScrapeRunStatus.PENDING:
                    mark_source_run_running(source_run)

        script_result = _run_local_scraper_script(source_code, self.request.id, run_reference)
        if script_result is not None:
            # C.1 : le script a fini. Si son batch a ete ingere, le sous-run
            # est deja terminal (adoption + recompute cote ingestion). Sinon
            # (0 offre trouvee, envoi non effectue), on le conclut SUCCESS a
            # zero offre maintenant — pas de zombie RUNNING jusqu'au filet M.1.
            if run_reference:
                with session_scope() as db:
                    for source_run in _matching_source_runs(db, source_code, run_reference):
                        if source_run.status in {ScrapeRunStatus.PENDING, ScrapeRunStatus.RUNNING}:
                            finish_source_run(source_run, ScrapeRunStatus.SUCCESS)
            return script_result

        # E.4 : le mode demo ne doit jamais alimenter la base de production
        # avec des offres factices, meme si la variable d'env est restee a
        # "1" par erreur sur la machine de deploiement.
        demo_env = os.getenv("ALLOW_DEMO_SCRAPER", "0").strip().lower() in {"1", "true", "yes", "on"}
        if not demo_env:
            reason = "no_local_scraper_script"
        elif settings.is_production:
            reason = "demo_refuse_en_production"
        else:
            reason = None
        if reason is not None:
            with session_scope() as db:
                _abandon_source(
                    db, source_code=source_code, run_reference=run_reference,
                    action=IngestionAction.SKIPPED, reason=reason,
                )
            return {"status": "skipped", "source_code": source_code, "reason": reason}

        batch_id = str(uuid4())
        payload = {
            "batch_id": batch_id,
            "source_code": source_code,
            "run_reference": run_reference or f"celery:{self.request.id}",
            "scraped_at": datetime.now(UTC).isoformat(),
            "offers": _demo_scrape(source_code),
        }
        headers = {"X-Scraper-Token": settings.scraper_api_token or ""}
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(f"{settings.api_base_url.rstrip('/')}/api/ingest/offers", json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
        except Exception as exc:
            # A.1 : echec d'envoi du batch trace en base avant le raise.
            reason = f"envoi_batch_echoue: {str(exc)[:180]}"
            with session_scope() as db:
                _abandon_source(
                    db, source_code=source_code, run_reference=run_reference,
                    action=IngestionAction.FAILED, reason=reason,
                )
            raise
        logger.info("Scraper source termine", extra={"source_code": source_code, "batch_id": batch_id, "response": data})
        return data


@celery_app.task(name="tasks.scrapers.run_active_scrapers")
def run_active_scrapers() -> dict:
    with session_scope() as db:
        source_codes = list(
            db.scalars(
                select(Source.code)
                .where(Source.status == SourceStatus.ACTIVE, Source.supports_scraping.is_(True))
                .order_by(Source.priority, Source.code)
            )
        )

    if not source_codes:
        return {"status": "skipped", "reason": "no_active_sources"}

    from tasks.ai_processing import trigger_ai_processing

    workflow = chord(group(run_source_scraper.s(source_code) for source_code in source_codes))(trigger_ai_processing.s())
    return {"status": "queued", "source_codes": source_codes, "task_id": workflow.id}
