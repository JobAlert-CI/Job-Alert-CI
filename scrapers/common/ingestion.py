from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import datetime, time, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

KNOWN_CONTRACT_CODES = {
    "cdi": "cdi",
    "cdd": "cdd",
    "stage": "stage",
    "mission": "mission",
    "alternance": "alternance",
}

EDUCATION_CODE_MAP = {
    "bac": "bac",
    "bac_2": "bac-2",
    "bac+2": "bac-2",
    "bac_plus_2": "bac-2",
    "bac_3": "bac-3",
    "bac+3": "bac-3",
    "bac_plus_3": "bac-3",
    "bac_5": "bac-5",
    "bac+5": "bac-5",
    "bac_plus_5": "bac-5",
}


def _clean(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _nested(data: dict[str, Any], *keys: str) -> Any:
    current: Any = data
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def _as_datetime(value: Any) -> str | None:
    text = _clean(value)
    if not text:
        return None
    normalized = text.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).isoformat()
    except ValueError:
        pass
    try:
        parsed_date = datetime.strptime(text, "%Y-%m-%d").date()
        return datetime.combine(parsed_date, time.min, tzinfo=timezone.utc).isoformat()
    except ValueError:
        return None


def _source_reference(source_code: str, job: dict[str, Any]) -> str | None:
    reference = _clean(job.get("source_reference"))
    if reference:
        return reference[:255]
    source_url = _clean(job.get("source_url"))
    if not source_url:
        return None
    digest = hashlib.sha1(source_url.encode("utf-8")).hexdigest()[:16]
    return f"{source_code}-{digest}"


def _contract_code(job: dict[str, Any]) -> str | None:
    raw_code = _clean(_nested(job, "contract_type", "code"))
    if not raw_code:
        return None
    normalized = raw_code.lower().replace("_", "-").replace("+", "-")
    normalized = normalized.removeprefix("emploi-")
    return KNOWN_CONTRACT_CODES.get(normalized)


def _education_code(job: dict[str, Any]) -> str | None:
    raw_code = _clean(_nested(job, "education_level", "code"))
    if not raw_code:
        return None
    normalized = raw_code.lower().replace("-", "_")
    return EDUCATION_CODE_MAP.get(normalized)


def _experience_code(job: dict[str, Any]) -> str | None:
    raw = _clean(_nested(job, "experience_level", "code")) or _clean(job.get("experience_level"))
    if not raw:
        return None
    normalized = raw.lower()
    if "debut" in normalized or "etudiant" in normalized or "stagiaire" in normalized:
        return "debutant"
    if "1" in normalized and "3" in normalized:
        return "1-3"
    if "3" in normalized and "5" in normalized:
        return "3-5"
    if "senior" in normalized or "+ de 5" in normalized or "5" in normalized:
        return "5-plus"
    return None


def to_ingest_offer(source_code: str, job: dict[str, Any], *, default_filiere_code: str | None = None) -> dict[str, Any] | None:
    title = _clean(job.get("title"))
    source_url = _clean(job.get("source_url"))
    company_name = _clean(job.get("company_name")) or _clean(_nested(job, "company", "name")) or _clean(job.get("company_hint"))

    if not title or not source_url or not company_name:
        return None

    description = _clean(job.get("description")) or _clean(_nested(job, "detail", "source_text"))
    item = {
        "source_reference": _source_reference(source_code, job),
        "title": title,
        "company_name": company_name,
        "source_url": source_url,
        "canonical_url": _clean(job.get("canonical_url")),
        "published_at": _as_datetime(job.get("published_at")),
        "location_raw": _clean(job.get("location_raw")),
        "salary_raw": _clean(job.get("salary_raw")),
        "description": description,
        "raw_data": job,
        "filiere_code": default_filiere_code,
        "contract_type_code": _contract_code(job),
        "experience_level_code": _experience_code(job),
        "education_level_code": _education_code(job),
    }
    return {key: value for key, value in item.items() if value is not None}


def build_batch(source_code: str, jobs: list[dict[str, Any]], *, run_reference: str | None = None) -> tuple[dict[str, Any], int]:
    default_filiere_code = os.getenv("SCRAPER_DEFAULT_FILIERE_CODE") or None
    offers = [
        item
        for job in jobs
        if (item := to_ingest_offer(source_code, job, default_filiere_code=default_filiere_code)) is not None
    ]
    return (
        {
            "batch_id": os.getenv("SCRAPER_BATCH_ID") or str(uuid4()),
            "source_code": source_code,
            "run_reference": run_reference or os.getenv("SCRAPER_RUN_REFERENCE") or f"scraper:{source_code}",
            "scraped_at": datetime.now(timezone.utc).isoformat(),
            "offers": offers,
        },
        len(jobs) - len(offers),
    )


@retry(
    retry=retry_if_exception_type((httpx.TransportError, httpx.TimeoutException)),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    stop=stop_after_attempt(3),
    reraise=True,
)
def send_batch(batch: dict[str, Any], *, api_base_url: str, token: str) -> dict[str, Any]:
    with httpx.Client(timeout=30.0) as client:
        response = client.post(
            f"{api_base_url.rstrip('/')}/api/ingest/offers",
            json=batch,
            headers={"X-Scraper-Token": token},
        )
        response.raise_for_status()
        return response.json()


def maybe_send_jobs_to_api(source_code: str, jobs: list[dict[str, Any]], *, run_reference: str | None = None, logger: Any = None) -> dict[str, Any] | None:
    if os.getenv("SCRAPER_SEND_TO_API", "0").strip().lower() not in {"1", "true", "yes", "on"}:
        return None

    api_base_url = os.getenv("SCRAPER_API_BASE_URL") or os.getenv("API_BASE_URL") or "http://localhost:8000"
    token = os.getenv("SCRAPER_API_TOKEN")
    if not token:
        raise RuntimeError("SCRAPER_API_TOKEN est requis pour envoyer les offres a l'API.")

    batch, skipped = build_batch(source_code, jobs, run_reference=run_reference)
    if skipped and logger is not None:
        logger.warning(f"{skipped} offre(s) ignoree(s) avant envoi API: title/source_url/company_name manquant.")
    if not batch["offers"]:
        if logger is not None:
            logger.warning("Aucune offre valide a envoyer a l'API.")
        return None

    result = send_batch(batch, api_base_url=api_base_url, token=token)
    if logger is not None:
        logger.success(f"Batch envoye a l'API: {result}")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Envoie un fichier JSON de scraper vers /api/ingest/offers.")
    parser.add_argument("source_code")
    parser.add_argument("json_file", type=Path)
    parser.add_argument("--api-base-url", default=os.getenv("SCRAPER_API_BASE_URL") or os.getenv("API_BASE_URL") or "http://localhost:8000")
    args = parser.parse_args()

    token = os.getenv("SCRAPER_API_TOKEN")
    if not token:
        raise SystemExit("SCRAPER_API_TOKEN est requis.")

    jobs = json.loads(args.json_file.read_text(encoding="utf-8"))
    if not isinstance(jobs, list):
        raise SystemExit("Le fichier JSON doit contenir une liste d'offres.")

    batch, skipped = build_batch(args.source_code, jobs, run_reference=f"file:{args.json_file.name}")
    if skipped:
        print(f"{skipped} offre(s) ignoree(s) avant envoi.")
    print(send_batch(batch, api_base_url=args.api_base_url, token=token))


if __name__ == "__main__":
    main()
