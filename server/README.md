# JobAlert CI Server

Backend FastAPI pour JobAlert CI : offres, filieres, sources, contenu, admin, envois, scraping et ingestion d'offres scrapees.

## Installation locale

```powershell
cd server
copy .env.example .env
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
alembic upgrade head
python -m scripts.seed
uvicorn main:app --reload
```

## Variables d'environnement

Les variables principales sont dans `.env.example`.

```env
DATABASE_URL="postgresql+psycopg://jobalert_app:jobalert_password@localhost:5432/jobalert_ci"
SCRAPER_API_TOKEN="change-me-scraper-token"
INGESTION_BATCH_SIZE_MAX=500
AI_ENABLED=false
REDIS_URL="redis://localhost:6379/2"
CELERY_BROKER_URL="redis://localhost:6379/0"
CELERY_RESULT_BACKEND="redis://localhost:6379/1"
API_BASE_URL="http://localhost:8000"
```

`AI_ENABLED=false` est volontaire : le pipeline utilise uniquement `NoopAIProcessor`, sans SDK IA, sans cle IA et sans appel HTTP externe vers un service IA.

## PostgreSQL et Redis

PostgreSQL porte les tables SQLAlchemy et Redis sert de broker Celery et de verrou distribue.

```powershell
# PostgreSQL: creer la base jobalert_ci puis renseigner DATABASE_URL
cd server
alembic upgrade head
python -m scripts.seed

# Redis doit etre accessible sur REDIS_URL / CELERY_BROKER_URL
```

## Lancement

```powershell
cd server
uvicorn main:app --reload

celery -A celery_app.celery_app worker -Q ingestion --loglevel=info
celery -A celery_app.celery_app worker -Q ai --loglevel=info
celery -A celery_app.celery_app beat --loglevel=info
```

Celery Beat planifie les sources demo a 06:00, 06:10, 06:20 et 06:30, et lance un sweep IA factice toutes les 5 minutes pour rattraper les offres `brute`.

## Pipeline d'ingestion

Les scrapers n'ecrivent jamais directement en base. Ils envoient un batch a `POST /api/ingest/offers` avec le header `X-Scraper-Token`.

Le backend valide le payload Pydantic, resout la source, cree ou reutilise l'entreprise, calcule `hash_unique`, evite les doublons, insere les nouvelles offres en `status='brute'`, cree les `offer_ingestion_events`, met a jour `scrape_runs` / `source_scrape_runs`, repond immediatement, puis declenche `process_raw_offers` sur la queue `ai`.

Les offres `brute`, `processing` et `rejected` ne sont pas exposees par `/api/offers`; les routes publiques filtrent `status='active'` et `visible_site=true`.

## Statuts et IA stub

`brute` signifie : offre collectee, stockee, non visible publiquement, en attente de validation finale.

Le job `process_raw_offers` marque les offres en `processing`, appelle `NoopAIProcessor`, valide les champs obligatoires, puis passe les offres valides en `active` avec `visible_site=true`. Les offres invalides passent en `rejected`.

## Test manuel

```powershell
cd server
$env:SCRAPER_API_TOKEN="change-me-scraper-token"
python -m scripts.send_scraped_offers_example --source emploi-dakar --count 3
```

Exemple curl :

```bash
curl -X POST http://localhost:8000/api/ingest/offers \
  -H "Content-Type: application/json" \
  -H "X-Scraper-Token: change-me-scraper-token" \
  -d '{"batch_id":"11111111-1111-1111-1111-111111111111","source_code":"emploi-dakar","offers":[{"title":"Developpeur Python","company_name":"Entreprise CI","source_url":"https://example.com/jobs/1","filiere_code":"tech-dev"}]}'
```

## Tests

```powershell
cd ..
server\.venv\Scripts\python.exe -m pytest server\tests\test_ingestion_pipeline.py -q
```

## Routes principales

- `GET /health`
- `GET /api/offers`
- `GET /api/offers/{id_ou_slug}`
- `GET /api/referentials/*`
- `POST /api/ingest/offers`
- `POST /api/subscriptions`
- `POST /api/contact`
- `GET/POST/PATCH /api/admin/*`
