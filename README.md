# JobAlert CI

Plateforme d'agrégation et de diffusion d'offres d'emploi en Côte d'Ivoire : collecte automatisée via scrapers, pipeline d'ingestion avec validation IA (stub par défaut), API publique et site vitrine React.

## Architecture générale

```
┌─────────────┐   POST /api/ingest/offers    ┌─────────────────┐
│  Scrapers   │ ──────────────────────────▶ | API FastAPI     │
│ (Playwright)│      X-Scraper-Token         │  server/        │
└─────────────┘                              └───────┬─────────┘
                                                     │ status='brute'
                                            Celery queue `ai`
                                            process_raw_offers
                                                     │
                                     active/rejected → visibles sur le site
```

Trois packages :

| Dossier | Rôle | Stack |
|---|---|---|
| `server/` | API REST + workers Celery + migrations | FastAPI, SQLAlchemy 2, Alembic, Celery, Redis, PostgreSQL |
| `client/` | Site public (SPA) | Vite, React 19, Tailwind v4, TanStack Query |
| `scrapers/` | Collecte des offres par source | Python, Playwright/selectolax |

## Démarrage rapide

### Prérequis

- Node.js + npm
- Python ≥ 3.11 (deux venv séparés : `server/.venv` et `scrapers/.venv`)
- PostgreSQL et Redis en local

### Backend (`server/`)

```powershell
cd server
copy .env.example .env          # puis renseigner DATABASE_URL etc.
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m scripts.seed
```

### Client (`client/`)

```powershell
cd client
npm install
```

### Tout lancer en une commande

À la racine :

```powershell
npm install
npm run dev    # API + client + 3 workers Celery (ingestion, ai, emails) + beat
```

## Pipeline de données

1. **Collecte** — les scrapers (`goafrica`, `jobivoire`, `educarriere`) produisent un JSON local puis POSTent les lots sur `POST /api/ingest/offers` avec le header `X-Scraper-Token`. Ils **n'écrivent jamais directement en base**.
2. **Ingestion** — le backend valide (Pydantic), dédoublonne via `hash_unique`, insère les offres en `status='brute'` (non publiées), journalise `offer_ingestion_events`, met à jour `scrape_runs`.
3. **Traitement IA** — la tâche `process_raw_offers` (queue `ai`) valide les champs obligatoires et bascule chaque offre en `active` (+ `visible_site=true`) ou `rejected`. Par défaut `AI_ENABLED=false` → `NoopAIProcessor`, aucun appel externe.
4. **Diffusion** — les routes publiques `/api/offers` ne servent que les offres `active` et `visible_site=true`.

Déclencher un scrape manuellement (nécessite Redis + worker `ingestion`) :

```powershell
npm run scrape:all              # ou scrape:goafrica / jobivoire / educarriere
```

Celery Beat planifie aussi des scrapes démo entre 06:00 et 06:30.

## Tests

Tests backend uniquement (aucune config racine) — lancer pytest **depuis la racine** pour que les chemins résolvent :

```powershell
server\.venv\Scripts\python.exe -m pytest server\tests\<fichier>.py -q
```

Les tests n'ont besoin d'aucun service externe : `conftest.py` force SQLite, Redis injoignable (mode fallback) et aucun appel Resend.

## Variables d'environnement clés

Voir `server/.env.example`. Les plus importantes :

- `DATABASE_URL` — PostgreSQL local
- `SCRAPER_API_TOKEN` — partagé entre serveur et scrapers pour l'endpoint d'ingestion
- `CELERY_BROKER_URL` / `REDIS_URL` — Redis avec DBs distinctes : 0 broker, 1 résultats, 2 cache
- `AI_ENABLED=false` — stub IA volontaire, ne pas activer sans nécessité
- `RESEND_API_KEY` / `EMAIL_CONFIRMATION_REQUIRED=false` — emails de confirmation (désactivables en dev)
- `SCRAPER_PYTHON` — interpréteur du venv scrapers utilisé par le subprocess serveur

## Documentation détaillée

- [`client/README.md`](client/README.md) — architecture frontend, routes, conventions
- [`server/README.md`](server/README.md) — API, ingestion, tests manuels
- [`scrapers/README.md`](scrapers/README.md) — ajout/lancement d'une source, envoi à l'API

## Déploiement

- Client : Vercel (`client/vercel.json`, envs dans `.env.production`)
- Serveur : hébergé séparément (URL de prod configurée dans `VITE_API_URL`)
