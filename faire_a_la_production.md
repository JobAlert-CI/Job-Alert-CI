OK je comprends mieux maintenant : **ton API Render actuelle est juste FastAPI sans Celery/Redis**, et Neon pour la DB. Tu ajoutes maintenant des briques (scrapers, Celery, Redis) et tu te demandes comment tout faire cohabiter proprement.

Laisse-moi d'abord vérifier quelques trucs sur ton setup avant de te répondre :OK j'ai **tout** ce qu'il faut maintenant. Voici l'état réel et la solution propre.

## 📊 État réel de ton projet

| Composant | État |
|---|---|
| Frontend Vite/React | ✅ Vercel |
| API FastAPI | ✅ Render (Web Service) — **sans Celery/Redis** |
| DB PostgreSQL | ✅ Neon |
| Scrapers (Python, dans `scrapers/`) | ✅ Code prêt, jamais déployé |
| Celery (beat + 3 workers) | ✅ Code prêt, jamais déployé |
| Redis | ❌ Pas provisionné |
| Digest quotidien (cascade T0-T5, email no-offer) | ✅ Code prêt, jamais activé en prod (ton API Render n'a pas de Beat qui tourne) |

**Tu as 4 briques à ajouter** : Redis + worker Beat + worker ingestion + worker AI/emails. Toutes utilisent le même `celery_app.celery_app` que ton API, juste avec des queues différentes.

---

## 🎯 Le bon ordre pour déployer sans rien casser

### Le principe clé

**Ton API Render actuelle doit rester fonctionnelle en permanence.** Tu ajoutes des services **à côté**, pas dedans. Ton API va :
1. Recevoir une **nouvelle variable d'env** : `CELERY_BROKER_URL=...` (elle n'en a pas besoin pour servir les requêtes HTTP, mais elle en a besoin pour certaines opérations comme `redis_lock`).
2. Toujours parler à Neon (DB inchangée).

Les **workers** (Beat + ingestion + AI + emails) sont des **Background Workers Render séparés** qui partagent la même DB Neon et le même Redis.

### Pourquoi ne PAS utiliser le plan gratuit Render pour les workers

- Le plan gratuit Render **dort après 15 min d'inactivité**. Un worker qui s'endort = aucun scrape, aucun email, aucun digest. Tu te retrouves avec une prod qui marche 30% du temps.
- Le **Background Worker gratuit a été supprimé** en 2024 sur Render. Aujourd'hui, le seul tier accessible est **Starter $7/mois/worker**.

---

## ✅ La stack propre et gratuite pour les workers

### 1. Redis : Upstash (gratuit, 10k commandes/jour)

- Crée un compte sur [upstash.com](https://upstash.com)
- New Database → Region **eu-central-1 (Frankfurt)** ou **eu-west-1 (Ireland)** — les plus proches des serveurs Render
- Type : **Global** (réplication multi-régions = plus rapide + plus résilient)
- Plan : **Free** (256 MB, 10 000 commandes/jour, largement assez)
- Tu obtiens une URL du type : `rediss://default:AbCdEf...@xxx-12345.upstash.io:6379`

**Comment chiffrer le besoin :**
- 3 scrapers × 4 runs/jour × ~50 commandes/run (locks + tâches) = 600 cmd/jour
- 1 Beat qui se réveille toutes les heures + digest quotidien (07h30 + 08h00 + 08h15) = ~30 cmd/jour
- 1 AI worker sur les offres ingérées = ~200 cmd/jour
- **Total : ~1000 cmd/jour** sur 10 000 disponibles ✅

**Note importante** : la spec de ton code utilise **3 DBs logiques distinctes** (`/0`, `/1`, `/2`) sur la même URL Redis. Avec Upstash, `/0`, `/1`, `/2` dans la même URL **fonctionnent** (Upstash émule la séparation logique). Mais Upstash recommande **1 seule DB par database**. Donc soit :
- **Tu crées 3 databases Upstash** (1 par usage) — plus propre mais 3 URLs à gérer.
- **Tu mets tout sur `/0`** et tu changes le code pour ne plus utiliser qu'une DB — plus simple, je te le fais dans une seconde.

### 2. Workers : 2 options

#### Option A — 100% gratuit (recommandée si tu ne veux pas payer)

**Oracle Cloud Free Tier** : 1 VM ARM 4 vCPU + 24 GB RAM gratuite à vie.
- Tu lances **Beat + worker ingestion + worker AI + worker emails + Redis** dans **Docker Compose** sur la même VM.
- Total : **0€/mois**.
- Effort : ~1 jour de setup (Dockerfile + docker-compose + Caddy + DNS).

#### Option B — Payante mais simple

**Render Background Workers** (Starter $7/mois chacun) :
- `job-alert-ci-beat` : $7/mois
- `job-alert-ci-worker-ingestion` : $7/mois
- `job-alert-ci-worker-ai` : $7/mois (ou fusionner avec emails)
- `job-alert-ci-worker-emails` : $7/mois (ou fusionner avec AI)
- **Total : $21-28/mois**

Moins de setup, mais ça chiffre. **Si tu pars sur cette option, je te recommande de fusionner AI + emails dans 1 seul worker** (ils traitent peu de tâches chacun).

---

## 🛠️ Plan d'exécution concret (Option A : Oracle gratuit)

### Étape 1 : Créer le compte Upstash

1. [upstash.com](https://upstash.com) → Sign up (GitHub OAuth le plus rapide)
2. Console → New Database
   - Name : `jobalert-redis`
   - Region : `eu-central-1` (Frankfurt)
   - TLS : activé
   - Plan : Free
3. Copier l'URL `rediss://default:...@...upstash.io:6379` — tu en auras besoin partout.

### Étape 2 : Refactor du code pour 1 seule DB Redis

Je te propose de **simplifier** : ne plus utiliser `/0`, `/1`, `/2` (3 DBs logiques) mais tout sur `/0`. Upstash recommande 1 DB par database, et on n'a aucun bénéfice à séparer.

**Fichiers à modifier** (3 lignes en gros) :
- `server/.env.example` : `REDIS_URL=rediss://...upstash.io:6379/0`, idem pour les 2 autres
- `server/core/config.py` : defaults à `/0` partout (ou supprimer le suffixe et forcer `/0`)

Dis-moi si tu veux que je le fasse.

### Étape 3 : Provisionner la VM Oracle

1. [cloud.oracle.com](https://cloud.oracle.com) → Sign up (carte requise mais **0€ facturé**)
2. Compute → Instances → Create Instance
   - Image : **Ubuntu 22.04 LTS** (ou 24.04)
   - Shape : **VM.Standard.A1.Flex** (ARM Ampere)
   - **4 OCPU + 24 GB RAM** (le max du free tier)
   - Boot volume : 100 GB
   - VCN : default
   - Subnet : default (public)
   - SSH key : télécharge ta clé privée
3. Note l'**IP publique** de la VM

### Étape 4 : Setup Docker sur la VM

```bash
# Connexion SSH
ssh -i ~/Downloads/ssh-key.key ubuntu@<IP_PUBLIQUE>

# Install Docker
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin ufw curl
sudo usermod -aG docker ubuntu
newgrp docker

# Firewall
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw enable
```

### Étape 5 : Créer `docker-compose.production.yml` à la racine

```yaml
# docker-compose.production.yml
services:
  beat:
    build: ./server
    command: celery -A celery_app.celery_app beat --loglevel=info
    env_file: ./server/.env.production
    restart: always
    depends_on: [redis]

  worker-ingestion:
    build: ./server
    command: celery -A celery_app.celery_app worker -Q ingestion --loglevel=info --concurrency=2
    env_file: ./server/.env.production
    restart: always
    depends_on: [redis]

  worker-ai:
    build: ./server
    command: celery -A celery_app.celery_app worker -Q ai --loglevel=info --concurrency=1
    env_file: ./server/.env.production
    restart: always
    depends_on: [redis]

  worker-emails:
    build: ./server
    command: celery -A celery_app.celery_app worker -Q emails --loglevel=info --concurrency=1
    env_file: ./server/.env.production
    restart: always
    depends_on: [redis]

  redis:
    image: redis:7-alpine
    restart: always
    volumes: [redis_data:/data]
    # Optionnel: mot de passe
    # command: redis-server --requirepass ${REDIS_PASSWORD}

  caddy:
    image: caddy:2
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    restart: always

volumes:
  redis_data:
  caddy_data:
  caddy_config:
```

### Étape 6 : Créer `server/Dockerfile`

```dockerfile
FROM python:3.11-slim

# Deps systeme pour Playwright/Chromium + PostgreSQL client + curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium chromium-driver \
    postgresql-client curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Deps Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Code
COPY . .

# Code des scrapers (a la racine du repo, pas dans server/)
COPY ../scrapers /app/scrapers

# Verif de sante
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s \
    CMD celery -A celery_app.celery_app inspect ping || exit 1

CMD ["celery", "-A", "celery_app.celery_app", "worker", "-Q", "ingestion"]
```

### Étape 7 : Créer `server/.env.production`

```bash
# Connection DB (Neon)
DATABASE_URL=postgresql+psycopg://user:pass@ep-xxx.region.neon.tech/jobalert?sslmode=require

# Redis Upstash (1 seule DB)
REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379/0
CELERY_BROKER_URL=rediss://default:xxx@xxx.upstash.io:6379/0
CELERY_RESULT_BACKEND=rediss://default:xxx@xxx.upstash.io:6379/0

# API Render (pour les scrapers)
SCRAPER_API_BASE_URL=https://job-alert-ci-i6ur.onrender.com
SCRAPER_API_TOKEN=change...oken

# Python pour subprocess scrapers (pas de venv Windows sur Linux)
SCRAPER_PYTHON=/usr/local/bin/python3

# Mode
APP_ENV=production
ALLOW_DEMO_SCRAPER=false
```

### Étape 8 : `Caddyfile` (reverse proxy HTTPS auto)

```caddyfile
api.jobalert.ci {
    reverse_proxy worker-ingestion:8000
}
```

(Caddy provisionne et renouvelle Let's Encrypt automatiquement — il te faut un domaine `jobalert.ci` pointant vers l'IP Oracle.)

### Étape 9 : Lancer

```bash
# Sur la VM Oracle
git clone https://github.com/JobAlert-CI/Job-Alert-CI.git
cd Job-Alert-CI
cp server/.env.production.example server/.env.production
nano server/.env.production  # editer avec les vraies valeurs

docker compose -f docker-compose.production.yml up -d --build

# Verifier que les workers sont vivants
docker compose -f docker-compose.production.yml logs -f beat
docker compose -f docker-compose.production.yml logs -f worker-ingestion
```

### Étape 10 : Activer le digest sur Render

Une fois Redis up :
1. Va sur Render → ton Web Service API → Environment
2. Ajoute :
   ```
   CELERY_BROKER_URL=rediss://default:xxx@xxx.upstash.io:6379/0
   CELERY_RESULT_BACKEND=rediss://default:xxx@xxx.upstash.io:6379/0
   REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379/0
   ```
3. Redéploie

L'API Render n'a plus besoin de Beat ni de workers (c'est juste une Web Service HTTP) — elle a juste besoin de pouvoir se connecter à Redis pour les locks.

---

## 🧪 Tester avant de tout déployer

Avant de mettre en prod, je te recommande de **tester en local** avec le nouveau setup :

1. Lance Redis en local : `docker run -d -p 6379:6379 redis:7-alpine`
2. Lance les 4 services en local :
   ```bash
   npm run dev:beat
   npm run dev:worker:ingestion
   npm run dev:worker:ai
   npm run dev:worker:emails
   ```
3. Déclenche un scrape : `npm run scrape:all`
4. Vérifie dans la DB (via Neon ou psql) que les offres arrivent dans `job_offers`
5. Vérifie que le digest du jour se crée (tu peux forcer avec `prepare_daily_digests` en local)

---

## ❓ 4 questions pour ajuster le plan

Avant que je te génère les fichiers (Dockerfile, docker-compose, .env, etc.), j'ai besoin de 4 trucs :

1. **Tu pars sur quelle option** : A (Oracle gratuit, plus de setup) ou B (Render $21-28/mois, plus simple) ?
2. **Tu as un domaine custom** (`jobalert.ci`) ou tu restes sur `job-alert-ci-i6ur.onrender.com` + IP Oracle ?
3. **Tu veux que je refactor le code** pour passer de 3 DBs Redis (`/0`, `/1`, `/2`) à 1 seule (`/0`) ? C'est plus simple pour Upstash.
4. **Tu as un budget mensuel acceptable** pour confirmer l'option ?

Avec ces réponses je te livre les fichiers prêts à copier, sans exploration.