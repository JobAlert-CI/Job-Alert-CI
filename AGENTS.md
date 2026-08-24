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

## Testing quirks

- `server/tests/conftest.py` force-sets env (SQLite file DB, unreachable Redis → fallback mode, no Resend key) before any app import. Don't import `core.config` before conftest's env setup; tests need no external services.

## Misc

- Root `README.md` is empty; real docs are `server/README.md` and `scrapers/README.md`.
- Client uses Tailwind v4 (via `@tailwindcss/vite`), React Router v7, TanStack Query; pages in `client/src/Pages/`.
- Comments/docs in this repo are French — match that style.
