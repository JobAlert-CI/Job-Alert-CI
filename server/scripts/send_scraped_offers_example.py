from __future__ import annotations

import argparse
import os
from datetime import datetime, timezone
from uuid import uuid4

import httpx


def build_payload(source: str, count: int) -> dict:
    now = datetime.now(timezone.utc).replace(microsecond=0)
    offers = []
    for index in range(count):
        offers.append(
            {
                "source_reference": f"example-{source}-{now:%Y%m%d%H%M%S}-{index}",
                "title": f"Developpeur Python exemple {index + 1}",
                "company_name": "Entreprise Exemple CI",
                "source_url": f"https://example.com/{source}/offres/{now:%Y%m%d%H%M%S}-{index}",
                "published_at": now.isoformat(),
                "location_raw": "Abidjan",
                "salary_raw": "Selon profil",
                "description": "Description brute envoyee par le scraper exemple.",
                "raw_data": {"example": True, "index": index},
                "filiere_code": "tech-dev",
            }
        )
    return {
        "batch_id": str(uuid4()),
        "source_code": source,
        "run_reference": "manual-example",
        "scraped_at": now.isoformat(),
        "offers": offers,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="emploi-dakar")
    parser.add_argument("--count", type=int, default=3)
    parser.add_argument("--api-base-url", default=os.getenv("API_BASE_URL", "http://localhost:8000"))
    args = parser.parse_args()

    token = os.getenv("SCRAPER_API_TOKEN")
    if not token:
        raise SystemExit("SCRAPER_API_TOKEN est requis dans l'environnement.")

    payload = build_payload(args.source, args.count)
    with httpx.Client(timeout=30.0) as client:
        response = client.post(
            f"{args.api_base_url.rstrip('/')}/api/ingest/offers",
            json=payload,
            headers={"X-Scraper-Token": token},
        )
    print(response.status_code)
    print(response.text)
    response.raise_for_status()


if __name__ == "__main__":
    main()
