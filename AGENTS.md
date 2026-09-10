# AGENTS.md

Polyglot monorepo: FastAPI backend + Celery workers (`server/`), Vite React client (`client/`), Playwright scrapers (`scrapers/`). No CI workflows, no root test script.

## Commands

All Python commands must use the venv interpreters directly (Windows):
- Server: `server\.venv\Scripts\python.exe`
- Scrapers: `scrapers\.venv\Scripts\python.exe` (separate venv from server)

From repo root:
- `npm run dev` — API + client + 3 Celery workers (queues `ingestion`, `ai`, `emails`) + beat, all at once
- `npm run scrape:<source>` — trigger a scraper via Celery task `run_source_scraper` (sources: `goafrica`, `jobivoire`, `educarriere`); `scrape:all` runs all
- `npm run seed:scraper-sources`

Server (from `server/`):
- Tests: `server\.venv\Scripts\python.exe -m pytest server\tests\<file> -q` (from root; `pythonpath = ["."]` is set in pyproject). Run pytest with the **root** as cwd so paths resolve.
- Migrations: `.venv\Scripts\python.exe -m alembic upgrade head` (alembic.ini hardcodes a local Postgres URL; migrations live in `server/migrations/versions`)
- Lint client only: `cd client && npm run lint`

## Prerequisites

PostgreSQL and Redis must be running locally. Env comes from `server/.env` (copy `.env.example`). Key vars: `DATABASE_URL`, `SCRAPER_API_TOKEN`, `CELERY_BROKER_URL`/`REDIS_URL` (distinct Redis DBs: 0 broker, 1 results, 2 cache).

## Architecture rules

- **Scrapers never write to the DB.** They POST batches to `POST /api/ingest/offers` with header `X-Scraper-Token`. Direct DB writes from scraper code is a bug.
- Offer lifecycle: scraped offers land as `status='brute'`; the `ai` queue job `process_raw_offers` moves them to `active` or `rejected`. Public `/api/offers` routes filter `status='active' AND visible_site=true` — never expose other statuses.
- AI processing is stubbed by default (`AI_ENABLED=false` → `NoopAIProcessor`); keep it that way unless explicitly asked.
- Celery workers are split per queue; beat schedules demo scrapes at 06:00–06:30.
- Scraper subprocess used by server can be pointed at its own venv via `SCRAPER_PYTHON`.

## Maintenance rules (audit 4, L.2/L.4/I.2 — server)

- **Migrations creating tables MUST be idempotent.** Migration 0001 runs `Base.metadata.create_all` — on a fresh DB it already creates every table of the CURRENT models. Any later migration doing `op.create_table`/`op.create_index` MUST guard with `sa.inspect(bind).get_table_names()`/`get_indexes()` first (pattern 0004/0019/0020), or it crashes on fresh bases.
- **Enum/bounds changes ship as one commit on both layers.** DB constraints (`enum_column` CHECK) and Pydantic validators (`Field(ge=…, le=…)`) are a double validation — a value accepted by the schema but refused by the DB becomes a 500. Any new enum value or bound change requires a CHECK migration (pattern 0017) AND the Pydantic update in the same commit.
- **New read aggregations go in services, not routers.** Legacy admin routers hold read SQL (accepted debt, audit 4 I.2), but any NEW aggregation belongs in `services/` (e.g. `admin_aggregates.py`, `system_health.py` helpers) so it stays unit-testable.
- **One clock: `core/clock.py::now_utc()`** (audit 4, I.4). Never write a new `datetime.now(UTC)` helper; alias the central one.
- **Timezone-naive datetimes never leave a boundary.** SQLite tests return naive datetimes — re-awareify before comparing (cf. `_aware` in `system_health.py`).

## Testing quirks

- `server/tests/conftest.py` force-sets env (SQLite file DB, unreachable Redis → fallback mode, no Resend key) before any app import. Don't import `core.config` before conftest's env setup; tests need no external services.

## Misc

- Root `README.md` is empty; real docs are `server/README.md` and `scrapers/README.md`.
- Client uses Tailwind v4 (via `@tailwindcss/vite`), React Router v7, TanStack Query; pages in `client/src/Pages/`.
- Comments/docs in this repo are French — match that style.
