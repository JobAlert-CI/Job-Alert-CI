# JobAlert CI Server

Backend FastAPI pour JobAlert CI : offres, filieres, sources, contenu, admin, envois, scraping et ingestion d'offres scrapees.

## Perimetre actuel vs MVP (audit 4, H.4)

Le README decrivait historiquement le MVP ; l'etat reel du serveur a
largement depasse le cahier des charges initial. Tableau des ecarts a
connaetre avant de lire le reste :

| Axe | MVP (cahier des charges) | Etat actuel |
|---|---|---|
| Base | SQLite | PostgreSQL (migrations Alembic 0001→0020) |
| Back-office | absent | multi-rôles (super_admin, gestionnaire_offres, gestionnaire_utilisateurs, moderateur), JWT + refresh rotation, audit log, settings runtime |
| IA | non prevu | pipeline complet : cles chiffrees (Fernet), jobs, tentatives, alertes, circuit-breaker, fallback multi-cles (`AI_ENABLED=false` par defaut) |
| Emails | digests simples | digests cascade T0-T5 (`match_tier`), emails transactionnels, no-offer, retry borne, marqueurs Redis |
| Observabilite | logs bruts | `/metrics` Prometheus (HTTP + metier), health checks multi-niveaux, journal systeme unifie (`system_event_logs`, audit 4 G.1) |
| Exports/qualite | non prevus | exports CSV/JSON filtres, stats fenetrees, purges de retention 15/90 j |

Non livres a ce jour (gaps connus assumes, roadmap produit) : 2FA admin,
segments d'abonnes sauvegardes, matrice de permissions par route.

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

**Redis >= 6.2 requis** (commande `GETDEL`, utilisee par le flush des compteurs
view/save — `services/offer_metrics.py`). Un serveur plus ancien fonctionne
aussi grace au fallback pipeline GET+DEL, mais la version 6.2+ reste
recommandee. Verifier avec `redis-server --version` ou `INFO server`.

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

Celery Beat planifie (audit 4, F.1-F.4) : le scraping de toutes les sources
actives a 06:00 (`run_active_scrapers` — une source activee via l'admin est
scrapee des le lendemain), la preparation des digests a 07:30, leur envoi a
08:00, les emails sans offre 30 min apres l'envoi, et un sweep IA toutes les
5 minutes pour rattraper les offres `brut`. Vue complete en lecture seule :
`GET /api/admin/system/schedule`.

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
