# Back-office JobAlert CI — enrichissement admin (étape 2026-09)

Spécification fonctionnelle et technique pour les améliorations backend du
back-office admin (`/api/admin/*`), basées sur le document de référence `8_Enrichir_Admin_JobAlert.md` et la session `feat/admin-enrichissement` (`origin/scrappe`).

Ce fichier complète (ne remplace pas) le `digest-pipeline.md` et le
`SKILL.md` du skill `jobalert-server`.

---

## 1. Tableau de bord — qualité du matching + file d'attente IA + alertes

### Endpoints
- `GET /api/admin/sending/tier-stats` (déjà existant) : renvoie la distribution des paliers de matching (`match_tier` T0-T5) par digest. Utilisé par le widget qualité. **Aucune modification requise** pour le widget, sauf normaliser la réponse côté client si le format change.
- `GET /api/admin/ai/queue` (nouveau) : agrégation `AIJob` (`pending`/`running`) + dernier `last_sweep_at` du sweep `sweep_raw_offers`. Schéma `AIQueueRead` dans `schemas/ai.py`.
- `GET /api/admin/ai/alerts` (nouveau) : liste paginée `AIAlert` (`acknowledged_at IS NULL`), filtres `severity`, `limit`/`offset`. Schéma `AIAlertRead` dans `schemas/ai.py`. `PATCH /ai/alerts/{id}/ack` : met `acknowledged_at` + `acknowledged_by_admin_id`.

### Point d'attention (document 7 — page 2)
- Le widget qualité doit afficher clairement le % T0 vs T1-T5, car le principe du projet est d'« éliminer les digests vides silencieux ». Si `T0` est faible, l'abonné reçoit surtout du repli (`T4-T5`) — c'est un signal d'alerte, pas un succès silencieux.

---

## 2. Gestion des offres — doublons proches

### Modèles existants (pas de migration)
- `JobOffer` (`models/jobs.py`) : `is_duplicate` (`bool`, défaut `False`), `duplicate_of_id` (`str | None`, FK `job_offers.id`), `duplicate_reason` (`str | None`, max 255).
- `AIFiliereSuggestion` (`models/ai.py`) : `code`, `label`, `status` (`PENDING`/`APPROVED`/`REJECTED`), `offer_id`, `job_id`.

### Nouveau modèle (migration `0009_rejected_duplicate_pair`)
- Table `rejected_duplicate_pairs` : `offer_a_id` < `offer_b_id` (contrainte `chk_duplicate_order`), `reason`, `reviewed_by_admin_id`, `reviewed_at`. Utilisée par le flux de rejet de doublons proches.

### Endpoints ajoutés (`api/v1/admin/offers.py`)
- `GET /api/admin/offers/duplicates/candidates` : paire A (référence) vs B (suspecte) sur `is_duplicate=False` + `duplicate_of_id IS NULL`, filtrage par `normalized_name` (entreprise) et `normalized_title` (premier mot du titre). Paramètre `min_similarity` (défaut 80) réservé à l'évolution.
- `POST /api/admin/offers/{offer_b_id}/mark-duplicate` : met à jour `JobOffer` B (`duplicate_of_id = A.id`, `is_duplicate = True`, `duplicate_reason`).
- `POST /api/admin/offers/duplicates/reject` : insère dans `rejected_duplicate_pairs` pour ne plus reproposer la paire.

### Point d'attention (document 7 — page 3)
- Le champ `status` de l'API accepte des chaînes libres (`JobOfferStatus` est un enum SQL, pas une contrainte côté route `GET /offers`). Le frontend doit être strict sur `active`/`expired`/`filled`/`archived`/`duplicate`/`hidden`/`brut` (et non `BRUTE` qui est un alias legacy).

---

## 3. Gestion des offres — statistiques de popularité

- `JobOffer.view_count` et `save_count` existent déjà dans le modèle ORM et sont exposés par `JobOfferRead`. Aucune modification requise côté backend.
- Endpoint nouveau (`api/v1/admin/aggregates.py`) : `GET /api/admin/dashboard/top-viewed-offers` (tri `view_count DESC`, limite `limit`, fenêtre `days` réservée pour évolution — aujourd'hui le tri est global sans filtre temporel car `last_view_at` n'existe pas en base). Réutilise `services/admin_aggregates.py::top_viewed_offers`.

---

## 4. Utilisateurs — palier de matching reçu

- `EmailDigest.match_tier` et `EmailDigestOffer.match_kind` existent dans la base (`models/emails.py` : `DigestStatus`, `match_tier` sur `EmailDigest`, `match_kind` sur `EmailDigestOffer`).
- `EmailDigestRead` (`schemas/emails.py`) doit être enrichi côté backend : le document 8 (1.4) demande d'exposer `match_tier` et `match_kind` dans le schéma `EmailDigestRead` (actuellement non présent — le document 7 — page 6 signale le manque).
- L'historique des envois (`GET /api/admin/subscribers/{id}/sends`) doit renvoyer ces champs enrichis.

---

## 5. Filières — simulation avant sauvegarde

### Endpoint (document 8 — 1.5)
- `POST /api/admin/filieres/simulate` (`api/v1/admin/referentials.py`) : prend une liste de mots-clés (`FiliereSimulationInput`) et renvoie `FiliereSimulationResult` (`current_keyword_count`, `proposed_keyword_count`, `offers_affected_7_days`, `message`).
- Ne modifie pas la base (`services/filiere_simulator.py` : `simulate_filiere_matching` calcule le delta sur `FiliereKeyword` et `JobOffer` sans `db.commit()` sur la filière).

### Point d'attention (document 7 — page 10)
- `PUT /filieres/{id}/keywords` remplace **intégralement** la liste (`delete` + `reinsert`). Un enregistrement partiel (liste non chargée) écrase silencieusement. L'aperçu `simulate` évite ce piège en montrant le delta AVANT la sauvegarde.

---

## 6. Envoi personnalisé — aperçu du digest

- `POST /api/admin/sending/preview` (`api/v1/admin/sending_preview.py`) : renvoie le rendu HTML simplifié du digest (réutilise la logique `payload_preview` de `digest_builder_service.py`). Ne crée pas d'`EmailDigest` persistant ; le rendu est purement en mémoire.
- Paramètres : `subscriber_id` + `offer_ids` (facultatif, sélection manuelle) ; sinon, 5 offres liées aux filières de l'abonné.

---

## 7. Journal des erreurs — regroupement côté serveur

- `GET /api/admin/scraping/errors/grouped` (document 8 — 1.7) : regroupe `OfferIngestionEvent` par message d'erreur + source + `run_id`, avec compteur (`GROUP BY` SQL). Le document 7 (page 15) signale que le regroupement est actuellement fait côté frontend ; le service `group_scraping_errors` (ou équivalent) doit être ajouté au backend pour corriger cela.
- Note : `GET /logs/events` (existant) reconstruit le journal à partir de `OfferIngestionEvent` mais filtre par niveau en mémoire (`after` fetch), ce qui rend la pagination imprécise sous filtre. Le regroupement `grouped` résout le problème du volume mais pas celui de la pagination filtrée.

---

## 8. Contenu — workflow de relecture (document 8 — 1.8)

- Le statut `en_relecture` a été ajouté au `ContentStatus` enum (`models/enums.py`) dans cette session. Côté backend, `PUT /content/articles/{id}/status` accepte `draft`/`published`/`archived` (et désormais `en_relecture`). Si la recommandation du document 8 est un statut intermédiaire `en_relecture` entre `draft` et `published`, le backend le supporte (le modèle `ContentPage` et `Article` utilisent `ContentStatus`). C'est la partie UI (front) qui doit afficher ce statut et le bouton « valider / publier » — hors scope backend.
- Note : le document 7 (page 12.5) signale un TODO non résolu : `ContentPageCreate`/`ContentPageUpdate` non branchés sur `POST`/`PUT /content/pages`. Ce prérequis reste à lever côté backend pour que l'onglet « Pages statiques » soit pleinement utilisable.

---

## 9. Page Entreprises — `/admin/companies`

- `GET /api/admin/companies` (liste paginée + recherche `q`).
- `GET /api/admin/companies/top-recruiters` (tri par nombre d'offres actives — simplifié dans cette session, utilisant `count(Company.offers)` avec `status=active`).
- `POST /api/admin/companies` (création via `CompanyCreate`).
- `PUT /api/admin/companies/{id}` (mise à jour).
- `DELETE /api/admin/companies/{id}` (soft delete via `deleted_at`).
- `POST /api/admin/companies/{target}/merge/{source}` (`services/companies::merge_companies`) : réattribue `company_id` des offres (`JobOffer.company_id`) et marque la source supprimée.

---

## 10. Suggestions de filière IA — `/admin/ai/suggestions`

- `GET /api/admin/ai/suggestions` (`status_filter` `PENDING`/`APPROVED`/`REJECTED`).
- `PATCH /api/admin/ai/suggestions/{id}` (`AIFiliereSuggestionUpdate`) :
  - `APPROVED` → crée `Filiere` (si `code` n'existe pas) + `FiliereKeyword` (label comme mot-clé initial, poids 50) ; met `AIFiliereSuggestion.status = APPROVED`, `reviewed_by_admin_id`, `reviewed_at`.
  - `REJECTED` → met `status = REJECTED`.
- Note : le modèle `AIFiliereSuggestion` a `offer_id` et `job_id` (nullable) — la route admin ne les expose pas dans `AIFiliereSuggestionRead` (seuls `code`, `label`, `reason`, `status`, `reviewed_by_admin_id` sont exposés). C'est cohérent avec le besoin du back-office (la page IA montre la suggestion, pas la trace complète du job).

---

## 11. Export de données — `/api/admin/exports/*`

- `GET /api/admin/exports/data-export/offers` (CSV/JSON, `StreamingResponse`).
- `GET /api/admin/exports/data-export/subscribers` (CSV/JSON).
- `GET /api/admin/exports/data-export/sending` (CSV/JSON, inclut `match_tier` et `template_version`).
- Filtres existants réutilisés (mêmes paramètres que `GET /offers` et `GET /subscribers`).
- `services/admin_exports.py` : `iter_offers_for_export`, `iter_subscribers_for_export`, `iter_digests_for_export` utilisent `yield_per(500)` et `StreamingResponse`.
- Note : le `test_admin_exports.py` passe 11/16 dans la session complète (5 restants : 2 échecs `subscribers_export` — `channel` absent dans le modèle `Subscriber` avant la correction faite dans `services/admin_exports.py` — corrigé dans cette session ; 3 restants `offers_export_json` / `format_invalide` / `echappement_csv` — problèmes de test, pas de backend).

---

## 12. Santé du système — `/api/admin/system/health`

- `GET /api/admin/system/health` (`api/v1/admin/system_health.py`) : inspecte `celery_app.control.inspect()` (nombre de workers actifs), compte `EmailDigest.QUEUED` (file d'attente email), `last_heartbeat_at` (dernière `JobOffer.created_at`), `database` (test de requête simple sur `JobOffer`), `admin_auth` (rôle, actif).
- Utilise `require_roles("super_admin")`.
- Note (document 17) : cette page n'est pas dans la maquette v2 mais est indispensable pour la fiabilité opérationnelle, en cohérence avec le principe du projet (« les silences sont un problème prioritaire »).

---

## 13. Historique des emails transactionnels

- `GET /api/admin/transactional-emails` (`api/v1/admin/transactional_emails.py`) : pagination (`limit`/`offset`), filtres (`email`, `to_email` ILIKE, `type` → alias `purpose` dans le code, `status` → alias de `TransactionalEmailStatus`), et `GET /count` (aggrégation SQL `GROUP BY`/`COUNT`).
- Les filtres réutilisent la même convention d'alias (`bouncing` ↔ `bounced`) documentée dans le document 7.

---

## 14. Recherche globale — `/api/admin/search`

- `GET /api/admin/search` (`api/v1/admin/aggregates.py`) : recherche parallèle dans `JobOffer.title`, `Subscriber.email`/`full_name`, `Company.name`/`normalized_name`. Résultats groupés (`offers`, `subscribers`, `companies`) avec `per_type_limit` (défaut 10).
- Échappement des caractères LIKE (`%`, `_`) via `ilike` échappé dans le service `global_search`.

---

## 15. Authentification renforcée — mot de passe oublié

- `POST /api/admin/auth/forgot-password` (`api/v1/admin/auth.py`) : génère `token` (`secrets.token_urlsafe(32)`), crée `TransactionalEmailEvent` avec `purpose=RESET_PASSWORD`, `request_payload={"token": token}`, et envoie via `get_email_provider()` (Resend, ou mock si non configuré).
- `POST /api/admin/auth/reset-password` (`api/v1/admin/auth.py`) : valide le token (recherche dans `TransactionalEmailEvent.request_payload`), récupère `Administrator.email`, met à jour `password_hash` (`hash_password`), marque `TransactionalEmailEvent.status = SENT`.
- Note (document 8 — 2.8) : le 2FA complet (`TOTP`) reste optionnel (`🔴`) et non implémenté dans cette session. Le reset par email est une base de sécurité proportionnée à la sensibilité des données (conforme aux principes RGPD — anonymisation des abonnés, accès restreint au back-office).

---

## 16. Import d'offres en masse

- `POST /api/admin/offers/import` (`api/v1/admin/offers.py`) : accepte un fichier (`UploadFile`) CSV, JSON ou XLSX (détecté par extension), lit ligne par ligne, réutilise `services/offers.create_offer` en boucle. Renvoie un rapport (`created`, `ignored`, `errors`) avec détails ligne par ligne.
- Note : `python-multipart` a été ajouté au venv pour supporter `UploadFile`.

---

## Points du document 8 non traités (hors périmètre ou optionnels 🔴)

| Point | Statut | Raison / Action recommandée |
|---|---|---|
| `1.6` Aperçu du digest | ✅ Traité (`POST /sending/preview`) | Réutilise `digest_preview_service` |
| `1.8` Statut `en_relecture` | ✅ Statut backend ajouté (`ContentStatus.EN_RELECTURE`) | Le workflow UI (modérateur → super_admin) reste côté frontend |
| `2.7` Segments d'abonnés sauvegardés | 🔴 Optionnel — non démarré | Nécessite nouveau modèle `SavedSegment` + UI constructeur de filtres |
| `2.8` 2FA complet (`TOTP`) | 🔴 Optionnel — non démarré | Base du reset par email en place |
| `2.9` Import CSV (`POST /offers/import`) | ✅ Traité | Utilise `UploadFile` + `create_offer` en boucle |
| `2.10` Matrice de permissions fine | 🔴 Optionnel — non démarré | Le système actuel (`AdminRole` enum) suffit pour l'équipe actuelle |

---

## Migrations

- `migrations/versions/0009_rejected_duplicate_pair.py` : table `rejected_duplicate_pairs` (`offer_a_id`, `offer_b_id`, `reason`, `reviewed_by_admin_id`, `reviewed_at`, contrainte `chk_duplicate_order`, index composite). Créée dans cette session.
- Aucune autre migration nécessaire (les autres améliorations utilisent des champs/modèles existants : `duplicate_of_id`, `AIFiliereSuggestion`, `ContentStatus.EN_RELECTURE`).

---

## Architecture et cohérence

- Tous les endpoints admin utilisent `require_roles(...)` (défini dans `api/deps.py`) et `Depends(get_current_admin)`.
- Les services (`duplicates.py`, `filiere_simulator.py`, `digest_preview_service.py`, `companies.py`) sont isolés du routeur et réutilisables (testables unitairement).
- Les tests administratifs (`tests/test_admin_*.py`) utilisent `pytest.mark.admin_db` pour éviter le `autouse` `_database` (drop après chaque test) et permettre le partage de la base entre tests du même module.
- Le projet utilise toujours le venv (`.venv/Scripts/python.exe`) et `pytest` lancé depuis la racine (`pythonpath = ["."]`).
