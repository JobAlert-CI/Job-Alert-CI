# Digest quotidien par email — JobAlert CI

Pipeline d'envoi quotidien des offres aux abonnés, en **deux phases distinctes**,
conformément à `prompt_send_offres_email.md`.

## 1. Fonctionnement en deux phases

```
07h30 (Africa/Abidjan)                 08h00 (Africa/Abidjan)
┌───────────────────────────┐          ┌───────────────────────────┐
│ prepare_daily_digests     │          │ send_daily_digests        │
│  verrou lock:digest:      │          │  verrou lock:digest:      │
│        prepare:{date}     │          │        send:{date}        │
│  → abonnés éligibles      │          │  → vérifie le marqueur    │
│    (yield_per(100))       │          │    de préparation         │
│  → fan-out chord:         │   ────▶  │  → digests queued du jour │
│    build_and_queue_digest │          │  → fan-out chord:         │
│    (1 tâche / abonné)     │          │    send_digest            │
│  → marqueur + stats Redis │          │  → bilan d'envoi Redis    │
└───────────────────────────┘          └───────────────────────────┘
```

- **Phase 1 fige la sélection** : seules les offres déjà publiées à 07h30
  peuvent partir dans le digest du jour.
- **Les offres arrivées entre 07h30 et 08h00 partent le lendemain** —
  comportement attendu et documenté.
- Un digest est créé **même sans offre** (`skipped_empty`,
  `skipped_reason=no_matching_offer`) : la trace existe pour l'audit.

### Tâches Celery (`server/tasks/digests.py`)

| Tâche | Rôle |
|---|---|
| `tasks.digests.prepare_daily_digests` | Orchestrateur phase 1 : verrou, abonnés éligibles, fan-out |
| `tasks.digests.build_and_queue_digest` | Unitaire : filtres durs + scoring + création EmailDigest/EmailDigestOffer |
| `tasks.digests.mark_preparation_completed` | Callback chord : agrège, stocke stats et marqueur |
| `tasks.digests.send_daily_digests` | Orchestrateur phase 2 : verrou, garde-fou préparation, fan-out sur `queued` |
| `tasks.digests.send_digest` | Unitaire : éligibilité finale → sending → provider → sent/failed/cancelled |
| `tasks.digests.mark_sending_completed` | Callback chord : bilan d'envoi |
| `tasks.digests.retry_failed_digests` | Rattrapage manuel, désactivé par défaut |

Un échec sur un abonné ne bloque **jamais** les autres : chaque digest vit dans
sa propre tâche et sa propre transaction (`session_scope()`).

## 2. Configuration Celery Beat

Dans `server/celery_app.py` :

```python
"digest-prepare-0730": crontab(hour=7, minute=30)   # queue "emails"
"digest-send-0800":    crontab(hour=8, minute=0)    # queue "emails"
```

Les heures sont pilotées par les variables `DAILY_DIGEST_PREPARE_HOUR/MINUTE`
et `DAILY_DIGEST_SEND_HOUR/MINUTE`. Le worker `emails` doit tourner
(`npm run dev` démarre les 3 workers + beat).

## 3. Variables d'environnement

| Variable | Défaut | Rôle |
|---|---|---|
| `DAILY_DIGEST_PREPARE_HOUR/MINUTE` | 7 / 30 | Heure de préparation |
| `DAILY_DIGEST_SEND_HOUR/MINUTE` | 8 / 0 | Heure d'envoi |
| `DIGEST_TIMEZONE` | Africa/Abidjan | Timezone de calcul de la date du digest |
| `DIGEST_MAX_OFFERS` | 3 | Nombre d'offres par digest (1..10 via SiteSetting possible) |
| `DIGEST_MIN_OFFERS` / `DIGEST_SEND_IF_BELOW_MIN` | 1 / true | Envoi même si moins d'offres que le max |
| `DIGEST_INCLUDE_NO_CONTRACT_OFFERS` | false | Inclure les offres sans contrat quand l'abonné a des préférences |
| `DIGEST_INCLUDE_NO_LOCATION_OFFERS` | true | Inclure les offres sans localisation (score ville 0) |
| `EXPERIENCE_MATCH_MODE` / `..._TOLERANCE_YEARS` | compatible / 1 | Tolérance d'expérience |
| `CITY_MATCH_MODE` | normalized_exact | Comparaison exacte normalisée uniquement (pas de fuzzy) |
| `INCLUDE_REMOTE_OFFERS` | true | Offres remote quand la ville matche |
| `INCLUDE_REMOTE_OFFERS_FOR_UNMATCHED_CITY` | true | Offres remote si ville non résolue |
| `DIGEST_CITY_MODE` | prefer_city | `remote_only` possible pour abonné sans ville |
| `EMAIL_PROVIDER` / `EMAIL_FROM` | resend / JobAlert CI \<bonjour@jobalert.ci\> | Provider et expéditeur (source unique de vérité) |
| `PUBLIC_BASE_URL` | https://jobalert.ci | Base des liens offre/préférences/désinscription |
| `EMAIL_MAX_RETRIES` / `EMAIL_RETRY_BACKOFF_SECONDS` | 3 / 30 | Retry automatique (backoff exponentiel) |
| `DIGEST_PREPARE_LOCK_TTL_SECONDS` / `DIGEST_SEND_LOCK_TTL_SECONDS` | 7200 | TTL des verrous Redis |
| `SEND_IF_PREPARATION_INCOMPLETE` | false | Autoriser l'envoi si le marqueur de préparation manque |
| `RETRY_FAILED_DIGESTS_ENABLED` | false | Active `retry_failed_digests` |

Secrets (`RESEND_API_KEY`, etc.) restent hors `SiteSetting`.

## 4. Règles de matching — séparation obligatoire

**Filtres durs** (une seule condition non remplie ⇒ offre exclue) :
1. `status=active AND visible_site=true` (colonnes de tête de `ix_job_offers_feed`) ;
2. jamais envoyée à cet abonné : NOT EXISTS via un digest `sent` ;
3. `primary_filiere_id ∈ filières de l'abonné` ;
4. contrat : filtrage seulement si l'abonné a des préférences ;
5. expérience : chevauchement des tranches `min_years/max_years` ± tolérance ; offre sans exigence toujours compatible ;
6. ville : voir §6 ;
7. fraîcheur : `published_at ≥ dernier digest réellement sent` (fallback `collected_at`, puis `confirmed_at`/`subscribed_at`). Un digest `skipped_empty` **ne remet pas le compteur à zéro**.

**Scoring** (classement seul, aucun rejet) :

```
score = filière(100/70/40 selon priorité, +10 si prio 1)
      + contrat(+20 match, +5 sans contrat accepté)
      + expérience(+20 compatible, +15 sans exigence, +10 adjacente ±1 an)
      + ville(+25 exacte, +15 label/district, +10 remote)
      + fraîcheur(<24h +15, <48h +10, <7j +5)
Égalité : publication ↓, puis titre, puis id.
```

Code : `services/scoring_service.py`, sélection SQL dans
`services/digest_builder_service.py::select_candidate_offers`.

## 5. Gestion de la ville texte libre

`Subscriber.city` est libre : aucune FK vers `Location`.
- `normalize_city()` (`services/normalization.py`) étend `normalize_text()` :
  gère « Ville - Quartier » et retire « côte d'ivoire », « ci », etc.
- `CityMatchingService` (`services/city_matching_service.py`) compare la ville
  normalisée à `Location.city` / `label` / `district` en exacte normalisée.
- Aucun fuzzy matching. Ville non résolue ⇒ journalisée (`digest_city_unmatched`)
  ⇒ seules les offres remote (+ offres sans localisation selon config).
- Les cas ambigus sont loggés pour audit.

## 6. Retry d'envoi

Deux niveaux **non superposés** :

1. **Automatique, dans `send_digest`** : chaque appel trace une ligne
   `EmailDeliveryAttempt` (`attempt_no` 1..3, contrainte SQL). Retry Celery avec
   backoff exponentiel **uniquement** si `EmailSendResult.retryable` (timeout,
   429, 5xx). Erreurs définitives (401 clé API, domaine non vérifié, email
   invalide) ⇒ `failed` immédiat. Succès ⇒ `sent` + `sent_at` +
   `Subscriber.last_email_sent_at`.
2. **`retry_failed_digests`** : rattrapage manuel très encadré, désactivé par
   défaut ; ne rejoue que les digests `failed` dont `attempt_no < 3`. Ne
   duplique jamais le niveau 1.

Abonné devenu inéligible entre préparation et envoi ⇒ digest `cancelled`
(`subscriber_unsubscribed` ou `subscriber_ineligible`), aucun email.

## 7. Liens désinscription / préférences

Chaque digest contient deux liens signés sans login, générés à l'envoi via
`services/token_service.issue_token` (tokens bruts jamais stockés — seul
`token_hash()` SHA-256 va en base ; toute recherche compare le **hash**) :

- `{PUBLIC_BASE_URL}/preferences/{token}` — purpose `manage_alert`, réutilisable tant que non révoqué ;
- `{PUBLIC_BASE_URL}/desinscription/{token}` — purpose `unsubscribe`, **usage unique** (`used_at` marqué).

Endpoints concernés (`api/v1/public/subscriptions.py`) :
`GET/PUT /api/subscriptions/preferences/{token}`,
`POST /api/subscriptions/unsubscribe/{token}` (idempotent, crée un
`UnsubscribeEvent` et passe le statut à `unsubscribed`).

## 8. Tests

`server/tests/test_digest_pipeline.py` et `test_digest_endpoints.py` utilisent
le mock provider (`FakeEmailProvider` du conftest) : aucun appel réseau, aucune
clé API. Couverture : deux phases, filtres durs, scoring, skipped_empty,
anti-doublon, retries bornés à 3, cancellation, tokens single-use, remplacement
sûr des filières.

```bash
server\.venv\Scripts\python.exe -m pytest server/tests/test_digest_pipeline.py server/tests/test_digest_endpoints.py -q
```

## 9. Déclenchement manuel (admin)

Endpoints protégés JWT (`super_admin`, `gestionnaire_utilisateurs`),
body compatible `SendTrigger` (`subscriber_id`, `filiere_code`, `date_override`) :

| Endpoint | Effet |
|---|---|
| `POST /api/admin/sending/prepare` | Phase 1 en mode `force=true` (recalcule les digests non `sent/sending`) |
| `POST /api/admin/sending/send` | Phase 2 sur les digests `queued` du jour |
| `POST /api/admin/sending/run` | Chaîne préparée→envoi (celery chain) |

Réponses `202 {status: dispatched, task_id}` — 503 si broker injoignable.
Un digest `sent` n'est **jamais** recalculé, un digest `sending` n'est jamais modifié.

Statistiques : `GET /api/admin/sending/stats` (`SendingStatsRead`) et marqueurs
Redis `digest:{phase}:{date}:status|stats` (TTL 48h).

## 10. Comportement 07h30–08h00

Résumé : la fenêtre de 30 minutes garantit un contenu stable et vérifiable.
Une offre ingérée/validée à 07h45 attend le run du lendemain ; un admin peut
cependant relancer une préparation en `force` avant 08h00 via
`POST /api/admin/sending/prepare` pour l'inclure — seuls les digests non
encore envoyés sont alors recalculés.
