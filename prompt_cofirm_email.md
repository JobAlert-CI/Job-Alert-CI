Tu es un ingénieur backend senior Python spécialisé dans FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, Celery, Redis et les intégrations d’envoi d’emails transactionnels.

Tu dois mettre en place le module de confirmation d’email pour le projet JobAlert CI, en utilisant **Resend** comme service d’envoi d’emails.

JobAlert CI est une plateforme de veille automatisée pour le marché de l’emploi en Côte d’Ivoire. Les utilisateurs s’inscrivent avec leur email et choisissent 1 à 3 filières. L’inscription doit désormais être confirmée via un lien envoyé par email avec Resend.

--------------------------------------------------
OBJECTIF
--------------------------------------------------

Implémenter un flux complet de confirmation d’email :

1. L’utilisateur s’inscrit via l’API existante :
   POST /api/subscriptions

2. Le système crée le compte abonné avec le statut `pending` si la confirmation est activée.

3. Le système génère un token de confirmation sécurisé à usage unique.

4. Le système stocke uniquement le hash du token dans la table `subscriber_tokens`.

5. Le système envoie un email de confirmation via Resend contenant un lien de confirmation.

6. L’utilisateur clique sur le lien.

7. L’API valide le token.

8. Si le token est valide, l’abonné passe au statut `active` et `confirmed_at` est rempli.

9. Si le token est invalide, expiré ou révoqué, l’API renvoie une erreur claire.

10. Si l’email a déjà été confirmé, l’API répond de manière idempotente.

11. Il doit être possible de renvoyer l’email de confirmation.

--------------------------------------------------
CONTRAINTES D’INTÉGRATION AVEC L’EXISTANT
--------------------------------------------------

Tu dois respecter les modèles SQLAlchemy existants du projet.

Modèles existants à utiliser :

1. `Subscriber`
   - id UUID
   - email
   - email_normalized
   - full_name
   - city
   - status : enum SubscriberStatus
   - channel
   - timezone
   - wants_career_tips
   - experience_level_id
   - source
   - subscribed_at
   - confirmed_at
   - paused_until
   - unsubscribed_at
   - last_email_sent_at
   - unsubscribe_reason
   - bounce_count
   - admin_notes

2. `SubscriberToken`
   - subscriber_id
   - purpose : enum TokenPurpose
   - token_hash
   - expires_at
   - used_at
   - revoked_at

3. Enums existants :
   - `SubscriberStatus` : pending, active, paused, unsubscribed, bounced, deleted
   - `TokenPurpose` : confirm_email, manage_alert, unsubscribe

4. Schémas Pydantic existants :
   - `SubscriberCreate`
   - `SubscriberRead`
   - `TimestampRead`
   - `ORMModel`

Règles importantes :

- Ne pas casser l’endpoint existant `POST /api/subscriptions`.
- Utiliser `email_normalized` comme clé fonctionnelle unique.
- Ne jamais créer deux abonnés avec le même `email_normalized`.
- Respecter les conventions Pydantic du projet : `*Read`, `*Create`, `*Update`, `ORMModel`, `TimestampRead`.
- Les migrations Alembic doivent être additives.
- Les enums doivent utiliser la convention existante : `enum_column()` avec CHECK constraint plutôt qu’ENUM natif PostgreSQL si c’est déjà le cas dans le projet.

--------------------------------------------------
COMPORTEMENT ATTENDU DE L’INSCRIPTION
--------------------------------------------------

Endpoint existant :

POST /api/subscriptions

Payload existant :

{
  "email": "exemple@gmail.com",
  "full_name": "Utilisateur Démo",
  "city": "Abidjan",
  "filieres": ["tech-dev"],
  "experience": null,
  "contract_types": [],
  "wants_career_tips": true,
  "source": "site"
}

Nouveau comportement attendu :

Cas 1 : nouvel email, confirmation activée
- Créer l’abonné avec `status = pending`.
- Remplir `subscribed_at`.
- Laisser `confirmed_at` null.
- Générer un token de confirmation.
- Envoyer un email de confirmation via Resend.
- Retourner une réponse contenant :
  - les données de l’abonné,
  - un champ `requires_confirmation: true`,
  - un message indiquant qu’un email de confirmation a été envoyé.

Cas 2 : email déjà existant et statut `pending`
- Ne pas créer de doublon.
- Générer un nouveau token de confirmation.
- Révoquer les anciens tokens `confirm_email` non utilisés.
- Renvoyer l’email de confirmation.
- Retourner une réponse similaire à une création, avec par exemple :
  - `requires_confirmation: true`
  - `message: "Un email de confirmation a été renvoyé."`

Cas 3 : email déjà existant et statut `active`
- Ne pas créer de doublon.
- Ne pas renvoyer automatiquement l’email de confirmation.
- Retourner une réponse indiquant que l’email est déjà confirmé.
- Code HTTP recommandé : 200 ou 201 selon compatibilité existante, mais le comportement doit rester prévisible.

Cas 4 : email déjà existant avec statut `unsubscribed`, `bounced` ou `deleted`
- Définir une règle claire.
- Recommandation :
  - si `unsubscribed`, autoriser une nouvelle confirmation uniquement si le produit le permet, sinon refuser avec message ;
  - si `bounced`, refuser l’envoi ou demander une action admin ;
  - si `deleted`, traiter comme nouvel email seulement si soft delete.
- Documenter la règle retenue.

Configuration recommandée :

- `EMAIL_CONFIRMATION_REQUIRED=true`
- Si `EMAIL_CONFIRMATION_REQUIRED=false`, l’abonné peut être créé directement avec `status = active` et `confirmed_at = now`.
- Ce mode doit faciliter les tests locaux et les environnements de développement.

--------------------------------------------------
GÉNÉRATION ET STOCKAGE DU TOKEN DE CONFIRMATION
--------------------------------------------------

Tu dois créer un service dédié, par exemple :

`app/services/email_confirmation_service.py`

ou :

`app/services/token_service.py`

Règles de génération :

- Utiliser `secrets.token_urlsafe(32)` ou équivalent.
- Le token doit être URL-safe.
- Le token doit être à usage unique.
- Le token doit avoir une durée de validité configurable.

Stockage :

- Ne jamais stocker le token en clair.
- Stocker uniquement son hash dans `SubscriberToken.token_hash`.
- Utiliser SHA-256 :
  `hashlib.sha256(token.encode("utf-8")).hexdigest()`
- Ou HMAC-SHA256 avec une clé secrète si le projet préfère.
- La colonne `token_hash` doit rester unique.

Création du token :

- `subscriber_id` : abonné concerné
- `purpose` : `TokenPurpose.confirm_email`
- `token_hash` : hash du token
- `expires_at` : maintenant + durée configurée
- `used_at` : null
- `revoked_at` : null

Révocation :

- Lors de la génération d’un nouveau token de confirmation pour un même abonné, révoquer les anciens tokens `confirm_email` non utilisés :
  - `revoked_at = now`
- Ne pas supprimer physiquement les anciens tokens.

Durée de validité recommandée :

- 24 heures par défaut.
- Configurable via :
  `CONFIRM_EMAIL_TOKEN_TTL_HOURS=24`

--------------------------------------------------
ENVOI D’EMAIL AVEC RESEND
--------------------------------------------------

Tu dois intégrer Resend comme fournisseur d’envoi d’emails.

API Resend :

- Endpoint : `https://api.resend.com/emails`
- Méthode : POST
- Authentification : header `Authorization: Bearer RESEND_API_KEY`
- Body JSON :
  {
    "from": "JobAlert CI <notifications@jobalert.ci>",
    "to": ["utilisateur@example.com"],
    "subject": "Confirmez votre inscription à JobAlert CI",
    "html": "...",
    "text": "..."
  }

Tu dois créer un service email propre, par exemple :

`app/services/email/email_provider.py`
`app/services/email/resend_provider.py`

Interface recommandée :

EmailMessage:
  - to_email: str
  - subject: str
  - html: str
  - text: str
  - headers: dict | None = None

EmailProviderProtocol:
  - send(message: EmailMessage) -> EmailSendResult

EmailSendResult:
  - success: bool
  - provider: str
  - provider_email_id: str | None
  - error_message: str | None
  - raw_response: dict | None = None

Implémentation :

- Créer `ResendEmailProvider` qui implémente `EmailProviderProtocol`.
- Utiliser rigoureusement le système d'injection de dépendances de FastAPI (`Depends()`) pour injecter `EmailProviderProtocol` dans les routes ou les services (ex: via un `get_email_provider`). Cela garantira l'injection facile d'un mock lors des tests unitaires.
- Utiliser `httpx` avec timeout configurable.
- Ne pas utiliser de SDK obligatoire si un appel HTTP simple suffit.
- Ne jamais logger la clé API.
- Ne jamais exposer la clé API dans les réponses.
- Stocker l’ID de l’email renvoyé par Resend si disponible.

--------------------------------------------------
CONTENU DE L’EMAIL DE CONFIRMATION
--------------------------------------------------

Tu dois créer un template d’email de confirmation.

Format :
- HTML
- texte brut

Variables disponibles :
- `full_name`
- `email`
- `confirmation_url`
- `expiry_hours`
- `site_name`
- `support_email`

Exemple de lien :

`{PUBLIC_BASE_URL}/inscription/confirmation/{token}`

ou, si le frontend appelle directement l’API :

`{PUBLIC_BASE_URL}/inscription/confirmation?token={token}`

Le prompt doit demander de respecter le design existant si un template existe déjà.
Sinon, produire un template simple, lisible et responsive.

Contenu recommandé :

Objet :
`Confirmez votre inscription à JobAlert CI`

Texte :
- Bonjour,
- Merci de votre inscription.
- Cliquez sur le bouton ou le lien pour confirmer votre adresse email.
- Le lien expire après X heures.
- Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.

HTML recommandé :
- logo ou nom du site,
- titre,
- paragraphe,
- bouton principal,
- lien secondaire en texte,
- pied de page avec support/contact.

--------------------------------------------------
ENVOI ASYNCHRONE ET RETRY
--------------------------------------------------

L’envoi d’email ne doit pas bloquer la réponse HTTP.

Utiliser Celery si le projet possède déjà Celery/Redis.

Tâche Celery recommandée :

`send_confirmation_email_task(subscriber_id: UUID, raw_token: str)`

Cette tâche doit :

1. Récupérer l’abonné.
2. Vérifier qu’il existe.
3. Vérifier que l’email n’est pas en `deleted` ou `bounced`.
4. Construire l’URL de confirmation.
5. Rendre les templates HTML/texte.
6. Envoyer via Resend.
7. Journaliser le résultat.
8. Réessayer automatiquement en cas d’erreur temporaire.

Retry recommandé :

- Maximum 3 tentatives.
- Backoff exponentiel.
- Retry sur :
  - timeout réseau,
  - erreur 429,
  - erreur 5xx,
  - erreur de connexion.
- Pas de retry sur :
  - clé API invalide,
  - payload invalide,
  - domaine non vérifié,
  - erreur 4xx non retentable.


--------------------------------------------------
JOURNALISATION DES EMAILS TRANSACTIONNELS
--------------------------------------------------

Le modèle `EmailDeliveryAttempt` existant semble lié aux digests.
Pour les emails transactionnels de confirmation, tu dois prévoir une journalisation adaptée.

Créer une table additive, par exemple :

`transactional_email_events` ou `email_outbox_events`

Champs recommandés :

- id UUID PK
- subscriber_id UUID FK nullable, SET NULL
- purpose string/check ou enum
  - confirm_email
  - resend_confirmation
  - manage_alert
  - unsubscribe
- to_email string
- provider string default 'resend'
- provider_email_id string nullable
- status string/check
  - queued
  - sent
  - failed
- attempts integer default 0
- last_error text nullable
- request_payload JSONB nullable
- response_payload JSONB nullable
- created_at
- updated_at

Règles :

- Ne jamais stocker la clé API dans `request_payload`.
- Ne pas stocker le token de confirmation en clair.
- Stocker seulement les informations nécessaires au debug.
- Si Resend renvoie un ID d’email, le conserver dans `provider_email_id`.

Si le projet possède déjà une table générique de logs ou d’événements emails, utiliser celle-ci si elle est compatible.
Sinon, créer la nouvelle table avec migration Alembic additive.

--------------------------------------------------
ENDPOINT DE CONFIRMATION
--------------------------------------------------

Endpoint existant dans l’API :

GET /api/subscriptions/confirm/{token}

Tu dois conserver cet endpoint s’il existe déjà.
Sinon, le créer.

Comportement :

1. Recevoir le token brut dans l’URL.
2. Calculer son hash.
3. Rechercher un token correspondant dans `subscriber_tokens` avec :
   - `purpose = confirm_email`
   - `used_at is null`
   - `revoked_at is null`
   - `expires_at > now`
4. Si aucun token valide :
   - retourner une erreur 400 ou 410 selon le cas.
5. Si token expiré :
   - retourner 410 avec un message clair :
     "Le lien de confirmation a expiré. Veuillez demander un nouvel email."
6. Si token déjà utilisé :
   - vérifier le statut de l’abonné.
   - si l’abonné est déjà actif, répondre avec succès de manière idempotente.
   - sinon, retourner une erreur.
7. Si token valide :
   - marquer le token comme utilisé :
     `used_at = now`
   - mettre à jour l’abonné :
     `status = active`
     `confirmed_at = now`
   - journaliser l’événement.
   - retourner une réponse de succès.

Réponse de succès recommandée :

{
  "message": "Inscription confirmée",
  "email": "utilisateur@example.com"
}

Cette réponse doit rester compatible avec la réponse existante si l’endpoint existe déjà.

--------------------------------------------------
ENDPOINT DE RENVOI DE CONFIRMATION
--------------------------------------------------

Créer un endpoint dédié :

POST /api/subscriptions/resend-confirmation

Body JSON :

{
  "email": "utilisateur@example.com"
}

Schéma Pydantic recommandé :

`ResendConfirmationCreate`
- email: EmailStr

Comportement :

1. Normaliser l’email.
2. Rechercher l’abonné par `email_normalized`.
3. Si l’abonné n’existe pas :
   - pour éviter l’énumération d’emails, retourner une réponse générique de succès.
4. Si l’abonné existe et est `pending` :
   - révoquer les anciens tokens confirm_email non utilisés.
   - générer un nouveau token.
   - envoyer l’email via Resend.
   - retourner une réponse générique de succès.
5. Si l’abonné existe et est `active` :
   - retourner un message indiquant que l’email est déjà confirmé.
6. Si l’abonné est `bounced`, `deleted` ou `unsubscribed` :
   - appliquer la règle définie.
   - par défaut, ne pas envoyer automatiquement.

Réponse recommandée :

{
  "message": "Si votre compte existe et est en attente de confirmation, un email de confirmation vous a été envoyé.",
  "email": "utilisateur@example.com"
}

Sécurité :

- Ajouter une protection anti-abus stricte en utilisant Redis.
- Limiter les renvois par email et/ou par IP.
- Recommandation : implémenter un compteur avec TTL dans Redis pour garantir un maximum de 3 renvois par heure par email, ainsi qu'un cooldown strict de 60 secondes entre deux renvois.
- Utiliser `last_email_sent_at` ou la table d’événements emails uniquement comme fallback si Redis est indisponible.

--------------------------------------------------
CONFIGURATION ET VARIABLES D’ENVIRONNEMENT
--------------------------------------------------

Variables d’environnement à prévoir :

- RESEND_API_KEY=...
- EMAIL_FROM_ADDRESS=notifications@jobalert.ci
- EMAIL_FROM_NAME=JobAlert CI
- PUBLIC_BASE_URL=https://jobalert.ci
- CONFIRM_EMAIL_TOKEN_TTL_HOURS=24
- EMAIL_CONFIRMATION_REQUIRED=true
- EMAIL_PROVIDER=resend
- RESEND_TIMEOUT_SECONDS=10
- EMAIL_MAX_RETRIES=3
- EMAIL_RETRY_BACKOFF_SECONDS=5
- EMAIL_RATE_LIMIT_RESEND_PER_HOUR=3

Si le projet utilise `SiteSetting`, ajouter les paramètres non sensibles suivants :

- `email_from_name`
- `email_confirmation_subject`
- `confirm_email_token_ttl_hours`
- `email_confirmation_required`
- `support_email`

Les secrets doivent rester dans les variables d’environnement :
- `RESEND_API_KEY`
- tout autre secret.

--------------------------------------------------
SCHÉMAS PYDANTIC À CRÉER OU ADAPTER
--------------------------------------------------

Créer ou adapter les schémas suivants dans `schemas/subscriptions.py` ou un fichier dédié.

1. `ResendConfirmationCreate`

Champs :
- email: EmailStr

2. `ResendConfirmationResponse`

Champs :
- message: str
- email: str | None = None

3. Adapter `SubscriberRead` ou une réponse d’inscription si nécessaire.

Champs additionnels possibles :
- requires_confirmation: bool
- confirmation_message: str | None

Important :
- Ne pas casser les schémas existants.
- Ajouter les nouveaux champs comme optionnels si nécessaire.
- Respecter `ORMModel` et `TimestampRead`.


--------------------------------------------------
GESTION DES ERREURS RESEND
--------------------------------------------------

Tu dois gérer les erreurs suivantes :

1. Clé API invalide
- HTTP 401
- logger l’erreur sans exposer la clé.
- créer un événement email `failed`.
- ne pas retry automatiquement.

1. Domaine d’envoi non vérifié
- HTTP 403 ou message Resend spécifique.
- logger l’erreur.
- créer un événement email `failed`.
- ne pas retry automatiquement.

1. Limite de débit
- HTTP 429
- retry avec backoff.
- si échec persistant, marquer failed.

1. Er serveur Resend
- HTTP 5xx
- retry avec backoff.

1. Timeout réseau
- retry avec backoff.

1. Email rejeté ou bounce
- si webhook ou réponse disponible, incrémenter `Subscriber.bounce_count`.
- si bounce répété, passer l’abonné en `bounced` selon règle métier.

--------------------------------------------------
OPTION : WEBHOOK RESEND
--------------------------------------------------

Prévoir optionnellement un endpoint webhook :

POST /api/webhooks/resend

Objectif :
- recevoir les événements Resend : delivered, bounced, complained, opened, clicked.
- mettre à jour les événements email.
- mettre à jour le statut de l’abonné si bounce.

Contraintes :
- vérifier la signature ou le token du webhook si Resend le permet ou si un secret est configuré.
- ne pas exposer publiquement des informations sensibles.
- rendre le webhook idempotent.

Ce webhook est optionnel mais souhaité pour améliorer la fiabilité.

--------------------------------------------------
TESTS À PRODUIRE
--------------------------------------------------

Écris des tests pytest couvrant :

1. Inscription avec confirmation activée :
   - un nouvel email crée un subscriber pending,
   - un token est créé,
   - un email est mis en file d’envoi,
   - la réponse contient requires_confirmation=true.

2. Inscription avec confirmation désactivée :
   - le subscriber est créé active,
   - aucun email n’est envoyé.

3. Email déjà existant pending :
   - pas de doublon,
   - nouveau token créé,
   - ancien token révoqué,
   - email renvoyé.

4. Email déjà existant active :
   - pas de doublon,
   - pas d’envoi automatique,
   - réponse claire.

5. Confirmation valide :
   - token valide,
   - subscriber devient active,
   - confirmed_at est rempli,
   - token marqué used.

6. Token expiré :
   - réponse 410,
   - subscriber reste pending.

7. Token déjà utilisé :
   - si subscriber actif, réponse idempotente,
   - sinon erreur.

8. Token révoqué :
   - erreur.

9. Renvoi de confirmation :
   - email pending : renvoi,
   - email active : message déjà confirmé,
   - email inconnu : réponse générique.

10. Rate limiting :
   - trop de renvois dans un court délai bloqués.

11. Service Resend :
   - mock de l’API Resend,
   - succès,
   - erreur 401,
   - erreur 429,
   - erreur 5xx,
   - timeout.

12. Journalisation :
   - événement email créé,
   - provider_email_id stocké,
   - erreur stockée sans clé API.

--------------------------------------------------
MIGRATIONS ET SEED
--------------------------------------------------

Tu dois produire :

1. Une migration Alembic additive pour :
   - la table d’événements emails transactionnels si créée,
   - les nouveaux index éventuels,
   - les nouvelles contraintes éventuelles.

2. Un script de seed ou d’initialisation si nécessaire :
   - paramètres SiteSetting,
   - template par défaut,
   - configuration Resend non sensible.

Aucune donnée sensible ne doit être seedée.
La clé API Resend ne doit jamais être stockée en seed.

--------------------------------------------------
DOCUMENTATION À PRODUIRE
--------------------------------------------------

Produis un README ou une section de documentation expliquant :

1. Configuration Resend :
   - création du compte,
   - création de la clé API,
   - vérification du domaine,
   - configuration de l’adresse d’envoi.

2. Variables d’environnement.

3. Activation de la confirmation d’email.

4. Fonctionnement du token :
   - durée,
   - usage unique,
   - hash,
   - révocation.

5. Endpoints :
   - POST /api/subscriptions
   - GET /api/subscriptions/confirm/{token}
   - POST /api/subscriptions/resend-confirmation

6. Tâches Celery :
   - lancement du worker,
   - queue emails si utilisée.

7. Tests avec mock Resend.

8. Dépannage :
   - clé API invalide,
   - domaine non vérifié,
   - rate limit,
   - emails en spam.

--------------------------------------------------
CRITÈRES D’ACCEPTATION
--------------------------------------------------

Le module sera considéré comme valide si :

1. L’inscription crée un abonné avec `status = pending` quand la confirmation est activée.
2. Aucun email n’est envoyé si la confirmation est désactivée.
3. Le token de confirmation est sécurisé et stocké uniquement sous forme hashée.
4. Le token expire après la durée configurée.
5. Le token est à usage unique.
6. Les anciens tokens sont révoqués lors d’un renvoi.
7. L’email est envoyé via Resend.
8. L’envoi est asynchrone et non bloquant.
9. Les erreurs Resend sont gérées.
10. Les tentatives d’envoi sont journalisées.
11. Le lien de confirmation active l’abonné.
12. La confirmation est idempotente si l’abonné est déjà actif.
13. L’endpoint de renvoi existe.
14. Le renvoi est protégé contre les abus.
15. Les tests passent sans vraie clé API Resend.
16. Les migrations Alembic fonctionnent.
17. La réponse de l’endpoint de confirmation reste compatible avec l’existant.
18. Les schémas Pydantic respectent les conventions du projet.
19. Aucun secret n’est exposé dans les logs ou les réponses API.
20. Le code est modulaire, testable et prêt pour la production.

--------------------------------------------------
FORMAT DE RÉPONSE ATTENDU
--------------------------------------------------

Vu la densité du code demandé et pour éviter que ta réponse ne soit tronquée, nous allons procéder par étapes. 

Pour cette **première réponse**, fournis UNIQUEMENT :
1. Les modèles SQLAlchemy (`SubscriberToken`, table de logs des emails, et modifications éventuelles sur `Subscriber`).
2. Le script de migration Alembic correspondant.
3. Les schémas Pydantic ajoutés ou modifiés.
4. L'interface `EmailProviderProtocol` et l'implémentation `ResendEmailProvider`.
5. Le service de génération, hachage et validation des tokens (`token_service.py`).

Demande-moi explicitement mon feu vert à la fin de ta réponse pour passer à la **Phase 2** (qui contiendra les routes FastAPI avec injection de dépendances, les tâches Celery, et les tests Pytest).

Important :
- Ne casse pas l’inscription existante.
- Ne stocke jamais le token en clair.
- Ne stocke jamais la clé API Resend en base.
- Prévois un mock Resend pour les tests.
- Le flux doit être fiable, idempotent et sécurisé.