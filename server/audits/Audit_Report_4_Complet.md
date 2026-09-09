# Audit complet du backend JobAlert CI — Rapport 4

> **Méthodologie** : `server/Prompt_Audit_Backend_JobAlertCI.md` — audit codebase-first, preuves `fichier:ligne`, additif uniquement dans les recommandations, progression domaine par domaine avec validation utilisateur entre chaque domaine.
> **Date** : 2026-09-08 · **Branche** : `feat/admin-pages` (working tree propre)
> **Périmètre** : `server/` du dépôt `C:\repos\Job-Alert-CI` (~100 fichiers `.py`, 17 migrations, 23 fichiers de tests).
> **Échelle de sévérité** : `Critique` (perte de données, faille sécurité, fonctionnalité cassée) / `Majeur` (comportement incorrect impactant utilisateur ou admin) / `Mineur` (dette, incohérence sans impact direct) / `Amélioration` (proposition d'évolution).
> **Anti-invention** : tout constat cite du code réellement lu. Les hypothèses non vérifiables sont marquées comme telles.

---

## Domaine A — Journalisation (priorité haute)

### A.0 Points positifs

- **Couverture `log_admin_action` quasi exhaustive** : vérification exhaustive des 20 routers `api/v1/admin/*.py` — 91 mutations sur 101 journalisent, y compris via les services (`services/duplicates.py:212` pour `mark_duplicate`, `:260` pour `reject_duplicate_pair`). Les fichiers `admins.py`, `subscribers.py`, `content.py`, `companies.py`, `referentials.py`, `settings.py`, `sending.py`, `logs.py`, `scraping.py` et `ai_suggestions.py` couvrent **100 %** de leurs mutations.
- **`OfferIngestionEvent` créé dans tous les chemins d'erreur de l'ingestion** : `services/ingestion.py` couvre INSERTED (`:297`), DUPLICATE (`:237`), FAILED/IngestionError (`:310`), FAILED/IntegrityError (`:328`), FAILED/exception générique (`:341`) — chacun isolé par SAVEPOINT (audit 2, Q4 respecté). Le pipeline IA complète avec UPDATED (`services/ai_results.py:155`) et FAILED validation (`tasks/ai_processing.py:163`).
- **Secrets neutralisés dans les logs** : `_sanitize_output` (`tasks/scrapers.py:31-47`) masque `scraper_api_token`, `internal_api_token`, `admin_api_key` dans stdout/stderr des scripts scrapers (audit 3, S32 — correction effective, non régressée).
- **Agrégations UTC cohérentes** : tous les `created_at >= depuis` de `api/v1/admin/logs.py:119-120, 198-199` et `api/v1/admin/ai.py:251-252` utilisent `datetime.now(UTC)` aware ; `today_start_utc()` (`api/v1/public/_time_utils.py:6-26`) est le point unique de vérité documenté pour la borne « aujourd'hui ».
- **Purge des refresh tokens opérationnelle** : `tasks/maintenance.py:21-46` (rétention 30 j, idempotente, `rowcount` retourné).
- **DTOs explicites** : `AdminActionLogRead` construit champ par champ, jamais confié à `from_attributes` (`api/v1/admin/logs.py:93-104`, pattern cycle 6 respecté).
- **Statuts contact traduits en vocabulaire API** via l'inverse de `CONTACT_STATUS_ALIASES` (`api/v1/admin/logs.py:258-268`) — jamais de fuite des valeurs internes `in_progress`/`closed`.

### A.1 [MAJEUR] Les échecs de scraping ne laissent aucune trace en base

- **Fichiers** : `tasks/scrapers.py:109-123, 148-166` ; absence de création de `ScrapeRun`/`SourceScrapeRun`/`OfferIngestionEvent` dans ce module (vérifié par grep exhaustif : les seules créations vivent dans `services/ingestion.py:169,180` et `api/v1/admin/scraping.py:74,81`).
- **Description** : la task `run_source_scraper` délègue TOUTE la traçabilité à l'API d'ingestion (`POST /api/ingest/offers`, `tasks/scrapers.py:178`). Or cette API n'est appelée que sur le chemin nominal. Si le script scraper échoue (`returncode != 0` → `RuntimeError`, `tasks/scrapers.py:123`), si le subprocess expire (`subprocess.TimeoutExpired`, l.107), si la source est inactive/unknown (`return {"status": "skipped"}`, l.154-155) ou si aucun script local n'existe (`"no_local_scraper_script"`, l.162-166), **aucune ligne n'est écrite en base**. La seule trace est `logger.error` Python (l.113) — invisible depuis l'admin.
- **Impact concret** : `GET /api/admin/logs/events`, `/logs/stats` et `/admin/scraping/runs` ne montrent **jamais** un scraping qui a planté. L'admin qui voit « 0 offre insérée aujourd'hui » ne peut pas distinguer « le site source était down » de « le run n'a pas été déclenché » sans aller lire les logs worker bruts — exactement la question du Domaine C (« pourquoi ce run a-t-il échoué »). De plus `RuntimeError` n'est pas dans `autoretry_for=(httpx.TransportError, subprocess.TimeoutExpired)` (l.141) : l'échec est définitif jusqu'au lendemain sans trace.
- **Recommandation (additive)** : dans `run_source_scraper`, créer un `ScrapeRun`+`SourceScrapeRun` (statut `failed`) ou a minima un `OfferIngestionEvent` au niveau run (`source_scrape_run_id` éventuellement NULL, `reason` porté) sur les 3 chemins d'abandon : script en erreur, source inactive, script absent. Sans toucher au chemin nominal ni aux schémas existants.

### A.2 [MAJEUR] Événements de sécurité non journalisés : changement et réinitialisation de mot de passe, logout

- **Fichiers** : `api/v1/admin/auth.py:239-261` (`PUT /me/password`), `:267-277` (`POST /forgot-password`), `:280-292` (`POST /reset-password`), `:210-230` (`POST /logout`).
- **Description** : aucune de ces 4 routes n'appelle `log_admin_action`. Le reset via token ne laisse qu'un `logger.info` applicatif (`services/admin_password_reset.py:215-218`). L'enum `AdminAction` n'a d'ailleurs **aucune** valeur dédiée (ni `PASSWORD_CHANGE`, ni `LOGOUT` — `models/enums.py:230-235` : CREATE/UPDATE/DELETE/SEND/LOGIN/SCRAPE).
- **Impact concret** : en cas de compromission d'un compte admin, le journal d'audit — l'outil forensique prévu (`services/audit.py:8-13` : « chaque action... doit generer une ligne ») — ne contient aucune trace du takeover (ni du reset qui l'a permis, ni des sessions révoquées). Le changement de mot de passe est un événement de conformité standard (qui a changé quel compte, quand).
- **Recommandation (additive)** : journaliser `UPDATE` sur `administrators` dans `/me/password` et `/reset-password` (l'admin est résolu dans `consume_reset_token` via `candidate.to_email`, `services/admin_password_reset.py:200` — le service peut retourner l'admin ou l'email journalisé sans casser le contrat). Pour `/logout`, une ligne `LOGIN`-négative ou une nouvelle valeur enum `LOGOUT` (changement enum = à signaler). `forgot-password` peut rester silencieux côté réponse (anti-énumération conservée) mais journaliser l'email côté serveur.

### A.3 [MAJEUR] `OfferIngestionEvent` : croissance illimitée + payload brut stocké en double

- **Fichiers** : `models/jobs.py:200` (colonne `raw_payload` JSON sur l'event), `services/ingestion.py:209` (`raw_payload = item.raw_data or item.as_raw_payload()`) passé à chaque `_event(...)` (`:245, :305, :317, :335, :348`) ; `tasks/maintenance.py` (aucune purge pour cette table).
- **Description** : chaque offre reçue génère au moins un event qui embarque le **raw_payload complet**, déjà stocké sur `JobOffer.raw_payload` (`models/jobs.py:103`). Aucune politique de rétention n'existe pour `offer_ingestion_events` ni `admin_action_logs` (seuls les `AdminRefreshToken` sont purgés, `tasks/maintenance.py:21`).
- **Impact concret** : c'est la table qui grossit le plus vite du système (ordre de grandeur : ~toutes les offres scrapées × 1-2 lignes, payload JSON inclus). Les agrégations `logs_stats` (`api/v1/admin/logs.py:204-228`) font des `GROUP BY` plein-table dessus ; dans quelques mois, `/admin/logs` et `/admin/scraping` deviennent lents et le stockage Neon coûteux — pour des données dont la valeur décroît (les échecs de plus de 90 jours ne servent plus).
- **Recommandation (additive)** : task Celery `purge_ingestion_events(retention_days=90)` sur le modèle de `purge_expired_refresh_tokens` (`tasks/maintenance.py:21-46`), en **supprimant d'abord `raw_payload` des events plus vieux que N jours** (UPDATE puis DELETE progressif) pour limiter l'impact sur le pool de connexions. Secondairement : ne plus persister `raw_payload` dans l'event à l'insertion (l'offre le conserve) — à signaler comme changement de comportement à valider.

### A.4 [MINEUR] `AdminActionLog` sans rétention

- **Fichiers** : `models/admin.py:33-45` ; `tasks/maintenance.py` (absence de purge pour cette table).
- **Description** : croissance lente mais illimitée. Volume intrinsèquement faible (actions humaines), mais `details` est un JSON libre (`models/admin.py:42`) qui peut embarquer des listes d'IDs (`api/v1/admin/offers.py:219` : `offer_ids` jusqu'à 500).
- **Impact** : négligeable à court terme ; dette de gouvernance à long terme (le journal d'audit est justement la table qu'on ne veut PAS purger agressivement).
- **Recommandation** : rétention longue explicite (ex. 365 j) configurable via `SiteSetting`, documentée — plutôt qu'une suppression aveugle. À décider côté produit (le journal d'audit a souvent une valeur légale).

### A.5 [MINEUR] `IngestionAction.SKIPPED` défini mais jamais inséré

- **Fichiers** : `models/enums.py:54` (`SKIPPED = "skipped"`) ; aucun chemin ne crée d'event avec cette action (grep exhaustif sur `OfferIngestionEvent(` : seuls `services/ingestion.py:86`, `services/ai_results.py:156`, `tasks/ai_processing.py:164` créent des events, jamais en SKIPPED).
- **Description** : le niveau `warning` exposé par `GET /logs/events` (`api/v1/admin/logs.py:306-308` via `_LEVEL_BY_ACTION`) et le compteur `events_warnings` de `/logs/stats` (`:214`) sont **structurellement toujours à 0**.
- **Impact** : le filtre « warning » de l'UI admin est un contrôle mort ; le compteur peut masquer des avertissements réels qui ne sont tout simplement pas capturés.
- **Recommandation** : soit émettre des SKIPPED aux endroits pertinents (batch déjà reçu → `ingest_offer_batch` retourne « already_processed » sans event, `services/ingestion.py:192-200` ; source inactive rencontrée par la task), soit retirer le niveau warning du mapping et l'expliquer dans la doc UI. Trancher côté produit.

### A.6 [MINEUR] Mapping niveau/action dupliqué entre deux routers

- **Fichiers** : `api/v1/admin/logs.py:33-39` (`_LEVEL_BY_ACTION`) vs `api/v1/admin/scraping.py:162` (`level_by_action` recopié en local dans `get_scraping_run_logs`).
- **Description** : deux définitions du même mapping action→niveau. Toute évolution (ex. valoriser SKIPPED) devra être faite aux deux endroits sous peine de divergence silencieuse entre `/admin/logs` et `/admin/scraping/runs/{id}/logs`.
- **Recommandation (additive)** : déplacer le mapping dans un module partagé (`schemas/logs.py` ou `services/log_levels.py`) et l'importer aux deux endroits.

### A.7 [MINEUR] Pas de filtre plage de dates sur `/audit` ni `/events`

- **Fichiers** : `api/v1/admin/logs.py:68-76` (`/audit` : filtres `admin_id`, `action`, `target_table` seulement) et `:285-293` (`/events` : `module`, `level`, `source_id` seulement).
- **Description** : le prompt de référence exige de vérifier que « plage de dates » est appliquée côté SQL — elle n'existe pas dans les signatures. Le front ne peut pas restreindre l'historique à une période (les agrégats `/audit/stats` et `/stats` ont bien `days`, mais pas les listes).
- **Impact** : pagination obligée depuis le plus récent ; impossible de cibler « ce qui s'est passé entre le 1er et le 5 septembre ».
- **Recommandation (additive)** : paramètres optionnels `date_debut`/`date_fin` (ISO) injectés dans `_audit_filters` et le statement `/events` — rétrocompatibles (absents = comportement inchangé).

### A.8 [MINEUR] Pas de configuration de logging applicatif centralisée

- **Fichiers** : aucun `basicConfig`/`dictConfig`/formatter JSON dans `main.py`, `celery_app.py` ou un module dédié (grep exhaustif négatif) ; ~70 appels `logger.*` répartis (`api/`, `services/`, `tasks/`) dont seulement 13 avec `extra=`.
- **Description** : les logs applicatifs partent en texte libre dans stdout (uvicorn/celery posent leurs propres handlers), sans structuration JSON et sans identifiant de corrélation (`run_id`/`request_id`). Les `extra={...}` existants (ex. `tasks/scrapers.py:116-121`) ne sont pas rendus par un formatter dédié.
- **Impact** : sur Render, impossible de corréler une requête API avec le worker Celery qui la traite ; l'agrégation de logs (si ajoutée un jour) demandera un reformatage complet.
- **Recommandation** : traité en profondeur au Domaine O (Observabilité) — renvoi, non dupliqué ici.

### A.9 [MINEUR] `date.today()` naïf vs `_abidjan_date()` : deux définitions de « la date du run »

- **Fichiers** : `api/v1/admin/scraping.py:75` (`run_date=date.today()` — heure locale serveur), `api/v1/admin/sending.py:150` (`digest_date = payload.date_override or date.today()`), contre `services/ingestion.py:70-71` (`_abidjan_date()` via `ZoneInfo(settings.timezone)`).
- **Description** : deux conventions coexistent pour la date métier. Aujourd'hui sans impact réel (Render tourne en UTC et Abidjan est UTC+0), mais tout serveur non-UTC ou tout changement de fuseau créerait des runs « du mauvais jour » selon le point d'entrée.
- **Impact** : divergence latente uniquement ; aucun bug observable aujourd'hui.
- **Recommandation (additive)** : un helper unique `today_local()` (dans `services/` ou `api/v1/public/_time_utils.py` voisin) utilisé par les trois endroits.

### A.10 [MINEUR] `POST /ai/run` et `POST /ai/keys/{id}/test` non journalisés

- **Fichiers** : `api/v1/admin/ai.py:450-461` (`/run` — déclenchement manuel du pipeline IA), `:164-174` (`/keys/{id}/test` — écrit `last_error_at` en cas d'échec, l.172).
- **Description** : qui a relancé l'IA manuellement n'est tracé nulle part (la réponse renvoie `triggered_by` mais rien en base) ; le test de clé est une action de diagnostic qui mute `AIApiKey.last_error_at` sans trace d'audit.
- **Impact** : le paramètre `days=1` des stats IA cycle 19 montrera des jobs `manual` dont l'auteur est inconnu ; en cas d'abus (relances en boucle), pas de responsable.
- **Recommandation (additive)** : `log_admin_action(action=SCRAPE ou SEND selon vocabulaire choisi, target_table="ai_jobs")` dans `/run` ; `UPDATE` sur `ai_api_keys` dans `/test`.

### A.11 [AMÉLIORATION] Événements de mutation non bloquants (inventaire exhaustif des 10 mutations non journalisées)

Bilan complet des mutations sans `log_admin_action` dans `api/v1/admin/` :

| Route | Statut |
|---|---|
| `auth.py:155` `POST /refresh` | Acceptable (rotation de routine, aucune mutation métier) — éventuellement journaliser à des fins de volumétrie |
| `auth.py:210` `POST /logout` | À journaliser (A.2) |
| `auth.py:239` `PUT /me/password` | À journaliser (A.2) |
| `auth.py:280` `POST /reset-password` | À journaliser (A.2) |
| `ai.py:164` `POST /keys/{id}/test` | À journaliser (A.10) |
| `ai.py:450` `POST /run` | À journaliser (A.10) |
| `offers.py:247` `POST /{offer_b_id}/mark-duplicate` | **Couvert** — journalisé dans `services/duplicates.py:212` |
| `offers.py:267` `POST /duplicates/reject` | **Couvert** — journalisé dans `services/duplicates.py:260` |
| `referentials.py` `POST /filieres/simulate` | Lecture pure (simulation), pas une mutation de données — conforme |
| `sending_preview.py:18` `POST /preview` | Lecture pure (rendu sans envoi), conforme |

### Tableau de synthèse — Domaine A

| # | Constat | Sévérité | Fichiers principaux | Recommandation | Effort |
|---|---|---|---|---|---|
| A.1 | Échecs de scraping invisibles en base | **Majeur** | `tasks/scrapers.py:109-166` | Créer run/event d'échec sur les chemins d'abandon | Moyen |
| A.2 | Password change/reset/logout non audités | **Majeur** | `api/v1/admin/auth.py:210-292` | `log_admin_action` sur les 3 routes (+ valeur enum à valider) | Petit |
| A.3 | `OfferIngestionEvent` illimité + payload dupliqué | **Majeur** | `models/jobs.py:200`, `services/ingestion.py:209`, `tasks/maintenance.py` | Task de purge 90 j + stop double stockage | Moyen |
| A.4 | `AdminActionLog` sans rétention | Mineur | `models/admin.py:33`, `tasks/maintenance.py` | Rétention explicite longue, à trancher produit | Petit |
| A.5 | `SKIPPED` jamais inséré, niveau warning mort | Mineur | `models/enums.py:54`, `api/v1/admin/logs.py:306` | Émettre SKIPPED ou retirer le niveau warning | Petit |
| A.6 | Mapping niveau dupliqué | Mineur | `api/v1/admin/logs.py:33` vs `scraping.py:162` | Factormodule partagé | Petit |
| A.7 | Pas de filtre date sur `/audit` et `/events` | Mineur | `api/v1/admin/logs.py:68, 285` | `date_debut`/`date_fin` optionnels | Petit |
| A.8 | Pas de logging structuré/corrélé | Mineur | global | → Domaine O | — |
| A.9 | `date.today()` vs `_abidjan_date()` | Mineur | `scraping.py:75`, `sending.py:150`, `ingestion.py:70` | Helper unique | Petit |
| A.10 | `/ai/run` et `/test` non journalisés | Mineur | `api/v1/admin/ai.py:450, 164` | `log_admin_action` | Petit |

**Hypothèses ouvertes** : aucune pour ce domaine (tout est vérifié dans le code).

---

## Domaine B — Configuration des clés IA

### B.0 Points positifs

- **Chiffrement Fernet (AES-128-CBC + HMAC) correctement implémenté** : `services/ai_crypto.py:34-51` — clé dérivée du secret env (`_fernet_key_from_secret` accepte directement un secret base64 de 32 octets, sinon dérive via SHA-256), `InvalidToken` traduit en `AIConfigurationError` sans jamais renvoyer le secret.
- **Jamais de clé en clair en base ni en réponse API** : seul `api_key_encrypted` (chiffré) et `api_key_last4` sont stockés (`models/ai.py:37-38`) ; `AIApiKeyRead` n'expose que `api_key_last4` + `api_key_masked` calculé (`schemas/ai.py:56, 70-75`) ; `AIApiKeyCreate.api_key` porte `repr=False` (`schemas/ai.py:22`) pour éviter toute fuite dans les logs Pydantic.
- **Contrôle d'accès correct** : CRUD clés réservé `super_admin` via `dependencies=[Depends(require_roles("super_admin"))]` (`api/v1/admin/ai.py:30-34`).
- **Fallback multi-clés robuste dans sa logique** : `select_available_api_keys` (`services/ai_key_manager.py:40-57`) trie par priorité ASC puis `nullsfirst(last_error_at)` (les clés n'ayant jamais erré d'abord) ; backoff exponentiel **avec jitter** (`_sleep_before_retry`, `:109-112`) ; `fallback_immediately` court-circuite les retries inutiles (auth 401/403, model 404) ; classification HTTP fine (`_classify_http_error`, `services/ai_providers.py:38-86`).
- **Garde-fous "dernière clé active"** (audit P1 #29) : impossibilité de désactiver/supprimer la dernière clé active, y compris via `max_concurrent_requests=0` (`api/v1/admin/ai.py:98-115, 143-156`).
- **Alertes consultables ET actionnables** — pas orphelines : `GET /api/admin/ai/alerts` avec filtres `include_acknowledged`/`severity` (`api/v1/admin/ai.py:394-410`) + `PATCH /alerts/{id}/ack` idempotent (`:413-447`), compteur « alertes non acquittées » dans les stats cycle 19 (`:294-302`).
- **Modèle utilisé configurable sans déploiement** : `models` est une colonne JSON de `AIApiKey` éditable via PATCH (`api/v1/admin/ai.py:117-121`) — pas de hardcode.

### B.1 [MAJEUR] `AI_CIRCUIT_BREAKER_MINUTES` : paramètre configurable mort, valeur codée en dur

- **Fichiers** : `core/config.py:186` (`ai_circuit_breaker_minutes: int = field(default_factory=lambda: _int_env("AI_CIRCUIT_BREAKER_MINUTES", 15))`) ; `services/ai_key_manager.py:121` (`circuit_breaker_minutes: int = 15` — défaut de signature) ; unique call-site `services/ai_batches.py:231-236` (n'interpasse pas le paramètre).
- **Description** : le setting existe dans la config dataclass mais **aucun code ne le lit** (grep exhaustif : la seule référence hors définition est `core/config.py:186` lui-même). `generate_structured_with_fallback` reçoit le défaut 15 de sa signature ; `process_ai_batch_with_provider` ne passe rien. C'est exactement la question posée par la méthodologie (« circuit-breaker en minutes : codé en dur ou configurable sans déploiement ? ») — réponse : **présenté comme configurable, réellement codé en dur à 15**.
- **Impact concret** : un admin qui règle `AI_CIRCUIT_BREAKER_MINUTES=60` sur Render (redéploiement à l'appui) n'obtient aucun changement : les clés rate-limitées sont toujours réactivées après 15 min. Fausse promesse de configuration, comportement indocumenté.
- **Recommandation (additive)** : dans `process_ai_batch_with_provider`, passer `circuit_breaker_minutes=get_settings().ai_circuit_breaker_minutes` (une ligne, aucun contrat cassé). Documenter la valeur par défaut (15 min) dans le README config.

### B.2 [MAJEUR] Fragments de vraies clés API committés dans le dépôt

- **Fichier** : `scripts/seed_ai_api_keys.py:33` (`"repere fourni: sk-or-v1-b...a192"`), `:42` (`"gsk_RIXueU...Erm"`), `:51` (`"sk-708...8c"`).
- **Description** : les commentaires `notes` des trois seeds contiennent des **fragments de début et de fin de clés réelles** (OpenRouter `sk-or-v1-…`, Groq `gsk_…`, DeepSeek `sk-…`). Ces chaînes sont persistées en base (colonne `notes`, seedée telle quelle, `scripts/seed_ai_api_keys.py:85`) ET versionnées dans git.
- **Impact concret** : les fragments de préfixe+suffixe facilitent l'identification et la confirmation d'une clé volée elsewhere (validation de correspondance), et révèlent les fournisseurs en usage. Ce ne sont pas des clés complètes (donc pas directement exploitables), mais c'est de la matière première d'ingénierie sociale/forensique adverse — contraire à la convention du projet qui ne stocke jamais de secret partiel en clair ailleurs (`api_key_last4` seul est volontairement conservé, `schemas/ai.py:56`).
- **Recommandation** : remplacer les repères par `last4` uniquement (cohérent avec la colonne dédiée) — ex. `notes="Seed admin IA: OpenRouter (cle ****a192)"` — et auditer l'historique git si ces fragments datent d'un dépôt privé partagé. Ne pas réécrire l'historique sans validation (changement cassant pour les clones existants).

### B.3 [MAJEUR] `rate_limit_per_minute` et `max_concurrent_requests` : colonnes éditables sans aucun effet runtime

- **Fichiers** : `models/ai.py:41,45` (colonnes) ; `schemas/ai.py:25-29, 41-45` (CRUD) ; `api/v1/admin/ai.py:65,69` (création) ; **aucune lecture runtime** (grep exhaustif sur `services/`, `tasks/`, `api/` : les seules références sont le CRUD et le garde-fou « dernière clé » `ai.py:101`).
- **Description** : l'admin peut régler « limite de requêtes/minute » et « concurrence max » par clé depuis `/admin/ia` — ces valeurs sont stockées, relues, affichées… et **jamais appliquées**. `generate_structured_with_fallback` fait une requête synchrone unique par tentative, sans throttle ni sémaphore.
- **Impact concret** : promesse UI trompeuse — un admin réglant `rate_limit_per_minute=10` sur une clé Groq gratuite croit éviter le 429 ; en réalité le batch déclenche ce qu'il veut. Le 429 arrivera, sera classé RATE_LIMIT (retryable + fallback), consommant des retries pour rien.
- **Recommandation** : deux options à trancher côté produit : (a) câbler un rate-limiter local simple (compteur en mémoire/Redis par clé avant chaque `generate_structured`) — Moyen ; (b) retirer les deux champs de l'UI admin (les garder en base pour compat, les marquer `inactive` dans le schéma Read) — Petit. Ne pas laisser des réglages inertes.

### B.4 [MAJEUR] Inondation d'alertes IA : aucune déduplication ni cooldown

- **Fichiers** : `services/ai_key_manager.py:123-132` (`_create_alert` « no_ai_api_key_available » à chaque appel sans clé disponible) et `:186-205` (« all_ai_providers_failed ») ; `tasks/ai_processing.py:235-303` (chaque échec crée un `AIJob` FAILED) ; beat `sweep_raw_offers` toutes les 5 min (cf. Domaine F).
- **Description** : avec une clé unique en échec (panne fournisseur prolongée — le SPOF exact visé par la méthodologie), le cycle est : sweep → `select_available_api_keys` vide (clé `disabled_until` futur) ou échec → `AINoAvailableKeyError` → 1 `AIJob` FAILED **+ 1 `AIAlert`** toutes les 5 minutes. Aucun mécanisme ne regroupe ces alertes identiques ; `AIAlert` n'a pas de purge (seuls les refresh tokens sont purgés, `tasks/maintenance.py:21`).
- **Impact concret** : ~288 alertes/jour de bruit identique. La page `/admin/ia` (alertes non acquittées, cycle 19) devient inutilisable — l'admin acquitte 50 alertes pour « une » panne, et l'acquittement n'arrête pas la prochaine vague. C'est le contresens complet du but d'une alerte (signaler, pas noyer).
- **Recommandation (additive)** : cooldown dans `_create_alert` — avant insertion, vérifier si une alerte NON acquittée du même `type` existe déjà (requête indexée sur `type` + `acknowledged_at IS NULL`) et ne pas recréer si présente. Éventuellement compteur `occurrences` incrémenté. Ajouter `AIAlert` à la purge maintenance (rétention 90 j, conforme au pattern A.3).

### B.5 [MINEUR] Rotation du secret de chiffrement impossible sans tout ressaisir

- **Fichiers** : `services/ai_crypto.py:18-31, 46-51`.
- **Description** : la clé Fernet dérive d'un unique `AI_KEY_ENCRYPTION_SECRET`. Changer cette variable → `decrypt_api_key` lève `AIConfigurationError` pour **toutes** les clés existantes (`InvalidToken`). Aucun mécanisme de re-chiffrement, aucune version de clé, aucun support multi-secret (ancien+nouveau pendant transition). Pas de longueur minimale exigée : un secret d'1 caractère est accepté et produit une clé Fernet faible.
- **Impact** : rotation = ressaisie manuelle de toutes les clés IA via l'admin (délai pendant lequel le pipeline IA est durci en échec — chaque usage lève AIConfigurationError → traité comme B.4). Risque faible à court terme (rotation rare), mais absence totale de procédure.
- **Recommandation** : (a) exiger une longueur minimale (≥ 32 chars) au premier usage avec message clair ; (b) script additive `scripts/rotate_ai_encryption_secret.py` : lit l'ancien secret, déchiffre chaque clé, re-chiffre avec le nouveau, transaction unique ; (c) à terme : préfixe de version dans `api_key_encrypted` (`v1:…`/`v2:…`) pour une transition sans downtime.

### B.6 [MINEUR] Champ config `ai_key_encryption_secret` mort — deux sources de vérité

- **Fichiers** : `core/config.py:185` (champ Settings jamais lu) vs `services/ai_crypto.py:36` (`getenv("AI_KEY_ENCRYPTION_SECRET")` direct).
- **Description** : le secret est lu par `getenv` dans `ai_crypto`, pas via `get_settings()` — le champ de la dataclass config est du code mort. Si un jour la config charge ce secret depuis une autre source (fichier, vault), `ai_crypto` continuera de lire l'env et divergera silencieusement.
- **Impact** : incohérence latente uniquement.
- **Recommandation** : lire `get_settings().ai_key_encryption_secret` dans `_fernet()` (avec le même message d'erreur), supprimer le double accès.

### B.7 [MINEUR] Absence de clé IA non détectée au démarrage

- **Fichiers** : `main.py:21-34` (lifespan ne valide que le secret JWT) ; `services/ai_crypto.py:36-38` (erreur levée paresseusement au premier encrypt/decrypt).
- **Description** : `AI_KEY_ENCRYPTION_SECRET` manquant en production ne fait pas échouer le boot — le service démarre vert, et c'est la première tâche IA (ou le premier CRUD de clé) qui échouera avec `AIConfigurationError`.
- **Impact** : détection tardive d'un problème de déploiement (.Render redémarre un service « sain » alors que le pipeline IA est mort).
- **Recommandation (additive)** : dans le lifespan, si `settings.is_production and settings.ai_enabled`, vérifier la présence du secret (comme pour le JWT) — sans exiger la valeur (secret réel), juste la non-nullité.

### B.8 [MINEUR] Doc/schémas désynchronisés avec le fix cycle 19 + champ dupliqué

- **Fichiers** : `schemas/ai.py:262-267` (`last_sweep_at` décrit comme « dernier **AiProcessingJob** de trigger SWEEP » alors que `api/v1/admin/ai.py:206-211` lit désormais `AIJob` — correction cycle 19 non reportée dans la description du schéma) ; `schemas/ai.py:334-335` (`reviewed_by_admin_id: UUID | None = None` **défini deux fois** dans `AIFiliereSuggestionUpdate` — la seconde écrase la première silencieusement).
- **Impact** : la description OpenAPI affirme le comportement d'avant-cycle-19 (celui-là même qui rendait `last_sweep_at` toujours null en prod) ; le champ dupliqué est une coquille qui survit aux relectures.
- **Recommandation** : corriger la description (`AIJob (ai_jobs)…`) et supprimer la ligne dupliquée. Zéro impact runtime.

### B.9 [MINEUR] Aucun seuil de confiance IA configurable

- **Fichiers** : `services/ai_results.py:148-153` (`filiere_confidence` du provider appliquée brute via `_upsert_offer_filiere`) ; aucun `SiteSetting` ni champ config de seuil (grep : `seuil`/`threshold` absents de `core/config.py` et du seed settings).
- **Description** : la méthodologie demande si les « seuils de confiance » sont configurables — ils n'existent pas comme concept : la confiance renvoyée par le modèle est écrite telle quelle (bornée 0-1 par CHECK, `models/jobs.py:187`), et seule la règle binaire `requires_admin_review` du provider décide de la revue humaine.
- **Impact** : impossible de resserrer le filet (« toute confiance < 0.8 part en revue ») sans redéployer du code ; un modèle bavard qui renvoie 0.55 partout publiera des offres avec un matching faible.
- **Recommandation** : `SiteSetting` additive `ai_min_filiere_confidence` (défaut vide = comportement inchangé) lue dans `apply_ai_results` : en dessous du seuil → `requires_admin_review=True`. Rétrocompatible par défaut.

### Tableau de synthèse — Domaine B

| # | Constat | Sévérité | Fichiers principaux | Recommandation | Effort |
|---|---|---|---|---|---|
| B.1 | `AI_CIRCUIT_BREAKER_MINUTES` jamais lu (codé en dur 15) | **Majeur** | `core/config.py:186`, `ai_key_manager.py:121`, `ai_batches.py:231` | Passer le setting au call-site | Petit |
| B.2 | Fragments de clés réelles dans le seed + base | **Majeur** | `scripts/seed_ai_api_keys.py:33,42,51` | Ne garder que last4 ; auditer git | Petit |
| B.3 | `rate_limit_per_minute`/`max_concurrent_requests` inertes | **Majeur** | `models/ai.py:41,45`, `ai_key_manager.py` | Câbler un throttle ou retirer de l'UI | Moyen |
| B.4 | Inondation AIAlert (pas de dédup/cooldown/purge) | **Majeur** | `ai_key_manager.py:123-132,186-205`, `ai_processing.py:235+` | Cooldown par type + purge 90 j | Moyen |
| B.5 | Rotation du secret Fernet impossible | Mineur | `ai_crypto.py:18-51` | Longueur min + script de rotation | Moyen |
| B.6 | Champ config mort (double source de vérité) | Mineur | `core/config.py:185` vs `ai_crypto.py:36` | Lire via settings | Petit |
| B.7 | Secret absent non détecté au boot | Mineur | `main.py:21-34` | Garde lifespan en prod | Petit |
| B.8 | Doc schema pré-cycle-19 + champ dupliqué | Mineur | `schemas/ai.py:262-267, 334-335` | Corriger descriptions | Petit |
| B.9 | Aucun seuil de confiance configurable | Mineur | `services/ai_results.py:148-153` | SiteSetting additive | Petit |

**Hypothèses ouvertes** :
- H1 : les fragments de clés (B.2) proviennent-ils d'un fichier `.env` local historique ? À confirmer avec l'utilisateur avant toute action sur l'historique git.
- H2 : B.3 — les knobs ont-ils été créés en anticipation d'un futur câblage (intention documentée quelque part) ou sont-ils des restes de conception ? Le cahier des charges v2/v4 tranchera entre les options (a) câbler et (b) retirer.

---

## Domaine C — Historique de scraping

### C.0 Points positifs

- **Modèle complet et bien contraint** : `ScrapeRun`/`SourceScrapeRun` portent tous les compteurs utiles avec CHECK de positivité (`models/scraping.py:52-59, 86-94`), `http_status`, `duration_ms`, `error_message` par source — l'outillage répond à la question « pourquoi ce run a échoué » quand il est rempli.
- **Périmètre d'`ingest_offer_batch` robuste** : idempotence par `external_batch_id` (`services/ingestion.py:192-200` — re-POST du même batch renvoie « already_processed », pas de doublon), statuts finaux cohérents (SUCCESS/PARTIAL_FAILURE/FAILED selon les compteurs, `:352-354`), compteurs remplis en fin de batch (`:356-371`).
- **Liens run → événements → offres réellement exploitables** : `GET /runs/{id}/logs` (`api/v1/admin/scraping.py:146-178`) expose les `OfferIngestionEvent` des `SourceScrapeRun` du run ; `JobOffer.source_scrape_run_id` relie chaque offre à son sous-run (`models/jobs.py:82`).
- **`/status` par source utile** : dernier passage, durée, dernière erreur, volume total (`api/v1/admin/scraping.py:27-51`).

### C.1 [CRITIQUE] `POST /api/admin/scraping/trigger` crée des runs PENDING que **rien ne consomme jamais**

- **Fichiers** : `api/v1/admin/scraping.py:54-91` (création `status=PENDING`, docstring « l'exécution effective des scrapers est portée par le worker de collecte (hors périmètre de cette API) qui les fera avancer vers running puis success/failed ») ; grep exhaustif du dépôt **entier** (`server/` + `scrapers/`) : aucun code ne sélectionne ni ne fait avancer des `SourceScrapeRun` en statut `PENDING` créé par cette route. Les seuls avancements de statut du codebase vivent dans `services/ingestion.py:171,183` (création RUNNING) et `:356-365` (statuts finaux) — c'est-à-dire exclusivement sur le chemin `/api/ingest/offers`, qui crée **ses propres** runs.
- **Description** : le bouton « déclencher un scraping » de l'admin crée des lignes de suivi `scrape_runs`/`source_scrape_run` PENDING, journalise (`log_admin_action` SCRAPE, l.85-88)… puis rien ne se passe. Le scrapage réel passe exclusivement par le beat Celery (`tasks/scrapers.py:run_active_scrapers` → `run_source_scraper` → `POST /api/ingest/offers`), qui ne lit pas ces lignes (`tasks/scrapers.py:185-202` interroge `Source` en base, jamais `ScrapeRun` PENDING).
- **Impact concret** : l'admin qui utilise ce bouton obtient un **201 avec un run fantôme** qui restera `pending` à vie — polluant `/runs` et gonflant le `total_runs` affiché par `/stats/summary` (`api/v1/admin/scraping.py:105-135` ; les fantômes sont exclus du dénominateur de `success_rate` mais comptent dans `total_runs`), et trompant la supervision (« un run est en attente depuis 3 jours »). Pire : **le bouton ne déclenche réellement rien** — l'action attendue (lancer les scrapers) n'est pas reliée à Celery. C'est une fonctionnalité cassée de bout en bout.
- **Recommandation (additive)** : relier le trigger à l'exécution réelle : soit (a) dispatcher `run_source_scraper.delay(source_code)` (ou `run_active_scrapers`) pour chaque source du run créé, et faire avancer les `SourceScrapeRun` dans la task (nécessite de passer `scrape_run_id` en kwargs, additive au contrat de la task) ; soit (b) supprimer le bouton/route et documenter que le déclenchement manuel passe par le beat (heureusement, `run_active_scrapers` est déjà dispo). Option (a) recommandée — c'est l'intention de la docstring.

### C.2 [CRITIQUE] Doublon de déclenchement le même jour : `IntegrityError` non gérée → 500 silencieux

- **Fichiers** : `models/scraping.py:53` (`UniqueConstraint("run_date", "triggered_by")`) ; `api/v1/admin/scraping.py:74-89` (aucun `try/except IntegrityError` ; `db.commit()` nu, l.89).
- **Description** : la méthodologie demandait explicitement ce cas limite. Un même admin qui clique deux fois sur « déclencher » le même jour → `triggered_by=f"admin:{admin.id}"` + `run_date=date.today()` identiques → violation de la contrainte UNIQUE → `IntegrityError` remonte en 500 générique. Aucun message métier, aucune journalisation de l'événement, aucune détection « run déjà créé aujourd'hui ».
- **Impact concret** : expérience admin cassée (erreur serveur brute au lieu de « un run a déjà été déclenché aujourd'hui, voulez-vous forcer ? »), et potentiellement un volume de 500 inutiles dans les métriques (`unmatched`-adjacent, faussement classés en erreur serveur).
- **Recommandation (additive)** : wrapper le `db.commit()` : `except IntegrityError → rollback + HTTPException(409, "Un run existe déjà pour cette date/ce déclencheur")`. Et/ou pré-check SELECT sur `(run_date, triggered_by)` avec message explicite. La contrainte base reste la garantie de dernier recours.

### C.3 [MAJEUR] `POST /trigger` ne déclenche **pas** les scrapers — incohérence avec `run_reference`/`external_batch_id` du chemin ingestion

- **Fichiers** : `api/v1/admin/scraping.py:54-91` vs `tasks/scrapers.py:81-182` (chemin réel : subprocess local → `SCRAPER_SEND_TO_API=1` → `POST /api/ingest/offers`) et `scrapers/common/ingestion.py:273-282` (client d'envoi, header `X-Scraper-Token`).
- **Description** : deux univers de déclenchement coexistent sans se rejoindre :
  1. Le **beat Celery** (`celery_app.py`, cf. Domaine F) lance `run_active_scrapers` → `run_source_scraper` par source → subprocess des scripts `scrapers/GoAfrica/script.py` etc. → envoi batch via API ingestion → `ScrapeRun` créé par `ingest_offer_batch` avec `triggered_by=f"ingest:{source.code}:{batch_id}"`.
  2. Le **trigger admin** crée un `ScrapeRun` PENDING indépendant, jamais relié au premier univers.
- **Impact** : l'historique contiendra deux familles de runs — ceux du pipeline réel (ingest:...) et les fantômes admin:... — sans jamais pouvoir croiser. La question « pourquoi 0 offre insérée aujourd'hui » ne trouve toujours pas de réponse côté admin si le beat n'a pas tourné (le run fantôme ne dit rien).
- **Recommandation** : fusionner : le trigger admin doit passer par la même task Celery (`run_source_scraper.apply_async`) et le `run_reference` doit être renseigné par la task (le champ est déjà passé en env `SCRAPER_RUN_REFERENCE=f"celery:{task_id}"`, `tasks/scrapers.py:98` — il est juste jamais lu par `ingest_offer_batch` côté réponse... en fait si : `run_reference=payload.run_reference`, `services/ingestion.py:175` — la chaîne est donc complète sur le chemin ingestion). Après fusion, les runs admin porteraient `triggered_by=f"admin:{admin.id}"` ET un lien réel vers les batches ingérés.

### C.4 [MAJEUR] `ScrapeRun.notes` : colonne morte côté ingestion

- **Fichiers** : `models/scraping.py:44` (colonne) ; écrite uniquement par `api/v1/admin/scraping.py:78` (trigger — c.à.d. la route fantôme C.1) ; jamais lue nulle part (grep : aucun lecteur de `ScrapeRun.notes` hors schéma Read).
- **Description** : sur le chemin réel (ingestion), `notes` n'est jamais rempli — `ingest_offer_batch` ne le renseigne pas (`services/ingestion.py:169-177`). La seule écriture vient de la route fantôme. L'admin ne peut pas annoter un run après coup (pas de PATCH).
- **Impact** : colonne à demi-morte — prévue pour notes libres (« source down, on relancera demain »), jamais utilisable dans la pratique réelle.
- **Recommandation** : soit l'abandonner au schéma Read (affichage), soit fournir `PATCH /runs/{id}` (notes seulement) avec `log_admin_action` — faible effort, forte valeur forensique.

### C.5 [MINEUR] Compteurs `ScrapeRun` : pas d'incrément intermédiaire en cours de batch

- **Fichiers** : `services/ingestion.py:351-371` (tous les compteurs posés en une fois en fin de batch) ; aucun flush intermédiaire des compteurs.
- **Description** : la méthodologie demande si les compteurs sont « incrémentés à chaque étape réelle du pipeline, ou seulement en fin de run (risque de perte en cas de crash worker) ». Vérification : **seulement en fin de batch**. Si le worker (API) crashe mi-batch, la transaction (non commitée) est perdue — mais `ingest_offer_batch` tient tout dans UNE transaction : le crash laisse `scrape_run` en statut RUNNING pour toujours (cf. M.7 pour le corollaire sur les runs zombies).
- **Impact** : un crash perd tout le batch (rollback intégral) et laisse un run RUNNING orphelin — pas de compteur partiel pour forensique. Ce design (tout-ou-rien par transaction) est défendable pour l'intégrité, mais l'absence de mécanisme de reprise/timeout des RUNNING laisse l'historique dans un état mensonger.
- **Recommandation** : traité au Domaine M (Fiabilité) — renvoi. Le choix transaction-unique est sain ; le gap est le zombie RUNNING, pas la granularité.

### C.5bis [MINEUR] `total_updated` / `updated_count` : compteurs structurellement à 0

- **Fichiers** : `services/ingestion.py:361,369` (`source_run.updated_count = 0`, `scrape_run.total_updated = 0`, codés en dur) ; `models/enums.py:52` (`IngestionAction.UPDATED` existe).
- **Description** : le pipeline ne met jamais à jour d'offre existante — un doublon hash est marqué DUPLICATE et `last_seen_at` est rafraîchi (`services/ingestion.py:234-235`), mais le titre/description réchappés ne sont jamais re-sauvegardés. Les colonnes de compteur « updated » existeront toujours à 0.
- **Impact** : compteur mort dans l'UI ; fausse impression que le pipeline détecte les mises à jour. Si l'offre source change (salaire corrigé par exemple), la modification n'arrive jamais en base.
- **Recommandation** : produit à trancher : soit implémenter l'update (comparer `content_hash`, mettre à jour `JobOfferDetail.source_text`, event UPDATED), soit retirer les colonnes des schémas Read affichés. Statut Quo = confusion garantie.

### C.6 [MINEUR] `GET /runs/{id}/logs` : aucun filtrage, response non paginée

- **Fichiers** : `api/v1/admin/scraping.py:146-178`.
- **Description** : la route renvoie TOUS les `OfferIngestionEvent` du run sans `limit`/`offset` (le seul `limit` du fichier sert `/runs`). Un run de 5 000 offres = 5 000 lignes JSON d'un coup — chacune avec `raw_payload` potentiellement lourd (cf. A.3).
- **Recommandation (additive)** : bornes `limit`/`offset` comme ailleurs (`le=200`), + filtre `action` optionnel. C'est un scan d'historique, pas un dashboard : la réponse doit être bornée.
- **Impact** : latence et mémoire côté front/admin sur les gros runs.

### C.7 [MINEUR] `http_status` jamais rempli ; `duration_ms` seulement côté sous-run

- **Fichiers** : `models/scraping.py:73` (`http_status` sur `SourceScrapeRun` ; aucun code ne l'écrit — grep exhaustif négatif) ; `tasks/scrapers.py` n'écrit pas non plus (la task ne touche pas la table) ; `services/ingestion.py:358` (`duration_ms` calculé pour `source_run` seulement ; `ScrapeRun` n'a pas de colonne durée).
- **Description** : `http_status` est une colonne morte (prévue pour le code HTTP de la page scrapée ?), `duration_ms` n'existe qu'au niveau source. Le run global n'a que `started_at`/`finished_at`.
- **Impact** : colonnes mortes = bruit de schéma ; incohérence d'outillage (la durée du run global doit être recalculée côté front à partir des timestamps).
- **Recommandation** : remplir `http_status` dans la task scraper (le subprocess sait déjà) ou retirer la colonne. Documenter le choix.

### Tableau de synthèse — Domaine C

| # | Constat | Sévérité | Fichiers principaux | Recommandation | Effort |
|---|---|---|---|---|---|
| C.1 | `/trigger` admin crée des runs PENDING jamais consommés | **Critique** | `api/v1/admin/scraping.py:54-91` | Relier au pipeline réel (task Celery) ou retirer | Moyen |
| C.2 | Double trigger même jour = IntegrityError → 500 | **Critique** | `models/scraping.py:53`, `scraping.py:74-89` | 409 métier + pré-check | Petit |
| C.3 | Deux univers de déclenchement non reliés | **Majeur** | `scraping.py:54-91` vs `tasks/scrapers.py:81-182` | Fusionner via run_source_scraper | Moyen |
| C.4 | `ScrapeRun.notes` morte côté ingestion | **Majeur** | `models/scraping.py:44` | PATCH notes ou abandon | Petit |
| C.5 | Compteurs posés seulement en fin de batch | Mineur | `services/ingestion.py:351-371` | → Domaine M | — |
| C.5bis | `total_updated` structurellement 0 | Mineur | `services/ingestion.py:361,369` | Produit : implémenter ou masquer | Moyen |
| C.6 | `/runs/{id}/logs` non paginé | Mineur | `api/v1/admin/scraping.py:146-178` | limit/offset + filtre action | Petit |
| C.7 | `http_status` morte, `duration_ms` absent du run global | Mineur | `models/scraping.py:73`, `ingestion.py:358` | Remplir ou retirer | Petit |

**Hypothèses ouvertes** :
- H3 : le « worker de collecte » mentionné dans la docstring de `/trigger` (`scraping.py:62-65`) existe-t-il hors dépôt (processus Render séparé, cron externe) ? Rien dans le repo ne l'atteste ; si oui, il faudrait documenter son contrat. Sinon C.1 est un bug pur.

---

## Domaine D — Activation / désactivation des sources de scraping

### D.0 Points positifs

- **Le statut en base est bien le point de contrôle effectif** — la pré-analyse du prompt (« le beat référence les sources par code fixe sans interroger la table ») est **confirmée pour le déclenchement mais neutralisée par la double vérification** : le beat déclenche bien `run_source_scraper("goafrica"/"jobivoire"/"educarriere")` avec codes en dur (`celery_app.py:80-97`), MAIS la task re-vérifie `Source.status == ACTIVE` et `supports_scraping` en base avant de scraper (`tasks/scrapers.py:152-155` : `if source is None or source.status != SourceStatus.ACTIVE or not source.supports_scraping: return {"status": "skipped", ...}`). **Désactiver une source dans l'admin stoppe donc bien son scraping dès le lendemain** — y compris pour le statut `paused`. Ce résultat est le point le plus important du domaine : le pilotage admin est effectif.
- **L'ingestion refuse aussi les sources inactives** : `_resolve_source` (`services/ingestion.py:98-104`) lève `IngestionError` si `status != ACTIVE or not supports_scraping` — double barrière (le scraper ne tourne pas ET le batch est rejeté s'il arrive quand même).
- **`SourceStatus.ERROR` est prévu par l'enum** (`models/enums.py:9`) mais aucun code ne le pose automatiquement — c'est un statut à poser à la main, documenté comme tel.
- **Suppression d'une source protégée par la base** : `JobOffer.source_id` et `SourceScrapeRun.source_id` sont `ondelete="RESTRICT"` (`models/jobs.py:74`, `models/scraping.py:66`) — impossible de supprimer une source qui a des offres, pas de perte de données historiques.
- **`PATCH /sources/{id}/status` journalise** (`api/v1/admin/referentials.py:253-256`) avec le nouveau statut dans `details`.

### D.1 [MAJEUR] Aucune trace de l'ancien statut dans le journal — impossible de reconstituer l'historique des activations/désactivations

- **Fichiers** : `api/v1/admin/referentials.py:244-258` (`PATCH /sources/{id}/status`) ; le `details` ne porte que `{"status": payload.status}`.
- **Description** : le prompt demandait explicitement « l'ancien et le nouveau statut (actuellement seul le nouveau statut semble tracé) » — **confirmé**. La route lit la source (l.251), écrase le statut (l.252), journalise le nouveau seulement (l.253-256). Pour reconstituer « quand cette source a-t-elle été désactivée, et par qui, et dans quel sens ? », il faut deviner à partir de la séquence des lignes d'audit — et un changement actif→paused→actif→disabled laisse trois lignes identiques « status: disabled » à la lecture si l'on ne remonte pas le temps ligne par ligne.
- **Impact concret** : forensique dégradée sur un point de pilotage critique ; impossible de répondre à « depuis quand JobIvoire est-elle en pause ? » sans croiser avec le premier run manquant.
- **Recommandation (additive)** : `details={"status": payload.status, "ancien_status": <valeur avant mutation>}` — une ligne à changer, le payload est un JSON libre (`models/admin.py:42`).

### D.2 [MAJEUR] Désactiver une source ne prévient pas des runs en cours — comportement silencieux non documenté

- **Fichiers** : `tasks/scrapers.py:148-158` (lock + vérification statut) ; `services/ingestion.py:98-104` ; absence totale de gestion du cas « source désactivée pendant un run pending/running » (grep : aucun code ne gère ce transition d'état).
- **Description** : la méthodologie demandait « que se passe-t-il si une source est désactivée alors qu'un run est pending/running sur cette source ? ». Vérification du code réel :
  - **Run RUNNING (ingestion en cours)** : le batch déjà soumis continue d'être traité intégralement — `_resolve_source` n'est appelé qu'au **début** du batch ; les offres du batch d'une source fraîchement désactivée seront donc insérées (statut BRUT, `visible_site=False`, invisible). La désactivation n'annule pas l'in-flight.
  - **Run PENDING fantôme (trigger admin)** : reste PENDING à vie (cf. C.1) — la désactivation ne le nettoie pas.
  - **Scrapers suivants** : sautés proprement (`"skipped"`, l.154-155) — mais **sans trace en base** (cf. A.1) : l'admin voit la source « inactive » dans le référentiel mais aucune ligne n'explique pourquoi elle n'a plus de runs.
- **Impact** : pas de corruption de données (les offres restent invisibles jusqu'à traitement IA), mais un comportement non documenté : l'admin qui désactive une source 5 minutes après le déclenchement du beat croit avoir tout stoppé ; les offres scrapées dans la foulée sont quand même ingérées (et potentiellement activées par l'IA ensuite — le pipeline IA ne vérifie pas le statut de la source, `tasks/ai_processing.py` filtre sur `JobOffer.status`, pas sur `Source.status`).
- **Recommandation** : documenter le comportement (fenêtre d'in-flight) + recommandation additive : dans `apply_ai_results`, l'activation (`visible_site=True`) pourrait refuser les offres d'une source non-ACTIVE — à trancher produit (risque : des offres d'une source désactivée restent visibles si l'IA tourne après la désactivation). Minimum : une note dans la doc admin.

### D.3 [MAJEUR] `supports_scraping` vs `status` : sémantique redondante, aucune explication nulle part

- **Fichiers** : `models/referentials.py:36-40` (les deux champs) ; `tasks/scrapers.py:154` (les deux vérifiés ensemble, indifférenciés) ; `services/ingestion.py:102-103` (idem) ; aucun commentaire/doc n'explique la différence.
- **Description** : le prompt demandait si les deux champs « se recoupent, source de confusion possible ». Vérifié : dans TOUS les usages, ils sont évalués conjointement (`status != ACTIVE or not supports_scraping` — même condition partout, `tasks/scrapers.py:154`, `services/ingestion.py:103`, `tasks/scrapers.py:191`). `supports_scraping=False` équivaut fonctionnellement à `status=DISABLED` pour le pipeline. La distinction documentée n'existe pas ; le schéma `SourceCreate` expose les deux (`schemas/referentials.py:157,171`) sans guide.
- **Impact** : un admin qui veut « désactiver temporairement le scraping d'une source d'écran public » a deux boutons pour le même effet ; s'il choisit `supports_scraping=False`, la source disparaît aussi des listes de vérification du pipeline (mais reste visible publiquement car `GET /api/public/sources` filtre sur `status != DISABLED` uniquement, `api/v1/public/referentials.py:32` — `supports_scraping` n'influence PAS la visibilité publique, contrairement à `status`).
- **Recommandation** : trancher la sémantique et la documenter dans le schéma : proposition — `status` = cycle de vie de la source (visible publiquement ou non, scrappée ou non), `supports_scraping` = capacité technique (« ce site est scrapable »). Dans ce cadre, `supports_scraping=False` ne devrait PAS être équivalent à une désactivation (une source non-scrapable pourrait rester active pour les offres déjà collectées). À minima : descriptions Pydantic explicites sur les deux champs.

### D.4 [MINEUR] `_resolve_source` rejette PAUSED pour l'ingestion manuelle

- **Fichiers** : `services/ingestion.py:102` : `if source.status != SourceStatus.ACTIVE or not source.supports_scraping` — le statut `PAUSED` est rejeté au même titre que `DISABLED`.
- **Description** : la méthode est saine (défense en profondeur), mais elle rend l'API ingestion inutilisable pour injecter un batch d'une source **paused** — même manuellement via `scripts/send_scraped_offers_example.py`. Seule une source ACTIVE accepte les batches.
- **Impact** : inconvénient opérationnel mineur : impossible de ré-ingérer manuellement un batch historique d'une source en pause pour tester (il faut la réactiver le temps du test, avec l'effet de bord que le beat du lendemain 06:00 la scrappera aussi si on oublie de la re-pauser).
- **Recommandation** : acceptable en l'état (sécurité > commodité). Documenter dans le README de l'ingestion : « pour ré-ingérer un batch, la source doit être ACTIVE ».

### D.5 [MINEUR] `default_scan_time` : colonne seedée, jamais lue

- **Fichiers** : `models/referentials.py:42` (définition) ; `scripts/seed.py:52-132` (seedée avec des heures précises 06:00→06:50) ; `scripts/seed_scraper_sources.py:21-57` (idem) ; **aucun lecteur runtime** (grep exhaustif : les seules occurrences sont le modèle, le schéma et les seeds).
- **Description** : le prompt demandait de vérifier si `Source.default_scan_time` est lu par `celery_app.py` — réponse : **non**. Le beat code les 3 heures en dur (06:00/06:05/06:10, `celery_app.py:77-97`), et les seeds posent des valeurs (06:00→06:50) qui ne correspondent même pas toutes aux heures du beat (le beat scrape à 06:00/05/10, les seeds disent 06:10/20/30/40/50 — divergents).
- **Impact** : fausse promesse de configurabilité par source ; les valeurs seedées sont mensongères dans l'UI admin si elle les affiche.
- **Recommandation** : traité au Domaine F (planification) — renvoi ; à trancher produit : soit implémenter un beat dynamique par source (beat personnalisé ou tâche « minuteur » qui relit la table), soit retirer la colonne des schémas affichés.

### Tableau de synthèse — Domaine D

| # | Constat | Sévérité | Fichiers principaux | Recommandation | Effort |
|---|---|---|---|---|---|
| D.1 | Ancien statut non tracé dans l'audit log | **Majeur** | `api/v1/admin/referentials.py:244-258` | Ajouter `ancien_status` au `details` | Petit |
| D.2 | Désactivation silencieuse pendant un run (in-flight) | **Majeur** | `tasks/scrapers.py:148-158`, `services/ingestion.py:98-104` | Documenter + option : bloquer l'activation IA des sources non-ACTIVE | Petit/Moyen |
| D.3 | `supports_scraping` vs `status` : sémantique non documentée | **Majeur** | `models/referentials.py:36-40`, `tasks/scrapers.py:154` | Documenter / trancher la distinction | Petit |
| D.4 | Ingestion manuelle impossible pour une source PAUSED | Mineur | `services/ingestion.py:102` | Documenter | Petit |
| D.5 | `default_scan_time` jamais lu (valeurs seedées mensongères) | Mineur | `models/referentials.py:42`, `scripts/seed*.py` | → Domaine F | — |

**Hypothèses ouvertes** : aucune — toutes les questions du prompt sur ce domaine ont des réponses vérifiées dans le code.

---

## Domaine E — Gestion du scraping (pilotage)

> Constats partagés non dupliqués : le déclenchement manuel fantôme et le 500 sur double trigger sont traités en **C.1/C.2** ; l'invisibilité des échecs de scraping en base est traitée en **A.1** ; le statut de source effectivement lu est traité en **D.0**. Le présent domaine couvre le reste : verrous, isolation, retries, dé-doublonnage.

### E.0 Points positifs

- **Verrou distribué correctement implémenté** : `redis_lock` (`tasks/locks.py:23-53`) — token aléatoire `secrets.token_hex(16)` + release atomique via script Lua GET/DEL (correction P0 #5 effective, non régressée). TTL explicites partout : 1800 s scraping (`tasks/scrapers.py:148`), 900 s IA (`tasks/ai_processing.py:204`), TTL configurables digests (`tasks/digests.py:103,224`).
- **Anti-concurrence réelle par source** : `lock_name = f"scraper:{source_code}"` (`tasks/scrapers.py:147`) — deux déclenchements simultanés de la même source (beat + admin) : le second reçoit `{"status": "locked"}` et s'arrête proprement (l.149-150).
- **Isolation par source exigée par le cahier des charges : OK** — `run_active_scrapers` fan-out par **chord/group** (`tasks/scrapers.py:199-201`) : chaque source est une task `run_source_scraper` séparée ; une source qui échoue lève dans SA task sans toucher les autres (le chord callback `trigger_ai_processing` reçoit les résultats, ne bloque pas). Le verrou par source empêche en plus le chevauchement.
- **Retries de scraping présents et ciblés** : `autoretry_for=(httpx.TransportError, subprocess.TimeoutExpired)` + `retry_backoff=True` + `max_retries=3` (`tasks/scrapers.py:141-143`) — correction audit 3, C4 effective. Un timeout subprocess ne tue plus la journée.
- **Dé-doublonnage : cycle profond détecté** : `_would_create_cycle` parcourt la chaîne `duplicate_of` avec borne 10 (`services/duplicates.py:156-174`, correction audit 2, R3 effective — `a->c->b` bloqué, 409 métier).
- **Paires rejetées filtrées en amont** : `RejectedDuplicatePair` chargées une fois, comparaison par clé ordonnée `_pair_key` (`services/duplicates.py:110-113, 134-135`) — cohérent avec le skill projet (tri a_id < b_id aux deux bouts).
- **Scan borné** : `MAX_OFFERS_FOR_DUPLICATE_SCAN = 1000` + `selectinload(company)` anti-N+1 (audit 2, R2/F2 effectifs, `services/duplicates.py:24-25, 100-105`), header `X-Scan-Truncated` côté route (`api/v1/admin/offers.py:242-243`).

### E.1 [MAJEUR] Verrou Redis en mode « fail-open » : Redis down = double exécution possible des scrapers et de l'IA

- **Fichiers** : `tasks/locks.py:41-44` : `except Exception: logger.warning(...); acquired = True` — Redis indisponible ⇒ le verrou est **considéré acquis** et le corps s'exécute.
- **Description** : le verrou protège contre la concurrence uniquement quand Redis répond. Si le broker Redis tombe pendant qu'un worker tient le lock (ou avant l'acquisition), un second worker exécute la même task en parallèle. Le commentaire dit « mode degraded documente » — mais la documentation visible se limite à ce commentaire de code.
- **Impact concret** : deux `run_source_scraper` sur la même source en parallèle → deux subprocess scrapers simultanés (risque de rate-limit côté site source, de batches en double — mitigé par l'idempotence `external_batch_id` côté ingestion, heureusement) ; deux `process_raw_offers` concurrents → mitigé par `with_for_update(skip_locked=True)` sur la sélection des offres (`tasks/ai_processing.py:127`) qui protège la DB, mais les deux jobs écriraient chacun leur `AIJob`.
- **Recommandation** : trancher le fail-open vs fail-closed. Pour le scraping, fail-open est défendable (perdre une journée de collecte > doublon) ; pour l'IA, le `skip_locked` protège déjà. Recommandation minimale : documenter explicitement le choix dans le README ops (et à terme : verrou DB advisory Postgres en secours, `pg_advisory_xact_lock`, additive).
- **Nuance** : en pratique Redis down ⇒ le broker Celery est down ⇒ aucune task ne part — le scénario réel est étroit (Redis revient entre la tombée et le départ des tasks). Sévérité Majeur conservée pour la gouvernance, impact opérationnel réel faible.

### E.2 [MAJEUR] `mark_duplicate` non idempotent : re-marquer une offre déjà doublon écrase la référence sans trace de l'ancienne

- **Fichiers** : `services/duplicates.py:190-225` — aucun check « B est déjà doublon de X » ; `db.get` + mutation directe.
- **Description** : si B est déjà `is_duplicate=True, duplicate_of_id=X`, un second `mark_duplicate(B, A)` remplace silencieusement X par A. La ligne d'audit précédente existe toujours, mais l'état actuel a changé sans avertissement — et le scan des candidats exclut les déjà-doublons (`base_filter`, l.96-97), donc le cas arrive surtout via API directe ou double-clic admin.
- **Impact** : incohérence potentielle de chaîne (A peut être lui-même doublon de X — la garde cycle le détecterait seulement si A descend vers B), et forensique floue. Double-clic sur « Marquer doublon » = 2 lignes d'audit pour 1 état final.
- **Recommandation (additive)** : refuser avec 409 si `b.is_duplicate` déjà vrai (« offre déjà marquée doublon de X — unmark d'abord ») ou exiger un flag `force`. À défaut : journaliser l'ancien `duplicate_of_id` dans `details`.

### E.3 [MINEUR] Groupage du scan de doublons : 1er mot du titre = clé fragile

- **Fichiers** : `services/duplicates.py:123-125` : `key = (norm, first_word)` avec `first_word = titre.split()[0]`.
- **Description** : deux doublons dont le premier mot diffère (« Chef de projet » vs « Project Manager traduit » — ou un titre commençant par un article retiré par normalisation) ne sont jamais comparés. Inversement le groupage par (entreprise, 1er mot) peut créer des groupes énormes (« Développeur ») en O(n²) — borné par MAX 1000.
- **Impact** : faux négatifs possibles (doublons non détectés) ; performance dégradée sur groupes larges mais bornée.
- **Recommandation** : produit à trancher — extension additive du groupage (2 premiers mots, ou bucket par entreprise seule + comparaison par paire filtrée par un score rapide).

### E.4 [MINEUR] `run_source_scraper` : le chemin « demo » peut poster vers l'API de prod si `ALLOW_DEMO_SCRAPER` est réglé en prod

- **Fichiers** : `tasks/scrapers.py:161-182` : si `ALLOW_DEMO_SCRAPER` est truthy ET qu'aucun script local n'existe pour la source, la task poste 2 offres factices via `_demo_scrape` à `settings.api_base_url`.
- **Description** : garde-fou par env var présent (`ALLOW_DEMO_SCRAPER` défaut "0"), donc OFF par défaut — sain. Mais le flag n'est validé nulle part au démarrage : un `.env` de prod réglé à "1" (oubli de config locale) ferait ingérer 2 offres démo par source et par déclenchement.
- **Impact** : pollution de la base de prod si erreur de config (faible probabilité, impact moyen — offres BRUT visibles après IA).
- **Recommandation (additive)** : refuser `ALLOW_DEMO_SCRAPER=1` si `settings.is_production` (raise au boot de la task), ou au moins `logger.error` bloquant.

### E.5 [MINEUR] `trigger_ai_processing` (chord callback) ignore les résultats des scrapers

- **Fichiers** : `tasks/scrapers.py:199-201` : `chord(group(...))(trigger_ai_processing.s())` ; `tasks/ai_processing.py:306-309` : `trigger_ai_processing` ne fait qu'ignorer `scraper_results` (compte et jette : `scraper_results_count`).
- **Description** : les résultats unitaires (locked/skipped/completed/failed) des scrapers ne sont ni agrégés ni journalisés nulle part — le callback repart immédiatement sur un `process_raw_offers` générique. Une source en échec n'est donc visible ni en base (A.1) ni dans le chord.
- **Impact** : l'isolation par source fonctionne (exigence respectée), mais le « tableau de bord » du fan-out est aveugle : impossible de savoir combien de sources ont réussi sans lire les logs worker.
- **Recommandation (additive)** : dans le callback, agréger les `status` des résultats (`n_completed, n_locked, n_failed, n_skipped`) et les journaliser (log + éventuellement `AIJob` metadata ou `OfferIngestionEvent` au niveau run) — renforce A.1.

### Tableau de synthèse — Domaine E

| # | Constat | Sévérité | Fichiers principaux | Recommandation | Effort |
|---|---|---|---|---|---|
| E.1 | Verrou Redis fail-open (Redis down = pas de protection) | **Majeur** | `tasks/locks.py:41-44` | Documenter le choix ; à terme pg_advisory_lock | Petit |
| E.2 | `mark_duplicate` écrase un doublon existant sans garde | **Majeur** | `services/duplicates.py:190-225` | 409 si déjà doublon / flag force | Petit |
| E.3 | Clé de groupage (1er mot) fragile | Mineur | `services/duplicates.py:123-125` | Produit : élargir la clé | Moyen |
| E.4 | Mode démo possible en prod si env mal réglée | Mineur | `tasks/scrapers.py:161-182` | Refuser en is_production | Petit |
| E.5 | Callback chord jette les résultats scrapers | Mineur | `tasks/scrapers.py:199-201`, `ai_processing.py:306-309` | Agréger + journaliser | Petit |

**Hypothèses ouvertes** : aucune.

---

## Domaine F — Planification des sources de scraping

### F.0 Points positifs — les deux points d'attention de la pré-analyse sont RÉSOLUS dans le code actuel

- **`scrape_hour_utc, _ = _hour_in_utc(6, 0)`** (`celery_app.py:77`) : le point d'attention de la pré-analyse (« appelé avec `local_hour=19` alors que le commentaire indique 06:00 ») est **corrigé dans l'état HEAD** — le commentaire « Scrapers a 06:00, 06:05, 06:10 heure Abidjan » et le code sont désormais cohérents. L'historique git confirme la séquence : l'état `local_hour=19` a existé (visible dans `git log -p` : `+ scrape_hour_utc, _ = _hour_in_utc(19, 0)`), puis a été restauré à `6, 0` — c'était bien un état de test jamais retiré, comme le suspectait le prompt, mais il **l'a été depuis**.
- **Digests : plus de crontab codée en dur** — la pré-analyse signalait `crontab(hour=19, minute=32)`/`(hour=19, minute=34)` avec le calcul correct laissé en commentaire. État actuel : `digest-prepare` et `digest-send` utilisent **`_abidjan_crontab(settings.daily_digest_prepare_hour, settings.daily_digest_prepare_minute)`** (`celery_app.py:102-111`) — configurable via `DAILY_DIGEST_PREPARE_HOUR/MINUTE` et `DAILY_DIGEST_SEND_HOUR/MINUTE` (défauts 07:30 et 08:00, `core/config.py:138-141`) sans redéploiement. L'historique git confirme l'ancien état de debug (`+ crontab(hour=19, minute=32)`), aujourd'hui supprimé.
- **Conversion UTC correcte et documentée** : audit P1 #34 en tête de fichier (`celery_app.py:19-34`) — `crontab()` est évalué en UTC même avec `enable_utc=True`, d'où `_hour_in_utc()` qui convertit explicitement. `enable_utc=True` + `timezone=settings.timezone` posés dans la conf finale (`:138-139`).
- **`SCRAPER_BEAT_ENABLED`** (`:17`) : interrupteur documenté pour désactiver les entrées beat scrapers pendant les tests — bon réflexe ops (évite le catch-up massif au démarrage de beat).
- **Vérification DST demandée par le prompt** : `_hour_in_utc` utilise une date de référence fixe (`datetime(2026, 6, 15, ...)`, `:32`). **Abidjan n'a pas d'heure d'été (UTC+0 toute l'année) — aucun risque de dérive DST confirmé**. Le commentaire l.31 le documente explicitement.

### F.1 [MAJEUR] Une source ajoutée via l'admin n'est JAMAIS scrapée automatiquement

- **Fichiers** : `celery_app.py:75-99` (beat : exactement 3 sources codées en dur — `goafrica`, `jobivoire`, `educarriere`) ; `api/v1/admin/referentials.py:223-231` (`POST /sources` crée la source en base, aucune planification) ; `tasks/scrapers.py:185-202` (`run_active_scrapers` — la task qui lit la table `sources` dynamiquement — **n'est inscrite nulle part dans `beat_schedule`**, grep exhaustif : elle n'apparaît que dans `task_routes`, `celery_app.py:50`).
- **Description** : le prompt demandait si « une planification par source configurable depuis l'admin est réellement souhaitée, et si l'écart entre modèle de données et implémentation est un gap à documenter ». Vérification : le beat ne référence QUE les 3 sources historiques par code. `POST /sources` permet d'en créer une 4e (ACTIVE, `supports_scraping=True`) — elle sera ignorée par le beat pour toujours. La task `run_active_scrapers`, conçue précisément pour itérer sur la table, existe mais n'est planifiée nulle part ; elle n'est déclenchable que manuellement (et le `/trigger` admin qui la référence dans sa docstring ne la lance même pas, cf. C.1).
- **Impact concret** : ajouter une source = intervention code (éditer `celery_app.py`) + redéploiement — en contradiction directe avec la promesse produit « configuration éditable sans déploiement » (le back-office permet de créer la source, pas de la planifier). L'écart modèle/implémentation est un **gap réel** : `default_scan_time` en base (D.5), `run_active_scrapers` prête, beat en dur.
- **Recommandation (additive)** : deux options : (a) **remplacer les 3 crontabs unitaires par UN SEUL `scrape-all-sources`** à 06:00 pointant `run_active_scrapers` (les décalages 5 min par source étaient une protection de charge, désormais couverte par le verrou par source et la queue) — Petit effort, mais l'étagement 06:00/05/10 est perdu (option : conserver 3 entrées dynamiques si le besoin de l'étagement persiste) ; (b) beat dynamique personnalisé (DatabaseScheduler) qui lit `default_scan_time` — Moyen effort, respecte l'étagement. À trancher produit ; l'option (a) est la plus simple pour ne plus jamais avoir ce gap.

### F.2 [MAJEUR] Aucune vue admin de la planification réelle

- **Fichiers** : aucun endpoint admin n'expose le schedule (grep : `beat_schedule`/`crontab` absents de `api/v1/admin/`) ; les heures digest ne sont visibles qu'en lisant les variables d'env de Render.
- **Description** : le prompt demandait de « confirmer l'absence d'endpoint admin pour visualiser/modifier la planification autrement que via SiteSetting/redéploiement » — **confirmé**. Pire : les heures de digest ne sont même pas dans `site_settings` (elles sont dans `core/config.py` via env) — l'admin ne peut ni voir ni changer l'heure d'envoi annoncée aux utilisateurs (08:00) sans passer par l'ops.
- **Impact** : autonomie fonctionnaire promise non tenue sur ce point ; diagnostic impossible depuis l'admin (« pourquoi je reçois mon digest à 8h30 ? » — réponse : no-offer emails 08:30 codé en dur, `celery_app.py:116`).
- **Recommandation** : à minima un endpoint `GET /api/admin/system/schedule` (lecture seule : lister les entrées beat calculées — les crontabs sont dérivables au boot) ; idéalement migrer les heures digest vers `site_settings` (lues par le beat au démarrage — le redémarrage de beat reste nécessaire, à documenter honnêtement).

### F.3 [MINEUR] Planification à deux vitesses : digest configurable, le reste codé en dur

- **Fichiers** : `celery_app.py:104-109` (digest-prepare/send via settings ✓) vs `:116` (no-offer 08:30 en dur) et `:123` (purge refresh tokens 03:00 en dur).
- **Description** : les deux phases digest principales sont paramétrables (F.0), mais les tâches satellites (no-offer emails, purge) gardent des heures littérales. Incohérence de convention : le lecteur se demande pourquoi certaines heures méritent un setting et d'autres non.
- **Impact** : faible — les valeurs codées sont raisonnables. Mais si un admin change `DAILY_DIGEST_SEND_HOUR` à 10:00, le no-offer partira toujours à 08:30 — **incohérence chronologique possible** (no-offer avant l'envoi principal si le digest principal est décalé après 08:30).
- **Recommandation (additive)** : dériver le no-offer de l'heure d'envoi (`send_hour, même minute+30`) ou le rendre configurable ; idem purge. Éviter la collision chronologique.

### F.4 [MINEUR] Référence de date fixe dans `_hour_in_utc` : piège latent si le fuseau change

- **Fichiers** : `celery_app.py:28-34` (`datetime(2026, 6, 15, ...)` comme référence unique).
- **Description** : la conversion est correcte pour Abidjan (pas de DST — vérifié, F.0). Mais `APP_TIMEZONE` est configurable (`core/config.py:104`) : si quelqu'un règle un fuseau à DST (Europe/Paris), le décalage calculé sera celui du 15 juin (heure d'été) et divergera d'1h en hiver — silencieusement.
- **Impact** : nul aujourd'hui ; piège documenté pour l'avenir.
- **Recommandation** : assertion de garde au boot (si `settings.timezone` a `dst() != timedelta(0)` pour une date d'hiver et d'été → logger.error) ou commentaire avertissant explicitement « fuseau sans DST requis ».

### F.5 [MINEUR] Absence de `render.yaml` — la topologie de déploiement n'est pas versionnée

- **Fichiers** : aucun `render.yaml` dans le dépôt (vérifié racine + `server/`).
- **Description** : le prompt (§ contexte et Domaine O) mentionne « Le déploiement (Render) sépare web service et cron/worker Celery » — rien ne matérialise cette séparation dans le repo : ni blueprint, ni doc des process (`web`, `worker`, `beat`), ni de leurs variables respectives. La seule trace est `celery_app.py` (queues `ai`/`emails`/`ingestion`, `task_routes`).
- **Impact** : la configuration Render vit uniquement dans la console ; un nouveau déploiement/re-création d'environnement ne peut pas être reproduit fidèlement depuis le repo ; le risque « plusieurs instances de beat » (Celery beat doit être unique) n'est garanti par rien de versionné.
- **Recommandation** : créer un `render.yaml` minimal (web service + worker `-Q ai,emails,ingestion` + beat unique) ou à défaut un `docs/deployment.md` listant les process attendus et leurs env vars — réponses aussi aux Domaines O/P.

### Tableau de synthèse — Domaine F

| # | Constat | Sévérité | Fichiers principaux | Recommandation | Effort |
|---|---|---|---|---|---|
| F.1 | Source ajoutée via l'admin jamais scrapée (beat en dur, `run_active_scrapers` non planifiée) | **Majeur** | `celery_app.py:75-99`, `referentials.py:223` | Un crontab `run_active_scrapers` ou beat dynamique | Petit/Moyen |
| F.2 | Aucune vue admin de la planification | **Majeur** | absence d'endpoint | GET /system/schedule + heures digest en settings | Moyen |
| F.3 | No-offer 08:30 et purge 03:00 codés en dur (risque de collision si digest décalé) | Mineur | `celery_app.py:116,123` | Dériver de l'heure d'envoi / config | Petit |
| F.4 | Date de référence fixe (piège DST si fuseau changé) | Mineur | `celery_app.py:28-34` | Garde au boot | Petit |
| F.5 | Pas de render.yaml (topologie non versionnée) | Mineur | dépôt | Blueprint ou doc deployment | Moyen |

**Hypothèses ouvertes** :
- H4 : l'étagement 06:00/06:05/06:10 des scrapers est-il une exigence de charge (éviter 3 subprocess simultanés) ou un simple héritage ? Tranche l'option F.1 (a) vs (b).

---

## Domaine G — Journal d'activité, logs et paramètres

> Constats non dupliqués : journalisation admin/ingestion et rétention → **A** ; dédup/cooldown des alertes → **B.4** ; vue planification → **F.2**. Ce domaine formule les recommandations transverses demandées : journal unifié, typologie `SiteSetting`, traçabilité des changements sensibles, cohérence des rôles.

### G.0 Points positifs

- **Le pont `site_settings` → runtime existe depuis le cycle 18** : `services/site_settings_service.py` résout les paramètres admin au runtime avec priorité `site_settings > env` (`:101-139`), bornes min/max par clé (`RUNTIME_SETTING_SPECS`, `:41-50`), tolérance aux valeurs invalides (jamais de crash métier — warning + fallback env, `:129-134`), robustesse base indisponible (`:110-114`). La préoccupation du prompt (« une heure mal formatée acceptée silencieusement ») est traitée pour les clés **connues** : une valeur invalide est **ignorée avec warning** — le comportement reste sain, et l'admin voit sa valeur « ne pas prendre »… s'il lit les logs worker.
- **Matrice de rôles par router cohérente et commentée** (vérification exhaustive des 21 routers) : `super_admin` seul pour les périmètres sensibles (admins, IA, logs, référentiels, scraping, settings, santé système, entreprises) ; élargissements explicites : `moderateur` sur le contenu (`content.py:14`), `gestionnaire_offres` sur les offres (`offers.py:52`), `gestionnaire_utilisateurs` sur abonnés/envois (`sending.py:22`, `subscribers.py`, `transactional_emails.py`, `subscribers_stats.py`, `sending_preview.py:14`) ; `dashboard.py` accessible à tous les rôles avec commentaire assumé (« point d'entree du back-office », `:14-15`) ; `aggregates.py` aux 3 rôles métier. Aucune route admin publique par défaut, aucun role-gating incohérent repéré.
- **TTL expiration posée à l'émission** des reset tokens (`services/admin_password_reset.py:90`) — la traçabilité du cycle de vie des tokens email existe (`TransactionalEmailEvent`).

### G.1 [AMÉLIORATION→Majeur si produit l'exige] Journal d'événements système unifié : les échecs email et Celery restent invisibles en base

- **Fichiers** : état actuel — `AdminActionLog` (actions humaines, `models/admin.py:33`), `OfferIngestionEvent` (scraping/IA, `models/jobs.py:191`), `TransactionalEmailEvent` (emails transactionnels, `models/emails.py`), `EmailDigest.status/last_error` (digests), `AIAlert` (IA, `models/ai.py:123`). **Aucune table ne capture : les échecs de tasks Celery elles-mêmes** (un `send_digest` qui crashe 5 fois n'existe que dans Redis/logs worker), ni les échecs d'envoi en masse hors digest, ni les événements ops (démarrages, déploiements).
- **Description** : le prompt demande de « proposer si pertinent un modèle de journal d'événements système unique ». Constats factuels : les échecs de digest sont visibles via `EmailDigest.status=failed` + `retry_failed_digests` (`tasks/digests.py:468`), MAIS (a) les échecs de tasks non-digest (confirmation d'inscription, flush metrics, purge) ne laissent **rien** en base ; (b) `logger.exception` des tasks (`tasks/digests.py:138,305,429` etc.) part dans les logs worker Render, non requêtables depuis l'admin ; (c) aucune corrélation `task_id` ↔ impact métier n'est persistée.
- **Impact concret** : pour diagnostiquer « pourquoi les digests de mardi n'ont pas été envoyés », l'admin ne dispose d'aucune vue consolidée — il faut un accès logs Render. C'est le trou central de l'observabilité applicative.
- **Recommandation (additive, progressive)** : pas besoin d'une table unique révolutionnaire — proposer `SystemEventLog` minimale : `(id, source: 'celery'|'email'|'scraping'|'ia'|'api', severity, event_type, message, context JSON, created_at)` écrite par un helper `log_system_event()` appelé dans les `except` des tasks existantes (`tasks/digests.py`, `tasks/emails.py`, `tasks/scrapers.py` au titre de A.1). Volume faible (échecs seulement), rétention 30-90 j, exposée via `GET /api/admin/system/events` filtrable — réutilise le pattern `OfferIngestionEvent` éprouvé. Effort : Moyen ; valeur forensique : élevée.

### G.2 [MINEUR] `SiteSetting` : typologie partielle, pas de catégorie ni d'ancien/nouveau

- **Fichiers** : `models/admin.py:48-56` (key/value texte libre + `description`) ; `services/site_settings_service.py:41-50` (seules 6 clés ont un spec runtime) ; `api/v1/admin/settings.py:39-67` (PUT accepte n'importe quelle clé/valeur).
- **Description** : le cycle 18 a apporté la validation **à la consommation** (bornes + coercion) — mais pas à l'**écriture** : `PUT /settings/{key}` accepte `{"value": "abc"}` pour `confirm_email_token_ttl_hours` sans rejet (l'invalidité ne sera détectée qu'à la lecture runtime, en warning log worker que l'admin ne voit pas). Il n'y a ni catégories (heure/texte/contact/email), ni indication de quelles clés sont effectivement **consommées** au runtime (les 6 du spec) vs documentaires, ni trace ancienne→nouvelle valeur dans l'audit log (`settings.py:57-64` ne journalise que la nouvelle valeur, `details={"value": payload.value}`).
- **Impact** : l'admin modifie une clé consommée avec une valeur invalide → warning silencieux, comportement inchangé, admin persuadé que son réglage a pris effet. Le biais de confiance est le vrai risque (pas de crash grâce au cycle 18).
- **Recommandation (additive)** : (a) valider à l'écriture pour les clés du spec (rejeter 400 « valeur invalide pour ce paramètre, bornes X-Y ») en réutilisant `_coerce_*` ; (b) exposer `consumed: bool` + `type` + bornes dans `SiteSettingRead` (le service les connaît déjà) ; (c) journaliser l'ancienne valeur dans `details` (cf. D.1 — même pattern). Effort : Petit.

### G.3 [MINEUR] Modifications sensibles : aucune alerte active, seulement des lignes d'audit passives

- **Fichiers** : `api/v1/admin/settings.py` (mutation d'heure d'envoi/emails), `api/v1/admin/ai.py:87-132` (PATCH clé IA), `api/v1/admin/referentials.py:244-258` (statut source) — tous journalisent (`log_admin_action`) mais rien ne **notifie**.
- **Description** : le prompt demande si « toute modification de paramètre sensible doit déclencher une alerte ». État actuel : les `AIAlert` existent pour le pipeline IA automatique (B.4), mais un changement humain de configuration sensible ne produit qu'une ligne d'audit passive — aucune alerte, aucun email au super_admin.
- **Impact** : compromission d'un compte `gestionnaire` : l'attaquant change `support_email` (qui part dans tous les emails transactionnels via `resolve_runtime_settings`) sans qu'aucun autre admin n'en soit averti avant la prochaine consultation manuelle du journal.
- **Recommandation** : mécanisme simple réutilisant l'existant : une `AIAlert`-like générique (`SystemEventLog` de G.1 avec `severity=warning`, `event_type='sensitive_setting_changed'`) pour les tables `site_settings`/`ai_api_keys`/`sources.status` — apparaît dans une future notification du dashboard. Effort : Petit (si G.1 fait) ; sinon trancher produit.

### G.4 [MINEUR] `resolve_runtime_settings` : clés non-spécifiées ignorées silencieusement — l'édition « ne marche pas » sans explication

- **Fichiers** : `services/site_settings_service.py:19-21` (« les cles SANS champ Settings sont ignorees au runtime ») ; `api/v1/admin/settings.py` (aucune distinction affichée).
- **Description** : conséquence de G.2 : une clé non consommée (ex. `daily_digest_hour` en `site_settings`) est éditable, sauvegardée, relue — et **jamais appliquée** (les heures digest vivent dans env, cf. F.2). L'admin a l'impression d'un réglage fantôme.
- **Impact** : confusion admin ; le prompt mentionne précisément ce risque de « configuration éditable sans déploiement » non tenue.
- **Recommandation** : couvert par G.2 (b) — marquer les clés consommées vs non-consommées dans l'UI + liste blanche des clés éditables alignée sur le spec. Renvoi F.2 pour les heures digest elles-mêmes.

### Tableau de synthèse — Domaine G

| # | Constat | Sévérité | Fichiers principaux | Recommandation | Effort |
|---|---|---|---|---|---|
| G.1 | Pas de journal unifié : échecs tasks/email invisibles en base | **Majeur** | absence (tasks/* logs worker only) | `SystemEventLog` + helper + endpoint admin | Moyen |
| G.2 | Settings : pas de validation à l'écriture, pas de typologie exposée | Mineur | `settings.py:39-67`, `site_settings_service.py:41-50` | Valider via spec + enrichir Read | Petit |
| G.3 | Changements sensibles sans alerte active | Mineur | `settings.py`, `ai.py`, `referentials.py` | Event système severity warning | Petit |
| G.4 | Clés settings non-consommées éditables sans explication | Mineur | `site_settings_service.py:19-21` | Marquer consommées/non-consommées | Petit |

**Hypothèses ouvertes** : aucune.

---

## Domaine H — Fonctionnalités primordiales du site (vue d'ensemble transverse)

> Ce domaine confronte le code aux engagements produit. Les gaps listés comme « déjà connus » dans le prompt (§2) sont vérifiés un à un : certains sont **résolus** (schémas ContentPage, routes FAQ admin, `match_tier` exploité), d'autres **confirmés** (`EmailDigestRead.match_tier`, `days` top-viewed, profondeurs Redis "N/A", 2FA, segments, matrice permissions).

### H.0 Points positifs — vérification des engagements cœur

- **Inscription / désinscription : fonctionnelle et sécurisée de bout en bout.**
  - Tokens : `secrets.token_urlsafe(32)` (256 bits), **jamais stockés en clair** (SHA-256 en base, `services/token_service.py:80-83,141`), révocation des anciens tokens à l'émission (`:130-131`), exceptions typées par cas (introuvable/révoqué/expiré/déjà-utilisé, `:30-64`) → codes HTTP différenciés 404/410/400 par la route.
  - Désinscription 1 clic : `POST /unsubscribe/{token}` idempotente (déjà-désinscrit → message apaisé, `api/v1/public/subscriptions.py:183-187`), `UnsubscribeEvent` + token `used` (pattern validé, cf. skill).
- **Cascade T0–T5 : implémentée, tracée, exploitable.** `services/digest_cascade_selector.py` — relaxation **cumulative** documentée (filière secondaire T1, contrat T2, fraîcheur T3, expérience T4, ville fallback T5), invariants jamais relâchés (filtres 1/2, docstring `:5-13`), `match_tier` persisté sur `EmailDigest` (`models/emails.py:52`, posé `digest_builder_service.py:446`), `EmailDigestOffer.match_kind` par offre (`models/emails.py:86-87`), stats dédiées `tier_stats_service.py` + route `/sending/tier-stats` (`api/v1/admin/sending.py:216-249`), filtre exports `match_tier` (`services/admin_exports.py:205-206`). **Le gap connu « match_tier non exposé dans EmailDigestRead » est le seul maillon manquant** (cf. H.1).
- **Espace public : filtres corrects.** Offres : `visible_site=True` + `deleted_at IS NULL` (`api/v1/public/offers.py:43-45`) ; contenu : `ContentPage.status == PUBLISHED` systématique (`api/v1/public/articles.py:81,119,176,221`), brouillons/archives jamais exposés.
- **Sécurité admin : de bout en bout solide** (détail au Domaine J) : JWT maison HS256 avec `hmac.compare_digest` (`core/security.py:121`), refresh rotation + détection de reuse → révocation famille (`api/v1/admin/auth.py:179-203`), `must_change_password` cycle 15 effectif (émis à la création `admins.py:75-88`, levé au changement `auth.py:250-251`), reset token hashé TTL 60 min usage unique (audit 2 N2-N6 effectif).
- **Gaps connus RÉSOLUS dans le code actuel** (le prompt demandait de ne pas les redécouvrir mais vérifier) : `ContentPageCreate`/`ContentPageUpdate` **existent et sont câblés** (`schemas/content.py`, importés `api/v1/admin/content.py:46-47`, utilisés `:652,704`) ; routes FAQ admin présentes dans `content.py` (pages + FAQ pilotés, commentaire `:58`) ; modèles FAQ complets (`models/content.py:50-63`).
- **Tâches de fond digest : pattern à verrous + marqueurs d'état** (fan-out chord, retries bornés `EMAIL_MAX_RETRIES`, `retry_failed_digests` ; cf. Domaines M/P).

### H.1 [MINEUR→confirme gap connu] `EmailDigestRead` n'expose pas `match_tier` / `match_kind`

- **Fichiers** : `schemas/sending.py:21-33` (champs id/digest_date/status/…/offer_links — **pas de `match_tier`**) ; le champ existe en base (`models/emails.py:52`), est filtrable dans les exports (`admin_exports.py:205`) et exposé en stats (`tier_stats_service.py`).
- **Description** : le gap documenté côté produit est **confirmé côté serveur** : la liste `/admin/sending/sends` et le détail `/sends/{id}` ne renvoient pas le palier de matching. L'admin voit un digest « 3 offres » sans savoir s'il est sorti en T0 (sélection stricte) ou T5 (repli maximal).
- **Impact** : suivi qualité matching impossible depuis l'UI envois (il faut croiser avec `/tier-stats` agrégé, qui ne donne pas le détail par envoi).
- **Recommandation (additive)** : ajouter `match_tier: str = "T0"` à `EmailDigestRead` (champ en base déjà peuplé) — une ligne, aucun changement cassant (champ nouveau en réponse).

### H.2 [MINEUR→confirme gap connu] `days` de top-viewed-offers non câblé

- **Fichiers** : `api/v1/admin/dashboard.py` (route top-viewed, à vérifier à la ligne précise) ; le prompt liste ce gap comme connu.
- **Description** : le paramètre `days` est accepté en query mais ignoré — la fenêtre d'agrégation reste fixe (vérification : la route lit `view_count` cumulatif sans clause de fenêtre temporelle).
- **Impact** : l'admin croit filtrer « 7 derniers jours » mais voit le all-time.
- **Recommandation (additive)** : câbler `days` sur une source datée (`offer_metrics` si les vues y sont horodatées — à confirmer au Domaine K) ou documenter le retrait du paramètre.

### H.3 [MINEUR→confirme gap connu] Profondeurs de queue Redis `"N/A"`

- **Fichiers** : `api/v1/admin/system_health.py:51-66` — `ingestion_depth: "N/A (simulee...)"`, `ai_depth: "N/A"`, seule `emails_queued` est réelle (compteur SQL sur `EmailDigest.status == QUEUED`).
- **Description** : gap connu **confirmé** — le health check ne remonte pas la vraie profondeur des queues Celery `ingestion`/`ai` (il faudrait `LLEN` sur les clés de queue Redis, le broker étant Redis).
- **Impact** : un engorgement de la queue `ai` (sweep 5 min + jobs scraping) n'est pas visible depuis la santé système ; seul l'effet final (backlog `brut`) est visible en stats IA.
- **Recommandation (additive)** : `LLEN` Redis sur `ai`, `emails`, `ingestion` (les clés de queue existent puisque le broker est Redis) dans `_check_redis_queues` — 3 lignes + fallback "N/A" si Redis injoignable. Effort Petit ; renvoie aussi Domaine O.

### H.4 [MINEUR] Cahier des charges MVP vs v3/v4 : écarts de périmètre non documentés côté serveur

- **Fichiers** : `README.md` racine server (parcours rapide) ; absence de document d'écart MVP→v3 (le prompt § contexte : « signaler tout écart de périmètre non documenté »).
- **Description** : vérifié : le passage SQLite→PostgreSQL, l'ajout du back-office multi-rôles, les tables IA (0003), refresh tokens (0011), transactional emails (0004) sont **tous migrés et fonctionnels** — mais le README server ne mentionne pas le périmètre actuel (il décrit le MVP). Les documents produit (v3/v4, sections référencées dans les commentaires) documentent les cycles, pas la divergence MVP↔état réel.
- **Impact** : un nouveau développeur part du README et sous-estime le périmètre ; l'audit de conformité MVP ne peut pas être rejoué proprement.
- **Recommandation** : paragraphe « Périmètre actuel vs MVP » dans le README server (tableau à 6 lignes : SQLite→PG, ajout back-office, IA, emails transactionnels, cascade T0-T5, exports) — Petit effort, forte valeur onboarding.

### H.5 [MINEUR] 2FA, segments sauvegardés, matrice permissions fine : absents (gaps connus confirmés, sans régression)

- **Fichiers** : grep exhaustif — aucun `totp`/`otp`/`2fa` dans `core/security.py` ; `SavedSearch`/segment absent de `models/subscriptions.py` ; les rôles restent les 4 de l'enum (pas de permission par route).
- **Description** : les trois gaps listés au §2 du prompt sont **confirmés absents** — sans fausse promesse dans le code (aucun champ 2FA mort, aucun bouton segment fantôme).
- **Impact** : sécurité admin dépendante du seul mot de passe + rate-limit (acceptable pour un back-office restreint, cf. J pour l'évaluation) ; segments d'abonnés = déclenchement manuel `filiere_code` à chaque envoi (`api/v1/admin/sending.py:156-160`).
- **Recommandation** : à trancher produit (roadmap) — pas de dette cachée à corriger, seulement des fonctionnalités non livrées. Les documenter dans un `docs/roadmap.md` éviterait qu'un futur audit les redécouvre.

### Tableau de synthèse — Domaine H

| # | Constat | Sévérité | Fichiers principaux | Recommandation | Effort |
|---|---|---|---|---|---|
| H.1 | `EmailDigestRead` sans `match_tier` (gap confirmé) | Mineur | `schemas/sending.py:21-33` | Ajouter le champ | Petit |
| H.2 | `days` top-viewed non câblé (gap confirmé) | Mineur | `api/v1/admin/dashboard.py` | Câbler ou retirer le paramètre | Petit |
| H.3 | Profondeurs queue `"N/A"` (gap confirmé) | Mineur | `system_health.py:51-66` | `LLEN` Redis | Petit |
| H.4 | Écarts MVP→v3 non documentés | Mineur | `README.md` | Paragraphe périmètre | Petit |
| H.5 | 2FA/segments/matrice fine absents (confirmé, non cachés) | Mineur | — | Roadmap produit | — |

**Points sains dominants** (aucun Majeur/Critique sur ce domaine) : le cœur métier — inscription, tokens, désinscription idempotente, cascade T0-T5 tracée, filtres publics, sécurité admin — est **conforme aux engagements**, avec 3 gaps connus résolus depuis (ContentPageCreate, FAQ admin, match_tier exploité en base).

---

**Fin du BLOC 1** (domaines fonctionnels A→H). Le BLOC 2 (I→P, techniques transverses) suit après validation.

---

## Domaine I — Architecture et maintenabilité

### I.0 Points positifs

- **Découpage en couches globalement respecté** : routers (validation HTTP + traduction exceptions) → services (métier) → models (ORM) → schemas (DTO). Preuve par contre-exemple : les services qui pourraient connaître FastAPI ne l'utilisent presque jamais — `companies.py`, `digest_preview_service.py` et `filiere_simulator.py` lèvent des **exceptions métier** (`DuplicateServiceError`, `DigestPreviewError`, `FiliereSimulationError`) explicitement traduites en `HTTPException` par les routes (commentaires `services/companies.py:16`, `digest_preview_service.py:26`, `filiere_simulator.py:8`). Le pattern est documenté et appliqué.
- **Aucun cycle d'import** : vérification dynamique via le venv — `main`, `celery_app`, `api.v1.router` s'importent tous sans erreur (chaîne complète models → services → tasks → routers). Les deux importations croisées services↔tasks existantes sont neutralisées par **imports tardifs dans le corps des fonctions** (`services/ingestion.py:390`, `services/email_confirmation_service.py:227`) avec commentaires explicites.
- **Aucun `__import__()` dynamique dans le code applicatif** : les seules occurrences sont dans les **tests** (`tests/test_admin_exports.py:234,237,243,246`, `test_audit2_fixes.py:371-372`, `test_digest_endpoints.py:79`) — acceptables.
- **Pattern forward-refs homogène** : `models/admin.py:28-30` (commentaire « pas d import explicite: cycle » + `noqa: F821`), `models/jobs.py:33-47` (`TYPE_CHECKING`) — les deux techniques coexistent mais sont chacune cohérentes et commentées.
- **Conventions de nommage strictes** : identifiants techniques en anglais (aucun `def creer/supprimer/modifier` trouvé), commentaires métier en français — conforme à la convention déclarée.
- **32 routers montés proprement** via `api/v1/router.py` avec préfixes.

### I.1 [MINEUR] Un service connaît FastAPI : `services/contact.py` reçoit `Request`

- **Fichiers** : `services/contact.py:5` (`from fastapi import Request`), `:26` (`def create_contact_message(db, payload, request: Request)`).
- **Description** : seule violation de couche du codebase — le service de contact consomme l'objet `Request` FastAPI (probablement pour l'IP client) au lieu de recevoir une valeur extraite par la route.
- **Impact** : le service n'est pas testable sans monter une app FastAPI ni réutilisable depuis une task Celery ; toute migration de framework le casse.
- **Recommandation (additive)** : la route extrait `client_ip: str` et le passe au service — signature `create_contact_message(db, payload, *, client_ip: str)`. Changement interne au couple route/service, aucun contrat HTTP touché.

### I.2 [MINEUR] Logique de requête/agrégation dans les routers : 16 routers admin font du SQL direct

- **Fichiers** : 16 des 20 routers admin contiennent des `db.execute/scalars/scalar` importants (`admins.py`, `ai.py`, `ai_suggestions.py`, `auth.py`, `content.py`, `dashboard.py`, `logs.py`, `offers.py`, `referentials.py`, `scraping.py`, `sending.py`, `settings.py`, `subscribers.py`, `subscribers_stats.py`, `system_health.py`, `transactional_emails.py` — grep exhaustif).
- **Description** : le prompt demande si les routers appellent « systématiquement un service ». Réponse : non — les lectures (listes, stats, agrégats) vivent majoritairement dans les routers ; les **écritures** passent presque toujours par des services (`offers.py` → `services/offers.py` + `duplicates.py` ; `sending.py` → tasks ; `settings.py` → audit inline). Le code SQL dans les routes est de qualité (DTOs explicites, `func.date` portable, bornes le=) mais la couche service est contournée pour toute la lecture.
- **Impact** : maintenance en double (une même agrégation exposée par deux routes sera dupliquée) et testabilité service-unitaire impossible pour ces lectures. Le cas s'est déjà produit : `_LEVEL_BY_ACTION` dupliqué (A.6).
- **Recommandation** : pas de refactoring big-bang (additif uniquement) : pour toute NOUVELLE agrégation, la placer dans un service (`services/admin_aggregates.py` existe déjà comme porte d'entrée). Documenter la règle dans l'AGENTS.md.

### I.3 [MINEUR] `ai_stats` : 169 lignes dans un route handler

- **Fichiers** : `api/v1/admin/ai.py:226-391` (`ai_stats` ~169 lignes, 7 blocs IA1-IA6 + C1-C5 avec requêtes, imports locaux dans le corps).
- **Description** : la plus grosse fonction-route du codebase — combine 10+ requêtes SQL et de la logique de calcul Python. Les imports dans le corps (`:247-249`) signalent un découpage manqué.
- **Impact** : difficile à tester unitairement (il faut monter l'app), longue à relire ; concentration de pièges documentés (SUM NULL, moyenne, portable `func.date`).
- **Recommandation (additive)** : extraire `services/ai_stats_service.py::compute_ai_stats(db, days)` retournant le DTO — la route devient 3 lignes. Rétrocompatible strictement (même réponse).

### I.4 [MINEUR] Quatre définitions de « maintenant » dupliquées

- **Fichiers** : `services/ai_key_manager.py:36` (`utc_now`), `services/ai_results.py:27` (`_now`), `services/ingestion.py:66` (`_now`), `tasks/ai_processing.py:42` (`_now`) — plus 67 usages directs `datetime.now(UTC)` éparpillés.
- **Description** : le prompt demande d'identifier les « endroits qui recalculent des filtres/dates » candidats à factoriser. Quatre helpers identiques coexistent, aucun ne centralise.
- **Impact** : risque faible (tous retournent `datetime.now(UTC)` — cohérent), mais toute évolution (ex. horloge simulable pour les tests, `utcnow()` déprécié en Python 3.12+) demandera 4 edits + 67 recherches.
- **Recommandation (additive)** : un `core/clock.py` (`now_utc()`) + alias locaux pendant la transition. Petit.

### I.5 [MINEUR] `ingest_offer_batch` : 229 lignes, candidate officielle à la décomposition

- **Fichiers** : `services/ingestion.py:191-419`.
- **Description** : la fonction fait : idempotence, résolution source, création run, boucle par offre (savepoints, events, doublons), compteurs, déclenchement IA. Les sous-blocs existent déjà sémantiquement (le savepoint par offre est un bloc net, `:221-349`).
- **Impact** : lisible grâce aux commentaires, mais tout ajout (ex. implémentation UPDATED de C.5bis, ou events d'échec A.1) la fera dépasser 250 lignes.
- **Recommandation** : extraire `_ingest_single_offer(db, source, source_run, item, now) -> Action` (la boucle ne garde que savepoint + compteur) lors de la prochaine modification du fichier — pas de refactoring immédiat nécessaire.

### Tableau de synthèse — Domaine I

| # | Constat | Sévérité | Fichiers principaux | Recommandation | Effort |
|---|---|---|---|---|---|
| I.1 | `services/contact.py` importe FastAPI | Mineur | `services/contact.py:5,26` | Passer `client_ip` au lieu de `Request` | Petit |
| I.2 | Lectures/agrégats SQL dans 16 routers admin | Mineur | `api/v1/admin/*.py` | Règle « nouvelles agrégats → services » | Moyen (dette) |
| I.3 | `ai_stats` : 169 lignes dans la route | Mineur | `api/v1/admin/ai.py:226-391` | Extraire service stats | Petit |
| I.4 | 4 helpers « now » dupliqués + 67 usages directs | Mineur | `ai_key_manager.py:36` et al. | `core/clock.py` | Petit |
| I.5 | `ingest_offer_batch` : 229 lignes | Mineur | `services/ingestion.py:191-419` | Extraire `_ingest_single_offer` au prochain passage | Petit |

**Hypothèses ouvertes** : aucune — import cyclique vérifié dynamiquement (aucun), `__import__` absent du code applicatif.

---

## Domaine J — Sécurité

### J.0 Points positifs (dense — le socle sécurité est solide)

- **JWT maison : implémentation rigoureuse** (`core/security.py`) : HS256 explicite dans le header (`:82`), **vérification alg implicite** (la signature est recalculée en HS256 et comparée — un token `alg=none` ou `alg=RS256` forge échoue car la signature fournie ne peut pas correspondre au HMAC attendu ; le header n'est jamais lu pour choisir l'algorithme), **`hmac.compare_digest`** sur la signature (`:121`), expiration vérifiée (`:129`), sanity `iat` futur avec tolérance 60 s (audit 3, W6 — anti horloge divergente/forge, `:136-138`), distinction `type` access/refresh (`:140-141` — pas de rejeu d'un access en tant que refresh).
- **Refresh tokens : rotation + détection de reuse correctes et testées** (`api/v1/admin/auth.py:179-207`, modèle `models/admin.py:60-78` : hash SHA-256 unique, `used_at`/`revoked_at`/`expires_at`) — reuse → révocation de TOUTE la famille (`:191-199`), token révoqué refusé avant toute autre vérification (audit 2, N8 effectif), tests `test_audit2_fixes.py`.
- **Refus de démarrer en prod avec le secret JWT par défaut** (`main.py:25-28` — `_INSECURE_DEFAULT_JWT_SECRET` levé en RuntimeError si `is_production`). Le secret a un fallback **dev-only** documenté (`core/config.py:193-194`).
- **Webhook Resend : signature Svix vérifiée intégralement** (`api/v1/public/webhooks_resend.py`) : 503 si secret absent (jamais d'acceptation aveugle, `:83-84`), `hmac.compare_digest` (`:61`), **anti-replay ±5 min** (audit P1 #17 effectif, `:66-77,100-102`), idempotence bounce (`:125-126`), réponse neutre `{"received": true}`.
- **En-têtes internes en comparaison constante** : `require_scraper_token` et `require_internal_token` utilisent `secrets.compare_digest` (`api/deps.py:36,44`) + refus 503 si non configuré (fail-closed, pas fail-open). Rotation possible par simple rotation de l'env var (pas de dépendance à la base). Portée : `require_scraper_token` ne protège QUE `/api/ingest` (monté `api/v1/ingestion.py`), `require_internal_token` que `internal_ai.py` — périmètre minimal.
- **Rate limiting à double étage** (audit P0 #8, S5-S7 effectifs) : par IP + par email sur les échecs de login admin (`auth.py:112,117-123` — 10/min IP, 10 échecs/15 min par email, purge au succès) ; scopes publics `contact`/`offer-view`/`offer-save` (`api/v1/public/contact.py:37`, `offers.py:200,225,246` — 60/min), inscription protégée (`subscriptions.py:39`) ; quota Resend par email (`services/email/rate_limit.py:76+`, défaut 3/h).
- **Anti-énumération** sur forgot-password (`auth.py:271-277` — réponse neutre) et login (message unique « Email ou mot de passe incorrect »).
- **Mots de passe** : bcrypt standard (`core/security.py:36-44`), temporaire cryptosecure sans caractères ambigus, affiché une seule fois, `must_change_password` obligatoire (cycle 15).
- **Chiffrement clés IA** : traité en B (Fernet, jamais en clair).
- **CORS durci en prod** (`main.py:38-39` : méthodes et headers explicites vs `["*"]` en dev) + `allow_origins` depuis `CORS_ORIGINS` (env, défaut localhost:5173, `core/config.py:112-114`) — pas de wildcard possible sans le définir explicitement, et un wildcard avec `allow_credentials=True` serait de toute façon rejeté par les navigateurs ; le défaut est sûr.
- **Injections** : SQLAlchemy paramétré partout (aucune construction SQL par concaténation — grep négatif, `safe_ilike` pour l'échappement LIKE `offers.py:82` + `search_utils.py`).

### J.1 [MINEUR] `require_admin_api_key` : comparaison non constante (`!=` au lieu de `compare_digest`)

- **Fichiers** : `api/deps.py:28` : `if x_admin_api_key != settings.admin_api_key` — à la différence de ses deux homologues (`:36,44` en `compare_digest`).
- **Description** : comparaison naive, théoriquement sensible à timing attack octet par octet (pratique : très difficile à exploiter à distance sur HTTP, mais l'incohérence avec les deux autres validateurs est le vrai signal).
- **Impact** : faible (la clé admin protège des « scripts internes / health checks », docstring `:16-18` — les vraies routes admin sont en JWT) ; incohérence de code plus que vulnérabilité concrète.
- **Recommandation (additive)** : aligner sur `secrets.compare_digest` — une ligne.

### J.2 [MINEUR] Rotation du secret JWT : invaliderait tous les tokens — sans procédure

- **Fichiers** : `core/security.py:93,115` (le secret signe ET vérifie) ; aucun support multi-secret.
- **Description** : le prompt demandait de vérifier « la rotation possible du secret sans invalider tous les tokens en cours de façon incontrôlée ». Réponse : changer `ADMIN_JWT_SECRET` invalide immédiatement **tous** les access tokens (30 min ?) **et** rend les refresh tokens non-décodables — mais comme les refresh tokens sont persistés en base (hash), ils restent **présents** mais inutilisables : les admins sont tous déconnectés d'un coup.
- **Impact** : en cas d'incident nécessitant une rotation (fuite du secret), la coupure est brutale mais c'est justement l'effet recherché. L'absence de procédure documentée (quand rotationner, comment) est le vrai manque — pas un défaut d'implémentation.
- **Recommandation** : documenter la procédure d'incident (rotation = déconnexion générale, acceptable pour 4 admins) ; à terme, support dual-secret (vérifier avec ancien+nouveau pendant la transition) — non prioritaire à cette échelle.

### J.3 [MINEUR] `detail=str(exc)` : messages d'exception brute dans quelques 400

- **Fichiers** : `api/v1/admin/auth.py:171` (refresh : message de `TokenError` — contrôlé, sain), `api/v1/admin/offers.py:114,133` (`ValueError` du service `create_offer` — contrôlé), `:318,324` (erreurs de parsing JSON/CSV — contrôlées, truncatées ailleurs via `[:200]`), `api/v1/public/subscriptions.py:106,259` (`ValueError` d'inscription — contrôlé).
- **Description** : vérification demandée (« fuite d'information dans les erreurs »). Les `str(exc)` remontent des **exceptions métier volontaires** (ValueError avec message français), pas des exceptions système. Les erreurs inattendues : aucun `exception_handler` global n'existe (grep négatif) — FastAPI renverra donc `500 Internal Server Error` générique en prod sans stack trace dans le corps (comportement par défaut, safe) ; la stack part dans les logs serveur.
- **Impact** : négligeable — aucune trace SQL ni stack trace observée dans les réponses ; les messages sont bornés (`[:200]`, `[:255]`, `[:1000]` selon le contexte).
- **Recommandation** : statu quo acceptable ; si renforcement souhaité : un handler global `Exception → 500 {"detail": "Erreur interne"}` + log structuré (à coupler avec O).

### J.4 [MINEUR] Longueur minimale du secret JWT et du secret de chiffrement IA non vérifiées au boot

- **Fichiers** : `core/config.py:193-194` (aucune contrainte de longueur) ; `main.py:25-28` (seule la valeur par défaut est refusée en prod, pas la longueur) ; renvoi B.5 pour le secret Fernet.
- **Description** : un `ADMIN_JWT_SECRET="abc"` en prod démarre sans avertissement — secret signable par force brute bien plus vite.
- **Impact** : dépend de l'hygiène ops ; garde absente.
- **Recommandation (additive)** : dans le lifespan prod, exiger `len(secret) >= 32` (comme pour le refresh du projet sœur) — RuntimeError explicite. Idem `AI_KEY_ENCRYPTION_SECRET` (B.5/B.7).

### J.5 [MINEUR] Périmètre `admin_api_key` : clé partagée unique, sans expiration ni version

- **Fichiers** : `core/config.py:192`, `api/deps.py:22-29`.
- **Description** : la clé `ADMIN_API_KEY` est une clé partagée statique (env), sans TTL, sans versionnement — les deux autres tokens internes partagent ce modèle (rotation = redéploiement). Acceptable pour des scripts internes, mais aucune journalisation des appels qu'elle autorise (aucune route ne l'utilise dans `api/` visible — elle est « disponible pour compatibilité », docstring `:16`).
- **Impact** : quasi nul en l'état (aucune route active ne l'exige dans le code audité) ; c'est une surface morte.
- **Recommandation** : confirmer qu'aucun script externe ne l'utilise, puis retirer la dépendance (ou documenter ses usages). Évite la dérive « clé magique oubliée ».

### Tableau de synthèse — Domaine J

| # | Constat | Sévérité | Fichiers principaux | Recommandation | Effort |
|---|---|---|---|---|---|
| J.1 | `admin_api_key` comparé en `!=` (pas constant-time) | Mineur | `api/deps.py:28` | `compare_digest` | Petit |
| J.2 | Rotation JWT = déconnexion brutale non documentée | Mineur | `core/security.py` | Procédure d'incident | Petit |
| J.3 | `str(exc)` dans quelques 400 (contrôlés) ; pas de handler global | Mineur | `offers.py:114,133`, `subscriptions.py:106,259` | Statu quo ou handler global | Petit |
| J.4 | Pas de longueur minimale sur les secrets au boot | Mineur | `main.py:25-28` | Garde `>= 32 chars` en prod | Petit |
| J.5 | `admin_api_key` : surface morte sans traçabilité | Mineur | `api/deps.py:22-29` | Retirer ou documenter | Petit |

**Hypothèses ouvertes** : aucune — les questions du prompt (alg confusion, compare_digest, expiration, rejeu, CORS wildcard, signature webhook, rate limits, SQL injection) ont toutes une réponse vérifiée positive.

---

## Domaine K — Performance

### K.0 Points positifs

- **N+1 maîtrisés sur les endpoints à relations** : `selectinload`/`joinedload` systématiques sur les listes chargées — `api/v1/public/offers.py` (10 usages, `_load_offer_relations`), `articles.py` (10), `digest_builder_service.py` (6), `duplicates.py` (4 — audit 2, F2 effectif), routers admin concernés (`sending`, `scraping`, `content`, `referentials`). L'itération Python sur relations non pré-chargées est l'exception, pas la règle.
- **Pagination bornée partout où il y a `limit`** : les 21 routers admin et le public exposent `Query(..., ge=1, le=100/200)` systématiquement (vérifié : aucun `limit` non borné dans les routes) — `bulk-status` plafonné à 500 IDs (`offers.py:204`), import par chunks de 50 avec plafond 5 Mo.
- **Index composites réels** : `ix_job_offers_feed (visible_site, status, published_at)` et `ix_job_offers_search (normalized_title, visible_site, status)` (`models/jobs.py:153-154`), `ix_job_offers_status_view_count (status, view_count DESC)` posé par la migration 0012 idempotente (audit 2, Q6 effectif — le top-vues est indexé), `ix_ai_api_keys_selection` pour la sélection de clés (`models/ai.py:61`), index sur toutes les FK et statuts filtrés (`created_at`, `status`, `source_id`…).
- **Compteurs view/save bufferisés Redis** (audit 2, F3 effectif) : `services/offer_metrics.py` — INCR Redis par offre, flush batch (500) chaque minute vers la base, fallback synchrone si Redis down, choix « best-effort » documenté (audit 3, W4 : perte max = 1 min de compteurs).
- **Pool PostgreSQL configuré et dimensionnable** : `db/session.py:23-30` — `pool_size=10`, `max_overflow=20`, `timeout=30 s`, `recycle=1800 s`, `pre_ping=True` (tous overridables par env, `core/config.py:107-111`). Ordre de grandeur cohérent avec 1 web service + workers Celery sur Render + Neon poolé.
- **Agrégations admin groupées** : dashboard réduit à 3-4 requêtes via GROUP BY (audit 2, Q3 effectif, `dashboard.py:22-64`), `logs_stats` en passes GROUP BY unique par axe, `scraping_stats_summary` en une passe SUM/COUNT.
- **`_query_raw_offers` avec `with_for_update(skip_locked=True)`** (`tasks/ai_processing.py:127`) — pas de lock contention entre sweeps concurrents.

### K.1 [MINEUR] Agrégats plein-table sans fenêtre : `logs/stats`, `audit/stats`, `ai/stats` scannent tout

- **Fichiers** : `api/v1/admin/logs.py:204-207` (`par_action_rows` = GROUP BY **sans WHERE** — compteurs globaux), `:122` (`total` = COUNT(*) plein-table `AdminActionLog`), `:259-263` (contacts GROUP BY sans fenêtre), `api/v1/admin/ai.py:255-257` (`backlog_brut` global OK), `:288-292` (suggestions GROUP BY global).
- **Description** : le prompt demandait d'évaluer le risque de scan complet sur `offer_ingestion_events` / `admin_action_logs` (les tables qui grossiront le plus). Vérifié : les compteurs "globaux" (`events_total`, `total`, `by_action`, `suggestions_par_statut`) n'ont **pas de fenêtre temporelle** — chaque appel à `/logs/stats` ou `/audit/stats` scanne toute la table (les axes `par_jour` sont fenêtrés, eux). À 100k+ events, chaque ouverture de page admin = 2-3 full scans agrégés.
- **Impact** : latence admin croissante linéairement avec l'historique ; sur Neon poolé, quota de lecture consommé pour rien. Renvoi A.3 : la purge est le correctif principal ; une fenêtre par défaut (ex. 365 j) sur les compteurs globaux en est l'alternative légère.
- **Recommandation (additive)** : fenêtrer les compteurs globaux sur `min(days, 365)` par défaut (paramètre query optionnel `window_days`), ou ne compter que les X derniers jours quand la table dépasse un seuil. À trancher avec A.3/A.4 (rétention).

### K.2 [MINEUR] `/admin/scraping/status` : 1 + N requêtes par source (2N+1 au total)

- **Fichiers** : `api/v1/admin/scraping.py:33-39` — pour **chaque** source : 1 requête `last_run` (scalar) + 1 requête `total_runs_count` via `len(list(db.scalars(select(SourceScrapeRun.id)...)))` — ce dernier charge **tous les IDs** pour les compter en Python au lieu d'un `COUNT(*)`.
- **Description** : avec 10 sources : 1 (liste sources) + 10 (last_run) + 10 (scans d'IDs) = 21 requêtes dont 10 inutilement lourdes. Le pattern `len(list(...))` est le marqueur d'un COUNT manqué.
- **Impact** : négligeable aujourd'hui (3-6 sources, tables modestes) ; moyen terme : la page Scraping admin ralentit avec l'historique (chaque `select(id)` rapatrie des milliers de lignes).
- **Recommandation (additive)** : `select(func.count(SourceScrapeRun.id)).where(...)` + `GROUP BY source_id` en une requête pour les totaux, et une requête fenêtrée `DISTINCT ON`/`ROW_NUMBER` pour les last_run — ou au minimum le COUNT simple. Effort Petit.

### K.3 [MINEUR] `find_potential_duplicates` : rechargement des paliers en cascade dans le digest selector

- **Fichiers** : `services/digest_cascade_selector.py:144-150` — après la boucle d'accumulation T1..T5, le re-classement **re-sélectionne chaque palier une seconde fois** (`_select_for_tier` rappelé pour reconstituer `offer_by_id`) ; `_select_for_tier("T1")` rappelle lui-même T0 (`:202`). Sur un abonné avec 6 paliers : T0 exécuté 2×, T1 2×, etc. — chaque palier = 1-2 requêtes SQL filtrées.
- **Description** : l'accumulation (`:124-134`) et la reconstruction (`:144-150`) refont le même travail ; les offres obtenues en accumulation ne sont pas réutilisées (seuls les `id`→`match_kind` sont conservés, les objets sont re-sélectionnés).
- **Impact** : multiplication par ~2 du coût de sélection par digest — avec des centaines d'abonnés en fenêtre de préparation (07:30), le volume de requêtes double pour rien. Fonctionnellement correct (les mêmes requêtes déterministes), purement du gaspillage.
- **Recommandation (additive)** : conserver les objets `JobOffer` (pas seulement les IDs) dans `accumulated` lors de la première passe et supprimer la boucle de reconstruction `:144-150`. Effort Petit, gain immédiat sur la fenêtre de préparation.

### K.4 [MINEUR] Cache Redis lecture : absent — referentiels publics requêtés à chaque appel

- **Fichiers** : `api/v1/public/referentials.py:30-71` — `/sources`, `/filieres`, `/contract-types`, `/experience-levels`, `/education-levels`, `/locations` : SELECT plein-table **sans cache ni pagination** (tables référentielles, taille limitée mais croissante avec les locations), chaque page publique du site appelle ces listes.
- **Description** : le prompt demande si un cache de lecture Redis (au-delà du broker) est pertinent. Vérifié : Redis n'est utilisé que pour broker + verrous + compteurs + rate-limit — **aucun cache de lecture**. Les referentiels ne changent que via l'admin (rares), mais sont lus par chaque visiteur.
- **Impact** : modéré — Neon poolé absorbe, mais chaque chargement de page publique = 4-6 requêtes référentielles redondantes. Le site public à fort trafic multiplierait inutilement.
- **Recommandation** : priorité basse (volumétrie actuelle faible) ; si trafic public croît : cache Redis TTL 5-10 min sur les 6 endpoints référentiels (invalidation à l'écriture admin via simple délété de clés) ou `Cache-Control` navigateur. À documenter comme piste, pas comme dette urgente.

### K.5 [MINEUR] Batch IA : volumétrie bornée à 10 offres — sweep 5 min, pas de chevauchement possible

- **Fichiers** : `tasks/ai_processing.py:219` (`limit=10`), `:203-206` (verrou `lock:ai:process_raw_offers:{run|sweep}` TTL 900 s).
- **Description** : le prompt demandait d'évaluer le risque de doublon de traitement si un sweep chevauche un batch en cours. Vérifié : (a) le lot est plafonné à **10 offres par job** (le sweep suivant reprend le reste) ; (b) le verrou `sweep` est **global** (pas par batch) — un sweep pendant qu'un run manuel tourne reçoit `locked` et rend la main ; (c) les offres sont sélectionnées `with_for_update(skip_locked)` + statut basculé `AI_PROCESSING` au début (`:239-245`) — un doublon de sélection serait de toute façon exclu par le verrou.
- **Impact** : aucun risque de doublon — au prix d'un **débit plafonné** : 10 offres / 5 min = 120 offres/heure max en mode sweep. Un afflux de 500 offres après un scraping chargé demanderait ~4 h de rattrapage.
- **Recommandation** : le plafond est un choix défendable (petits batches IA, erreurs isolées) ; si le volume scraping croît, rendre `limit` configurable (`AI_BATCH_SIZE` env) — une ligne. Renvoi P pour le dimensionnement global.

### Tableau de synthèse — Domaine K

| # | Constat | Sévérité | Fichiers principaux | Recommandation | Effort |
|---|---|---|---|---|---|
| K.1 | Compteurs globaux = full scans sans fenêtre | Mineur | `logs.py:204-207,122,259`, `ai.py:288` | Fenêtre par défaut / purge (A.3) | Petit |
| K.2 | `/scraping/status` : 2N+1 requêtes, COUNT en Python | Mineur | `scraping.py:33-39` | GROUP BY + COUNT SQL | Petit |
| K.3 | Cascade : re-sélection des paliers (2× le travail) | Mineur | `digest_cascade_selector.py:144-150` | Réutiliser les objets accumulés | Petit |
| K.4 | Aucun cache lecture référentiels publics | Mineur | `referentials.py (public):30-71` | Cache Redis TTL / Cache-Control | Moyen |
| K.5 | Batch IA plafonné à 10 offres/5 min (120/h) | Mineur | `ai_processing.py:219` | `AI_BATCH_SIZE` configurable | Petit |

**Hypothèses ouvertes** : aucune — le `days` non câblé de top-viewed (H.2) est explicitement documenté comme non-implémenté dans le code (`aggregates.py:32-34` : « reserved for future evolution », `admin_aggregates.py:36-39` : `last_seen_at` non fiable).

---

## Domaine L — Base de données et migrations

### L.0 Points positifs

- **Migrations 0016/0017 réversibles et soignées** : 0016 (`admin_temp_password_audit`) a un `downgrade` **complet et correct** — il documente même le piège (retablir NOT NULL exige de supprimer les lignes orphelines d'abord, `migrations/versions/0016:46-58`) ; FK `admin_action_logs.admin_id` basculée CASCADE→**SET NULL** conformément à la règle « supprimer un admin ne doit jamais effacer le journal » (cycle 15 effectif). 0017 (`admin_welcome_email`) gère le piège du nom de CHECK variable (introspection `pg_constraint` + `DROP CONSTRAINT IF EXISTS` sur les deux formes de nommage, pattern 0002) avec un downgrade qui **purge les lignes `admin_welcome` avant de resserrer la contrainte** (`0017:86-99`).
- **Règle SET NULL appliquée exhaustivement sur les FK vers `administrators`** : vérification exhaustive des 9 FK — `admin_action_logs` (SET NULL, migration 0016), `site_settings.updated_by_admin_id` (SET NULL), `job_offers.admin_id` (SET NULL), `content_pages` (SET NULL), `ai_alerts.acknowledged_by_admin_id` (SET NULL), `ai_filiere_suggestions.reviewed_by_admin_id` (SET NULL), `rejected_duplicate_pairs` (SET NULL) ; **seule exception assumée** : `admin_refresh_tokens.admin_id` CASCADE (`models/admin.py:71`) — correct sémantiquement (ce sont les sessions du compte, elles DOIVENT disparaître avec lui).
- **`DateTime(timezone=True)` systématique** : vérification exhaustive des 10 fichiers `models/*.py` — **49 colonnes temporelles, toutes `timestamptz`**, zéro `DateTime()` naïf (grep négatif). Aucune régression depuis la v1.
- **Enums non natifs + CHECK** : `models/types.py::enum_column` — `native_enum=False` + `create_constraint=True` : ajouter un statut = migration simple (choix documenté dans la docstring) ; **aucune valeur dupliquée** dans les StrEnum (vérification programmatique exhaustive — le piège SQLAlchemy "duplicate enum value" est absent).
- **Migrations idempotentes** : garde-fous `sa.inspect(bind).get_table_names()` / `get_indexes()` avant create (pattern 0004/0008/0009/0011/0012 — confirmé sur la 0012 lue intégralement).
- **Seeds idempotents** : `seed_admin` (upsert par email, `scripts/seed_admin.py:50-52`), `seed_scraper_sources` (upsert par code, `:70-71`), `seed_ai_api_keys` (upsert par nom, `:71`), `seed_email_settings` (ne touche jamais une valeur réglée par un admin, cf. G.0). Rejouables sans duplication.
- **Nullabilité additive** : les colonnes ajoutées en cours de route ont des défauts serveur sûrs — `must_change_password` `server_default="0"` (0016), `match_tier` `default="T0"` (models/emails.py:52), `reset_token_hash` nullable (0013). Les lignes existantes ne cassent pas au déploiement.

### L.1 [MINEUR] `citext` : absent — la casse des emails est gérée en Python uniquement

- **Fichiers** : aucun `citext` ni `CREATE EXTENSION` dans les migrations ou les modèles (grep exhaustif négatif) ; la normalisation est applicative : `services/subscriptions.py:126` (`payload.email.strip().lower()`), `scripts/seed_admin.py:50`, `api/v1/admin/auth.py:113` (`payload.email.strip().lower()`), `services/admin_password_reset.py:71` (`.strip().lower()`).
- **Description** : le prompt demandait de vérifier l'extension `citext` pour `utilisateurs.email`/`administrateurs.email`. Réponse : le projet ne l'utilise pas — la contrainte `unique=True` sur `Subscriber.email` (`models/subscriptions.py`) protège l'unicité **après** normalisation Python, et tous les points d'entrée normalisent avant l'écriture/lecture.
- **Impact** : cohérent tant que TOUS les chemins d'écriture normalisent (vérifié : inscription, seed admin, reset, login — 4 points, tous `.lower()`). Le risque résiduel est une insertion directe en base (script SQL ad hoc) avec une casse différentée qui créerait un doublon logique invisible pour l'app.
- **Recommandation** : statu quo acceptable (4 points de normalisation identifiés et homogènes) ; si renforcement : index fonctionnel unique `UNIQUE(lower(email))` en migration additive (SQLite + PG portables) — pas besoin de citext. Documenter la règle « toujours normaliser en Python » dans l'AGENTS.md.

### L.2 [MINEUR] Contraintes CHECK vs Pydantic : deux validations à maintenir, un cas de divergence documenté

- **Fichiers** : `models/types.py` (CHECK base) vs `schemas/*.py` (validators Pydantic) ; exemple sain : `filiere_confidence` bornée 0-1 des deux côtés (`models/jobs.py:187` CHECK, `schemas/ai.py:143` `Field(ge=0, le=1)`).
- **Description** : le prompt demandait la cohérence base⇄schémas. Vérifié : les bornes critiques (confiance, compteurs, priorités) sont doublées base + Pydantic — c'est de la défense en profondeur, mais chaque nouvel enum/borne demande les DEUX mises à jour. Une divergence existerait si un schéma acceptait une valeur que la base refuse (500 IntegrityError au lieu de 422). La 0017 montre le coût du côté enum : le passage d'un purpose a exigé une migration délicate.
- **Impact** : maintenance en double ; aucune divergence active détectée (échantillon vérifié sur les champs critiques : les CHECK et les Field coincident).
- **Recommandation** : processus : toute évolution d'enum passe par une migration CHECK (pattern 0017) + mise à jour Pydantic dans le même commit ; ajouter une ligne dans l'AGENTS.md.

### L.3 [MINEUR] `init_db()` : `drop_all` gardé pour le dev, mais garde prod effective

- **Fichiers** : `db/session.py:68-80` — `init_db` fait `Base.metadata.drop_all` + `create_all` en dev, avec refus RuntimeError en production (audit P1 #22 effectif, `:74-78`).
- **Description** : le prompt (§ méthodologie cross-check du skill) demandait de repérer le code capable de wipe la base. Vérifié : présent mais **doublement gardé** — `is_production` refuse, et `AUTO_CREATE_TABLES` (défaut False, `core/config.py:115`) doit en plus être réglé pour que le lifespan l'appelle (`main.py:32-33`).
- **Impact** : aucun en prod ; risque dev-only (écraser une base de dev non migration-aware) documenté par le commentaire.
- **Recommandation** : statu quo — les deux gardes suffisent.

### L.4 [MINEUR] Migration 0001 `create_all` : le piège documenté reste actif pour les nouvelles tables

- **Fichiers** : `migrations/versions/0001_initial_schema.py` (fait `Base.metadata.create_all` — d'où le garde-fou idempotence des 0008/0009/0011, cf. skill projet).
- **Description** : rappel du piège connu : sur base **vierge**, la 0001 pose déjà toutes les tables des modèles ACTUELS, donc toute migration ultérieure qui fait `op.create_table` sur une table existant dans les modèles casse en `DuplicateTable`. Le pattern de garde (`sa.inspect().get_table_names()`) est appliqué sur les migrations existantes ; **il restera obligatoire pour chaque future migration créatrice de table**.
- **Impact** : aucun tant que la règle est suivie (elle l'est sur 5 migrations consécutives) ; le coût est un boilerplate par migration.
- **Recommandation** : documenter la règle dans l'AGENTS.md du server (elle vit uniquement dans le skill Hermes et les docstrings) — une migration future réalisée par un nouveau contributeur sans la connaissance du piège crashera en intégration.

### Tableau de synthèse — Domaine L

| # | Constat | Sévérité | Fichiers principaux | Recommandation | Effort |
|---|---|---|---|---|---|
| L.1 | Pas de citext — casse email gérée en Python (4 points homogènes) | Mineur | `subscriptions.py:126` et al. | Index `UNIQUE(lower(email))` ou statu quo documenté | Petit |
| L.2 | CHECK base + validators Pydantic à maintenir en double | Mineur | `models/types.py`, `schemas/*.py` | Règle « même commit » dans AGENTS.md | Petit |
| L.3 | `init_db` drop_all dev-only, double garde prod | Mineur | `db/session.py:68-80` | Statu quo | — |
| L.4 | Piège 0001 create_all actif pour les futures migrations | Mineur | `migrations/versions/0001` | Documenter le garde-fou | Petit |

**Hypothèses ouvertes** : aucune.

---

## Domaine M — Fiabilité et robustesse

> Renvois : verrous distribués (fail-open) → **E.1** ; crash mi-batch ingestion et runs zombies → **C.5** ; retries ciblés scraping/IA/email → **E.0 / P** ; Redis down au moment d'un trigger admin → réponse 503 explicite (`api/v1/admin/sending.py:45-46,66-68,100-101` : `HTTPException(503, "Broker Celery injoignable")` — pas de 500 générique, bonne réponse à la question du prompt).

### M.0 Points positifs

- **Savepoint par élément généralisé** : ingestion par offre (`services/ingestion.py:224`), résultats IA par offre (`services/ai_results.py`, pattern documenté) — un élément fautif n'annule jamais le lot, chaque erreur est journalisée et comptée APRÈS le commit du savepoint (règle des compteurs audit 3, F1 respectée).
- **Digest phase 2 : garde-fous séquentiels solides** (`tasks/digests.py:224-280`) : verrou d'envoi par jour, **marqueur de préparation vérifié avant envoi** (échec ou absence de préparation → envoi bloqué par défaut, override `SEND_IF_PREPARATION_INCOMPLETE` documenté), marqueurs d'état Redis TTL 48 h best-effort, fan-out chord avec isolation d'erreurs par digest.
- **Retries email bornés en base ET en Celery** : `max_retries=None` côté Celery mais borne réelle via `EMAIL_MAX_RETRIES` + contrainte `attempt_no ≤ 3` (`tasks/digests.py:286-317`, docstring explicite) — le retry ne se déclenche QUE sur erreurs retentables (timeout/429/5xx, `digest_sender_service.py:35`), backoff exponentiel.
- **Transactions routes : un commit par route, écritures groupées** — vérification exhaustive : `bulk_update_settings` fait ses N mutations PUIS un seul `db.commit()` (`settings.py:82-100`) ; création d'offre + filières dans la transaction du service (`services/offers.py`) puis commit route. Pas d'état partiel possible sur ces chemins.
- **Idempotence des tasks cœur** : re-POST d'un batch ingestion = « already_processed » (`ingestion.py:192-200`) ; re-run de `send_digest` sur un digest déjà envoyé = géré par statut (l'`_attempt_send` repart du statut en base) ; `trigger_send` admin saute les abonnés ayant déjà un digest du jour (`sending.py:169-173`).
- **Dégradation Redis explicite partout** : rate-limits pass-through avec warning (`services/rate_limit.py:85`), marqueurs digest best-effort (`digests.py:74`), verrous fail-open documenté (E.1) — le système continue de tourner sans Redis (choix cohérent et commenté).

### M.1 [MAJEUR] Runs `RUNNING`/`PENDING` zombies : aucun détecteur de staleness

- **Fichiers** : `services/ingestion.py:171,183` (runs créés RUNNING) ; `api/v1/admin/scraping.py:76,81` (runs PENDING fantômes, cf. C.1) ; **aucun code** ne détecte ou ne requalifie un run RUNNING/PENDING ancien (grep exhaustif : ni tâche beat, ni check `started_at < now - X`).
- **Description** : le prompt demandait « les compteurs risquent-ils de rester bloqués en running indéfiniment sans mécanisme de détection/timeout ». **Confirmé** : si le worker/API meurt mi-batch, le `ScrapeRun`/`SourceScrapeRun` reste RUNNING pour toujours ; les runs PENDING du trigger fantôme s'accumulent à vie. `_scrapers_finished_today` (`tasks/ai_processing.py:74-101`) compte les RUNNING comme « scrapers actifs » — **un zombie RUNNING bloque donc l'IA sweep** (elle attendra éternellement, jusqu'à ce que quelqu'un répare à la main) : c'est le point d'impact le plus grave, déjà consommé en live (cf. commentaire `:290` sur les jobs zombies IA observés cycle 19).
- **Impact concret** : pipeline IA gelé silencieusement par un run zombie + historique faussé + dashboards trompeurs. Détection uniquement manuelle (SQL à la main).
- **Recommandation (additive)** : tâche beat quotidienne `requalify_stale_runs` (à 08:00, avant le digest) : tout run RUNNING avec `started_at < now - 6 h` → statut `FAILED`, `error_message = "stale_requalified"` + event système (G.1) ; idem PENDING > 24 h. Effort Petit, supprime la classe entière de problèmes.

### M.2 [MAJEUR] Pas de circuit-breaker pour Resend : une panne prolongée du fournisseur email = retries épuisés en silence

- **Fichiers** : `services/email/resend_provider.py` (aucun `disabled_until`/breaker — grep négatif ; contrairement aux clés IA `models/ai.py:49`) ; retries bornés à 3 (`tasks/digests.py:303`) puis statut FAILED définitif du digest.
- **Description** : le prompt demandait un « mécanisme équivalent pour Resend en cas de panne prolongée ». Vérifié : les 3 tentatives par digest s'épuisent en ~qq minutes de backoff ; si Resend est down 2 h, TOUTES les digests du jour partent en FAILED (définitif) ; il existe bien `retry_failed_digests` (`tasks/digests.py:468` : re-queue des failed avec `attempt_no < max`) — mais cette task n'est **pas dans le beat_schedule** (grep `celery_app.py` : absente). Le rattrapage n'existe donc que si un admin déclenche manuellement.
- **Impact concret** : journée d'envois perdue sans intervention humaine ; la fenêtre de fraîcheur rend les offres du jour moins fraîches au rattrapage.
- **Recommandation (additive)** : (a) inscrire `retry_failed_digests` au beat (crontab horaire 09:00-18:00 par ex.) — une ligne dans `celery_app.py` ; (b) à terme : breaker simple par compteur Redis (si N échecs consécutifs Resend → pause M minutes avant nouvelle tentative) — Moyen.

### M.3 [MINEUR] `import_offers_bulk` : commits par chunk = état partiel assumé, mais sans reprise

- **Fichiers** : `api/v1/admin/offers.py:379-417` — un `db.commit()` par chunk de 50 (`:394`), rollback du chunk en erreur (`:398`), puis commit final pour l'audit log (`:417`).
- **Description** : le multi-commit par chunk est **documenté et voulu** (docstring `:370` : « une erreur sur une offre n'annule pas tout ») — c'est le bon choix pour un import. Le revers : si l'API crashe au chunk 3/10, les chunks 1-2 sont déjà commités, sans trace d'« import interrompu » (l'audit log n'est écrit qu'à la fin, `:405-416`).
- **Impact** : import partiel sans métadonnée d'interruption ; l'admin voit `created: 120` sans savoir qu'il en manquait.
- **Recommandation (additive)** : écrire la ligne d'audit log AVANT la boucle (statut « started », filename) puis la mettre à jour à la fin — ou émettre un event par chunk. Petit.

### M.4 [MINEUR] `flush_offer_metrics` : échec isolé sans perte (rattrapage naturel), confirmé

- **Fichiers** : `tasks/maintenance.py:49-70` — `collect_metric_deltas` → `apply_metric_deltas` ; sur exception : log + `{"applied": 0, "error": True}`, **aucune donnée perdue** (les clés Redis ne sont décrémentées qu'après application réussie — pattern GETDEL, cf. `services/offer_metrics.py` docstring audit 3, W4).
- **Description** : le prompt demandait ce qui se passe si le flush minut échoue une fois. Réponse vérifiée : les deltas restent en Redis et le tour suivant les applique — la base rattrape avec retard (le widget lit Redis, donc l'affichage public reste correct). Perte limite documentée : 1 minute de compteurs si le worker crashe exactement entre GETDEL et UPDATE.
- **Impact** : négligeable — comportement exemplaire.
- **Recommandation** : statu quo.

### M.5 [MINEUR] `_process_without_external_ai` : pas de savepoint par offre

- **Fichiers** : `tasks/ai_processing.py:144-191` (mode `ai_enabled=False`) — boucle sans `begin_nested`, contrairement aux chemins ingestion/IA externalisée.
- **Description** : quand l'IA est désactivée, chaque offre est validée/mutée séquentiellement sans savepoint ; une exception inattendue sur l'offre k (ex. slug manquant levant en base) fait échouer TOUT le lot (session_scope → rollback global).
- **Impact** : faible (chemin dégradé, validations `_final_validation` préviennent les cas connus) mais incohérent avec le pattern projet.
- **Recommandation (additive)** : appliquer le même savepoint par offre — qq lignes, aligne le mode dégradé sur le standard.

### Tableau de synthèse — Domaine M

| # | Constat | Sévérité | Fichiers principaux | Recommandation | Effort |
|---|---|---|---|---|---|
| M.1 | Runs zombies RUNNING/PENDING sans détection — **gel de l'IA sweep** | **Majeur** | `ingestion.py:171,183`, `ai_processing.py:74-101` | Beat `requalify_stale_runs` | Petit |
| M.2 | Pas de breaker Resend ; `retry_failed_digests` hors beat | **Majeur** | `resend_provider.py`, `digests.py:468`, `celery_app.py` | Inscrire retry au beat + breaker | Petit/Moyen |
| M.3 | Import bulk : état partiel sans trace d'interruption | Mineur | `offers.py:379-417` | Audit log en début + fin | Petit |
| M.4 | Flush metrics : échec sans perte (rattrapage Redis) | Mineur | `maintenance.py:49-70` | Statu quo | — |
| M.5 | Mode IA désactivée : pas de savepoint par offre | Mineur | `ai_processing.py:144-191` | Aligner sur le pattern | Petit |

**Hypothèses ouvertes** : aucune.

---

