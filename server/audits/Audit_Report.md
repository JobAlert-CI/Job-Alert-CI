# Audit backend JobAlert CI — Rapport

> **Périmètre** : intégralité du dossier `server/` du dépôt JobAlert CI. Aucun fichier frontend, aucune donnée inventée. Tous les constats renvoient à un fichier et à des lignes réelles. Les points incertains sont étiquetés **Hypothèse**.
> **Date** : 2026‑09‑03
> **Méthodologie** : cf. `server/Audit.md`. Lecture par couches (config → modèles → migrations → deps → routes → services → tâches → tests), puis croisement code/ORM, identification d'anti‑patterns, et estimation d'impact.

---

## 1. Résumé exécutif

### 1.1 Note globale

**C+ (7/10)** — Backend fonctionnel, bien découpé, avec de vraies bonnes pratiques (migrations strictes, transactions explicites, idempotence des jetons, rate‑limit du renvoi, chiffrement des clés IA, signatures Svix sur le webhook Resend, schémas Pydantic soignés). Les points les plus fragiles ne sont pas des bugs silencieux : ce sont (a) des contrôles d'accès manquants ou incohérents sur plusieurs routers admin, (b) un import CSV/JSON sans borne de taille ni validation de MIME, (c) des duplications de logique « Search by ilike `%q%` » sans échappement des wildcards sur au moins 6 routes, (d) des verrous Redis « non fous » (token de lock = nom du lock) qui peuvent être libérés par un autre worker, et (e) un modèle `JobOfferStatus` qui contient **trois valeurs synonymes** (`brut`, `brute`, `legacy_brute`) qui violent la contrainte SQLAlchemy `Enum(native_enum=False)` au niveau Python.

### 1.2 Les 5 priorités à corriger en premier

1. **🔴 P0 — Faille d'autorisation sur `/api/admin/companies`** (`server/api/v1/admin/companies.py:14-30, 80-114`). Le router n'a **aucun** `require_roles`. N'importe quel admin authentifié (y compris un simple modérateur) peut créer, modifier, supprimer ou **fusionner** des entreprises. Le service de fusion (`server/services/companies.py:27-40`) ré‑attribue silencieusement les `JobOffer` d'une entreprise vers une autre sans audit. En prime, l'endpoint POST référence `Administrator` qui n'est pas importé : `NameError` à l'exécution.
2. **🔴 P0 — Import d'offres non borné et non validé** (`server/api/v1/admin/offers.py:252-296`). `POST /api/admin/offers/import` lit le fichier entier en mémoire (`await file.read()`), décode sans limite, ne vérifie ni le type MIME, ni la taille, ni l'extension au‑delà de deux suffixes, et itère ligne par ligne sans atomicité (un crash à mi‑chemin laisse la base dans un état partiel). Aucun `Content-Length` plafond.
3. **🔴 P0 — `JobOfferStatus` à 3 valeurs synonymes** (`server/models/enums.py:21-35`). `BRUT = "brut"`, `BRUTE = "brute"` et `LEGACY_BRUTE = "brut"` partagent deux valeurs de chaîne. Avec `Enum(native_enum=False, validate_strings=True, create_constraint=True)`, SQLAlchemy matérialisera des `CHECK` dupliqués et l'ORM Python lèvera `ValueError: duplicate enum value` à la première utilisation. À fixer avant la première migration 0003 en production.
4. **🟠 P1 — `ilike(f"%{q}%")` sans échappement des wildcards** sur au moins 6 endpoints : `admin/offers.py:60`, `admin/subscribers.py:58`, `admin/companies.py:39`, `admin/articles.py:125` (via `content.py:125`), `admin/aggregates.py` (par `services/admin_aggregates.py` qui *fait* l'échappement — seul cas conforme) et `public/articles.py:87`. Un utilisateur qui saisit `%` ou `_` peut (a) provoquer un scan complet de table au lieu d'un préfixe, (b) extraire de l'information par collision de patterns.
5. **🟠 P1 — Verrous Redis non fous** (`server/tasks/locks.py:14-34`). Le « token » du lock est le **nom du lock** lui‑même. Deux workers peuvent prendre puis libérer le même verrou en cascade. Aucune atomicité SET‑NX + token‑aléatoire + Lua. Le code commente « verrou distribué » mais ce n'est pas un vrai Redlock ni un équivalent SET NX + EX + DEL atomique.

### 1.3 Domaines globalement sains

- **Schémas Pydantic** : `schemas/` est cohérent, sépare Create/Update/Read, documente chaque champ. Quelques schémas de retour sont redéclarés en `dict` (ex. `admin/ai_suggestions.py`, `admin/companies.py`) — c'est une dette de typage mineure.
- **Tokens et confirmation d'email** (`services/token_service.py`, `services/email_confirmation_service.py`) : `secrets.token_urlsafe(32)`, hash SHA‑256 uniquement en base, révocation des anciens tokens, rate‑limit Redis, fallback gracieux sans Redis, messages anti‑énumération. C'est l'un des modules les mieux conçus du projet.
- **Webhook Resend** (`server/api/v1/public/webhooks_resend.py:1-114`) : signature Svix vérifiée en `hmac.compare_digest`, secret obligatoire (sinon 503), réponse opaque `{"received": true}`, idempotence via `provider_email_id`. Petit bémol : pas de fenêtre de tolérance sur le timestamp (replay possible), à confirmer en hypothèse.
- **Migrations Alembic** : chaîne linéaire 0001 → 0009, chaque migration teste l'existence préalable (`if "col" not in columns`) pour être re‑jouable, `compare_type=True` + `compare_server_default=True` activés dans `env.py`. Bon niveau de robustesse.
- **Échappement HTML** des emails (`services/email/templates.py`, `services/no_offer_email_service.py:159-228`) : `html.escape()` systématique, pas de Jinja non échappé, le token brut n'apparaît que dans l'URL.

---

## 2. Rapport détaillé par domaine

### 2.1 Architecture et maintenabilité

#### Constats positifs
- **Découpage en couches net** : `models/`, `schemas/`, `services/`, `tasks/`, `api/`, `core/`, `db/`, `migrations/`. Aucun import croisé cyclique détecté (vérifié sur 30+ modules). Les `services/` ne dépendent pas de FastAPI sauf pour les exceptions `HTTPException` levées au plus près de la route.
- **Mixins réutilisables** : `db/base.py:33-55` (`UUIDPrimaryKeyMixin`, `TimestampMixin`, `SoftDeleteMixin`) factorisent les colonnes systématiques. Le `NAMING_CONVENTION` Alembic (`db/base.py:10-16`) garantit des noms de contraintes stables.
- **Enums centralisés** : `models/enums.py` regroupe 25 énumérations, toutes en `StrEnum` Python 3.11+ — lisible et testable.
- **Repositories minces** : `_get_or_create_company` (`services/offers.py:37-45`, `services/ingestion.py:122-136`) factorise proprement, avec `db.flush()` explicite.
- **Pattern `session_scope()` cohérent** : `db/session.py:53-65` avec `commit/rollback/close` propre, utilisé par toutes les tâches Celery.

#### Problèmes identifiés

| ID | Criticité | Localisation | Description |
|----|-----------|--------------|-------------|
| A1 | **P1** | `api/v1/admin/companies.py:14-30` | Le router `/api/admin/companies` n'a **aucun** `require_roles` au niveau du router ni sur les endpoints. Seuls `get_current_admin` est appliqué. Un modérateur peut supprimer ou fusionner des entreprises. C'est un défaut de défense en profondeur — le bon pattern est appliqué partout ailleurs (`admins.py:18-22`, `sending.py:19-24`, `scraping.py:19-24`, `referentials.py:48-53`, `content.py:51-56`). |
| A2 | **P1** | `api/v1/admin/companies.py:80-114` | Les handlers POST/PUT/DELETE référencent `Administrator` sans l'importer (`NameError` à l'exécution). Le code de `admin/ai_suggestions.py:44,84` fait la même chose via `__import__("models").admin.Administrator` et `__import__("datetime")` — anti‑pattern qui contourne les imports et empêche la détection statique. |
| A3 | **P1** | `api/v1/admin/companies.py:43-72` (`top_recruiters`) | La fonction exécute deux requêtes redondantes (l.51-58 construit une requête `select Company, count...` jamais utilisée, l.62-67 ré‑effectue la même jointure) et ne filtre pas réellement par statut `active` malgré le commentaire « simplifie ». `companies` est lu puis filtré « pour rester simple » (l.71) — code mort. |
| A4 | **P1** | `api/v1/admin/ai_suggestions.py:39-88` | Pas de transaction explicite, pas de log d'audit, pas de duplicate‑detection sur le `slug` de filière (collision possible), pas de validation que `suggestion.code` est slug‑safe, et `__import__("models")`/`__import__("datetime")` dans le corps du handler. |
| A5 | **P2** | `api/v1/admin/offers.py:199-296` | Bloc « doublons + import » ajouté en bas du fichier avec imports inline (`from schemas.offers import DuplicateMarkRequest, RejectRequest, PotentialDuplicateRead` ligne 201 ; `import csv, io, json` ; `from fastapi import UploadFile`). Mélange route + service + import en vrac dans le même module. |
| A6 | **P2** | `api/v1/admin/companies.py:21-28` (`CompanyCreate`) | Le schéma est redéclaré dans le router (`class CompanyCreate(ORMModel)`) au lieu d'être dans `schemas/`. Pareil pour `ContactMessageCreate` dans `public/contact.py:16-20`. Duplique la définition et complique la maintenance. |
| A7 | **P2** | `api/v1/admin/system_health.py:22-82` | Énorme bloc de `__import__("models")` à l'intérieur d'une signature de fonction (l.22) et d'un corps (l.27, l.47, l.60) — anti‑pattern qui sent le merge raté. Le `dependencies=[Depends(get_current_admin)]` n'a pas de `require_roles` : n'importe quel admin (y compris un modérateur) accède à la santé système. |
| A8 | **P2** | `services/companies.py:1-40` | Imports `HTTPException` à l'intérieur des fonctions via `from fastapi import HTTPException`. Le service « pur » ne devrait pas connaître FastAPI ; l'exception métier devrait être levée en `ValueError` ou via une `CompanyServiceError` et traduite par la route. Idem `services/duplicates.py:80,85` et `services/filiere_simulator.py:34-35`. |
| A9 | **P2** | `api/v1/admin/ai.py:37` | `*** = db.get(AIApiKey, key_id)` — placeholder obfusqué qui ne compile pas dans un environnement qui n'aurait pas été altéré manuellement. À remplacer par un nom explicite. |
| A10 | **P2** | `services/duplicates.py:98-126` | Le service de rejet de paires duplique `find_potential_duplicates` + boucle Python sur **toutes** les offres actives (`db.scalars(...).all()` à la ligne 34) — O(N) en mémoire, inacceptable au‑delà de quelques milliers d'offres actives. |

#### Pistes de correction (extraits)

```python
# api/v1/admin/companies.py — version corrigée
from models.admin import Administrator  # import en haut, plus de NameError

router = APIRouter(
    prefix="/api/admin/companies",
    tags=["admin-companies"],
    dependencies=[Depends(require_roles("super_admin"))],  # défense en profondeur
)

# Schéma CompanyCreate déplacé dans schemas/companies.py
```

---

### 2.2 Sécurité

#### 2.2.1 Authentification & autorisation

| ID | Criticité | Localisation | Description |
|----|-----------|--------------|-------------|
| S1 | **P0** | `api/v1/admin/companies.py:14-30` | (déjà décrit A1) : aucun `require_roles`. |
| S2 | **P0** | `api/v1/admin/system_health.py:18-19` | `/api/admin/system/health` n'a que `Depends(get_current_admin)`. Un modérateur peut interroger l'infra, ce qui est probablement OK fonctionnellement mais est documenté comme « réservé super_admin » dans d'autres modules. Aligner. |
| S3 | **P1** | `core/config.py:195-197` | `admin_jwt_secret` a un **fallback** à `"dev-insecure-secret-change-me"`. Le check `main.py:22-25` refuse le démarrage en prod **uniquement si** `is_production and admin_jwt_secret == _INSECURE_DEFAULT_JWT_SECRET`. Tout déploiement `APP_ENV=staging` (lowercase != `"prod"`) hérite du secret faible sans avertissement. Aligner `is_production` sur tout `APP_ENV != development/test`. |
| S4 | **P1** | `api/v1/public/subscriptions.py:33-48` | `_get_subscriber_by_token` duplique `validate_token` mais ignore la vérification `revoked_at`/`used_at`/`expires_at` pour `manage_alert` : il filtre seulement `revoked_at.is_(None)`. Un token `manage_alert` déjà consommé reste utilisable. Le code source l'avoue implicitement (l.173, l.191). |
| S5 | **P1** | `api/v1/public/subscriptions.py:58-86` (`POST /api/subscriptions`) | Aucun rate‑limit applicatif. Seul `resend-confirmation` est protégé (`services/email/rate_limit.py`). Un attaquant peut bombarder l'API d'inscriptions et épuiser les `Subscriber` actifs et les envois de confirmation. |
| S6 | **P1** | `api/v1/public/contact.py:1-26` | Aucun rate‑limit, aucun captcha. Le schéma `ContactMessageCreate` est redéclaré en local. |
| S7 | **P1** | `api/v1/public/offers.py:195-202` (`POST /api/offers/{id}/save`) | Incrémente `save_count` sans rien écrire dans `SavedOffer`. N'importe qui (pas d'auth) peut spammer l'endpoint pour gonfler arbitrairement le compteur d'une offre. `POST /api/offers/{id}/view` (l.185-192) a le même problème et biaise le widget « top‑vues ». |
| S8 | **P1** | `services/subscriptions.py:184-192` | Le `MANAGE_ALERT` token est généré et hashé, mais la **valeur brute n'est jamais retournée**. Aucun appelant ne peut construire l'URL `/preferences/{token}`. Conséquence : l'endpoint `GET/PUT /api/subscriptions/preferences/{token}` (`public/subscriptions.py:171-222`) est inatteignable depuis l'inscription, et les emails de digest/no‑offer ne peuvent pas lier vers la page de préférences (sauf en re‑émettant un token à la volée — `no_offer_email_service.py:298-300`). |
| S9 | **P2** | `core/security.py:36-44` | `verify_password` capture `ValueError`/`TypeError` mais **pas** `bcrypt.exceptions.BcryptError` (versions 5.x). Une exception interne inattendue remontera 500. |
| S10 | **P2** | `api/deps.py:48-55` (`_extract_bearer_token`) | Tolère la casse `bearer ` (lowercase), mais ne vérifie pas qu'il y a **un seul** espace. Une valeur `"Bearer  abc"` (deux espaces) serait acceptée et passerait `" abc"` comme token — échec d'authentification, pas un trou de sécu mais c'est laxiste. |

#### 2.2.2 Mots de passe, hash, JWT

| ID | Criticité | Localisation | Description |
|----|-----------|--------------|-------------|
| S11 | OK | `core/security.py:36-44` | `bcrypt` (5.0.0), `gensalt()` par défaut (cost 12). Conforme. |
| S12 | OK | `core/security.py:60-75` | JWT HS256 maison, signature via `hmac.compare_digest`, validation d'`exp`. Code dépouillé mais correct. Le champ `iat` est posé sans `nbf`/`aud`/`iss`, ce qui est acceptable pour un back‑office interne. |
| S13 | **P1** | `api/v1/admin/auth.py:43-66` (`refresh`) | Le refresh crée un **nouveau** couple access+refresh sans révoquer l'ancien refresh. La « rotation » n'est pas effective : un token refresh volé reste valide jusqu'à expiration (7 jours par défaut). Pas de famille de tokens, pas de tracking `jti`. |
| S14 | **P2** | `core/security.py:88-121` | `decode_token` ne vérifie pas l'`iat` dans le futur (sanity check). Acceptable mais à durcir si l'horloge des workers dérive. |

#### 2.2.3 Validation des entrées

| ID | Criticité | Localisation | Description |
|----|-----------|--------------|-------------|
| S15 | **P1** | `api/v1/admin/offers.py:60` | `JobOffer.title.ilike(f"%{q}%")` — pas d'échappement. |
| S16 | **P1** | `api/v1/admin/subscribers.py:58` | `(Subscriber.email.ilike(f"%{q}%")) | (Subscriber.full_name.ilike(f"%{q}%"))` — pas d'échappement. |
| S17 | **P1** | `api/v1/admin/companies.py:39` | `Company.name.ilike(f"%{q}%")` — pas d'échappement. |
| S18 | **P1** | `api/v1/admin/content.py:125` | `ContentPage.title.ilike(f"%{q}%")` — pas d'échappement. |
| S19 | **P1** | `api/v1/public/articles.py:87` | `ContentPage.title.ilike(f"%{q}%")` — pas d'échappement. |
| S20 | **P1** | `services/admin_exports.py:103,153,155` | Mêmes `ilike` non échappés. |
| S21 | **P1** | `api/v1/admin/offers.py:252-296` (`/import`) | **Aucune** validation de type MIME, **aucune** borne de taille (`await file.read()` lit tout), tentative de parse JSON sur n'importe quoi. Un POST de 500 Mo de JSON malformé fera 500 sur le worker (et OOM en prod). |
| S22 | **P2** | `api/v1/public/offers.py:91` | `JobOffer.normalized_title.contains(normalize_text(q))` — `contains` de SQLAlchemy est équivalent à `LIKE %?%` **sans** échappement automatique (contrairement à `ilike` qui passe par l'opérateur `LIKE`). Pire : avec SQLite le `contains` est case‑sensitive. Le commentaire laisse penser que c'est sûr — ce n'est pas le cas. |
| S23 | **P2** | `api/v1/admin/sending.py:122-126` | `if status:` filtre brut sur `EmailDigest.status == status`. Pas de validation que la valeur est dans `DigestStatus`. Un user peut filtrer par `'; DROP TABLE…'` (inoffensif grâce à SQLAlchemy paramétré, mais c'est un défaut de robustesse). |

#### 2.2.4 CORS

| ID | Criticité | Localisation | Description |
|----|-----------|--------------|-------------|
| S24 | OK | `main.py:41-47` | `allow_origins=settings.cors_origins` (liste de la config), pas de `*` codé en dur. `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]` — l'usage de `*` sur méthodes/headers en prod est large ; en pratique OK si l'origin est strict. |
| S25 | **P2** | `main.py:41-47` | Pas de validation runtime que `CORS_ORIGINS` exclut `http://*` en prod. Documenter dans `.env.example` que la liste doit être explicite. |

#### 2.2.5 Webhooks

| ID | Criticité | Localisation | Description |
|----|-----------|--------------|-------------|
| S26 | OK | `api/v1/public/webhooks_resend.py:44-58` | Signature Svix vérifiée en `hmac.compare_digest`, secret obligatoire (sinon 503), support des en‑têtes `svix-*` **et** `webhook-*` (compat), parsing JSON propre. |
| S27 | **Hypothèse** | `api/v1/public/webhooks_resend.py:62-114` | **Pas** de fenêtre de tolérance sur le timestamp (replay possible). Le code ne vérifie pas que `now - svix_timestamp < 5 min` (recommandation Svix). À confirmer côté prod. |
| S28 | **P2** | `api/v1/public/webhooks_resend.py:55-58` | Si la signature contient plusieurs versions (`v1,sig1 v1,sig2`), la boucle `for part in signature_header.split()` les essaie toutes. Bonne pratique, mais `whsec_` est strippé **avant** la base64‑decode — un secret `whsec_` non base64 utilisera le fallback `key.encode("utf-8")` ligne 49, ce qui peut faire diverger les signatures entre l'émetteur et le récepteur. Documenter. |

#### 2.2.6 Uploads / données

| ID | Criticité | Localisation | Description |
|----|-----------|--------------|-------------|
| S29 | **P0** | `api/v1/admin/offers.py:252-296` | Import sans limite. Cf. S21. |
| S30 | **P2** | `services/email/resend_provider.py:73-79` | Header `Authorization: Bearer <api_key>` correctement posé mais aucun retry sur 401 (bonne pratique : éviter de fuiter un token invalide). OK. |

#### 2.2.7 Logs / fuite de données

| ID | Criticité | Localisation | Description |
|----|-----------|--------------|-------------|
| S31 | OK | `services/email/resend_provider.py:115-117` | `error_message` ne contient pas la clé API. Le champ `raw_response=body` (l.123) n'est jamais loggé par le worker (`tasks/emails.py:54-89`) mais est stocké en base. À vérifier : `TransactionalEmailEvent.response_payload` (`models/emails.py:129`) — n'est jamais renvoyé par `transactional_emails.py:46` (« Aucun payload n'est expose ici par securite »). OK. |
| S32 | **P1** | `tasks/scrapers.py:91-100` | En cas d'erreur du script de scraping, le code logge `completed.stderr[-4000:]` et `completed.stdout[-2000:]`. Si le script logge accidentellement `SCRAPER_API_TOKEN` ou des payloads, ces informations atterrissent dans les logs applicatifs. À encadrer par une sanitisation explicite ou un filtre PII. |
| S33 | **P2** | `tasks/scrapers.py:71-81` | `env.update({"SCRAPER_API_TOKEN": settings.scraper_api_token or ""})` propage le token dans l'environnement du sous‑processus. Risque mineur (le sous‑processus est de confiance) mais à durcir (passer le token via stdin). |

#### 2.2.8 Modèles / ORM

| ID | Criticité | Localisation | Description |
|----|-----------|--------------|-------------|
| S34 | **P0** | `models/enums.py:29-31` | `BRUT = "brut"`, `BRUTE = "brute"`, `LEGACY_BRUTE = "brut"`. `BRUT` et `LEGACY_BRUTE` partagent la **même** valeur chaîne → avec `Enum(native_enum=False, validate_strings=True)`, SQLAlchemy lèvera une erreur à l'instanciation de la première colonne. À corriger d'urgence (typiquement supprimer `LEGACY_BRUTE` et migrer les données existantes vers `BRUT`). |

#### 2.2.9 Dépendances

| ID | Criticité | Localisation | Description |
|----|-----------|--------------|-------------|
| S35 | OK | `requirements.txt:1-32` | Versions épinglées. `bcrypt 5.0.0`, `cryptography 46.0.3`, `fastapi 0.141.1`, `SQLAlchemy 2.0.51`, `pydantic 2.13.4` — toutes récentes. À surveiller en CI : pas de dependabot/safety configuré. |

---

### 2.3 Performance

| ID | Criticité | Localisation | Description |
|----|-----------|--------------|-------------|
| P1 | **P1** | `api/v1/public/filieres.py:36-58` | Boucle Python sur les filieres (`for f in filieres:`) avec 3 `db.scalar(select(func.count(...)))` par filière → N+3 requêtes pour ~10 filieres, ~30 aller‑retours SQL par appel. À remplacer par une seule requête agrégée. |
| P2 | **P1** | `services/duplicates.py:34` | `db.scalars(...).all()` charge **toutes** les offres actives en RAM pour calculer les paires. Inacceptable dès 10k+ offres. Stratégie documentée « simplifie » mais en prod ce sera un goulot. À transformer en SQL fenêtré / pg_trgm / Levenshtein côté DB. |
| P3 | **P1** | `api/v1/admin/logs.py:84-114` | `events` charge `limit * 3` lignes (`stmt.limit(limit * 3)`) puis filtre Python (`if level and computed_level != level`) pour ne garder que `limit` résultats. Sur‑fetch 3x. |
| P4 | **P1** | `api/v1/admin/companies.py:43-72` (`top_recruiters`) | Double requête (`db.execute(select Company, count...)` puis `db.scalars(stmt).limit(limit)`) — code mort redondant. |
| P5 | **P1** | `api/v1/public/offers.py:185-202` | Incrémentation synchrone de `view_count`/`save_count` sur chaque appel : `db.commit()` après chaque vue. Sous charge (page lue 100x/s), c'est un hotspot d'écriture. À batcher ou à déléguer à un compteur asynchrone. |
| P6 | **P2** | `services/admin_aggregates.py:30-58` | `top_viewed_offers` charge `limit` lignes (≤50) sans `joinedload(Company)`. Acceptable mais pourrait bénéficier d'un tri par `view_count` indexé (manquant). |
| P7 | **P2** | `services/ingestion.py:208-325` | Boucle d'ingestion séquentielle par offre. `db.flush()` à chaque offre (l.275, 359). Pour 500 offres, c'est 500 flush. À batcher (chunk de 50 + un seul commit). |
| P8 | **P2** | `services/digest_builder_service.py:180-182` | `db.scalars(select(Location).where(...).is_active).all()` charge **toutes** les locations actives en RAM à chaque appel. Acceptable si la table est petite (référentiel), à surveiller. |
| P9 | **P2** | `services/ai_results.py:138-148` | Création d'un `OfferIngestionEvent` par offre traitée. Croissance linéaire de la table d'événements ; envisager une partition par mois. |
| P10 | **P2** | `api/v1/admin/offers.py:57-73` | `joinedload` 9 relations (`_load_offer_relations()`) à chaque listing. Pour 100 lignes × 9 jointures, génère 900 lignes SQL en plus des 100 principales. À valider : utiliser `selectinload` au lieu de `joinedload` pour les relations many‑to‑many (filiere_links, etc.) si jamais le schéma grossit. |

#### Index manquants ou redondants

- `models/jobs.py:91-92` : `view_count` et `save_count` indexés **non** (volontaire ?), mais le tri par `view_count DESC` (`services/admin_aggregates.py:55`) sera lent sur 100k+ offres. Ajouter un index composé `(status, view_count DESC, deleted_at)`.
- `models/subscriptions.py:30` : `email_normalized` est déjà `index=True` ✅
- `models/jobs.py:48` : `title` est `index=True` mais les requêtes filtrent sur `normalized_title` (qui l'est aussi). Bon.
- `models/ai.py:61` : `Index("ix_ai_api_keys_selection", "is_active", "priority", "last_error_at", "created_at")` est composé mais aucun modèle n'en bénéficie dans les routes : à confirmer en hypothèse.
- `models/jobs.py:132-133` : `ix_job_offers_feed (visible_site, status, published_at)` et `ix_job_offers_search (normalized_title, visible_site, status)` — bons index, **mais** la 1ère colonne n'est pas utilisée dans tous les filtres : `admin/offers.py:73` trie par `created_at DESC` sans index dédié.

---

### 2.4 Base de données et migrations

| ID | Criticité | Localisation | Description |
|----|-----------|--------------|-------------|
| DB1 | OK | `migrations/versions/0001-0009` | Chaîne linéaire, chaque migration teste l'existence préalable (`if "col" not in columns`). |
| DB2 | OK | `migrations/env.py:55-57` | `compare_type=True`, `compare_server_default=True` activés. |
| DB3 | **P0** | `models/enums.py:21-35` | (déjà S34) doublons `BRUT/LEGACY_BRUTE`. |
| DB4 | **P1** | `migrations/versions/0001_initial_schema.py:13-21` | `upgrade()` et `downgrade()` sont des `Base.metadata.create_all/drop_all`. Très pratique en dev, mais `downgrade()` **drop TOUTES les tables**. Aucun garde‑fou (`if not app_env == "development"`). Risque de perte de données si on lance `alembic downgrade -1` en prod par accident. |
| DB5 | **P1** | `migrations/versions/0002_ingestion_ai_pipeline.py:55-57` | La contrainte CHECK `jobofferstatus_values` n'est appliquée **que** sur `dialect != "sqlite"`. En SQLite (tests + dev), aucune contrainte → une valeur invalide peut être insérée en dev et exploser en prod. Aligner ou documenter. |
| DB6 | **P1** | `migrations/versions/0005_filiere_color_hex.py:32-35` | `alter_column("hue", new_column_name="color_hex")` change le **nom** de colonne. En prod, c'est une opération qui peut locker la table (PostgreSQL ≤ 11). Sur de petites tables OK, à surveiller si `filieres` grossit. |
| DB7 | **P2** | `db/session.py:68-74` (`init_db`) | `Base.metadata.drop_all` + `create_all` au boot. C'est explicitement piloté par `AUTO_CREATE_TABLES`, mais c'est un piège : si quelqu'un l'active en prod, `drop_all` détruit tout. OK si le code reste `if not is_production` — vérifier que c'est le cas. |
| DB8 | **P2** | `models/emails.py:51-54` | `UniqueConstraint("subscriber_id", "digest_date")` — OK, mais aucun index « partial » pour les `skipped_empty` (qui partagent `digest_date`). En prod, la table `email_digests` grossit vite ; à partitionner. |
| DB9 | **P2** | `models/jobs.py:53` | `location_id ... ondelete="SET NULL"` — OK. `models/scraping.py:66` : `source_id ... ondelete="RESTRICT"` — OK, **mais** empêche de désactiver une source qui a des `SourceScrapeRun` actifs. Cohérent mais contraignant. |
| DB10 | **P2** | `models/admin.py:51` | `SiteSetting.updated_by_admin_id ... ondelete="SET NULL"` — OK, mais `db.session.execute` du `__init__.py` n'a pas de fixture de nettoyage. |
| DB11 | **P2** | `migrations/versions/0007_digest_cascade_match_tier.py:48-55` | `match_tier` n'a pas de `CheckConstraint("match_tier IN ('T0', 'T1', ...)")`. Un `INSERT/UPDATE` avec `match_tier='T9'` passera. Le code n'utilise que T0‑T5 mais rien n'empêche un bug applicatif. |

---

### 2.5 Fiabilité et robustesse

| ID | Criticité | Localisation | Description |
|----|-----------|--------------|-------------|
| R1 | **P1** | `tasks/locks.py:14-34` | Token de lock = nom du lock. Deux workers peuvent entrer en collision sur la phase de release. Pattern correct : `secrets.token_hex(16)` stocké comme valeur du `SET NX EX`, et `release` doit faire un `GET == token ? DEL : noop` via Lua (atomicité). |
| R2 | **P1** | `services/email_confirmation_service.py:215-241` | `dispatch_confirmation_email` : si Celery est down, le fallback synchrone appelle `send_confirmation_email_task(**payload)` qui est la **tâche Celery** (pas une fonction). L'appel synchrone revient à exécuter la fonction décorée, ce qui n'est pas garanti (la signature `@celery_app.task` la transforme en `EagerResult` mais pas en worker réel). Le « fallback » peut masquer des envois ratés. À mocker explicitement en mode `apply()` ou exécuter le service directement. |
| R3 | **P1** | `api/v1/admin/offers.py:175-196` (`bulk-status`) | `db.execute(update(JobOffer).where(...).values(status=...))` puis `db.commit()` — pas de gestion d'erreur, pas de validation que tous les `offer_ids` existent. Un user obtient `count=0` et ne sait pas si c'est intentionnel. |
| R4 | **P1** | `services/offers.py:110-112` | `create_offer` fait son propre `db.commit()` au milieu du flux. La route (`api/v1/admin/offers.py:90-95`) appelle `create_offer_service` puis **re‑commit** (l.95). En cas d'erreur après le premier commit, l'offre existe déjà en base et le handler lève 500. État partiel possible. |
| R5 | **P1** | `services/duplicates.py:70-95` (`mark_duplicate`) | Aucune vérification que `a != b` ; un admin peut créer un cycle `a.duplicate_of = b; b.duplicate_of = a`. Aucune protection `IntegrityError` autour de l'`UniqueConstraint("source_id", "source_reference")` ou de l'auto‑référence. |
| R6 | **P2** | `services/companies.py:27-40` | `merge_companies` ne capture pas l'`IntegrityError` sur le `UNIQUE(normalized_name)`/`UNIQUE(slug)` quand la cible existe déjà. Pas d'audit (`log_admin_action` jamais appelé). |
| R7 | **P2** | `services/ai_results.py:77-174` | Pas de transaction explicite (`begin_nested`). Si une erreur survient sur l'offre 50/100, le `db.commit()` en aval (route `internal_ai.py:20`) commit les 49 premières modifications. |
| R8 | **P2** | `services/ingestion.py:191-396` | Le bloc `try/except IntegrityError: db.rollback(); raise` (l.311-313) rollback **toute** la transaction du batch, pas seulement l'offre fautive. Comportement inverse du `try/except Exception` (l.314-325) qui marque `FAILED` et continue. Conséquence : un seul doublon en fin de batch annule tout. |
| R9 | **P2** | `api/v1/admin/ai_suggestions.py:39-88` | Pas de transaction explicite, pas de log d'audit (cf. A4). |
| R10 | **P2** | `services/email/resend_provider.py:111-126` | 401/403/422 ne sont **pas** retryable, OK. Mais le code ne marque pas explicitement le cas « 401 sur la première clé du fallback ». Le fallback ne s'enclenche que si `fallback_immediately=True` est positionné. À relire. |
| R11 | **P2** | `tasks/digests.py` | (lecture partielle) — utilise `redis_lock` (donc exposé à R1). Le pattern `chord` (préparation → fan‑out → envoi) est sain. |
| R12 | **P2** | `api/v1/admin/companies.py:117-125` (`POST /merge`) | `target_id == source_id` accepté : la fusion d'une entreprise avec elle‑même ré‑attribue ses propres offres (no‑op) et la soft‑delete. Pas d'erreur, comportement trompeur. |
| R13 | **P2** | `api/v1/admin/ai.py:86-111` (`PATCH /keys/{id}`) | L'update accepte `priority` et `is_active` sans contraintes ; un admin peut positionner `priority=0, is_active=false, max_concurrent=0` sur la **dernière** clé active, désactivant le module IA. Pas de garde‑fou « au moins une clé active ». |
| R14 | **P2** | `services/admin_aggregates.py:30-58` | `top_viewed_offers` ne filtre **pas** sur la fenêtre temporelle `days`. Le paramètre est documenté comme « info, pas encore filtree sur last_seen_at » — c'est un mensonge. Soit l'API l'expose en l'état (et le contrat est trompeur), soit il faut implémenter le filtre. |

#### Hypothèses à vérifier

- **Hypothèse R1a** : le `tenant_id`/`workspace_id` n'existe pas dans le schéma (mono‑tenant par conception). Confirmé : aucun `tenant` ou `workspace` dans les modèles. Pas un trou, mais à documenter.
- **Hypothèse R2a** : `dispatch_confirmation_email` (l.215-241) appelle la tâche décorée par `@celery_app.task` en synchrone, ce qui **n'exécute pas** la logique métier (le décorateur Celery transforme la fonction en `Proxy`). À tester manuellement.
- **Hypothèse R3a** : `BulkStatusUpdate` n'a pas de limite sur `offer_ids` (un user peut envoyer 1M d'IDs) — le `update ... in_(...)` construira une clause WHERE gigantesque. Pas de plafond applicatif.

---

### 2.6 Qualité du code

| ID | Criticité | Localisation | Description |
|----|-----------|--------------|-------------|
| Q1 | **P1** | `api/v1/admin/companies.py`, `admin/ai_suggestions.py`, `admin/system_health.py`, `services/duplicates.py`, `services/filiere_simulator.py`, `services/companies.py` | Utilisation d'`__import__("models")` ou `__import__("datetime")` dans le corps des fonctions (9 occurrences au moins). Anti‑pattern qui rend les imports invisibles aux linters et complique la lecture. |
| Q2 | **P1** | `api/v1/admin/ai_suggestions.py:44,84` | Signature de fonction `admin: __import__("models").admin.Administrator = Depends(get_current_admin)` — illisible. |
| Q3 | **P2** | Tous les modules | Pas de `pyproject.toml` Black/Ruff/isort configuré (`pyproject.toml` ne contient que `[tool.pytest]`). Style inconsistant (mix français/anglais dans les logs, indentation parfois 4 parfois 2). |
| Q4 | **P2** | `services/ai_providers.py:262-270` | Les providers `ANTHROPIC` et `GOOGLE_GEMINI` sont listés dans `AIProviderType` mais aucun adaptateur n'est branché — `AIProviderFactory.build` lèvera `AIConfigurationError` à l'usage. À documenter ou à supprimer de l'enum. |
| Q5 | **P2** | `services/duplicates.py:50-67` | Algorithme de détection de doublons `O(N²)` en Python, après un `O(N)` de chargement SQL. Commentaire « simplifie » assumé mais inacceptable en prod. |
| Q6 | **P3** | `api/v1/admin/aggregates.py:11-16` | Le router est préfixé `/api/admin` (sans sous‑préfixe), avec deux endpoints sous `/api/admin/dashboard/top-viewed-offers` et `/api/admin/search`. Cohérent mais à isoler pour éviter les collisions futures. |

#### Typage

- Bon en général (`Mapped`, `MappedColumn` partout). Quelques `Any` dans `services/ai_providers.py:80-86` (`raw_response: dict | None`) — acceptable.
- `admin/system_health.py:22` : `admin: __import__("models").admin.Administrator` — non typé proprement.
- `api/v1/admin/ai.py:37` : `***` n'a pas de type.

#### Logging

- Utilisation cohérente de `logger = logging.getLogger(__name__)`.
- `services/contact.py`, `services/no_offer_email_service.py` : logs INFO sans `extra` structuré → intégration JSON/ELK manquante.
- Pas de `print` résiduel (vérifié). 

#### Tests

- 11 fichiers de test dans `tests/`, ciblent : confirmation email, ingest, digest pipeline, digest cascade, resend webhook, admin aggregates, admin AI endpoints, admin exports, admin transactional emails.
- Couverture des chemins critiques : auth, ingestion, email confirmation, webhook, digest OK.
- Manque : tests pour `admin/companies.py` (CRUD + merge), `admin/ai_suggestions.py`, `admin/import` (import d'offres), `admin/sending_preview.py`, services `duplicates.py`, `scoring_service.py`, `city_matching_service.py` (uniquement testé indirectement).
- Pas de mesure de couverture (`pytest-cov` absent de `requirements.txt`).
- Fixtures : `conftest.py` + `conftest_admin.py` sont bien découpés (admin_db marker).
- Les tests `admin_client` mockent `get_current_admin` mais **`require_roles` reste actif** (l.57-58 de conftest_admin.py) — bon point pour la sécurité des tests.

---

### 2.7 Observabilité et ops

| ID | Criticité | Localisation | Description |
|----|-----------|--------------|-------------|
| O1 | **P1** | `main.py:34-39` | Pas de hook d'instrumentation Prometheus/OpenTelemetry. Aucune exposition de `/metrics`. |
| O2 | **P1** | `api/system.py:14-28` | `GET /health` répond `{status, database, environment}`. Ne vérifie **pas** Redis, ni Celery, ni le worker. `api/v1/admin/system_health.py:21-82` le fait mais n'est accessible qu'aux admins. Pour un healthcheck de LB/uptime‑robot, c'est insuffisant (route admin). |
| O3 | **P2** | `core/config.py:108` | `database_echo` n'est jamais consommé par les logs structurés (pas de `JSONFormatter` configuré). |
| O4 | **P2** | `api/v1/admin/system_health.py:35-44` | L'inspection Celery `celery_app.control.inspect(timeout=2.0)` peut bloquer 2 s par appel. Pas de timeout global. |
| O5 | **P3** | `celery_app.py:106-114` | `task_acks_late` et `task_reject_on_worker_lost` non configurés globalement. Pour des tâches critiques (envoi d'email, ingestion), `acks_late=True` devrait être activé sur la tâche ou globalement. `tasks/emails.py:38-39` le configure explicitement ✅, `tasks/ai_processing.py` non vérifié ici. |

---

### 2.8 Celery

| ID | Criticité | Localisation | Description |
|----|-----------|--------------|-------------|
| C1 | **P1** | `celery_app.py:41-47` | `beat_schedule` ne contient que `ai-process-raw-offers-sweep` (toutes les 5 min) en plus des scrapers. Pas de schedule pour `send_no_offer_emails` (orchestration manuelle) — en pratique `beat_schedule["digest-send-no-offer"]` est défini (l.100-104). OK. |
| C2 | **P2** | `celery_app.py:55-56` | `crontab(hour=6, minute=00)` sans `timezone=` car la version de Celery ne supporte pas. Le code est cadré par `celery_app.conf.timezone=settings.timezone` (l.110) — OK. Mais les heures sont **lues comme heure locale du beat**, pas du fuseau cible `Africa/Abidjan`. Si le worker tourne en UTC et l'utilisateur attend 06:00 Abidjan = 04:00 UTC, le scrape tourne à 06:00 UTC au lieu de 04:00 UTC. Le README dit `daily_collection_hour=6` — ambiguïté. |
| C3 | **P2** | `celery_app.py:79-95` | `digest-prepare` et `digest-send` configurés en heure **locale du beat**, pas d'Abidjan. À aligner explicitement (cfr. C2). |
| C4 | **P2** | `tasks/scrapers.py:109` | `run_source_scraper` a `autoretry_for=(httpx.TransportError,)` et `max_retries=3` — OK. Mais la fonction fait `subprocess.run(...)` qui n'est pas un `httpx.TransportError` : un timeout du sous‑processus ne retry pas. |

---

## 3. Backlog priorisé

> Trié par criticité décroissante, puis par complexité croissante au sein d'une même criticité.

### P0 — Critique (à corriger avant mise en prod)

| # | Titre | Domaine | Fichiers | Correction | Complexité |
|---|-------|---------|----------|------------|------------|
| 1 | Ajouter `require_roles("super_admin")` sur `/api/admin/companies` | Sécurité | `server/api/v1/admin/companies.py:14-30, 80-125` | `dependencies=[Depends(require_roles("super_admin"))]` au niveau du router, `log_admin_action` dans `merge_companies`. Import explicite de `Administrator`. | Petit |
| 2 | Borner et valider `/api/admin/offers/import` | Sécurité | `server/api/v1/admin/offers.py:252-296` | Limiter `Content-Length` via middleware ; valider extension/MIME (`text/csv`, `application/json`) ; refuser >5 Mo ; transaction explicite par chunk de 50. | Moyen |
| 3 | Dédoublonner `JobOfferStatus` (BRUT/BRUTE/LEGACY_BRUTE) | DB / Sécurité | `server/models/enums.py:21-35`, `migrations/versions/0003_*.py:48-61` | Supprimer `LEGACY_BRUTE` (et `BRUTE` si redondant) ; migration 0010 de renommage `brute→brut` ; CHECK contraint en prod. | Petit |
| 4 | Échapper les wildcards dans tous les `ilike(f"%{q}%")` | Sécurité | `server/api/v1/admin/offers.py:60`, `admin/subscribers.py:58`, `admin/companies.py:39`, `admin/content.py:125`, `public/articles.py:87`, `services/admin_exports.py:103,153,155` | Réutiliser `_normalize_search_query` (`services/admin_aggregates.py:18-27`) partout. Penser à `ESCAPE '\\'` dans la clause. | Petit |
| 5 | Remplacer le `redis_lock` non‑fou | Fiabilité | `server/tasks/locks.py:14-34` | `SET NX EX` avec `secrets.token_hex(16)`, release via Lua atomique `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1])`. | Petit |
| 6 | `CompanyCreate` provoque `NameError` (Administrator non importé) | Qualité | `server/api/v1/admin/companies.py:1-30, 80-114` | Import en tête de fichier, suppression des `__import__("models")`. | Petit |
| 7 | `decode_token` : aligner `is_production` sur staging | Sécurité | `server/core/config.py:208-209` | `is_production` → `environment not in {"development", "test", "staging"}` ou durcir l'exigence. | Petit |
| 8 | Rate‑limit sur `POST /api/subscriptions` et `POST /api/contact` | Sécurité | `server/api/v1/public/subscriptions.py:58-86`, `public/contact.py:1-26` | Réutiliser `services/email/rate_limit.py` (cooldown par IP + par email) ou ajouter `slowapi`. | Moyen |

### P1 — Important (à planifier dans les 2 sprints)

| # | Titre | Domaine | Fichiers | Correction | Complexité |
|---|-------|---------|----------|------------|------------|
| 9 | `get_current_admin` → `_get_subscriber_by_token` n'utilise pas `validate_token` | Sécurité | `server/api/v1/public/subscriptions.py:33-48` | Appeler `validate_token(db, token, purpose=TokenPurpose.MANAGE_ALERT)` et propager les `HTTPException` adéquates. | Petit |
| 10 | Émettre rotation de refresh tokens (revocation de l'ancien) | Sécurité | `server/api/v1/admin/auth.py:43-66` | Marquer l'ancien refresh comme `revoked_at`, ajouter `jti` au payload, persister une `TokenRevocation` table. | Moyen |
| 11 | `view_count` / `save_count` non protégés | Sécurité | `server/api/v1/public/offers.py:185-202` | Soit auth + rate‑limit, soit déléguer à un endpoint interne. À minima, ne pas incrémenter sur IP unique > N/min. | Petit |
| 12 | N+1 sur `/api/filieres` | Performance | `server/api/v1/public/filieres.py:36-58` | Une requête agrégée : `SELECT filiere_id, count(*) FROM job_offers WHERE visible_site AND status='active' GROUP BY filiere_id`. | Petit |
| 13 | `find_potential_duplicates` charge tout en RAM | Performance | `server/services/duplicates.py:34` | SQL fenêtré / pg_trgm / `word_similarity`. À court terme, plafond `LIMIT 1000` + message d'erreur. | Gros |
| 14 | `logs/events` sur‑fetch 3x + filtre Python | Performance | `server/api/v1/admin/logs.py:84-114` | Filtre SQL : `WHERE action = (SELECT enum_value ...)` ou utiliser une colonne `level` calculée. | Petit |
| 15 | `top_recruiters` : 2 requêtes redondantes, code mort | Performance / Qualité | `server/api/v1/admin/companies.py:43-72` | Supprimer la 1ère requête, garder le `GROUP BY companies.id` + `count` + `ORDER BY`. | Petit |
| 16 | Boucle d'ingestion séquentielle | Performance | `server/services/ingestion.py:208-325` | Chunker par 50 + commit par chunk, ou utiliser `bulk_insert_mappings`. | Moyen |
| 17 | Fenêtre de tolérance Svix timestamp | Sécurité | `server/api/v1/public/webhooks_resend.py:62-114` | `if abs(now - svix_timestamp) > 300: raise 401`. | Petit |
| 18 | `merge_companies` n'audite pas | Sécurité | `server/services/companies.py:27-40` | `log_admin_action(db, admin_id=admin_id, action=AdminAction.UPDATE, target_table="companies", target_id=source_id, details={"merged_into": target_id, "offers_reassigned": len(offers)})`. | Petit |
| 19 | Cycle de doublons possible | Fiabilité | `server/services/duplicates.py:70-95` | Refuser `a == b`, vérifier que `b.duplicate_of_id` n'est pas `a.id` (pas de cycle), catcher `IntegrityError`. | Petit |
| 20 | `dispatch_confirmation_email` fallback synchrone suspect | Fiabilité | `server/services/email_confirmation_service.py:215-241` | Tester manuellement ; si confirmé, remplacer par exécution directe de `send_confirmation_email_now`. | Petit |
| 21 | `MANAGE_ALERT` token inutilisable depuis `create_subscriber` | Fiabilité | `server/services/subscriptions.py:184-192` | Retourner la valeur brute via un dataclass `CreatedToken` (analogue à `PendingConfirmationEmail`). | Moyen |
| 22 | `init_db` fait `drop_all` + `create_all` | DB | `server/db/session.py:68-74` | Refuser en prod : `if settings.is_production: raise RuntimeError(...)`. | Petit |
| 23 | Migration 0001 `downgrade` drop toutes les tables | DB | `server/migrations/versions/0001_initial_schema.py:18-20` | `if not settings.is_production: raise RuntimeError(...)` au début de `downgrade`. | Petit |
| 24 | `log_admin_action` manquant dans `ai_suggestions` | Qualité | `server/api/v1/admin/ai_suggestions.py:39-88` | Tracer création/approbation/rejet avec `log_admin_action`. | Petit |
| 25 | Schémas redéclarés localement (Contact, Company) | Qualité | `server/api/v1/public/contact.py:16-20`, `admin/companies.py:21-28` | Déplacer dans `schemas/contact.py`, `schemas/companies.py`. | Petit |
| 26 | Remplacer les `__import__("models")` par de vrais imports | Qualité | 9+ occurrences | Refactor systématique (cf. Q1/Q2). | Petit |
| 27 | `CORS` : durcir méthodes/headers en prod | Sécurité | `server/main.py:41-47` | Aligner sur `settings.cors_methods`/`cors_headers`. | Petit |
| 28 | Endpoint `system_health` ouvert à tous les admins | Sécurité | `server/api/v1/admin/system_health.py:18-19` | `dependencies=[Depends(require_roles("super_admin"))]`. | Petit |
| 29 | `/api/admin/ai/keys` peut désactiver la dernière clé | Fiabilité | `server/api/v1/admin/ai.py:86-111` | Vérifier qu'au moins une `AIApiKey` reste `is_active=True` avant commit. | Petit |
| 30 | `BulkStatusUpdate` sans plafond | Fiabilité | `server/api/v1/admin/offers.py:175-196` | `payload.offer_ids: list[str] = Field(max_length=500)`. | Petit |
| 31 | `ai.py:37` `***` placeholder | Qualité | `server/api/v1/admin/ai.py:37` | Renommer `***` → `item`. | Petit |
| 32 | Pas de `/metrics` Prometheus | Ops | `main.py`, nouveau `api/metrics.py` | Ajouter `prometheus-fastapi-instrumentator` ou middleware custom. | Petit |
| 33 | Healthcheck public ne vérifie que la DB | Ops | `server/api/system.py:14-28` | Ajouter ping Redis (`ping()`) et un ping Celery (`control.ping()` court). | Petit |
| 34 | Celery `crontab` n'est pas en TZ cible | Ops | `server/celery_app.py:55-95` | Calculer les heures en `Africa/Abidjan` puis convertir en UTC avant d'injecter dans `crontab(hour=, minute=)`. | Petit |

### P2 — Amélioration (dette à planifier)

| # | Titre | Domaine | Fichiers | Correction | Complexité |
|---|-------|---------|----------|------------|------------|
| 35 | Échappement des wildcards dans `contains` (offers public) | Sécurité | `server/api/v1/public/offers.py:91` | Réutiliser `_normalize_search_query` ou utiliser `op.contains` avec un sanitizer. | Petit |
| 36 | Validation Pydantic des filtres `status`/`status_value` | Qualité | multiples routes | `status: Optional[DigestStatus] = Query(None)` (déjà fait partiellement). | Petit |
| 37 | Refactor `__import__("datetime")` | Qualité | `services/companies.py:23,38`, `services/duplicates.py:122` | Import en tête. | Petit |
| 38 | Test unitaire pour `duplicates.py` et `scoring_service.py` | Tests | `tests/test_duplicates.py`, `tests/test_scoring.py` | Couvrir `find_potential_duplicates`, `mark_duplicate`, `compute_offer_score`. | Moyen |
| 39 | Test pour `/api/admin/companies` CRUD + merge | Tests | `tests/test_admin_companies.py` | Couvrir create / update / delete / merge + auth. | Petit |
| 40 | Test pour `/api/admin/ai/suggestions` | Tests | `tests/test_admin_ai_suggestions.py` | Couvrir approbation, rejet, idempotence. | Petit |
| 41 | Test pour `/api/admin/offers/import` | Tests | `tests/test_admin_offers_import.py` | Couvrir CSV, JSON, MIME invalide, taille > plafond. | Petit |
| 42 | Mesure de couverture (pytest-cov) | Tests | `pyproject.toml`, `requirements.txt` | Ajouter `pytest-cov`, seuil ≥ 70%. | Petit |
| 43 | Lint/format (Ruff + Black) | Qualité | `pyproject.toml` | Configuration stricte. | Petit |
| 44 | `pydantic-settings` non utilisé (`core/config.py` est un dataclass) | Qualité | `core/config.py` | Migrer vers `BaseSettings` pour bénéficier de la validation. | Moyen |
| 45 | Providers `ANTHROPIC`/`GOOGLE_GEMINI` listés mais non implémentés | Qualité | `models/enums.py:79-81`, `services/ai_providers.py:262-270` | Documenter ou implémenter. | Moyen |
| 46 | `pydantic-settings` 2.15 dans `requirements.txt` mais inutilisé | Hygiène | `requirements.txt:21` | Supprimer ou aligner. | Petit |
| 47 | Logs JSON structurés | Ops | nouveau `core/logging.py` | Configurer `JSONFormatter` si `APP_ENV=production`. | Petit |
| 48 | `transactional_emails.py` : pas de pagination `created_at` indexé | Performance | `models/emails.py:128` (implicite) | Ajouter `Index("ix_transactional_email_events_created_at", "created_at")` en migration 0010. | Petit |
| 49 | `ai_results.py` : pas de transaction explicite | Fiabilité | `services/ai_results.py:77-174` | Englober dans `with db.begin():` ou `begin_nested()`. | Petit |
| 50 | `BulkStatusUpdate` n'audite pas le `count==0` | Qualité | `server/api/v1/admin/offers.py:175-196` | Si `count==0`, logguer un warning. | Petit |
| 51 | `system_health` : ne capture pas l'`overall_status` quand Celery est down | Ops | `server/api/v1/admin/system_health.py:75-82` | `overall_status` doit être `"degraded"` si `health_celery.status != "ok"`. | Petit |
| 52 | `BulkStatusUpdate` : `status` non validé comme `JobOfferStatus` | Qualité | `server/api/v1/admin/offers.py:175-196` | `payload.status: JobOfferStatus` (Pydantic) au lieu de `str`. | Petit |

---

## 4. Annexes

### 4.1 Fichiers analysés (88 fichiers .py, 9 migrations, 1 alembic.ini, 1 .env.example, 1 requirements.txt, 1 pyproject.toml, 2 docs markdown, 1 README)

- `main.py`, `celery_app.py`, `alembic.ini`, `requirements.txt`, `pyproject.toml`, `README.md`, `.env.example`
- `core/` : `config.py`, `security.py`
- `db/` : `base.py`, `session.py`
- `models/` : `admin.py`, `ai.py`, `content.py`, `editorial.py`, `emails.py`, `enums.py`, `jobs.py`, `referentials.py`, `rejected_duplicates.py`, `scraping.py`, `subscriptions.py`, `types.py`, `__init__.py`
- `schemas/` : `admin.py`, `aggregates.py`, `ai.py`, `base.py`, `content.py`, `editorial.py`, `emails.py`, `ingestion.py`, `logs.py`, `offer_stats.py`, `offers.py`, `referentials.py`, `scraping.py`, `sending.py`, `settings.py`, `subscriptions.py`, `__init__.py`
- `services/` : 28 fichiers (`admin_aggregates.py`, `admin_exports.py`, `ai_batches.py`, `ai_crypto.py`, `ai_errors.py`, `ai_key_manager.py`, `ai_processor.py`, `ai_prompts.py`, `ai_providers.py`, `ai_results.py`, `audit.py`, `city_matching_service.py`, `companies.py`, `contact.py`, `digest_builder_service.py`, `digest_cascade_selector.py`, `digest_preview_service.py`, `digest_sender_service.py`, `digest_template.py`, `duplicates.py`, `email_confirmation_service.py`, `email/{email_provider,rate_limit,resend_provider,templates}.py`, `filiere_simulator.py`, `ingestion.py`, `no_offer_email_service.py`, `normalization.py`, `offers.py`, `scoring_service.py`, `subscriptions.py`, `tier_stats_service.py`, `token_service.py`)
- `tasks/` : `ai_processing.py`, `digests.py`, `emails.py`, `locks.py`, `scrapers.py`, `__init__.py`
- `api/` : `deps.py`, `system.py`, `v1/router.py`, `v1/ingestion.py`, `v1/internal_ai.py`, `v1/admin/*` (19 fichiers), `v1/public/*` (10 fichiers + `_time_utils.py`)
- `migrations/versions/` : 9 migrations (`0001` à `0009`) + `env.py`
- `scripts/` : `init_db.py`, `seed.py`, `seed_ai_api_keys.py`, `seed_email_settings.py`, `seed_scraper_sources.py`, `send_scraped_offers_example.py`
- `tests/` : 11 fichiers de test + 2 conftest

### 4.2 Points positifs transverses (à conserver)

1. **Transactions explicites** dans la majorité des services : `db.flush()` puis `db.commit()` est la norme.
2. **Idempotence des tokens** : `validate_token` (`services/token_service.py:183-208`) distingue clairement les cas not‑found / revoked / expired / used.
3. **Messages anti‑énumération** sur `resend-confirmation` (`services/email_confirmation_service.py:62-64`).
4. **Streaming exports** (`services/admin_exports.py:14-58`, `api/v1/admin/exports.py:69-73`) : `yield_per` SQLAlchemy + `StreamingResponse` — pattern scalable.
5. **Schémas Pydantic séparés Create/Update/Read** sur la majorité des ressources.
6. **Migrations idempotentes** : `if "col" not in columns` avant chaque `add_column`.
7. **Détermination Celery `task_acks_late=True` explicite** sur `tasks/emails.py:38-39` (tâche critique).
8. **Mixins de base** (`UUIDPrimaryKeyMixin`, `TimestampMixin`, `SoftDeleteMixin`) pour DRY.
9. **Logging cohérent** via `logging.getLogger(__name__)` dans tous les modules.
10. **Le service `CityMatchingService`** (`services/city_matching_service.py:1-134`) est bien découpé et journalise les cas ambigus sans planter.

### 4.3 Hypothèses ouvertes (à confirmer par les mainteneurs)

- **H1** : le `dispatch_confirmation_email` synchrone (services/email_confirmation_service.py:215-241) appelle `send_confirmation_email_task(**payload)` qui n'est pas une fonction « worker » au sens Celery. À tester pour confirmer que le fallback synchrone fonctionne réellement.
- **H2** : `transactional_emails.py` n'a pas d'index sur `created_at` ; à vérifier si la table reçoit beaucoup d'écritures.
- **H3** : `crontab(hour=6, minute=00)` dans `celery_app.py:55-95` est interprété en heure locale du beat, pas en `Africa/Abidjan`. À aligner sur le fuseau cible.
- **H4** : les providers `ANTHROPIC` et `GOOGLE_GEMINI` (models/enums.py:79-81) sont dans l'enum mais aucun adaptateur (`services/ai_providers.py:262-270`). À documenter.
- **H5** : `MANAGE_ALERT` token retourné par `create_subscriber` (`services/subscriptions.py:184-192`) n'est pas utilisé par l'endpoint `GET /api/subscriptions/preferences/{token}` (`public/subscriptions.py:171-175`). À confirmer si c'est intentionnel (les tokens sont régénérés par `no_offer_email_service.py:298-300`).
- **H6** : `offers/{id}/save` (api/v1/public/offers.py:195-202) incrémente `save_count` sans rien écrire dans `SavedOffer` — possible comportement de métriques uniquement, mais à clarifier.

### 4.4 Synthèse des fichiers les plus à risque

| Fichier | Risques cumulés |
|---------|-----------------|
| `server/api/v1/admin/offers.py` | A5, S15, S21, S29, R3, R4, P7 (mélange route + service + import ; `/import` non borné ; `ilike` non échappé ; `bulk-status` non validé) |
| `server/api/v1/admin/companies.py` | A1, A2, A3, P4, R6, R12, S17 (aucun `require_roles` ; `NameError` ; double requête ; fusion non auditée) |
| `server/services/duplicates.py` | P2, R5, A10 (`O(N²)` Python ; cycle possible ; import FastAPI dans service) |
| `server/models/enums.py` | S34, DB3 (`BRUT`/`BRUTE`/`LEGACY_BRUTE` en doublon) |
| `server/tasks/locks.py` | R1 (verrou non‑fou) |
| `server/api/v1/admin/ai_suggestions.py` | A4, Q1, Q2, R9 (`__import__("models")` ; pas de transaction ; pas d'audit) |
| `server/api/v1/admin/system_health.py` | A7, Q1, S2, O4 (`__import__("models")` ; pas de `require_roles` ; inspection Celery sans timeout dur) |
| `server/services/email_confirmation_service.py` | R2 (fallback synchrone suspect) |
| `server/services/subscriptions.py` | S8 (`MANAGE_ALERT` token inutilisable) |
| `server/celery_app.py` | C2, C3 (TZCible) |

---

**Fin du rapport.**
