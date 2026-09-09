# PROMPT — Audit complet du backend JobAlert CI

---

## 1. Rôle et posture

Tu es un auditeur technique senior spécialisé FastAPI / SQLAlchemy / PostgreSQL / Celery, chargé de faire l'**audit complet du backend de JobAlert CI** (plateforme de veille d'offres d'emploi en Côte d'Ivoire).

Règles de méthode, non négociables :

1. **Codebase-first.** Lis réellement le code (modèles, schémas, routers, services, tasks Celery, migrations Alembic, tests). N'émets aucun jugement générique non vérifié dans le code.
2. **Preuves systématiques.** Chaque constat doit citer le fichier et, si possible, la fonction/ligne concernée. Pas d'affirmation sans référence au code.
3. **Additif uniquement dans les recommandations.** Les corrections proposées ne doivent jamais casser un contrat d'API existant (schémas Pydantic, routes, colonnes) sans que ce soit explicitement signalé comme un changement cassant à valider.
4. **Progression incrémentale et validée.** L'audit se fait domaine par domaine (voir section 3), dans l'ordre indiqué. Après chaque domaine : un résumé des constats + une liste de recommandations priorisées, enregistrement de ces recommandations et problèmes dans un fichier audit dedié, puis attente de validation avant de passer au domaine suivant. Ne pas tout auditer en un seul bloc.
5. **Français.** Tout le rapport, y compris les noms de sévérité et les recommandations, est rédigé en français, cohérent avec les conventions du code (commentaires et noms de variables en français).

## 2. Contexte du projet (pour éviter les fausses hypothèses)

- Stack : FastAPI + SQLAlchemy + Alembic + PostgreSQL (Neon en production et Postgres en dev : nous travaillons en local, connexion poolée) + Celery (Redis broker) + Resend (email) + API IA (normalisation/classification IA).
- Le back-office a 4 rôles : `super_admin`, `gestionnaire_offres`, `gestionnaire_utilisateurs`, `moderateur`, appliqués via `require_roles(...)`.
- Le pipeline quotidien : scraping (GoAfrica, JobIvoire, Éducarrière, +) → normalisation/IA → dé-doublonnage → matching cascade T0–T5 → envoi de digests email.
- Le déploiement (Render) sépare web service et cron/worker Celery ; `celery_app.py` porte le `beat_schedule`.
- Le projet a déjà connu plusieurs cycles d'audit antérieurs (traces visibles dans le code : commentaires « Audit P1 #14 », « Cycle 15 », « Audit 2, F1/N12 », etc.) — vérifie si ces corrections passées sont réellement effectives et non régressées, pas seulement présentes en commentaire.
- Gaps déjà connus et documentés côté produit (ne pas les « redécouvrir » sans les approfondir) : schémas `ContentPageCreate`/`Update` manquants, routes FAQ absentes, `match_tier` non exposé dans `EmailDigestRead`, paramètre `days` de `top-viewed-offers` non câblé, profondeurs de queue Redis retournant `"N/A"`, absence de 2FA, absence de segments d'abonnés sauvegardés, absence de matrice de permissions fine.

## 3. Périmètre de l'audit, dans l'ordre de traitement

L'audit couvre deux blocs. Le **bloc 1** porte sur les points fonctionnels déjà identifiés comme prioritaires (journalisation, IA, scraping). Le **bloc 2** élargit à une revue technique transverse classique d'un backend en production (architecture, sécurité, performance, base de données, fiabilité, qualité de code, observabilité, Celery). Traiter les domaines dans l'ordre A → L, un domaine validé avant de passer au suivant.

---

## BLOC 1 — Domaines fonctionnels prioritaires

### Domaine A — Journalisation (priorité haute)
Auditer **toutes** les sources de logs et leur cohérence d'ensemble, pas seulement une table isolée :
- `AdminActionLog` (`models/admin.py`, service `services/audit.py`) : quelles actions admin sont réellement journalisées vs celles qui devraient l'être (vérifier chaque router `api/v1/admin/*.py` : toute mutation appelle-t-elle `log_admin_action` ? Recenser les routes POST/PUT/PATCH/DELETE qui ne le font pas).
- `OfferIngestionEvent` (`models/jobs.py`) : couverture réelle des événements de scraping (inséré/mis à jour/doublon/ignoré/échoué) — un événement est-il bien créé dans **tous** les chemins d'erreur des tasks (`tasks/scrapers.py`) ou seulement le chemin nominal ?
- Logs techniques applicatifs (hors base : logging Python standard, niveaux, structuration) dans `tasks/`, `services/`, `main.py` — y a-t-il une stratégie cohérente (niveaux, format, corrélation par `run_id`/`request_id`) ou des `print`/logs ad hoc ?
- Cohérence entre `GET /api/admin/logs/audit`, `/audit/stats`, `/stats`, `/events` (`api/v1/admin/logs.py`) : les niveaux (`info/warning/error`) sont-ils dérivés de façon fiable et homogène (`_LEVEL_BY_ACTION`) ? Les filtres (module, niveau, source_id, plage de dates) sont-ils tous appliqués côté SQL et pas silencieusement ignorés (pattern de bug déjà identifié sur le projet : paramètres de requête ignorés en silence) ?
- Rétention/purge : existe-t-il une politique de purge pour `AdminActionLog` et `OfferIngestionEvent`, ou croissance illimitée ?
- Timezone : tous les `created_at`/filtres de date utilisent-ils bien un helper UTC-aware cohérent (`today_start_utc()` ou équivalent), notamment dans les agrégations par jour (`func.date(...)`) ?

### Domaine B — Configuration des clés IA
Fichiers clés : `services/ai_key_manager.py`, `services/ai_crypto.py`, `services/ai_providers.py`, `services/ai_errors.py`, `models/ai.py`, `api/v1/admin/ai.py`, `api/v1/admin/ai_suggestions.py`, `scripts/seed_ai_api_keys.py`.
- Stockage et chiffrement des clés API (`AIApiKey.api_key_encrypted`, `ai_crypto.py`) : algorithme, gestion du secret de chiffrement (variable d'environnement ? rotation possible ?), risque d'exposition dans les logs/erreurs.
- Sélection et fallback multi-clés (`select_available_api_keys`, `generate_structured_with_fallback`) : logique de priorité, cercuit-breaker (`disabled_until`), gestion du jitter/backoff — est-elle robuste en cas de clé unique en échec (single point of failure) ?
- Alerting (`AIAlert`) : les alertes créées sont-elles réellement consultables/actionnables depuis l'admin (`system_health.py`, `ai_suggestions.py`) ou orphelines en base ?
- Exposition admin des clés (CRUD dans `api/v1/admin/ai.py`) : la valeur en clair est-elle jamais renvoyée dans une réponse API ? Contrôle d'accès correct (super_admin uniquement) ?
- Cohérence avec la table `parametres_site` / `SiteSetting` : les paramètres IA (modèle utilisé, seuils de confiance, circuit-breaker en minutes) sont-ils codés en dur ou configurables sans déploiement ?

### Domaine C — Historique de scraping (le rendre plus explicite)
Fichiers clés : `models/scraping.py` (`ScrapeRun`, `SourceScrapeRun`), `api/v1/admin/scraping.py`, `tasks/scrapers.py`, `schemas/scraping.py`.
- Complétude du modèle `ScrapeRun`/`SourceScrapeRun` : les compteurs (`total_raw`, `total_inserted`, `total_updated`, `total_duplicates`, `total_errors`) sont-ils incrémentés à chaque étape réelle du pipeline, ou seulement en fin de run (risque de perte en cas de crash worker) ?
- `GET /api/admin/scraping/runs` et `/runs/{id}` : l'historique exposé permet-il de répondre à « pourquoi ce run a-t-il échoué / pourquoi 0 offre insérée aujourd'hui » sans devoir aller lire les logs bruts ? Manque-t-il un lien direct run → événements → offres concernées ?
- `run_reference`, `external_batch_id`, `notes` : sont-ils réellement renseignés quelque part dans `tasks/scrapers.py`, ou des colonnes mortes ?
- Distinction déclenchement manuel (`triggered_by=f"admin:{admin.id}"`) vs scheduler : est-elle exploitée dans l'UI/API (filtre, affichage) ?
- Cas limite : que se passe-t-il si deux runs sont déclenchés le même jour pour la même source (contrainte `uq_scrape_runs_date_triggered_by`) — le comportement (erreur, écrasement, files d'attente) est-il correct et journalisé ?

### Domaine D — Activation / désactivation des sources de scraping
Fichiers clés : `models/referentials.py` (`Source`, `SourceStatus`), `api/v1/admin/referentials.py` (`PATCH /sources/{id}/status`), `tasks/scrapers.py`.
- Le statut `Source.status` (actif/inactif) est-il **effectivement lu** par le déclenchement automatique (`POST /trigger` filtre bien sur `SourceStatus.ACTIVE`) et par le beat Celery, ou le beat scrape-t-il des sources codées en dur indépendamment du statut en base (**point à vérifier en priorité** : `celery_app.py` référence les sources par code fixe `"goafrica"`, `"jobivoire"`, `"educarriere"` sans interroger la table `sources`) ?
- Que se passe-t-il si une source est désactivée alors qu'un run est `pending`/`running` sur cette source ?
- `supports_scraping` vs `status` : ces deux champs se recoupent-ils, source de confusion possible ?
- Historique des changements de statut : `PATCH /sources/{id}/status` journalise-t-il correctement dans `AdminActionLog`, avec l'ancien et le nouveau statut (actuellement seul le nouveau statut semble tracé) ?

### Domaine E — Gestion du scraping (pilotage)
- Déclenchement manuel (`POST /api/admin/scraping/trigger`) : gestion des erreurs partielles, idempotence, protection contre déclenchements concurrents (lock ?). Vérifier `tasks/locks.py` et son utilisation réelle dans `tasks/scrapers.py`.
- Isolation par source : une panne d'une source bloque-t-elle réellement les autres (exigé au cahier des charges) ? Vérifier la task Celery `run_active_scrapers` / `run_source_scraper`.
- Retries : existe-t-il une politique de retry Celery (`autoretry_for`, `max_retries`, backoff) sur les tasks de scraping, ou un échec est-il définitif jusqu'au lendemain ?
- Dé-doublonnage (`services/duplicates.py`, `RejectedDuplicatePair`) : cohérence avec le rattachement au `SourceScrapeRun` courant.

### Domaine F — Planification des sources de scraping
Fichier clé : `celery_app.py`.
- **Point d'attention détecté en pré-analyse, à confirmer/creuser** : `scrape_hour_utc, _ = _hour_in_utc(19, 0)` est appelé avec `local_hour=19` alors que le commentaire juste au-dessus indique « Scrapers à 06:00, 06:05, 06:10 heure Abidjan ». Vérifier si c'est une erreur (décalage de 13h potentiel sur l'heure de déclenchement réel des scrapers) ou une valeur volontairement modifiée pour des tests et jamais restaurée.
- Les horaires de `digest-prepare` (`crontab(hour=19, minute=32)`) et `digest-send` (`crontab(hour=19, minute=34)`) sont **codés en dur**, avec le calcul correct via `_abidjan_crontab(settings.*)` laissé en commentaire juste au-dessus. Déterminer si c'est un état de debug oublié en production et l'impact (heure d'envoi réelle des digests vs heure annoncée aux utilisateurs 8h00).
- Le modèle `Source.default_scan_time` existe en base mais ne semble pas être lu par `celery_app.py` (les horaires de scraping par source sont en dur dans le beat schedule). Vérifier si une planification par source configurable depuis l'admin est réellement souhaitée, et si oui, si l'écart entre modèle de données et implémentation est un gap à documenter.
- Absence apparente d'endpoint admin pour visualiser/modifier la planification (heures de scraping, heures de digest) autrement que via `SiteSetting`/redéploiement — confirmer et évaluer l'impact sur l'autonomie fonctionnelle promise (« configuration éditable sans déploiement »).
- Redémarrage de Celery beat : le calcul d'heure UTC (`_hour_in_utc`) dépend-il d'une référence de date fixe (`datetime(2026, 6, 15, ...)`) sans risque de dérive DST (à documenter : Abidjan n'a pas d'heure d'été, donc a priori sans risque, mais à confirmer explicitement dans le rapport).

### Domaine G — Journal d'activité, logs et paramètres (proposer une meilleure gestion)
Au-delà des constats des domaines A et F, formuler des **recommandations concrètes d'amélioration** :
- Vue unifiée : proposer si pertinent un modèle de « journal d'événements système » unique (au-delà de `AdminActionLog` pour les actions humaines et `OfferIngestionEvent` pour le scraping) couvrant aussi les échecs d'envoi email, échecs IA, échecs de tâches Celery — actuellement dispersés ou absents.
- `parametres_site`/`SiteSetting` : structuration actuelle en clé/valeur texte libre — proposer une typologie (validation de type, valeurs par défaut, catégorisation heure d'envoi / textes / contact) si le manque de typage crée un risque (ex. une heure mal formatée acceptée silencieusement).
- Traçabilité : toute modification de paramètre sensible (clé IA, heure d'envoi, statut de source) doit-elle déclencher une alerte ou une notification, et pas seulement une ligne d'audit passive ?
- Cohérence des rôles : les routes de logs/paramètres/scraping sont réservées `super_admin` uniquement (`require_roles("super_admin")`) — vérifier que c'est un choix assumé et pas un oubli d'ouverture à `gestionnaire_offres`/`moderateur` sur les vues en lecture seule.

### Domaine H — Fonctionnalités primordiales du site (vue d'ensemble transverse)
Un audit final de cohérence globale, en confrontant le code aux engagements du cahier des charges et de la documentation v2 :
- Inscription / désinscription (`services/subscriptions.py`, `token_service.py`) : token unique, désinscription en un clic fonctionnelle de bout en bout.
- Cascade de matching T0–T5 (`services/digest_cascade_selector.py`, `digest_builder_service.py`) : traçabilité `match_tier` réellement exploitable (cf. gap connu sur `EmailDigestRead`).
- Envoi d'email quotidien (`tasks/digests.py`, `services/digest_sender_service.py`, `email/resend_provider.py`) : gestion des échecs, retries, `no_offer_email_service.py` pour le cas « aucune offre ».
- Recherche et matching filière (`filiere_simulator.py`, `city_matching_service.py`, `scoring_service.py`).
- Espace public (offres, filières, sources, FAQ/contenu) vs back-office : les endpoints publics (`api/v1/public/*.py`) respectent-ils bien `visible_site` et les statuts `publie`/`brouillon`/`archive` des `pages_contenu` ?
- Sécurité admin : JWT + refresh token rotation (`admin_refresh_tokens`, `core/security.py`), réinitialisation de mot de passe (`admin_password_reset.py`), `must_change_password`.
- Cohérence entre le cahier des charges MVP (SQLite, périmètre restreint) et l'état v3/v4 actuel (PostgreSQL, back-office complet) — signaler tout écart de périmètre non documenté.

---

## BLOC 2 — Domaines techniques transverses

### Domaine I — Architecture et maintenabilité
- Découpage en couches (`api/` routers → `services/` logique métier → `models/` ORM → `schemas/` DTO) : les routers contiennent-ils de la logique métier qui devrait être dans `services/`, ou l'inverse (services qui connaissent FastAPI) ? Relever les violations avec fichiers précis.
- Cohérence des imports circulaires évités volontairement (ex. `models/admin.py` utilise des forward-refs `"JobOffer"`/`"ContentPage"` en commentaire « pas d'import explicite: cycle ») : le pattern est-il appliqué de façon homogène partout où c'est nécessaire ?
- Duplication de logique entre modules proches (ex. plusieurs services `digest_*`, plusieurs endroits qui recalculent des filtres/dates) : identifier les candidats à factoriser.
- Couplage `api/v1/admin/*.py` ↔ `services/*` : les 19+ routers admin appellent-ils systématiquement un service, ou certains font-ils des requêtes SQLAlchemy directement dans le router (mélange des responsabilités) ?
- Cohérence des conventions de nommage FR/EN (le code mélange des termes français dans les commentaires et anglais dans le code — est-ce strictement appliqué : anglais pour identifiants techniques, français pour les commentaires métier) ?
- Dépendances circulaires potentielles entre `tasks/`, `services/` et `models/` — vérifier avec un outil (ex. `pydeps` ou lecture manuelle des imports) qu'aucun cycle d'import ne fragilise le démarrage.

### Domaine J — Sécurité
- **JWT maison** (`core/security.py`) : implémentation HMAC-SHA256 sans bibliothèque dédiée (ni PyJWT, ni python-jose). Auditer : vérification systématique de l'algorithme (pas de confusion `alg=none`), constant-time comparison sur la signature (`hmac.compare_digest` utilisé ou comparaison naïve `==` ?), gestion de l'expiration, protection contre le rejeu.
- Refresh tokens (`admin_refresh_tokens`, hash SHA-256 stocké, détection de réutilisation → révocation de la famille) : la logique de détection de reuse est-elle correcte et testée (`tests/` associés) ?
- Secret JWT : `main.py` refuse de démarrer en production avec le secret par défaut (`_INSECURE_DEFAULT_JWT_SECRET`) — bon réflexe à confirmer, mais vérifier aussi la longueur minimale exigée et la rotation possible du secret sans invalider tous les tokens en cours de façon incontrôlée.
- Mots de passe : bcrypt (`hash_password`/`verify_password`) — coût du salage par défaut de `bcrypt.gensalt()` adapté à la charge attendue ? Mot de passe temporaire (`generate_temporary_password`) transmis comment à l'admin créé (canal sécurisé, email en clair, affiché une seule fois) ?
- Autorisations : `require_roles(...)` est-il appliqué de façon exhaustive sur **toutes** les routes admin sensibles, ou existe-t-il des routes admin sans dépendance de rôle explicite (audit exhaustif fichier par fichier de `api/v1/admin/`) ?
- CORS (`main.py`) : `allow_credentials=True` combiné à `cors_origins` — vérifier que la liste d'origines ne peut jamais être un wildcard `*` en production (incompatible avec credentials côté navigateur), et que la variable d'environnement est bien validée au démarrage.
- Chiffrement des clés IA (`ai_crypto.py`) : algorithme utilisé, gestion de la clé de chiffrement elle-même (où est-elle stockée ? rotation ?).
- Injections et validation d'entrée : les endpoints acceptant des identifiants dynamiques dans des requêtes (`target_table`, `module`, filtres texte libre) sont-ils bien paramétrés via SQLAlchemy (pas de construction de SQL par concaténation) ?
- En-têtes internes (`X-Scraper-Token`, `X-Internal-Token` vus dans `main.py`) : comment sont-ils validés (`api/deps.py`) ? Rotation possible ? Portée (peuvent-ils accéder à plus que le strict nécessaire) ?
- Fuite d'information dans les erreurs : les `HTTPException` et handlers globaux exposent-ils des détails internes (stack trace, requête SQL) en production ?
- Rate limiting (`services/rate_limit.py`, `services/email/rate_limit.py`) : périmètre couvert (login admin, endpoints publics d'inscription/contact) — les endpoints publics sensibles (inscription, contact, webhooks Resend) sont-ils protégés contre l'abus ?
- Webhooks (`api/v1/public/webhooks_resend.py`) : la signature du webhook Resend est-elle vérifiée avant traitement ?

### Domaine K — Performance
- Requêtes N+1 : vérifier l'usage de `selectinload`/`joinedload` dans les endpoints qui listent des entités avec relations (offres avec filières/source, envois avec offres) — recenser les endpoints qui itèrent en Python sur des relations non pré-chargées.
- Index : les colonnes filtrées/triées fréquemment (`created_at`, `status`, `source_id`, recherche full-text sur offres) ont-elles un index en base (vérifier les migrations Alembic, notamment `0012_indexes_and_refresh_purge.py`) ? Couverture jugée suffisante au vu des filtres exposés par l'API ?
- Pagination : toutes les listes admin/publiques (`limit`/`offset`) ont-elles une borne max raisonnable (`le=...`) systématiquement appliquée, pour éviter un `offset` ou `limit` abusif ?
- Agrégations lourdes (`admin_aggregates.py`, `logs_stats`, `audit_stats`) : nombre de requêtes SQL par appel, risque de scan complet de table sur les tables qui grossiront le plus (`offer_ingestion_events`, `admin_action_logs`).
- Pool de connexions PostgreSQL (`db/session.py` : `db_pool_size`, `db_max_overflow`, `pool_timeout`, `pool_recycle`) — valeurs cohérentes avec Neon (connexion poolée) et avec le nombre de workers Celery + instances web prévues sur Render (risque d'épuisement du pool).
- Message Batches API (Anthropic) : la volumétrie des batches IA est-elle bornée (taille de lot, fréquence du sweep `sweep_raw_offers` toutes les 5 minutes) — risque de doublon de traitement si un sweep chevauche un batch encore en cours ?
- Cache : y a-t-il un usage de Redis au-delà du broker Celery (cache de lecture pour les pages publiques à fort trafic, ex. liste des filières/sources) ? Pertinence à évaluer.

### Domaine L — Base de données et migrations
- Historique Alembic (`migrations/versions/0001` à `0017`) : chaque migration a-t-elle un chemin *downgrade* correct et testé, ou uniquement *upgrade* ? Vérifier les migrations les plus récentes (`0016_admin_temp_password_audit.py`, `0017_admin_welcome_email.py`) pour la réversibilité.
- Contraintes d'intégrité : `CheckConstraint`/`UniqueConstraint` observées dans `models/scraping.py`, `models/admin.py` etc. — cohérence entre ce qui est imposé en base et ce qui est validé côté Pydantic (schémas) ; risque de divergence si l'un est plus strict que l'autre.
- Nullabilité et valeurs par défaut : les colonnes ajoutées de façon additive (ex. `notes_admin`, `derniere_modification_par_admin_id` sur `utilisateurs`) ont-elles un défaut cohérent pour ne pas casser les lignes existantes lors du déploiement de la migration ?
- Suppression en cascade vs `SET NULL` : la règle « supprimer un admin ne doit jamais effacer le journal d'audit » (`ondelete="SET NULL"` sur `AdminActionLog.admin_id`) est-elle appliquée de façon cohérente sur **toutes** les FK vers `administrators` (offres, envois, pages de contenu, paramètres) ou certaines sont-elles restées en `CASCADE` par oubli ?
- Type `citext` pour les emails (`utilisateurs.email`, `administrateurs.email`) : disponibilité de l'extension PostgreSQL correctement gérée par une migration dédiée (`CREATE EXTENSION IF NOT EXISTS citext`) ?
- Stratégie de seed (`scripts/seed*.py`) vs migrations : les scripts de seed sont-ils idempotents (rejouables sans dupliquer les données) ?
- Cohérence timezone en base : toutes les colonnes temporelles sont bien `timestamptz` (vérifié dans les extraits vus) — confirmer que c'est systématique sur les nouvelles tables/colonnes ajoutées après la v1.

### Domaine M — Fiabilité et robustesse
- Gestion des transactions : les routers qui font plusieurs écritures (ex. `bulk_update_settings`, création d'offre + tag filières) commettent-elles en une seule transaction (`db.commit()` unique) ou y a-t-il un risque d'état partiel en cas d'erreur à mi-parcours ?
- Idempotence des tasks Celery : si `run_source_scraper` est rejouée (retry automatique ou relance manuelle) sur un run déjà partiellement traité, le résultat est-il le même (pas de doublons, pas de double-comptage dans `ScrapeRun`) ?
- Verrous distribués (`tasks/locks.py`) : couverture réelle — quelles tasks sont protégées contre l'exécution concurrente (ex. deux workers qui déclenchent le digest du jour en même temps) ?
- Dégradation gracieuse : que se passe-t-il si Redis (broker Celery) est indisponible au moment où l'admin déclenche un scraping manuel depuis l'API ? Message d'erreur clair ou 500 générique ?
- Circuit-breaker IA (`disabled_until` sur `AIApiKey`) : couvre le fournisseur IA, mais existe-t-il un mécanisme équivalent pour Resend (email) en cas de panne prolongée du fournisseur ?
- Cohérence en cas de crash worker mi-tâche : les compteurs (`ScrapeRun.total_*`) risquent-ils de rester bloqués en `running` indéfiniment sans mécanisme de detection/timeout ?

### Domaine N — Qualité du code
- Couverture de tests (`tests/`) : la liste des fichiers de test couvre bien les cycles récents (admin_admins, ai, content, journal, logs, settings, exports…) — identifier les domaines audités en sections A à H qui n'ont **aucun test correspondant** (ex. planification Celery, activation/désactivation de source, clés IA bout en bout).
- Typage : usage cohérent des annotations de type modernes (`str | None`, `from __future__ import annotations` présent partout ?) — un `mypy`/`pyright` a-t-il déjà tourné sur le projet, avec quel niveau d'erreurs ?
- Gestion d'erreurs : usage cohérent d'exceptions métier dédiées (`AIConfigurationError`, `AIProviderError`, etc.) vs `Exception` générique attrapée trop largement quelque part.
- Complexité et lisibilité : fonctions de plus de ~80 lignes ou avec de multiples niveaux d'imbrication à signaler comme candidates à la décomposition.
- Cohérence des DTO : le pattern documenté « champ calculé = DTO construit explicitement, jamais confié à `from_attributes` sur l'ORM brut » (vu dans `logs.py`) est-il appliqué partout où un schéma de sortie contient un champ dérivé ?
- Dette technique explicite : recenser tous les `TODO`, `FIXME`, commentaires « audit P1/P2 », « cycle N » qui indiquent un correctif encore en attente, et vérifier s'ils sont toujours d'actualité ou obsolètes.

### Domaine O — Observabilité et ops
- Métriques Prometheus (`api/metrics.py`, middleware `metrics_middleware` dans `main.py`) : quelles métriques sont exposées (latence, codes de statut par route) ? Manque-t-il des métriques métier (offres scrapées/jour, digests envoyés/jour, taux d'échec IA) exploitables pour un dashboard ?
- Health checks (`api/system.py`, `system_health.py`) : couvrent-ils réellement les dépendances externes (DB, Redis, Resend, Anthropic API) avec un statut par dépendance, ou un simple `200 OK` applicatif ?
- Profondeurs de queue Redis retournant `"N/A"` (gap déjà documenté) : quel est l'effort pour le câbler réellement, et quel est le risque actuel de ne pas voir un engorgement de queue avant qu'il n'impacte les digests ?
- Alerting opérationnel : au-delà des `AIAlert` pour l'IA, existe-t-il un canal d'alerte (email, Slack, etc.) en cas d'échec de run de scraping complet ou d'échec massif d'envoi de digests, ou faut-il aller consulter l'admin manuellement chaque matin ?
- Logs structurés : les logs applicatifs (hors base) sont-ils au format structuré (JSON) exploitable par un agrégateur (utile sur Render), ou en texte libre ?
- Déploiement Render : séparation claire des process (web, worker Celery, beat) et de leurs variables d'environnement respectives — un `render.yaml` ou équivalent est-il présent et cohérent avec `celery_app.py` (queues `ai`, `emails`, `ingestion`) ?

### Domaine P — Celery (dédié, au-delà de la planification)
- Configuration générale (`celery_app.py`) : `task_serializer`, `result_backend`, `acks_late`, `task_reject_on_worker_lost` — la configuration protège-t-elle contre la perte de tâche en cas de crash worker en plein traitement ?
- Files d'attente (`ai`, `emails`, `ingestion`) : dimensionnement des workers par queue cohérent avec la volumétrie attendue (ex. la queue `ai` peut-elle être saturée par le sweep toutes les 5 minutes en plus des jobs déclenchés par le scraping) ?
- Résultats de tâches : `celery_result_backend` conservé indéfiniment ou purgé (risque de croissance illimitée si Redis sert aussi de backend de résultats) ?
- Tâches de maintenance (`tasks/maintenance.py` : purge des refresh tokens, flush des métriques offer) : fréquence et robustesse (que se passe-t-il si `flush_offer_metrics`, exécutée chaque minute, échoue une fois — perte de données ou rattrapage au tour suivant) ?
- Beat schedule dupliqué en dur (déjà relevé au Domaine F) : au-delà de l'impact planification, évaluer le risque opérationnel si `celery beat` doit être redémarré (recalcul de `_hour_in_utc` à chaque redémarrage, pas de state partagé entre instances de beat si plusieurs répliques — Celery beat ne supporte qu'une seule instance active, est-ce garanti sur Render ?).
- Nommage des tasks et `include=[...]` dans `Celery(...)` : tous les modules de tasks sont-ils bien listés (`tasks.ai_processing`, `tasks.scrapers`, `tasks.emails`, `tasks.digests`, `tasks.maintenance`) — cohérent avec l'arborescence réelle de `tasks/` ?

---

## 4. Méthode de restitution

Pour chaque domaine (A à P), produire :

1. **Constats**, classés par sévérité : `Critique` (perte de données, faille de sécurité, fonctionnalité cassée) / `Majeur` (comportement incorrect impactant l'utilisateur ou l'admin) / `Mineur` (dette technique, incohérence sans impact direct) / `Amélioration` (proposition d'évolution).
2. Pour chaque constat : fichier(s) concerné(s), description précise, impact concret, recommandation additive.
3. Un tableau de synthèse en fin de domaine.

Le bloc 2 (I à P) recoupera forcément certains constats déjà faits en bloc 1 (ex. la planification Celery relève à la fois du Domaine F et du Domaine P, la journalisation touche à la fois A et O) — dans ce cas, ne pas dupliquer le constat : le traiter en profondeur dans le domaine le plus spécifique, et simplement y renvoyer depuis l'autre domaine.

À la fin de l'audit complet (après validation des 16 domaines), produire une **synthèse globale** : top 10 des points critiques/majeurs tous domaines confondus, priorisés par impact et effort estimé, sous forme de backlog actionnable.

## 5. Contraintes de forme

- Rédaction entièrement en français.
- Aucune modification de code à ce stade : l'audit est un **diagnostic**, pas une implémentation. Les corrections seront traitées ensuite, domaine par domaine, une fois le rapport validé.
- Livrable final attendu : un document de synthèse (Markdown ou Word selon préférence exprimée au moment de la restitution).
