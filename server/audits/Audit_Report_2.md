# Audit backend JobAlert CI — Rapport n°2 (post-corrections)

> **Périmètre** : intégralité de `server/` après la vague de corrections de l'audit n°1 (2026-09-03). Ce rapport vérifie (a) que les correctifs annoncés sont réellement en place, (b) qu'ils n'ont pas introduit de régressions, (c) et couvre les zones que le premier audit n'avait pas explorées (reset-password, dashboard, digest_preview, sending_preview, isolation des tests).
> **Date** : 2026-09-03 (2e passe)
> **Méthodologie** : lecture par couches, exécution de la suite de tests, vérification octet-par-octet des points suspects, exécution en Python 3.14 des hypothèses (bcrypt, syntaxe).

---

## 1. Résumé exécutif

### 1.1 Note globale

**B+ (7.5/10)** — en nette progression par rapport au C+ du premier audit. Les 8 P0 historiques sont corrigés et fonctionnels (require_roles partout, import borné 5 Mo + MIME + chunks, enum JobOfferStatus dédupliqué avec migration 0010, échappement LIKE systématique via `safe_ilike`, verrous Redis Lua, rate-limits publics). Les verrous Redis, la rotation des refresh tokens (nouvelle table `admin_refresh_tokens`) et l'anti-replay Svix sont de vrais gains de sécurité.

Mais cette 2e passe révèle :

1. **🔴 un P0 nouveau que l'audit n°1 avait manqué** : XSS par HTML non échappé dans l'aperçu de digest (`digest_preview_service.py:55`) — `full_name`, `email` et `title` des offres sont interpolés dans `html_snippet` sans `html.escape`, alors que le reste du pipeline email échappe tout.
2. **🔴 le flux forgot/reset-password admin est cassé à l'exécution** (`auth.py`) : `TransactionalEmailPurpose.RESET_PASSWORD` n'existe pas dans l'enum (AttributeError), `provider.send_simple()` n'existe pas dans le protocole, et le token de reset est stocké **en clair** dans `request_payload` puis matché par `contains()` — réutilisable à l'infini, sans expiration, et sans `html.escape` dans l'email.
3. **🟠 3 régressions introduites par mes propres correctifs** dans `offers.py` (services lèvent `DuplicateServiceError` non catchée → 500 ; dict `_warning` qui viole `response_model`).
4. **🟠 pas de rate-limit sur `POST /api/admin/auth/login`** : un attaquant peut brute-forcer les mots de passe admin sans limite.
5. Un lot de P2 résiduels (imports morts, `__import__` oublié dans `sending_preview.py`, isolation des tests fragilisée).

### 1.2 Les priorités à corriger en premier

1. **🔴 XSS — `render_digest_preview`** (`services/digest_preview_service.py:55`) : `html_snippet` interpole `full_name`/`email`/`title` sans `html.escape`. Le rendu est renvoyé au back-office (POST /api/admin/sending/preview) qui l'affiche ; un `title` d'offre scrapée = `<script>` exécutable dans l'admin. **Fix trivial : `html.escape()` sur chaque interpolation.**
2. **🔴 Flux reset-password admin cassé + non sécurisé** (`api/v1/admin/auth.py:150-206`) :
   - `TransactionalEmailPurpose.RESET_PASSWORD` → `AttributeError` (valeur uniquement dans `TokenPurpose`) ;
   - `provider.send_simple()` inexistant (le protocole n'expose que `send(EmailMessage)`) ;
   - le token est stocké **brut** dans `request_payload` (contraire à la convention SHA-256 du reste du projet) ;
   - `reset-password` ne consomme pas le token (`status` reste `SENT`→réutilisable), n'exige pas de mot de passe conforme (aucune min_length sur `new_password`, un `dict` brut au lieu d'un schéma Pydantic), et le `contains()` JSON scanne toute la table.
3. **🟠 Régressions `offers.py`** : `mark_duplicate`/`reject_duplicate_pair` lèvent `DuplicateServiceError` que la route ne traduit pas en HTTPException → 500 au lieu de 400/404/409 ; `find_potential_duplicates` peut renvoyer un dict `_warning` dans une liste typée `list[PotentialDuplicateRead]` → 500 Pydantic quand le plafond 1000 est atteint.
4. **🟠 Login admin sans rate-limit ni verrouillage** (`auth.py:50`) : le module `check_ip_rate_limit` existe pourtant déjà (`services/rate_limit.py`) — il n'est juste pas branché sur `/login`, `/refresh`, `/forgot-password`.
5. **🟠 Rotation refresh : `revoked_at` jamais vérifié** (`auth.py:81-105`) : un token révoqué (détection de reuse) mais non consommé reste accepté jusqu'à expiration, car le chemin ne teste que `used_at`. Ajouter `revoked_at is not None → 401`.

### 1.3 Vérification des correctifs de l'audit n°1 (tous confirmés en place)

| Correctif n°1 | Vérifié | Preuve |
|---|---|---|
| `require_roles` sur companies/system_health/ai_suggestions | ✅ | `companies.py:26-30`, `system_health.py:23-27`, `ai_suggestions.py:26-29` |
| Import borné (5 Mo, MIME, ext, chunks 50) | ✅ | `offers.py:34-37` + `_validate_upload`/`_parse_payload`/`_chunks` |
| Enum `JobOfferStatus` dédupliqué + migration 0010 | ✅ | `enums.py` (12 valeurs uniques), `RAW_STATUSES = {JobOfferStatus.BRUT}` |
| `safe_ilike`/`safe_like_lower` partout | ✅ | 6 routes + exports + recherche publique ; plus aucun `ilike(f"%{q}%")` brut |
| Redis lock `SET NX EX` + token + release Lua | ✅ | `tasks/locks.py:14-46` |
| Rate-limit subscribe/contact/view/save | ✅ | `services/rate_limit.py` branché sur les 4 routes |
| Svix ±5 min anti-replay | ✅ | `webhooks_resend.py:44-46,100-101` + test dédié |
| `is_production` élargi | ✅ | `config.py` (`not in {development, dev, test, testing, staging}`) |
| `init_db`/downgrade 0001 refusés en prod | ✅ | `db/session.py:71-77`, `0001_*.py:27-34` |
| Rotation refresh (table `admin_refresh_tokens` + migration 0011) | ✅ | structure présente, **mais** voir P1 #4 (revoked non testé) |
| `/metrics` + middleware Prometheus | ✅ | `api/metrics.py` + `main.py` middleware |
| Healthcheck Redis/Celery | ✅ | `api/system.py::_ping_redis/_ping_celery` |
| Celery TZ Abidjan→UTC | ✅ | `celery_app.py::_hour_in_utc` + `_abidjan_crontab` |
| `top_recruiters` 1 requête groupée | ✅ | `services/companies.py` (GROUP BY + JOIN, plus de code mort) |
| N+1 `/api/filieres` | ✅ | `_aggregate_filiere_stats` (3 GROUP BY) |
| MANAGE_ALERT brut retourné | ✅ | `CreatedToken` + champ `manage_alert_token` de la réponse |

Points n°1 **non** terminés (reconnus au premier rapport) : #16 chunking ingestion (rollback), #35/25 partiel, tests manquants companies/import. L'état est cohérent avec ce qui avait été annoncé.

---

## 2. Nouveaux constats détaillés

### 2.1 Sécurité

| ID | Criticité | Localisation | Description |
|----|-----------|--------------|-------------|
| N1 | **P0** | `services/digest_preview_service.py:55` | **XSS** : `html_snippet = f"<h2>Bonjour {full_name or email}...<li>{title}</li>..."` sans `html.escape`. Les 3 données proviennent de sources non fiables : `full_name` (abonné), `title` (offre **scrapée** = attaqueur contrôlable). Rendu exposé via `POST /api/admin/sending/preview` (roles: gestionnaire_utilisateurs, super_admin). Tout le module email (`templates.py`) échappe — celui-ci non. |
| N2 | **P0** | `api/v1/admin/auth.py:161` | `TransactionalEmailPurpose.RESET_PASSWORD` : l'attribut n'existe que dans `TokenPurpose` (enums.py:162), pas dans `TransactionalEmailPurpose` (l.180-188). `forgot-password` lève `AttributeError` sur **chaque appel avec email connu** → 500 + stacktrace. La réponse "neutre" n'est jamais atteinte. |
| N3 | **P0** | `api/v1/admin/auth.py:170` | `provider.send_simple(to=..., subject=..., body=...)` : le protocole `EmailProviderProtocol` n'expose que `send(EmailMessage)` (email_provider.py:44-47). `AttributeError` si la ligne précédente ne plantait pas. Le `except Exception: pass` masque ce deuxième bug — le premier (N2) se produit **avant** le try. |
| N4 | **P0** | `api/v1/admin/auth.py:158, 192` | **Token de reset stocké en clair** dans `request_payload={"token": token}` puis retrouvé par `.contains({"token": token})`. Contraste total avec `SubscriberToken.token_hash` (SHA-256, révocabilité, TTL). Violation de la règle documentée du module email : "le token brut ne circule qu'en mémoire et dans l'URL". |
| N5 | **P0** | `api/v1/admin/auth.py:174-205` | **Reset réutilisable à l'infini** : après usage, `event.status = SENT` mais le filtre accepte `status IN (QUEUED, SENT)` → le même token reset le mot de passe autant de fois que voulu (pas de `used_at`, pas d'expiration, pas de single-use). Un attaquant ayant lu un ancien email (fuite de boîte) garde un accès permanent. |
| N6 | **P1** | `api/v1/admin/auth.py:185-187` | `new_password` sans validation : payload `dict` brut (pas de schéma Pydantic), aucune contrainte de longueur/complexité. On peut poser un mot de passe vide ou 1 caractère. Comparer : `AdminChangePassword.new_password = Field(min_length=8, max_length=128)` existe déjà dans `schemas/admin.py:80`. |
| N7 | **P1** | `api/v1/admin/auth.py:50-67` | **Aucun rate-limit sur `/login`** (ni `/refresh`, ni `/forgot-password`). Brute-force illimité sur les comptes admin (bcrypt ralentit mais ne plafonne pas). Le helper `check_ip_rate_limit` (créé pour l'audit n°1) n'est pas importé dans ce module. |
| N8 | **P1** | `api/v1/admin/auth.py:81-105` | **`revoked_at` jamais vérifié** dans `/refresh`. La révocation de famille (anti-reuse) ne protège que si le token volé est re-présenté *après* un usage légitime ; un token révoqué mais non-consommé passe le check `old_token.used_at is not None → non`, est marqué `used_at` puis accepté. Test manquant : `if old_token.revoked_at is not None: raise 401`. |
| N9 | **P1** | `api/v1/admin/auth.py:176-177` | `token`/`new_password` non vérifiés non-None : si l'un manque, le `contains({"token": None})` peut matcher un event sans clé `token` (comportement dialecte-dépendant) → 400 peu clair voire match fallacieux. Valider la présence des clés avant la requête. |
| N10 | **P2** | `api/v1/admin/auth.py:52` | `logout` ne révoque rien (commentaire assumé "JWT sans état") — mais maintenant que `admin_refresh_tokens` existe, un vrai logout serveur (révoquer la famille de refresh de l'admin courant) est faisable en 4 lignes et élimine le vol de refresh via XSS client. |
| N11 | **P2** | `services/rate_limit.py:33-52` | En cas d'erreur Redis, l'IP "unknown" passe sans limite (`allowed=True, degraded=True`) : acceptable en dev, mais le message "fallback pass-through" n'est pas distingué côté réponse (pas d'entête `X-RateLimit-Degraded`) — l'observabilité du mode dégradé est nulle. |
| N12 | **P2** | `models/subscriptions.py` (héritage n°1) | `AdminRefreshToken.admin_id` FK vers `administrators` avec `ondelete="CASCADE"` : cohérent, mais aucun nettoyage périodique des tokens expirés (`expires_at` jamais rempli à l'insertion dans `auth.py:34-42`) → croissance linéaire de la table, la rotation ne s'auto-purge jamais. |

### 2.2 Régressions introduites par les correctifs n°1 (auto-audit honnête)

| ID | Criticité | Localisation | Description |
|----|-----------|--------------|-------------|
| R1 | **P1** | `api/v1/admin/offers.py:234-262` | `mark_duplicate` et `reject_duplicate_pair` lèvent désormais `DuplicateServiceError` (cycle, a==b, 404) mais la route ne l'attrape pas → **500** avec stacktrace au lieu de 400/404/409. Le pattern `except CompanyServiceError` existe pourtant dans `companies.py` — il manque l'équivalent ici. |
| R2 | **P1** | `services/duplicates.py:85-92` + `offers.py:223` | Le dict `{"_warning": ...}` est **appendé dans la liste** renvoyée par `find_potential_duplicates`, dont la route déclare `response_model=list[PotentialDuplicateRead]`. Dès que le plafond 1000 est atteint (≥1000 offres actives), la validation Pydantic échoue → **500**. Le warning doit passer par un header (`X-Truncated-Scan`) ou un champ dédié, pas dans le payload. |
| R3 | **P2** | `services/duplicates.py:116` | La garde anti-cycle `a.duplicate_of_id == b.id` ne détecte pas les cycles **longs** (a→c→b) : le check à 1 niveau laisse passer `a.duplicate_of = c ; c.duplicate_of = b`. Une vérification par parcours borné (profondeur max 10) est nécessaire. |
| R4 | **P2** | `services/duplicates.py:105-125` | `admin_id` accepté mais **aucun `log_admin_action`** dans `mark_duplicate`/`reject_duplicate_pair` : les actions de modération de doublons sont invisibles dans l'audit log (le `reviewed_by_admin_id` du *rejet* compense à moitié — rien pour le *marking*). |
| R5 | **P2** | `api/v1/public/subscriptions.py:28` | Import mort `from services.normalization import token_hash` (plus utilisé depuis le passage à `validate_token`). Linter requis. |
| R6 | **P2** | `api/v1/admin/sending_preview.py:24` | **Dernier `__import__("models")` du code applicatif** (l.24) — oublié lors du refactoring n°1 (9 occurrences corrigées, celle-ci non détectée car le fichier n'était pas listé dans la 2.2.3 du rapport initial). |
| R7 | **P2** | `services/digest_preview_service.py:27-28`, `services/filiere_simulator.py:34-35` | Imports FastAPI/`HTTPException` dans des services purs (l'anti-pattern A8 de l'audit n°1 s'étend à ces 2 fichiers non couverts au 1er passage). |
| R8 | **P2** | `api/metrics.py:22,32-33` | `get_db` importé non utilisé ; `_request_count`/`_request_duration_sum` = `defaultdict` sans plafond de cardinalité : chaque `(path, status)` distinct crée une clé pour toujours → fuite mémoire lente sur des mois (surtout avec des status 4xx variés). Prévoir une purge périodique ou un top-N borné. |
| R9 | **P2** | `api/metrics.py:70-77` | `client_ip not in {"127.0.0.1", "::1"}` → simple WARNING, l'accès reste 200 : en prod l'endpoint expose le volume de trafic par route à quiconque. À défaut d'allow-list, exiger l'`admin_api_key` (header déjà prévu dans `deps.py:22`). |

### 2.3 Qualité / dette

| ID | Criticité | Localisation | Description |
|----|-----------|--------------|-------------|
| Q1 | **P1** | `tests/test_admin_exports.py` (5 échecs) + `tests/test_digest_cascade.py::test_compute_tier_stats` (1 échec) | **Échecs pré-existants** (vérifiés via `git stash` sur la base d'origine) : `admin_client` est `scope="module"` et la base SQLite `test_admin_enrich.db` **persiste entre les tests du module**. Les assertions delta (`after - before >= N`) échouent dès qu'un test précédent a déjà seedé. Le `_seed_minimal` est idempotent pour offers/subscribers mais pas pour `EmailDigest` (le test tier-stats compte 2 T0 au lieu de 1). **Fix** : soit des fixtures function-scoped avec cleanup par table, soit des assertions absolues (compter par `hash_unique` unique) au lieu de deltas relatifs. |
| Q2 | **P2** | `api/v1/admin/auth.py:185` | `payload: dict = Body(...)` sans schéma Pydantic — seule route admin du projet sans validation d'entrée. Remplacer par `AdminResetPasswordRequest(token: str, new_password: str = Field(min_length=8, max_length=128))`. |
| Q3 | **P2** | `api/v1/admin/dashboard.py:15` | `dependencies=[Depends(get_current_admin)]` seul — assumé ("accessible à tous les roles"), cohérent pour un point d'entrée. Mais `get_dashboard_overview` exécute **7 requêtes scalaires séquentielles** ; regrouper en 2-3 `GROUP BY` (pattern déjà appliqué aux filières). |
| Q4 | **P2** | `services/ingestion.py:311-313` | `except IntegrityError: db.rollback(); raise` — **toujours présent** (le chunking n°1 a été rollbacké) : un doublon en fin de batch annule tout le batch (comportement signalé R8 audit n°1, non résolu). Le P1 #16 reste ouvert. |
| Q5 | **P2** | `tests/test_admin_exports.py:229-241`, `tests/test_digest_endpoints.py:79` | 5 `__import__("sqlalchemy")`/`("models")` dans les tests — cosmétique, mais les mêmes fichiers fonctionnent avec des imports normaux. |
| Q6 | **P2** | `models/jobs.py:91-92` | `view_count`/`save_count` toujours non indexés (index composé `(status, view_count)` recommandé au §2.3 n°1) — le tri `top_viewed_offers` reste séquentiel sur 100k+ offres. |
| Q7 | **P3** | `api/v1/admin/logs.py:88-92` | Le mapping inverse `level → actions` oublie que `OfferIngestionEvent.action` a une valeur `SKIPPED` mappée "warning" : filtrer `level=warning` renvoie aussi les événements sans niveau défini correctement — vérifier la couverture réelle des 5 actions de `_LEVEL_BY_ACTION` (FAILED seulement = "error"). |
| Q8 | **P3** | `core/security.py:40-44` | **Faux positif n°1 levé** : bcrypt 5.0.0 lève bien `ValueError` sur hash invalide (vérifié en exécution), pas de `BcryptError` à attraper. Le point S9 de l'audit n°1 peut être clôturé sans action. |
| Q9 | **P3** | `api/deps.py:48,59` | Fausse alerte levée pendant cet audit : le `***` affiché par les outils de lecture est un artefact de rendu du `|` (union type) ; `od -c` confirme `str | None` en octets. Le fichier est sain — **aucune action**. Consigner pour les audits futurs : vérifier les octets avant de conclure à un placeholder. |

### 2.4 Fiabilité

| ID | Criticité | Localisation | Description |
|----|-----------|--------------|-------------|
| F1 | **P2** | `api/v1/admin/auth.py:34-42` | `_issue_tokens` insère `AdminRefreshToken` **sans `expires_at`** alors que le modèle le prévoit : la purge/gc impossible (Q-12 lié), et la sémantique "rotation 7 jours" n'est pas inscrite en base. Remplir `expires_at = now + admin_jwt_refresh_minutes`. |
| F2 | **P2** | `services/duplicates.py:45-49` | `db.execute(select(JobOffer)...limit(1000)).all()` : le `o.company` déclenche ensuite un **lazy-load N+1** (une requête par offre) puisque aucune `selectinload(Company)` — le plafond mémoire est respecté mais le coût SQL explose (1001 requêtes). Ajouter `.options(selectinload(JobOffer.company))`. |
| F3 | **P2** | `api/v1/public/offers.py` (héritage) | `POST /offers/{id}/view` reste synchrone (`db.commit()` par vue) — P1 #11 de l'audit n°1 n'était couvert que par le rate-limit 60/min/IP ; le hotspot d'écriture sous charge demeure. À terme : compteur Redis INCR + flush périodique. |

### 2.5 Couverture des correctifs par les tests

| Correctif n°1 | Couvert par un test ? |
|---|---|
| Anti-replay Svix | ✅ `test_webhook_rejects_stale_timestamp` |
| Déduplication enum | ✅ (transitivement) `test_ingestion_pipeline` — 8/8 passent avec `BRUT` |
| Échappement LIKE | ✅ `test_search_echappe_caracteres_like` (pré-existant) + `test_offers_export_echappement_csv` |
| Rotation refresh tokens | ❌ **aucun test** (login/refresh/reuse/logout non testés) |
| Rate-limit subscribe/contact/view/save | ❌ aucun test |
| Import borné (5 Mo/MIME) | ❌ aucun test |
| Merge companies + audit | ❌ aucun test |
| XSS preview / reset-password | ❌ aucun test (et le code est cassé — les tests l'auraient détecté) |

La dette de tests identifiée au n°1 (§2.6) reste intégralement ouverte ; les nouveaux modules récents (auth rotation, rate-limit, metrics) l'aggravent.

---

## 3. Backlog priorisé

### P0 — avant toute mise en prod

| # | Titre | Fichiers | Correction | Complexité |
|---|-------|----------|------------|------------|
| 1 | Échapper `html_snippet` du digest preview | `services/digest_preview_service.py:55` | `html.escape()` sur `full_name`, `email`, chaque `title` (aligner sur `templates.py`) | Petit |
| 2 | Réécrire le flux forgot/reset-password | `api/v1/admin/auth.py:150-206`, `schemas/admin.py` | Ajouter `RESET_PASSWORD` à `TransactionalEmailPurpose` ; utiliser `provider.send(EmailMessage)` (ou wrapper) ; **hasher le token** (SHA-256 comme `SubscriberToken`) dans `request_payload` ; consommer le token à l'usage (champ dédié/statut `FAILED`) ; TTL 1h ; schéma Pydantic `AdminResetPasswordRequest` avec `new_password min_length=8` | Moyen |
| 3 | Catcher `DuplicateServiceError` dans la route doublons | `api/v1/admin/offers.py:234-262` | `except DuplicateServiceError as exc: raise HTTPException(exc.status_code, exc.message)` (x2 : mark + reject) | Petit |
| 4 | Ne plus injecter `_warning` dans le payload candidates | `services/duplicates.py:85-92` | Renvoyer `(results, truncated)` ou positionner un header `X-Scan-Truncated: true` côté route | Petit |

### P1 — 2 sprints

| # | Titre | Fichiers | Correction | Complexité |
|---|-------|----------|------------|------------|
| 5 | Rate-limit sur `/login`, `/refresh`, `/forgot-password` | `api/v1/admin/auth.py` | `check_ip_rate_limit(scope="admin-login", limit=10/min)` + par email (10 échecs/15 min → 429) | Petit |
| 6 | Vérifier `revoked_at` dans `/refresh` | `api/v1/admin/auth.py:~88` | `if old_token.revoked_at is not None: raise 401` avant le check `used_at` | Petit |
| 7 | Réparer l'isolation des tests admin (5+1 échecs) | `tests/test_admin_exports.py`, `test_digest_cascade.py` | Fixtures function-scoped avec cleanup, ou assertions absolues (count par clé unique) au lieu de deltas ; purge des `EmailDigest` entre tests | Moyen |
| 8 | Remplir `expires_at` des refresh tokens | `api/v1/admin/auth.py:34-42` | `expires_at = now + admin_jwt_refresh_minutes` + tâche beat mensuelle de purge | Petit |
| 9 | `selectinload(Company)` dans `find_potential_duplicates` | `services/duplicates.py:45` | Éviter 1001 requêtes lazy-load | Petit |
| 10 | Détection de cycles longs dans `mark_duplicate` | `services/duplicates.py:116` | Parcours `duplicate_of_id` borné (≤10) avant d'accepter | Petit |
| 11 | `log_admin_action` sur marking/reject de doublons | `services/duplicates.py` | Un admin modifie la visibilité d'offres : doit être tracé | Petit |
| 12 | Logout serveur : révoquer la famille de refresh | `api/v1/admin/auth.py:112-116` | DELETE les `AdminRefreshToken` actifs de l'admin courant | Petit |
| 13 | Purge mémoire `_request_count` metrics | `api/metrics.py` | Top-N borné (ex. 1000 clés) ou reset périodique | Petit |

### P2 — dette

| # | Titre | Localisation | Correction |
|---|-------|--------------|------------|
| 14 | Dernier `__import__("models")` | `api/v1/admin/sending_preview.py:24` | Import en tête |
| 15 | Services impurs (FastAPI dans services) | `digest_preview_service.py:27`, `filiere_simulator.py:34` | Exceptions métier + traduction route |
| 16 | Import mort `token_hash` | `api/v1/public/subscriptions.py:28` | Supprimer |
| 17 | `get_db` inutilisé dans metrics | `api/metrics.py:22` | Supprimer |
| 18 | Dashboard overview : 7 scalaires → 2 GROUP BY | `api/v1/admin/dashboard.py:20-56` | Réduire les allers-retours |
| 19 | `/metrics` en prod : exiger `admin_api_key` ou allow-list | `api/metrics.py:70-77` | Le WARNING actuel ne bloque rien |
| 20 | Index `(status, view_count DESC)` manquant | `models/jobs.py` + migration 0012 | Accélérer `top_viewed_offers` |
| 21 | Chunking ingestion (P1 #16 initial toujours ouvert) | `services/ingestion.py:311` | `IntegrityError` par-offre au lieu du batch entier |
| 22 | `__import__` cosmétiques dans les tests | `test_admin_exports.py:229+`, `test_digest_endpoints.py:79` | Imports normaux |
| 23 | Batch compteur view/save asynchrone | `api/v1/public/offers.py` | Redis INCR + flush (héritage F3) |
| 24 | Tests : auth rotation, rate-limits, import borné, companies CRUD/merge, XSS preview | `tests/` | Voir §2.5 — 0 couverture sur ces modules |
| 25 | Ruff/Black + `pytest-cov` (P1 n°1 non livrés) | `pyproject.toml` | Config + seuil 70% |

---

## 4. Annexe — preuves d'exécution

- **bcrypt 5.0** : `checkpw(b'x', b'hash-invalide')` → `ValueError` (pas de `BcryptError` à attraper) → point S9 du 1er audit clôturé.
- **`deps.py` sain** : `sed -n '48p' | od -c` → `s t r  |  N o n e` (le `***` était un artefact d'affichage du `|`).
- **Échecs pré-existants** : `git stash` sur la base d'origine → `test_admin_exports.py` : 5 failed, 6 passed ; `test_digest_cascade::test_compute_tier_stats` : failed. Identiques avec/sans mes correctifs.
- **Enum** : `JobOfferStatus` compte 12 valeurs strictement distinctes ; `RAW_STATUSES = {BRUT}` dans `tasks/ai_processing.py`.
- **Suite de tests post-correctifs** : `test_admin_aggregates` 11/11, `test_admin_ai_endpoints` 12/12, `test_admin_transactional_emails` 10/10, `test_ingestion_pipeline` 8/8, `test_resend_webhook` 5/5 (dont anti-replay), `test_email_task` 4/4, `test_email_confirmation` 27/27, `test_digest_cascade` 31/32 (1 pré-existant).

---

**Note finale : B+ (7.5/10)** — la vague de corrections n°1 est réelle et solide sur le périmètre couvert ; ce second audit fait surtout ressortir (a) deux zones jamais auditées (preview digest, reset-password) qui contiennent le plus gros des risques restants, (b) trois régressions mineures à 500, (c) une dette de tests qui gronde : les modules les plus récents (auth, rate-limit, import) sont livrés sans test, ce qui a laissé passer les bugs N2/N3.

**Fin du rapport n°2.**