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

## 11. Cascade de matching T0-T5

Le matching T0 strict (filtres durs seuls) laisse des abonnés sans
digest pertinent. Pour **maximiser le nombre d'offres envoyees** tout en
respectant la séparation filtres/scoring, on applique une cascade
cumulative de relaxations. Les invariants produit ne sont JAMAIS
relâchés (cf. règle §4) — seuls les critères de pertinence le sont.

### 11.1 Paliers et risques

| Palier | Filtre relâché | Effet SQL | Risque utilisateur |
|---|---|---|---|
| **T0** | — | Filtres durs stricts (1-7) | Le plus pertinent |
| **T1** | Filière | Matche aussi via `offer_filieres` (filière secondaire) | Faible : filière respectée |
| **T2** | Contrat | Ignore `SubscriberContractPreference` | Modéré : peut recevoir un type de contrat différent |
| **T3** | Fraîcheur | Élargit `window_start` à `today - DIGEST_CASCADE_FRESHNESS_DAYS` (défaut 14j) | Faible : la dédup NOT EXISTS empêche le renvoi |
| **T4** | Expérience | Double `EXPERIENCE_MATCH_TOLERANCE_YEARS` | Modéré |
| **T5** | Ville (uniquement si non résolue) | Ajoute les offres de `DIGEST_CASCADE_FALLBACK_CITY` (défaut Abidjan) | Modéré |

### 11.2 Algorithme

Le sélecteur teste d'abord T0 ; si `len(ranked) >= digest_min_offers`
(défaut 2), il s'arrête. Sinon il accumule les paliers T1→T5 jusqu'à
obtenir assez d'offres. Chaque palier utilise le **scoring canonique**
comme seule autorité de classement — une offre de repli ne remonte que
si elle le mérite par son score de filière/contrat/expérience/ville/fraîcheur.

Si aucun palier ne produit `digest_min_offers` offres, le digest est
marqué `skipped_empty` et un email transactionnel "no offer" est envoyé
(voir §12).

### 11.3 Traçabilité

Deux colonnes ajoutées (cf. migrations 0007 et 0008) :

- `email_digests.match_tier` (T0..T5 ou T5_INSUFFICIENT) : palier final
  atteint pour le digest.
- `email_digest_offers.match_kind` (primary/secondary/fallback_*) :
  comment chaque offre a été obtenue.

Ces colonnes permettent :

- l'audit (combien de digests basculent en T2+ par jour),
- le tableau de bord admin `/api/admin/sending/tier-stats`,
- la **distinction visuelle** dans l'email entre "Sélectionnées pour
  vous" (match_kind=primary) et "Pourrait aussi vous intéresser" (repli),
  avec un badge explicatif (type de contrat différent, etc.).

### 11.4 Variables d'env

| Variable | Défaut | Rôle |
|---|---|---|
| `DIGEST_CASCADE_ENABLED` | true | Master switch (false = comportement strict hérité) |
| `DIGEST_CASCADE_MAX_TIER` | T5 | Plafond (ex. T2 pour ne jamais aller à T3+) |
| `DIGEST_CASCADE_FRESHNESS_DAYS` | 14 | Lookback du palier T3 |
| `DIGEST_CASCADE_FALLBACK_CITY` | Abidjan | Ville de repli T5 |
| `DIGEST_MIN_OFFERS` | 2 | Seuil minimum pour arrêter la cascade |

## 12. Email transactionnel "no offer"

Quand la cascade T0-T5 ne produit aucune offre, on envoie un email
distinct du digest quotidien (pas de `EmailDigest`, pas d'`EmailDigestOffer`)
pour ne pas laisser l'abonné sans nouvelles.

### 12.1 Comportement

- **Skip si** : `SEND_NO_OFFER_EMAIL=false`, abonné non éligible, ou
  rate limit 7j glissants non écoulé.
- **Une seule tentative** : pas de retry auto (un no-offer qui rate est
  un no-offer qui rate, ce n'est pas critique).
- **Traçabilité** :
  - `no_offer_email_logs` (subscriber_id, digest_date, sent_at) pour
    le rate limit futur.
  - `email_delivery_attempts` lié à un `EmailDigest` `skipped_empty`
    (FK respectée) pour la cohérence avec le reste du pipeline.
- `Subscriber.last_email_sent_at` est mis à jour (cohérence : l'abonné
  a "reçu quelque chose" aujourd'hui).

### 12.2 Orchestration

La phase 2.5 envoie les no-offer à **08h15** (juste après la phase 2
principale à 08h00) via la tâche `tasks.digests.send_no_offer_emails`,
verrou Redis `lock:digest:no_offer:{date}` séparé, queue `emails`.

```python
celery_app.conf.beat_schedule["digest-send-no-offer"] = {
    "task": "tasks.digests.send_no_offer_emails",
    "schedule": crontab(hour=8, minute=15),
    "options": {"queue": "emails"},
}
```

### 12.3 Variables d'env

| Variable | Défaut | Rôle |
|---|---|---|
| `SEND_NO_OFFER_EMAIL` | true | Active l'envoi (false = silencieux) |
| `NO_OFFER_EMAIL_MIN_INTERVAL_DAYS` | 7 | Fenêtre glissante du rate limit |

## 13. Endpoint admin : stats par tier

`GET /api/admin/sending/tier-stats?period_days=7` (JWT super_admin /
gestionnaire_utilisateurs) renvoie la distribution des paliers de
matching par jour et par tier/match_kind.

**Réponse** :

```json
{
  "period_days": 7,
  "since": "2026-08-22",
  "until": "2026-08-28",
  "tier_distribution": {
    "by_day": {
      "2026-08-28": {
        "tiers": [
          {"tier": "T0", "count": 120},
          {"tier": "T1", "count": 5}
        ],
        "skipped_empty": 8,
        "total": 133
      }
    },
    "global": {
      "tiers": [{"tier": "T0", "count": 800}, {"tier": "T1", "count": 30}],
      "skipped_empty": 50,
      "total": 880
    }
  },
  "match_kind_distribution": {
    "by_day": {
      "2026-08-28": {
        "kinds": {"primary": 360, "secondary": 15},
        "total": 375
      }
    },
    "global": {
      "kinds": {"primary": 2400, "secondary": 90},
      "total": 2490
    }
  }
}
```

**Cas d'usage ops** :

- Si > 30% des digests basculent en T2+ sur 7j glissants → signal de
  tagging trop strict sur les filières/contrats.
- Si `skipped_empty` augmente fortement → envisager d'élargir le
  `DIGEST_CASCADE_MAX_TIER` ou d'auditer le référentiel `Location`.

## 14. Tests

`server/tests/test_digest_pipeline.py` (10 tests, comportement historique
intact) et `server/tests/test_digest_cascade.py` (~30 tests, cascade
T0-T5 + email no-offer + 2 sections + stats admin) couvrent l'ensemble.
Couverture :

- Filtres durs T0 stricts (anti-régression).
- Cascade T0→T5 (chaque palier + cas d'arrêt).
- Persistance `match_tier` / `match_kind` par digest et par offre.
- Email no-offer (template, rate limit 7j, désactivation, échec provider).
- Template 2 sections (badges, section vide, split primary/secondary).
- Endpoint admin `tier-stats` (réponse, structure).

```bash
server\.venv\Scripts\python.exe -m pytest server/tests/test_digest_pipeline.py server/tests/test_digest_cascade.py -q
```
