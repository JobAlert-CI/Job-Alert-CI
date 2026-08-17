from __future__ import annotations

from sqlalchemy import select

from db.session import session_scope
from models import Source, SourceStatus


SCRAPER_SOURCES = [
    {
        "code": "goafrica",
        "name": "Go Africa Online",
        "slug": "goafrica",
        "base_url": "https://www.goafricaonline.com",
        "jobs_url": "https://www.goafricaonline.com/ci/emploi",
        "logo_path": "/static/sources/goafrica.png",
        "color_hex": "#1D4ED8",
        "short_code": "GA",
        "priority": 20,
        "anti_scraping_level": 1,
        "default_scan_time": "06:10",
        "description": "Site emploi a couverture regionale africaine.",
        "notes": "Source branchee via scraper Playwright local.",
        "is_primary": False,
        "supports_scraping": True,
        "status": SourceStatus.ACTIVE,
    },
    {
        "code": "jobivoire",
        "name": "JobIvoire",
        "slug": "jobivoire",
        "base_url": "https://www.jobivoire.ci",
        "jobs_url": "https://www.jobivoire.ci/job",
        "logo_path": "/static/sources/jobivoire.png",
        "color_hex": "#2563EB",
        "short_code": "JI",
        "priority": 50,
        "anti_scraping_level": 2,
        "default_scan_time": "06:20",
        "description": "Portail d'offres d'emploi ivoirien.",
        "notes": "Source branchee via scraper Playwright local.",
        "is_primary": False,
        "supports_scraping": True,
        "status": SourceStatus.ACTIVE,
    },
    {
        "code": "educarriere",
        "name": "Educarriere",
        "slug": "educarriere",
        "base_url": "https://emploi.educarriere.ci",
        "jobs_url": "https://emploi.educarriere.ci/page/all",
        "logo_path": "/static/sources/educarriere.png",
        "color_hex": "#059669",
        "short_code": "EC",
        "priority": 60,
        "anti_scraping_level": 2,
        "default_scan_time": "06:30",
        "description": "Plateforme emploi Educarriere Cote d'Ivoire.",
        "notes": "Source branchee via scraper Playwright local.",
        "is_primary": False,
        "supports_scraping": True,
        "status": SourceStatus.ACTIVE,
    },
]


def seed_scraper_sources() -> None:
    with session_scope() as db:
        for values in SCRAPER_SOURCES:
            source = db.scalar(select(Source).where(Source.code == values["code"]))
            if source is None:
                db.add(Source(**values))
                continue
            for field_name, field_value in values.items():
                setattr(source, field_name, field_value)


if __name__ == "__main__":
    seed_scraper_sources()
    print("Sources de scrapers inserees ou mises a jour.")
