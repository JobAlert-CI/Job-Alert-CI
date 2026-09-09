
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

## Domaine N — Qualité du code

### N.0 Points positifs

- **Aucun TODO/FIXME/XXX/HACK** dans tout le code applicatif (`api/`, `services/`, `tasks/`, `core/`, `models/`, `schemas/`, `db/`, `main.py`, `celery_app.py` — grep exhaustif négatif) : la dette n'est pas balisée « à faire », elle est soit corrigée, soit documentée en commentaires d'audit — état remarquable.
- **`from __future__ import annotations` quasi systématique** : 95/108 fichiers (88 %) ; les 13 restants sont des `__init__.py` vides, `models/enums.py`/`types.py` (pas d'annotations), et 4 routers publics (`dashboard.py`, `articles.py`, `filieres.py`, `sources.py`, `stats.py`) — incohérence mineure sans impact (les annotations modernes `str | None` sont utilisées partout).
- **54 commentaires d'audit/cycle traçant la dette historique** : chaque correction porte sa référence (« Audit 2, N8 », « cycle 15 », « audit P1 #29 ») — traçabilité exemplaire, vérifiable dans git ; aucune référence d'audit « encore en attente » détectée (les corrections référencées sont toutes effectives dans le code, vérifié au fil des domaines A-M).
- **Typage moderne cohérent** : `str | None`, dataclasses `slots=True`/`frozen=True` (`CascadeOutcome`, `AIProviderExecutionResult`), `TypedDict`/`Literal` dans les services récents.
- **23 `except Exception` assumés et localisés** : chacun porte soit un commentaire de justification (redis absent `rate_limit.py:105`, « definitivement inattendu » `ai_results.py:180,193`), soit une journalisation (`logger.exception`) — pas d'avale-tout silencieux.
- **21 fichiers de tests couvrant les cycles récents** : admins (cycle 15), IA (cycle 19 + endpoints), contenu (14 + fixes), journal (16), logs (17), scraping stats, settings (18), transactional emails, exports, audit 2 fixes, digest (cascade/endpoints/pipeline), email (confirmation/task), ingestion, webhook Resend — correspondance directe avec les chantiers récents.

### N.1 [MINEUR] mypy/pyright jamais exécutés — aucune configuration de typage statique

- **Fichiers** : aucun `mypy.ini`/`pyrightconfig.json`/section `[tool.mypy]` (vérifié) ; `pyproject.toml` ne référence que ruff + pytest-cov.
- **Description** : le prompt demandait si un mypy/pyright avait déjà tourné et à quel niveau d'erreurs. Réponse : **jamais configuré**. Le typage est décoratif (aide IDE) mais non vérifié — aucune CI ne détecterait une régression de types.
- **Impact** : les erreurs de type passent à l'exécution (ex. passer un `str` là où un `datetime` est attendu entre services) ; les refactors perdent le filet de sécurité.
- **Recommandation** : introduire progressivement : `mypy --ignore-missing-imports server/api server/core` en warning non bloquant d'abord, mesurer, puis élargir. Effort Moyen (dette initiale inconnue), valeur croissante.

### N.2 [MINEUR] 9 erreurs Ruff actives sur le code applicatif (hors migrations/tests historiques)

- **Fichiers** : `ruff check api/ services/ tasks/` → 4×F401 (imports inutilisés), 2×I001 (imports non triés), 2×RUF100 (noqa inutiles), 1×SIM102.
- **Description** : le baseline documenté dans le skill (« ~200 dettes ruff sur migrations et tests HISTORIQUES, hors périmètre ») est respecté — mais ces 9-là vivent dans le code **applicatif récent**, elles sont donc « nouvelles » au sens du skill (ne jamais nettoyer en drive-by les historiques, mais les fichiers touchés doivent être propres).
- **Impact** : bruit de lint qui banalise les vraies alertes.
- **Recommandation** : `ruff check --fix` ciblé sur ces 4 fichiers (8/9 auto-fixables) lors du prochain commit backend — pas de drive-by sur les migrations/tests.

### N.3 [MINEUR] Couverture de tests : trois domaines de l'audit sans test dédié

- **Fichiers** : inventaire des 21 fichiers vs domaines A→P : **absents** — (a) planification Celery/`celery_app.py` (aucun test des crontabs/heures, conforme au fait que c'est de la config), (b) activation/désactivation de source (aucun `test_sources_status` : la barrière D.0 « statut → skip scraping » n'est pas testée), (c) clés IA de bout en bout (les tests IA existants couvrent endpoints + savepoint, mais pas le fallback multi-clés `generate_structured_with_fallback`).
- **Description** : le prompt demandait d'identifier les domaines audités en A-H **sans aucun test correspondant**. Réponse : ces trois-là. Le plus sensible est (b) : la promesse « désactiver une source stoppe son scraping » (D.0) repose sur `tasks/scrapers.py:154` — une régression silencieuse casserait l'exigence produit sans rien casser côté tests.
- **Impact** : les invariants critiques de B/D (barrière statut, garde dernière-clé) ne sont protégés par aucun test de non-régression.
- **Recommandation (additive)** : un test prioritaire : `run_source_scraper` avec source PAUSED → `{"status": "skipped"}` (mock session, 15 lignes) ; puis fallback IA multi-clés (mock provider échouant sur clé 1, réussissant sur clé 2). Effort Petit.

### N.4 [MINEUR] 5 fichiers applicatifs sans `from __future__ import annotations`

- **Fichiers** : `api/v1/public/articles.py`, `filieres.py`, `sources.py`, `stats.py`, `api/v1/admin/dashboard.py` — 5 fichiers applicatifs sans la ligne (les autres 8 sans-ligne sont des `__init__`/enums).
- **Description** : incohérence de convention sans impact fonctionnel (le code y utilise déjà la syntaxe moderne via annotations de fonctions simples).
- **Impact** : nul ; uniformisation.
- **Recommandation** : ajouter la ligne aux 5 fichiers au prochain passage — 5 lignes.

### N.5 [MINEUR] Fonctions longues recensées (dette de lisibilité croissante)

- **Fichiers** : `ai_stats` 169 l. (`api/v1/admin/ai.py:226-391`), `ingest_offer_batch` 229 l. (`services/ingestion.py:191-419`), `build_and_queue_digest_sync` 111 l. (`digest_builder_service.py`), `_hard_filter_conditions` 102 l. (idem).
- **Description** : le prompt demandait les fonctions > ~80 lignes candidates à la décomposition. Quatre dépassements, tous déjà traités en I.3/I.5 (routes/services) — le rappel ici pour la complétude du domaine.
- **Impact** : lisibilité/testabilité dégradées, croissance continue.
- **Recommandation** : renvoi I.3/I.5 (décomposition aux prochains passages, pas de big-bang).

### Tableau de synthèse — Domaine N

| # | Constat | Sévérité | Fichiers principaux | Recommandation | Effort |
|---|---|---|---|---|---|
| N.1 | Aucun typage statique configuré (mypy/pyright jamais lancés) | Mineur | `pyproject.toml` | Introduire mypy progressivement | Moyen |
| N.2 | 9 erreurs ruff sur le code applicatif récent | Mineur | api/services/tasks | `ruff --fix` ciblé au prochain commit | Petit |
| N.3 | 3 domaines sans test : barrière statut source, fallback IA, planification | Mineur | `tests/` | Test « source PAUSED → skipped » prioritaire | Petit |
| N.4 | 5 fichiers sans `__future__ annotations` | Mineur | public/*.py, dashboard.py | Ajouter la ligne | Petit |
| N.5 | 4 fonctions > 80 lignes | Mineur | cf. I.3/I.5 | Renvoi décomposition | — |

**Hypothèses ouvertes** : aucune.

---

## Domaine O — Observabilité et ops

> Renvois : profondeurs de queue `"N/A"` → **H.3** (même constat, recommandation `LLEN`) ; `render.yaml` absent → **F.5** ; logs structurés/corrélation → **A.8** ; journal unifié en base → **G.1**.

### O.0 Points positifs

- **Métriques Prometheus minimales mais saines** (`api/metrics.py`) : compteur requêtes par (méthode, path-template, statut) + durée cumulée, **cardinalité bornée** à 2000 avec purge des 20 % moins sollicités (audit 2, R8 effectif — pas de fuite mémoire), path-template uniquement (jamais l'URL brute → pas de PII, `:74`), **accès protégé en prod** : loopback ou clé admin en `compare_digest` (audit 2, R9 effectif — le `_is_authorized` de metrics utilise `secrets.compare_digest`, `:94`, contrairement au `require_admin_api_key` générique J.1), middleware avec normalisation `unmatched` des 404 (audit 3, W3 effectif, `main.py:56-65`).
- **Health checks à deux niveaux, tous deux réels** :
  - `/health` public (`api/system.py:43-74`) : DB (SELECT 1), **Redis (ping réel)**, **Celery (control.inspect avec timeout 1 s)**, statut agrégé ok/degraded — répond à la question du prompt : ce n'est pas un simple 200 OK applicatif ; le choix « 200 + degraded » plutôt que 503 est documenté (éviter les retraits d'instance par le LB sur une panne Redis temporaire, `:62-66`).
  - `/health/db-deep` (`metrics.py:115-127`) pour blackbox_exporter, 503 explicite.
  - `/admin/system/health` (document 8) : workers actifs, digests queued, heartbeat (dernière offre créée), overall_status incluant Celery (audit P1 #51 effectif).
- **`X-Scraper-Token` et tokens internes observables** : chaque ingestion est journalisée avec durée et statut (`api/v1/ingestion.py` logger.info structuré `extra=`).

### O.1 [MINEUR] Métriques métier absentes de `/metrics`

- **Fichiers** : `api/metrics.py` — seules métriques HTTP exposées ; aucune métrique métier.
- **Description** : le prompt demandait s'il manque des métriques métier exploitables (offres scrapées/jour, digests envoyés/jour, taux d'échec IA). **Confirmé** : ces chiffres existent en base (compteurs `ScrapeRun`, `EmailDigest`, `AIJob`) et via l'admin (stats cycles 16-19), mais **pas au format Prometheus** — un dashboard Grafana branché sur `/metrics` ne verrait que le trafic HTTP, pas la santé du pipeline.
- **Impact** : l'observabilité métier est 100 % back-office (sessions admin) ; aucun scraping Prometheus ne peut alerter sur « 0 offre insérée aujourd'hui » ou « taux d'échec IA > 50 % ».
- **Recommandation (additive)** : exposer 3-5 compteurs métier simples dans `_format_prometheus()` : `offers_inserted_total` (cumul ScrapeRun), `digests_sent_total` / `digests_failed_total` (EmailDigest par statut), `ai_jobs_failed_total` — lecture SQL à chaque scrape (coût faible, cardinalité fixe). Effort Petit ; à combiner avec G.1 (events système) pour l'alerting.

### O.2 [MINEUR] Alerting opérationnel : rien d'automatique au-delà des AIAlert

- **Fichiers** : `models/ai.py:123` (AIAlert — IA uniquement) ; aucun canal d'alerte (email/Slack) pour « échec de run complet » ou « échec massif de digests » (grep négatif).
- **Description** : le prompt demandait s'il existe un canal d'alerte en cas d'échec de scraping complet ou d'échec massif d'envoi. Réponse : **non** — l'admin doit consulter le back-office chaque matin. Les AIAlert ne couvrent que l'IA ; un `ScrapeRun` FAILED ou 200 digests FAILED ne déclenche rien (et les échecs de scraping ne sont même pas en base, cf. A.1).
- **Impact** : détection des incidents dépendante de la consultation manuelle ; une panne nocturne (scraping 06:00 → digest 08:00) n'est vue qu'à la première connexion admin.
- **Recommandation (additive, progressive)** : court-circuiter l'existant : (a) `SystemEventLog` (G.1) avec sévérités ; (b) un email au super_admin (via le provider Resend déjà câblé, `services/email/resend_provider.py`) quand un `ScrapeRun` finit FAILED ou que le marqueur digest `send` du jour contient `failed > 20 %` — la tâche `mark_sending_completed` a déjà les chiffres en main (`digests.py:358-365`). Effort Moyen ; s'appuie sur G.1.

### O.3 [MINEUR] Logs applicatifs non structurés — renvoi A.8

- **Fichiers** : renvoi **A.8** (pas de `dictConfig`/JSON ; `extra=` non rendus par un formatter dédié).
- **Description** : sur Render, les ~70 `logger.*` partent en texte libre ; l'agrégation (si ajoutée) demanderait un reformatage. Les `extra={...}` existants (13) sont bien renseignés (source_code, batch_id, lock, duration_ms) mais noyés dans le texte.
- **Recommandation** : renvoi A.8 — un `logging.config.dictConfig` JSON formatter (uvicorn et celery acceptent `--log-config`/`worker_hijack_root_logger`) ; effort Petit/Moyen, à faire quand un agrégateur est choisi.

### O.4 [MINEUR] Le health check public ne teste pas Resend ni l'API Anthropic

- **Fichiers** : `api/system.py:43-74` — DB, Redis, Celery seulement ; `system_health.py` (admin) : DB, Celery, queues, heartbeat — **aucun ping Resend / fournisseur IA**.
- **Description** : le prompt demandait si les health checks couvrent « les dépendances externes (DB, Redis, Resend, Anthropic API) avec un statut par dépendance ». Réponse : **Resend et l'IA manquent** des deux niveaux de health check. (Nuance : pinger Resend à chaque health check coûterait des quotas et fausserait le rate-limit — un statut dérivé des derniers échecs serait plus juste qu'un ping.)
- **Impact** : une panne Resend n'apparaît dans aucun health check — elle se manifeste par des digests FAILED (retard de détection, cf. M.2/O.2).
- **Recommandation (additive)** : dans `/admin/system/health`, un statut `email_provider` calculé **sans ping** : `last_error_at` des N derniers `EmailDeliveryAttempt` (erreur < 15 min → degraded) ; idem `ai_provider` via `AIApiKey.last_error_at`/`disabled_until`. Effort Petit, zéro appel réseau.

### Tableau de synthèse — Domaine O

| # | Constat | Sévérité | Fichiers principaux | Recommandation | Effort |
|---|---|---|---|---|---|
| O.1 | Aucune métrique métier dans `/metrics` | Mineur | `api/metrics.py` | 3-5 compteurs (offres, digests, IA) | Petit |
| O.2 | Pas d'alerting automatique hors IAAlert | Mineur | absence | Email super_admin sur run FAILED / échec massif | Moyen |
| O.3 | Logs non structurés | Mineur | renvoi A.8 | dictConfig JSON | Petit/Moyen |
| O.4 | Health checks sans Resend ni fournisseur IA | Mineur | `system.py:43-74`, `system_health.py` | Statut dérivé des derniers échecs | Petit |

**Hypothèses ouvertes** : aucune.

---

## Domaine P — Celery

> Renvois : planification du beat → **F** (F.1 sources en dur, F.2 pas de vue admin, F.3 heures codées) ; retry email borné en base → **M.0** ; `retry_failed_digests` hors beat → **M.2** ; débit plafonné 10 offres/sweep → **K.5** ; queues `"N/A"` → **H.3**.

### P.0 Points positifs

- **Routage exhaustif et cohérent avec l'arborescence** : les 5 modules de `tasks/` sont tous dans `include=[...]` (`celery_app.py:41` — `ai_processing`, `scrapers`, `emails`, `digests`, `maintenance` ; `locks.py` est un helper, pas un module de tasks) ; **15 tasks routées explicitement** dans `task_routes` vers leurs 3 queues (`ai`, `emails`, `ingestion`) — chaque task définie a sa route (vérification exhaustive : aucune task `@celery_app.task` du codebase manque dans `task_routes`).
- **Isolation des queues par domaine** : IA (`ai` — sweep + runs), ingestion (`ingestion` — scrapers), emails (`emails` — digests + confirmations + maintenance) : dimensionnable indépendamment côté Render (`-Q ai,ingestion,emails`).
- **Serialisation verrouillée** : `task_serializer="json"`, `accept_content=["json"]` (pas de pickle — surface d'attaque réduite), `enable_utc=True` + `timezone` posés.
- **Retries par domaine métier bien calibrés** : scraping (`autoretry_for` ciblé + backoff + max 3, audit 3 C4), IA (`ConnectionError` + backoff + 3), emails (borne métier `EMAIL_MAX_RETRIES` + contrainte base `attempt_no ≤ 3` — docstrings explicites des trois modules).
- **`SCRAPER_BEAT_ENABLED`** : interrupteur ops documenté (anti catch-up au test).

### P.1 [MAJEUR] `acks_late`/`task_reject_on_worker_lost` non configurés : une tâche en cours est **perdue** au crash worker

- **Fichiers** : `celery_app.py:134-142` (`conf.update` : serializer, timezone, routes, beat — **ni `task_acks_late`, ni `task_reject_on_worker_lost`, ni `worker_prefetch_multiplier`**).
- **Description** : le prompt demandait si la configuration protège contre la perte de tâche en cas de crash worker en plein traitement. Réponse : **non** — défauts Celery : `acks_late=False` (ack à la réception) ⇒ un worker tué mid-task perd la tâche **définitivement** (elle est déjà acquittée, personne ne la reprendra). Conséquences par domaine : un `send_digest` tué en plein envoi = digest jamais envoyé ni marqué FAILED (phantôme `sending`) ; un `run_source_scraper` tué = source non scrapée ce jour (A.1 : aucune trace) ; un `process_raw_offers` tué = offres bloquées en `AI_PROCESSING` à vie (cf. zombies M.1 — le verrou TTL 900 s libérera, mais les offres restent dans le statut intermédiaire... vérification : `RAW_STATUSES = {BRUT}` ne les reprend pas, il faut une réparation manuelle).
- **Impact concret** : chaque redéploiement Render du worker (déploiements fréquents) pendant le digest de 08:00 a une fenêtre de perte silencieuse. Les marqueurs Redis (TTL 48 h) montrent un run `running` jamais conclu.
- **Recommandation (additive)** : `task_acks_late=True` + `task_reject_on_worker_lost=True` (la tâche est réattribuée au worker suivant) **pour la totalité des tasks** — elles sont toutes idempotentes ou défendables (vérifié : ingestion idempotente par batch_id, send_digest reprend du statut base, scrapers verrouillés, sweep reprend le reste) ; à accompagner de `worker_prefetch_multiplier=1` pour éviter qu'un worker accapare des tâches qu'il rendra aux autres à sa mort. Trois lignes de conf + un test de redéploiement.

### P.2 [MINEUR] Result backend Redis sans `result_expires` : croissance illimitée de la base 1

- **Fichiers** : `core/config.py:188` (`celery_result_backend` = Redis db 1) ; aucun `result_expires` dans la conf (grep négatif).
- **Description** : le prompt demandait si les résultats sont purgés. Défaut Celery : `result_expires=86400` (24 h)... vérification : le défaut existe (1 jour), donc la croissance est **bornée par défaut** — MAIS aucun réglage explicite ne le garantit si une future conf le touche, et les résultats des chords (group results) peuvent être plus lourds. Risque réel faible.
- **Impact** : mémoire Redis consommée par les résultats des 15 tasks (petits dicts) — marginal, auto-purgé à 24 h par défaut.
- **Recommandation** : poser `result_expires=3600` explicitement (les résultats ne sont jamais lus après usage — les valeurs de retour servent au débogage uniquement) — une ligne, explicite l'intention.

### P.3 [MINEUR] Queue `ingestion` dimensionnée pour 3 crontabs unitaires... mais pas pour `run_active_scrapers`

- **Fichiers** : `celery_app.py:80-97` (3 entrées `run_source_scraper` unitaires à 06:00/05/10) ; `task_routes` place `run_active_scrapers` aussi sur `ingestion` (`:50`) — task non planifiée (F.1).
- **Description** : le prompt demandait si la queue `ai` peut être saturée par le sweep 5 min + jobs scraping — réponse K.5 (débit plafonné, pas de saturation). Le point dimensionnement restant : si F.1 est corrigé par un `scrape-all-sources` unique à 06:00, la queue `ingestion` reçoit un seul message qui fan-oute vers N tasks `run_source_scraper` — dimensionnement inchangé (elles repartent sur `ingestion`). Si au contraire le beat dynamique par source (option b de F.1) est choisi, la queue recevra N crontabs simultanés à 06:00 → prévoir la concurrence worker (subprocess Python mémoire ~200-400 Mo chacun).
- **Impact** : aucun aujourd'hui ; à documenter au moment de la correction F.1.
- **Recommandation** : couplé à F.1 — si option (a), rien à faire ; si option (b), vérifier la mémoire worker Render (concurrency 1-2) et l'étagement par `default_scan_time`.

### P.4 [MINEUR] Redémarrage de beat : recalcul OK, mais single-instance non garanti par le code

- **Fichiers** : `celery_app.py:28-34` (`_hour_in_utc` recalculé à chaque import — sans état, sans risque de dérive, DST vérifié F.4) ; aucun `render.yaml` garantissant une seule instance de beat (F.5).
- **Description** : le prompt demandait le risque si beat est redémarré et si plusieurs répliques peuvent coexister. Vérifié : le module est stateless (aucun état partagé entre instances), le calcul est déterministe — un redémarrage est neutre. Le risque multi-réplique est **réel** si Render scale le service beat (chaque instance déclencherait les crontabs en double : doublons de messages — mitigés par les verrous par task, heureusement) : rien dans le repo ne matérialise l'engagement « une seule instance de beat ».
- **Impact** : double envoi potentiel des crontabs si scaling horizontal accidentel — les verrous Redis (`redis_lock` par source/jour) neutralisent l'exécution, au prix de warnings noyés.
- **Recommandation** : couvert par F.5 (render.yaml blueprint avec service beat `scale: 1` ou doc de déploiement) ; renvoi.

### Tableau de synthèse — Domaine P

| # | Constat | Sévérité | Fichiers principaux | Recommandation | Effort |
|---|---|---|---|---|---|
| P.1 | `acks_late`/`reject_on_worker_lost` absents : perte de tâche au crash worker | **Majeur** | `celery_app.py:134-142` | `acks_late=True` + `reject_on_worker_lost=True` + prefetch=1 | Petit |
| P.2 | `result_expires` non posé (défaut 24 h implicite) | Mineur | `core/config.py:188` | `result_expires=3600` explicite | Petit |
| P.3 | Dimensionnement queue ingestion : à trancher avec F.1 | Mineur | `celery_app.py:80-97` | Couplé F.1 (option a : rien) | — |
| P.4 | Single-instance beat non garantie par le repo | Mineur | renvoi F.5 | render.yaml / doc | Moyen |

**Hypothèses ouvertes** : aucune.

---

## Synthèse globale — Top 10 des points critiques/majeurs (backlog actionnable)

Classement par impact × effort (les deux Critiques C.1/C.2 en tête, puis les Majeurs qui gèlent ou aveuglent le pipeline) :

| # | Constat (domaine) | Sévérité | Effort | Action |
|---|---|---|---|---|
| 1 | **Trigger admin fantôme** : `POST /scraping/trigger` crée des runs PENDING jamais consommés, ne lance rien (C.1 + C.3) | Critique | Moyen | Relier au pipeline : `run_source_scraper.apply_async` par source du run + avancement des `SourceScrapeRun` |
| 2 | **Double trigger = 500** : `IntegrityError` non gérée sur `uq_scrape_runs_date_triggered_by` (C.2) | Critique | Petit | `except IntegrityError → 409` métier + pré-check |
| 3 | **Runs zombies** : RUNNING/PENDING à vie, un zombie **gèle l'IA sweep** (`_scrapers_finished_today`), aucun détecteur (M.1) | Majeur | Petit | Beat `requalify_stale_runs` (RUNNING > 6 h → FAILED, PENDING > 24 h → FAILED) |
| 4 | **`acks_late` absent** : crash/redéploiement worker mid-task = tâche perdue silencieusement, digest phantom `sending` (P.1) | Majeur | Petit | `task_acks_late=True` + `task_reject_on_worker_lost=True` + prefetch 1 |
| 5 | **Échecs de scraping invisibles en base** : scraper planté/timeout = zéro trace admin, la question « pourquoi 0 offre » reste sans réponse (A.1 + E.5) | Majeur | Moyen | Events/runs d'échec sur les chemins d'abandon + agrégation des résultats du chord |
| 6 | **`AI_CIRCUIT_BREAKER_MINUTES` mort** (B.1) + **inondation AIAlert** (B.4) : fausse configurabilité + ~288 alertes/jour en panne IA | Majeur | Petit | Câbler le setting (1 ligne) + cooldown par type d'alerte + purge |
| 7 | **Password takeover non tracé** : `/me/password`, `/reset-password`, `/logout`, `/ai/run` sans journalisation (A.2 + A.10) | Majeur | Petit | `log_admin_action` sur les 4 routes (details IP/email, pas le secret) |
| 8 | **Rétention absente** : `OfferIngestionEvent` avec `raw_payload` doublé + compteurs globaux full-scan (A.3 + K.1) | Majeur | Moyen | Task purge 90 j (pattern purge refresh tokens) + fenêtre par défaut sur les compteurs |
| 9 | **`retry_failed_digests` hors beat** : panne Resend 2 h = journée perdue sans rattrapage automatique (M.2) | Majeur | Petit | Inscrire au beat (crontab horaire) + à terme breaker Resend |
| 10 | **Source ajoutée via l'admin jamais scrapée** : beat en dur, `run_active_scrapers` non planifiée (F.1) | Majeur | Petit/Moyen | Un crontab `scrape-all-sources` 06:00 → `run_active_scrapers` (option a) ou beat dynamique (b) |

**Suivants directs (Majeurs confirmés mais hors top 10)** : fragments de clés réelles dans le seed (B.2 — purge immédiate recommandée), knobs `rate_limit_per_minute`/`max_concurrent_requests` inertes (B.3), verrou Redis fail-open non documenté (E.1), `mark_duplicate` non idempotent (E.2), ancien statut source non tracé (D.1), `SiteSetting` sans validation à l'écriture (G.2), journal unifié absent (G.1 — socle de O.2/A.1), `EmailDigestRead.match_tier` absent du schéma (H.1 — une ligne).

**Verdict global** : backend **solide et bien audité par le passé** — 16 domaines, aucun Critique de sécurité, aucune perte de données possible par design (idempotence, savepoints, verrous). Les 2 Critiques sont fonctionnels (bouton déclenchement fantôme + 500), les 14 Majeurs se répartissent en 3 familles : **traçabilité des échecs** (A.1, A.2, A.3, B.4, M.1, M.2, P.1), **fausse configurabilité** (B.1, B.3, F.1, F.2, G.2), **cohérence trigger/pipeline** (C.1, C.2, C.3, D.1, E.2). Le backlog top 10 est majoritairement **Petit effort** (7/10) : une après-midi de corrections ciblées éliminerait tous les Majeurs opérationnels.

---

*Fin de l'audit — rapport complet dans `server/audits/Audit_Report_4_part_1.md` (bloc 1 : A→H) et `server/audits/Audit_Report_4_part_2.md` (bloc 2 : I→P + synthèse).*

