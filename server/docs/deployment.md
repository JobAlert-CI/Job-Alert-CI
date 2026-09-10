# Deploiement Render — topologie et variables (audit 4, F.5)

Ce document et `server/render.yaml` (Blueprint) decrivent la topologie de
deploiement attendue. Le blueprint suffit a recreer un environnement ; ce
document explique le role de chaque process et les pietges.

## Process attendus (4)

| Process | Role | Commande | Instances |
|---|---|---|---|
| `web` | API FastAPI (routes publiques + admin, `/metrics`, `/health`) | `uvicorn main:app --host 0.0.0.0 --port $PORT` | scalable |
| `worker` | Consomme les 3 queues Celery | `celery -A celery_app.celery_app worker -Q ai,ingestion,emails --loglevel=info` | scalable |
| `beat` | Declenche les crontabs (scraping 06:00, digests 07:30/08:00, no-offer, purges 03:xx, sweep IA 5 min) | `celery -A celery_app.celery_app beat --loglevel=info` | **exactement 1** |
| `db` | PostgreSQL (Render Postgres) | — | 1 |

**Pourquoi le beat doit etre unique** : plusieurs instances declencheraient
chaque crontab en double (deux scrapings 06:00, deux preparations de digest).
Les verrous Redis par tache (`lock:digest:prepare:{date}`,
`scraper:{source}`) forment une seconde barriere, mais la topologie doit
deja etre correcte.

**Worker unique multi-queues vs 3 workers specialises** : le projet route
explicitement chaque task (`task_routes` de `celery_app.py`) vers `ai`,
`ingestion` ou `emails` ; un seul worker `-Q ai,ingestion,emails` convient.
Si la charge croit, split en 3 workers specialises par queue — aucune
configuration code necessaire, les routes existent deja.

## Variables d'environnement par process

Tous les process partagent la base `DATABASE_URL` et l'instance Redis
(broker `CELERY_BROKER_URL`, backend `CELERY_RESULT_BACKEND`, cache
`REDIS_URL` — bases Redis 0/1/2 distinctes).

| Variable | web | worker | beat | Notes |
|---|---|---|---|---|
| `APP_ENV` | `production` | idem | idem | active les gardes boot (secrets, CORS) |
| `DATABASE_URL` | oui | oui | oui | Render Postgres (internal connection string) |
| `CELERY_BROKER_URL` | oui | oui | oui | Redis db 0 |
| `CELERY_RESULT_BACKEND` | oui | oui | oui | Redis db 1 |
| `REDIS_URL` | oui | oui | oui | Redis db 2 (verrous, compteurs, rate-limit) |
| `ADMIN_JWT_SECRET` | oui | — | — | **>= 32 caracteres** (garde au boot, audit 4 J.4) |
| `AI_KEY_ENCRYPTION_SECRET` | oui | oui | — | requis si `AI_ENABLED=true` (Fernet, >= 32) |
| `SCRAPER_API_TOKEN` | oui | — | — | header `X-Scraper-Token` de `/api/ingest` |
| `INTERNAL_API_TOKEN` | oui | — | — | header `X-Internal-Token` de l'API interne IA |
| `ADMIN_API_KEY` | oui | — | — | protege `/metrics` hors loopback |
| `RESEND_API_KEY` | oui | oui | — | provider email transactionnel + digests |
| `API_BASE_URL` | oui | oui | oui | URL interne/publique du web (les tasks appellent l'API) |
| `PUBLIC_BASE_URL` | oui | oui | oui | URL publique du client (liens emails) |
| `CORS_ORIGINS` | oui | — | — | origine exacte du client, jamais `*` en prod |
| `SCRAPER_BEAT_ENABLED` | — | oui | oui | kill-switch du crontab scraping (anti catch-up) |
| `AUTO_CREATE_TABLES` | `false` | `false` | `false` | Alembic pilote le schema en prod |

## Migrations

Appliquer avant chaque deploiement qui touche les modeles :

```bash
cd server
alembic upgrade head
```

Les migrations sont **idempotentes** (garde `sa.inspect()` avant create) —
rejouables sans erreur. La 0001 fait `Base.metadata.create_all` : sur une
base vierge elle pose deja toutes les tables actuelles ; les migrations
ulterieures doivent garder leur garde-fou (cf. AGENTS.md, L.4).

## Gardes au boot (audit 4, J.4 + B.7)

En `APP_ENV=production`, le service web **refuse de demarrer** si :
- `ADMIN_JWT_SECRET` absent, egal au defaut dev, ou < 32 caracteres ;
- `AI_ENABLED=true` sans `AI_KEY_ENCRYPTION_SECRET` (ou secret < 32 chars).

Mieux vaut un boot rouge qu'un service sain au pipeline mort.

## Health checks

- `/health` (public, LB Render) : DB + Redis + Celery, repond 200
  `degraded` plutot que 503 (evite les retraits d'instance sur une panne
  temporaire) ;
- `/health/db-deep` (blackbox_exporter) : 503 explicite si DB down ;
- `/metrics` (Prometheus) : protégé en prod — loopback ou `X-Admin-API-Key`.

## Journal systeme (audit 4, G.1)

Les echecs de tasks (digests, emails, scraping, IA, maintenance) sont
persistes dans `system_event_logs` et visibles via
`GET /api/admin/system/events?source=&severity=&days=` — plus de dependance
aux logs worker Render pour diagnostiquer un incident.
