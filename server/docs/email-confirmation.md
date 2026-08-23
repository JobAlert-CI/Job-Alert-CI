# Confirmation d'email (Resend) — JobAlert CI

Flux complet : inscription -> abonne `pending` -> token a usage unique -> email
Resend envoye par Celery -> clic -> abonne `active`.

## 1. Configuration Resend

1. Creer un compte sur <https://resend.com>.
2. **Domains** -> *Add domain* : ajouter `jobalert.ci`, puis creer chez le
   registrar les enregistrements DNS proposes (SPF/DKIM, et DMARC recommande).
   Attendre le statut **Verified** : sans domaine verifie, Resend refuse
   l'envoi (erreur definitive, non retentee).
3. **API Keys** -> *Create API key* avec la permission *Sending access*.
   Copier la valeur (`re_...`) : elle ne sera plus affichee.
4. Renseigner `RESEND_API_KEY` dans `server/.env` (jamais dans Git, jamais en
   base, jamais dans les logs).
5. `EMAIL_FROM_ADDRESS` doit utiliser le domaine verifie
   (`notifications@jobalert.ci`).
6. Optionnel : **Webhooks** -> ajouter
   `https://<domaine>/api/webhooks/resend`, copier le secret (`whsec_...`) dans
   `RESEND_WEBHOOK_SECRET`.

## 2. Variables d'environnement

```env
RESEND_API_KEY=""                      # secret
EMAIL_FROM_ADDRESS="notifications@jobalert.ci"
EMAIL_FROM_NAME="JobAlert CI"
PUBLIC_BASE_URL="https://jobalert.ci"
CONFIRM_EMAIL_TOKEN_TTL_HOURS=24
EMAIL_CONFIRMATION_REQUIRED=true       # false = abonnes actifs sans email (dev)
EMAIL_PROVIDER="resend"
RESEND_TIMEOUT_SECONDS=10
EMAIL_MAX_RETRIES=3
EMAIL_RETRY_BACKOFF_SECONDS=5
EMAIL_RATE_LIMIT_RESEND_PER_HOUR=3
SUPPORT_EMAIL="support@jobalert.ci"
RESEND_WEBHOOK_SECRET=""               # secret, optionnel
EMAIL_BOUNCE_THRESHOLD=2
```

Parametres non sensibles editables par un admin (`site_settings`) :

```powershell
python -m scripts.seed_email_settings
```

Ce seed est idempotent et n'ecrase jamais une valeur reglee par un admin.

## 3. Activation / desactivation

- `EMAIL_CONFIRMATION_REQUIRED=true` : l'abonne est cree `pending`,
  `confirmed_at` reste `null` et l'email de confirmation part en file Celery.
- `EMAIL_CONFIRMATION_REQUIRED=false` : l'abonne est cree `active` avec
  `confirmed_at = now`, aucun email n'est envoye (pratique en local/CI).

## 4. Token de confirmation

- Genere avec `secrets.token_urlsafe(32)` (256 bits, URL-safe).
- Seul le SHA-256 est persiste (`subscriber_tokens.token_hash`, unique) : la
  valeur en clair n'existe que le temps de construire l'URL de l'email.
- `expires_at = now + CONFIRM_EMAIL_TOKEN_TTL_HOURS` (24 h par defaut).
- Usage unique : `used_at` est rempli a la confirmation.
- Emettre un nouveau token `confirm_email` revoque les precedents non utilises
  (`revoked_at = now`) sans jamais les supprimer.

## 5. Endpoints

| Methode | Chemin | Role |
|---|---|---|
| POST | `/api/subscriptions` | Inscription ; reponse = `SubscriberRead` + `requires_confirmation` + `confirmation_message` |
| GET | `/api/subscriptions/confirm/{token}` | Confirme l'abonne ; `{"message": "Inscription confirmée", "email": "..."}` |
| POST | `/api/subscriptions/resend-confirmation` | Renvoi (reponse generique, anti-enumeration) |
| POST | `/api/webhooks/resend` | Webhook Resend signe (optionnel) |

Codes de retour de la confirmation :

| Situation | Code |
|---|---|
| Token valide | 200 |
| Abonne deja confirme (token deja utilise ou revoque) | 200 (idempotent) |
| Token inconnu / deja utilise alors que l'abonne n'est pas actif | 400 |
| Token expire | 410 (`"Le lien de confirmation a expiré..."`) |
| Abonne `bounced` / `deleted` | 409 |

Regles par statut a l'inscription :

| Statut existant | Comportement |
|---|---|
| aucun | creation `pending` + email de confirmation |
| `pending` | pas de doublon, anciens tokens revoques, email renvoye |
| `active` / `paused` (confirme) | pas de doublon, aucun email, `requires_confirmation=false` |
| `unsubscribed` | re-inscription autorisee, repasse par une confirmation |
| `bounced` | refus 409 (action admin requise) |
| soft-supprime | traite comme un nouvel email |

Renvoi : 3 envois par heure et par email maximum, cooldown strict de 60 s
(compteurs Redis avec TTL ; fallback sur `last_email_sent_at` si Redis est
injoignable). Depassement -> 429 avec header `Retry-After`.

## 6. Celery

L'envoi est asynchrone : la route journalise un evenement `queued` puis publie
`tasks.emails.send_confirmation_email_task` dans la queue `emails`.

```powershell
celery -A celery_app.celery_app worker -Q emails -l info
# ou, en partageant un worker
celery -A celery_app.celery_app worker -Q emails,ai,ingestion -l info
```

Retry : 3 tentatives max (`EMAIL_MAX_RETRIES`), backoff exponentiel
(`EMAIL_RETRY_BACKOFF_SECONDS * 2**tentative`) sur timeout, 429, 5xx et erreurs
reseau. Aucun retry sur 401 (cle invalide), 403 (domaine non verifie), payload
invalide ou abonne `bounced`/supprime. Si le broker est injoignable, la route
retombe sur un envoi synchrone best-effort et l'evenement reste `queued` en cas
d'echec (l'abonne peut demander un renvoi).

Chaque tentative est journalisee dans `transactional_email_events`
(`status`, `attempts`, `last_error`, `provider_email_id`). Ni cle API ni token
brut n'y figurent.

## 7. Tests

```powershell
python -m pytest tests -q
```

Aucune vraie cle Resend n'est necessaire : `tests/conftest.py` fournit
`FakeEmailProvider`, et les tests du provider mockent `httpx.post` pour
simuler 200/401/403/429/5xx et les timeouts. Redis est volontairement pointe
sur une URL injoignable pour exercer le fallback du rate limiting.

## 8. Depannage

| Symptome | Cause probable | Action |
|---|---|---|
| `Cle API Resend non configuree` | `RESEND_API_KEY` vide | renseigner la cle puis redemarrer worker et API |
| 401 dans `last_error` | cle revoquee/incorrecte | regenerer la cle dans Resend |
| 403 / *domain not verified* | DNS non valides | verifier SPF/DKIM, attendre le statut *Verified* |
| 429 repetes | quota Resend | reduire le debit, augmenter `EMAIL_RETRY_BACKOFF_SECONDS` |
| Evenements bloques en `queued` | worker `emails` arrete ou Redis HS | demarrer le worker, verifier `CELERY_BROKER_URL` |
| Emails en spam | DKIM/DMARC absents, expediteur generique | completer les DNS, soigner objet et version texte |
| 429 sur `resend-confirmation` | cooldown 60 s / quota horaire | attendre la valeur de `Retry-After` |
