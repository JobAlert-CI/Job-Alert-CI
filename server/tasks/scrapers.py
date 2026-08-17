from __future__ import annotations

import logging
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import httpx
from sqlalchemy import select

from celery_app import celery_app
from core.config import get_settings
from db.session import session_scope
from models import Source, SourceStatus
from tasks.locks import redis_lock

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRAPER_SCRIPTS = {
    "goafrica": REPO_ROOT / "scrapers" / "GoAfrica" / "script.py",
    "jobivoire": REPO_ROOT / "scrapers" / "JobIvoire" / "script.py",
    "educarriere": REPO_ROOT / "scrapers" / "Educarriere" / "script.py",
}


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
    now = datetime.now(timezone.utc).replace(microsecond=0)
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


def _run_local_scraper_script(source_code: str, task_id: str | None) -> dict | None:
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
            "SCRAPER_RUN_REFERENCE": f"celery:{task_id or source_code}",
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
        logger.error(
            "Scraper local en erreur: %s",
            completed.stderr[-4000:] or completed.stdout[-4000:],
            extra={
                "source_code": source_code,
                "returncode": completed.returncode,
                "stdout": completed.stdout[-2000:],
                "stderr": completed.stderr[-4000:],
            },
        )
        raise RuntimeError(f"Scraper {source_code} termine avec le code {completed.returncode}")
    logger.info(
        "Scraper local termine",
        extra={"source_code": source_code, "stdout": completed.stdout[-1000:], "stderr": completed.stderr[-1000:]},
    )
    return {"status": "completed", "source_code": source_code, "mode": "local_script"}


@celery_app.task(name="tasks.scrapers.run_source_scraper", bind=True, autoretry_for=(httpx.TransportError,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def run_source_scraper(self, source_code: str) -> dict:
    settings = get_settings()
    lock_name = f"scraper:{source_code}"
    with redis_lock(lock_name, ttl_seconds=1800) as acquired:
        if not acquired:
            return {"status": "locked", "source_code": source_code}

        with session_scope() as db:
            source = db.scalar(select(Source).where(Source.code == source_code))
            if source is None or source.status != SourceStatus.ACTIVE or not source.supports_scraping:
                return {"status": "skipped", "source_code": source_code, "reason": "source_inactive_or_unknown"}

        script_result = _run_local_scraper_script(source_code, self.request.id)
        if script_result is not None:
            return script_result

        if os.getenv("ALLOW_DEMO_SCRAPER", "0").strip().lower() not in {"1", "true", "yes", "on"}:
            return {
                "status": "skipped",
                "source_code": source_code,
                "reason": "no_local_scraper_script",
            }

        batch_id = str(uuid4())
        payload = {
            "batch_id": batch_id,
            "source_code": source_code,
            "run_reference": f"celery:{self.request.id}",
            "scraped_at": datetime.now(timezone.utc).isoformat(),
            "offers": _demo_scrape(source_code),
        }
        headers = {"X-Scraper-Token": settings.scraper_api_token or ""}
        with httpx.Client(timeout=30.0) as client:
            response = client.post(f"{settings.api_base_url.rstrip('/')}/api/ingest/offers", json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
        logger.info("Scraper source termine", extra={"source_code": source_code, "batch_id": batch_id, "response": data})
        return data
