Tu es un ingénieur backend senior Python spécialisé dans FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, Celery, Redis et les systèmes d’envoi d’emails transactionnels.

Tu dois implémenter le module d’envoi quotidien des offres par email aux abonnés dans le projet JobAlert CI.

Les offres envoyées aux abonnés doivent être des offres déjà validées, visibles et actives.

--------------------------------------------------
CONTEXTE PROJET
--------------------------------------------------

JobAlert CI est une plateforme de veille automatisée pour le marché de l’emploi en Côte d’Ivoire.

Chaque abonné peut enregistrer :
- jusqu’à 3 filières avec priorité 1, 2 ou 3 ;
- des types de contrat préférés ;
- un niveau d’expérience ;
- une ville en texte libre.

Le système doit envoyer chaque jour à 08h00 un digest personnalisé contenant par défaut 3 nouvelles offres correspondant à ses préférences.

Le nombre d’offres incluses dans le digest doit être configurable par l’administrateur, sans redéploiement, si le mécanisme `SiteSetting` est disponible.

--------------------------------------------------
OBJECTIF GÉNÉRAL
--------------------------------------------------

Mettre en place un pipeline complet de digest quotidien en deux phases distinctes :

Phase 1 — Préparation du digest :
- déclenchée à 07h30 ;
- parcourt les abonnés actifs ;
- sélectionne les offres candidates selon leurs préférences ;
- exclut les offres déjà envoyées à cet abonné ;
- construit un digest personnalisé ;
- crée un EmailDigest même si la liste est vide ;
- laisse les digests prêts avec le statut `queued`.

Phase 2 — Envoi du digest :
- déclenchée à 08h00 ;
- récupère les digests du jour avec statut `queued` ;
- vérifie une dernière fois l’éligibilité des abonnés ;
- envoie les emails via le provider email ;
- trace chaque tentative dans EmailDeliveryAttempt ;
- gère les retries, échecs et annulations.

--------------------------------------------------
CONTRAINTES FONDAMENTALES : UTILISER L’EXISTANT
--------------------------------------------------

Tu dois utiliser les modèles SQLAlchemy existants.

Modèles à réutiliser :

Abonnés :
- Subscriber
- SubscriberFiliere
- SubscriberContractPreference
- SubscriberToken
- UnsubscribeEvent

Offres :
- JobOffer
- JobOfferDetail
- OfferFiliere
- Company
- Location

Emails :
- EmailDigest
- EmailDigestOffer
- EmailDeliveryAttempt

Référentiels :
- Filiere
- ContractType
- ExperienceLevel
- EducationLevel
- Location

Enums existants :
- SubscriberStatus
- DigestStatus
- EmailAttemptStatus
- TokenPurpose
- JobOfferStatus

Schémas Pydantic existants :
- SubscriberRead
- SubscriberPreferencesUpdate
- EmailDigestRead
- EmailDigestOfferRead
- SendTrigger
- SendingStatsRead
- SiteSettingRead
- SettingUpdate

Règles :
- Ne pas recréer les tables existantes.
- Ne pas casser les endpoints existants.
- Les migrations Alembic doivent être strictement additives.
- Respecter les conventions SQLAlchemy 2 du projet.
- Respecter les conventions Pydantic : `*Read`, `*Create`, `*Update`, `ORMModel`, `TimestampRead`.
- Utiliser le style snake_case pour les fonctions, tâches, services et variables internes.

--------------------------------------------------
ÉLÉMENTS EXISTANTS À RÉUTILISER OBLIGATOIREMENT
--------------------------------------------------

1. Normalisation du texte

Le fichier `services/normalization.py` contient déjà une fonction `normalize_text()` qui réalise :
- trim,
- minuscules,
- suppression des accents via NFKD,
- nettoyage de la ponctuation,
- remplacement des espaces multiples.

Tu ne dois pas réinventer cette normalisation.

Tu dois :
- réutiliser `normalize_text()` ;
- créer une fonction spécialisée `normalize_city()` qui étend ce comportement ;
- ajouter dans `normalize_city()` :
  - la suppression des mots parasites comme "côte d'ivoire", "ci", "ivoire" si pertinent ;
  - la gestion du format "Ville - Quartier" en extrayant la partie ville ;
  - une normalisation cohérente avec `Location.normalized_label`.

2. Hash des tokens

Une fonction `token_hash()` existe déjà dans le projet.

Tu dois :
- réutiliser `token_hash()` pour hasher les tokens de désinscription et de gestion des préférences ;
- ne pas créer un nouveau mécanisme de hash de token ;
- ne jamais stocker le token en clair dans `SubscriberToken.token_hash`.

3. Configuration email

Le fichier `core/config.py` contient déjà une configuration de type :

EMAIL_FROM="JobAlert CI <bonjour@jobalert.ci>"

Tu dois utiliser cette configuration existante comme source de vérité.

Tu ne dois pas introduire une configuration redondante ou conflictuelle comme :
- EMAIL_FROM_ADDRESS
- EMAIL_FROM_NAME

sauf si ces variables sont clairement dérivées de `EMAIL_FROM` et ne créent aucun conflit.

Règle recommandée :
- utiliser `EMAIL_FROM` directement dans le provider email ;
- si un parsing est nécessaire, le faire proprement depuis `EMAIL_FROM`.

4. Index existant

Il existe déjà un index :

ix_job_offers_feed (visible_site, status, published_at)

La requête de sélection des offres candidates doit être conçue pour tirer parti de cet index.

Conditions principales à utiliser :
- JobOffer.visible_site == true
- JobOffer.status == active
- JobOffer.published_at ...

--------------------------------------------------
BUG CONNU À CORRIGER : MISE À JOUR DES PRÉFÉRENCES
--------------------------------------------------

Un bug est identifié dans la gestion des préférences abonné.

Dans la fonction de création/mise à jour des préférences, actuellement dans `services/subscriptions.py`, le remplacement des filières peut utiliser un pattern du type :

- clear()
- append()

sans flush intermédiaire.

Avec `cascade="all, delete-orphan"` et les contraintes :
- UNIQUE(subscriber_id, priority)
- UNIQUE(subscriber_id, filiere_id)

cela peut provoquer une violation de contrainte, car les DELETE des anciennes lignes ne sont pas forcément exécutés avant les INSERT des nouvelles dans le même flush.

Tu dois corriger ce bug dans toutes les fonctions concernées, notamment :
- création d’abonné avec filières ;
- mise à jour des préférences via token ;
- mise à jour admin si elle existe.

Correctif attendu :

Stratégie recommandée :
1. récupérer les lignes `SubscriberFiliere` existantes ;
2. les supprimer une par une ou via une suppression explicite ;
3. faire un flush ;
4. ajouter les nouvelles lignes ;
5. faire un second flush si nécessaire ;
6. valider la contrainte 1 à 3 filières ;
7. valider l’unicité des priorités.

Même logique pour `SubscriberContractPreference` si les contrats sont remplacés.

Important :
- ne pas utiliser de camelCase dans le nouveau code ;
- utiliser des noms snake_case ;
- citer les fonctions réelles du projet si elles existent, par exemple `create_subscriber`, `update_preferences`, `get_or_create_subscriber`, selon le code réellement présent.

--------------------------------------------------
ARCHITECTURE EN DEUX PHASES
--------------------------------------------------

Le pipeline doit être séparé en deux tâches planifiées distinctes.

Phase 1 : préparation

Tâche principale :

prepare_daily_digests()

Horaire recommandé :
- 07h30
- timezone Africa/Abidjan

Configuration :
- DAILY_DIGEST_PREPARE_HOUR=7
- DAILY_DIGEST_PREPARE_MINUTE=30
- DIGEST_TIMEZONE=Africa/Abidjan

Rôle :
- acquérir un verrou Redis dédié à la préparation ;
- calculer la date du digest en timezone Africa/Abidjan ;
- vérifier que le pipeline IA n’est pas en train de bloquer des offres si nécessaire ;
- parcourir les abonnés éligibles ;
- déclencher la construction des digests ;
- produire un statut de préparation.

Phase 2 : envoi

Tâche principale :

send_daily_digests()

Horaire recommandé :
- 08h00
- timezone Africa/Abidjan

Configuration :
- DAILY_DIGEST_SEND_HOUR=8
- DAILY_DIGEST_SEND_MINUTE=0
- DIGEST_TIMEZONE=Africa/Abidjan

Rôle :
- acquérir un verrou Redis dédié à l’envoi ;
- vérifier l’état de la phase de préparation ;
- récupérer tous les EmailDigest du jour avec status = queued ;
- déclencher l’envoi unitaire de chaque digest ;
- produire un bilan d’envoi.

--------------------------------------------------
VERROUS REDIS ET TTL
--------------------------------------------------

Tu dois utiliser des verrous Redis séparés pour les deux phases.

Verrou de préparation :

lock:digest:prepare:{digest_date}

Verrou d’envoi :

lock:digest:send:{digest_date}

Règles :
- ne pas utiliser le même verrou pour les deux phases ;
- chaque verrou doit avoir un TTL explicite ;
- prévoir une durée suffisante pour couvrir le traitement ;
- prévoir un mécanisme de renouvellement de verrou si la librairie utilisée le permet ;
- si le verrou expire pendant le traitement, journaliser l’événement et éviter les doubles traitements.

TTL recommandés :

- DIGEST_PREPARE_LOCK_TTL_SECONDS=7200
- DIGEST_SEND_LOCK_TTL_SECONDS=7200

Marqueurs d’état Redis recommandés :

digest:prepare:{digest_date}:status
digest:prepare:{digest_date}:stats
digest:send:{digest_date}:status
digest:send:{digest_date}:stats

Valeurs possibles pour `digest:prepare:{digest_date}:status` :
- running
- completed
- partial_failure
- failed

TTL des marqueurs :
- 48 heures recommandé.

--------------------------------------------------
GRANULARITÉ DES TÂCHES CELERY
--------------------------------------------------

Tu dois séparer clairement l’orchestration et le traitement unitaire.

Tâches à créer :

1. prepare_daily_digests()
   - tâche orchestrator de la phase 1 ;
   - acquiert le verrou de préparation ;
   - récupère les abonnés éligibles ;
   - déclenche un fan-out vers `build_and_queue_digest` ;
   - marque la préparation comme terminée, partielle ou échouée.
   - Contrainte de performance base de données :
      Lors de la récupération des abonnés éligibles dans `prepare_daily_digests`, tu dois impérativement gérer la volumétrie. Utilise `yield_per(100)` (ou la méthode de pagination appropriée de SQLAlchemy 2) pour itérer sur les abonnés sans charger l'intégralité de la table en mémoire RAM. Ne fais jamais de `.all()` sur la table entière des abonnés.


2. build_and_queue_digest(subscriber_id, digest_date)
   - tâche unitaire par abonné ;
   - calcule les offres candidates ;
   - applique les filtres durs ;
   - calcule le score ;
   - sélectionne le top N ;
   - crée l’EmailDigest ;
   - crée les EmailDigestOffer ;
   - retourne un résultat exploitable.

3. mark_preparation_completed(results, digest_date)
   - callback ou tâche de clôture ;
   - agrège les résultats ;
   - stocke les statistiques de préparation ;
   - positionne le marqueur Redis de préparation.

4. send_daily_digests()
   - tâche orchestrator de la phase 2 ;
   - acquiert le verrou d’envoi ;
   - vérifie le marqueur de préparation ;
   - sélectionne les EmailDigest du jour avec status = queued ;
   - déclenche un fan-out vers `send_digest`.

5. send_digest(digest_id)
   - tâche unitaire d’envoi ;
   - vérifie l’éligibilité finale de l’abonné ;
   - passe le digest en `sending` ;
   - génère l’email ;
   - envoie via le provider ;
   - trace la tentative dans EmailDeliveryAttempt ;
   - met à jour le statut final.

6. retry_failed_digests()
   - tâche de récupération optionnelle ;
   - ne doit pas dupliquer le mécanisme de retry automatique de `send_digest` ;
   - doit être déclenchée manuellement ou de manière très encadrée.

Recommandation d’implémentation :
- utiliser des groupes Celery ou chunks pour isoler les erreurs ;
- ne pas faire une seule boucle synchrone géante si le volume d’abonnés augmente ;
- chaque abonné doit être traité de manière isolée ;
- l’échec d’un abonné ne doit jamais bloquer tout le run.

--------------------------------------------------
OFFRES ARRIVÉES PENDANT LES 30 MINUTES D’ÉCART
--------------------------------------------------

Les offres ingérées ou validées après la phase de préparation ne doivent pas être incluses dans le digest du jour.

Règle métier :
- la phase de préparation à 07h30 fige la sélection des offres pour la journée ;
- les offres qui arrivent entre 07h30 et 08h00 seront normalement envoyées le lendemain ;
- ce comportement est attendu et doit être documenté.

Exception :
- si un administrateur déclenche manuellement une nouvelle préparation avec un mode `force` avant l’envoi, alors les digests non envoyés peuvent être recalculés ;
- un digest déjà `sent` ne doit jamais être recalculé ;
- un digest `sending` ne doit pas être modifié.

--------------------------------------------------
ABONNÉS ÉLIGIBLES
--------------------------------------------------

Abonnés éligibles à la préparation :

- status = active ;
- non supprimés logiquement si soft delete existe ;
- email valide ;
- au moins une filière enregistrée ;
- pas en pause si `paused_until` est dans le futur.

Ne pas envoyer :
- aux abonnés `unsubscribed` ;
- aux abonnés `bounced` ;
- aux abonnés `deleted` ;
- aux abonnés en pause future.

Si un abonné devient inéligible entre la préparation et l’envoi :
- la tâche `send_digest` doit détecter ce cas ;
- le digest doit passer en `cancelled` ;
- aucun email ne doit être envoyé.

--------------------------------------------------
SÉLECTION DES OFFRES CANDIDATES
--------------------------------------------------

La sélection doit séparer clairement :
1. les filtres durs, qui excluent une offre ;
2. les facteurs de scoring, qui classent les offres restantes.

Cette séparation est obligatoire.

--------------------------------------------------
FILTRES DURS
--------------------------------------------------

Une offre est exclue si elle ne respecte pas au moins un des filtres durs suivants.

1. Statut et visibilité

Conditions obligatoires :
- JobOffer.status = active
- JobOffer.visible_site = true

2. Offre déjà envoyée

Une offre ne doit jamais être envoyée deux fois à un même abonné.

Exclure :
- les offres déjà liées à un EmailDigest de cet abonné avec status = sent ;
- les offres déjà présentes dans EmailDigestOffer via un digest envoyé.

Utiliser une requête NOT EXISTS robuste.

3. Correspondance de filière

Règle principale :
- JobOffer.primary_filiere_id doit correspondre à une des filières de l’abonné.

Optionnel mais souhaitable :
- si `MATCH_USING_OFFER_FILIERES=true`, les offres liées via OfferFiliere peuvent être acceptées en secondaire ;
- les offres dont `primary_filiere_id` correspond doivent rester prioritaires.

Si aucune correspondance de filière :
- l’offre est exclue.

4. Type de contrat

Si l’abonné n’a sélectionné aucun contrat :
- ne pas filtrer par contrat.

Si l’abonné a sélectionné des contrats :
- ne garder que les offres dont `contract_type_id` est dans ses contrats préférés ;
- les offres sans contrat peuvent être acceptées seulement si `DIGEST_INCLUDE_NO_CONTRACT_OFFERS=true`.

Si l’offre n’a pas de contrat et que la config est stricte :
- l’offre est exclue.

5. Niveau d’expérience

Si l’abonné n’a pas de niveau d’expérience :
- ne pas filtrer par expérience.

Si l’offre n’a pas de niveau d’expérience :
- elle peut être considérée comme compatible.

Si l’offre a un niveau d’expérience :
- utiliser une logique de compatibilité basée sur `ExperienceLevel.min_years` et `ExperienceLevel.max_years`.

Une offre dont l’expérience exigée est trop éloignée du profil de l’abonné doit être exclue par un filtre dur.

6. Ville

Le champ `Subscriber.city` est du texte libre.
Il n’y a pas de FK directe vers `Location`.

Règles de filtre dur :

Cas 1 : l’abonné n’a pas renseigné de ville
- appliquer la configuration `DIGEST_CITY_MODE` ;
- par défaut, inclure toutes les offres ;
- optionnellement inclure seulement les offres remote si config explicite.

Cas 2 : l’abonné a une ville et elle matche une localisation
- inclure les offres dont la ville correspond ;
- inclure éventuellement les offres dont le label ou district correspond selon configuration ;
- inclure les offres remote si `INCLUDE_REMOTE_OFFERS=true`.

Cas 3 : l’abonné a une ville mais aucune correspondance fiable
- ne pas forcer un match approximatif dangereux ;
- journaliser la ville comme non matchée ;
- inclure uniquement les offres remote si `INCLUDE_REMOTE_OFFERS_FOR_UNMATCHED_CITY=true` ;
- sinon exclure les offres localisées non compatibles.

Cas 4 : offre sans localisation
- si `DIGEST_INCLUDE_NO_LOCATION_OFFERS=true`, l’offre peut être incluse ;
- elle reçoit alors un score ville de 0 ;
- si `DIGEST_INCLUDE_NO_LOCATION_OFFERS=false`, l’offre est exclue.

Configuration recommandée :
- CITY_MATCH_MODE=normalized_exact
- INCLUDE_REMOTE_OFFERS=true
- INCLUDE_REMOTE_OFFERS_FOR_UNMATCHED_CITY=true
- DIGEST_CITY_MODE=prefer_city
- DIGEST_INCLUDE_NO_LOCATION_OFFERS=true

7. Fraîcheur

Ne considérer que les offres nouvelles depuis le dernier digest réellement envoyé à cet abonné.

Dernier digest envoyé :
- dernier EmailDigest avec status = sent et sent_at non null.

Si aucun digest envoyé :
- utiliser `subscribed_at` ou `confirmed_at` comme point de départ.

Si le dernier digest était `skipped_empty` :
- ne pas remettre le compteur de nouveauté à zéro ;
- continuer à chercher les offres non envoyées depuis le dernier digest réellement envoyé.

Champ à utiliser :
- JobOffer.published_at

Fallback :
- JobOffer.collected_at
- JobOffer.created_at

--------------------------------------------------
FACTEURS DE SCORING
--------------------------------------------------

Une fois les filtres durs appliqués, les offres restantes sont classées par score.

Formule recommandée :

score =
  score_filiere
+ score_contract
+ score_experience
+ score_city
+ score_freshness

Score filière :
- priorité 1 : 100 points
- priorité 2 : 70 points
- priorité 3 : 40 points
- bonus optionnel de 10 points si l’offre correspond à la filière principale de l’abonné.

Score contrat :
- contrat correspondant : +20 points
- offre sans contrat acceptée par config : +5 points
- abonné sans préférence contrat : +0 point

Score expérience :
- expérience exactement compatible : +20 points
- offre sans expérience requise : +15 points
- expérience adjacente tolérée : +10 points

Score ville :
- correspondance exacte ville normalisée : +25 points
- correspondance via label ou district : +15 points
- offre remote alors que l’abonné a une ville : +10 points
- offre sans localisation : +0 point

Score fraîcheur :
- publiée depuis moins de 24h : +15 points
- publiée depuis moins de 48h : +10 points
- publiée depuis moins de 7 jours : +5 points
- plus ancienne : +0 point

En cas d’égalité :
- trier par date de publication décroissante ;
- puis par titre ;
- puis par ID.

--------------------------------------------------
MATCHING PAR EXPÉRIENCE
--------------------------------------------------

Utiliser les champs réels :
- ExperienceLevel.min_years
- ExperienceLevel.max_years

Logique recommandée :

Configuration :
- EXPERIENCE_MATCH_TOLERANCE_YEARS=1
- EXPERIENCE_MATCH_MODE=compatible

Règles :
- abonné débutant :
  - accepte offres sans expérience ;
  - accepte offres débutant ;
  - accepte éventuellement offres 1-3 ans si config tolérante.
- abonné 1-3 ans :
  - accepte offres sans expérience ;
  - accepte offres débutant ;
  - accepte offres 1-3 ans ;
  - accepte éventuellement offres 3-5 ans si config tolérante.
- abonné 5+ :
  - accepte la plupart des offres, sauf celles explicitement trop juniors si configuration stricte.

Le scoring peut valoriser une expérience proche, mais l’exclusion des offres trop éloignées doit être gérée par filtre dur.

--------------------------------------------------
MATCHING PAR VILLE
--------------------------------------------------

Tu dois créer un service dédié :

city_matching_service.py

Ce service doit :
- réutiliser `normalize_text()` ;
- étendre la normalisation via `normalize_city()` ;
- comparer la ville de l’abonné avec :
  - Location.city,
  - Location.label,
  - Location.normalized_label ;
- gérer les formats "Ville - Quartier" ;
- éviter les faux positifs ;
- journaliser les cas ambigus.

Étapes :

1. Normaliser `Subscriber.city`.
2. Normaliser les champs de localisation.
3. Chercher une correspondance exacte normalisée.
4. Si pas de correspondance exacte, comparer avec le label normalisé.
5. Si toujours pas de correspondance fiable, appliquer la règle fallback.

Ne jamais faire de fuzzy matching dangereux sans configuration explicite.

--------------------------------------------------
NOMBRE D’OFFRES PAR DIGEST
--------------------------------------------------

Le digest doit contenir par défaut 3 offres.

Configuration :
- DIGEST_MAX_OFFERS=3

Ce nombre doit pouvoir être configuré par l’administrateur.

Si le projet utilise SiteSetting :
- créer ou utiliser une clé `digest_max_offers` ;
- valeur entière sécurisée, par exemple entre 1 et 10 ;
- si la valeur est absente ou invalide, utiliser la valeur par défaut.

Si le projet ne permet pas encore l’édition complète de SiteSetting :
- lire la valeur depuis SiteSetting si elle existe ;
- sinon utiliser la variable d’environnement.

Règles :
- si nombre d’offres éligibles > DIGEST_MAX_OFFERS :
  - garder seulement les meilleures offres ;
- si nombre d’offres éligibles = 0 :
  - créer un digest `skipped_empty` ;
- si nombre d’offres éligibles < DIGEST_MAX_OFFERS mais >= 1 :
  - envoyer avec les offres disponibles.

--------------------------------------------------
CRÉATION DU DIGEST
--------------------------------------------------

Pour chaque abonné, créer un EmailDigest.

Contrainte existante :
- UNIQUE(subscriber_id, digest_date)

Si un digest existe déjà pour cet abonné et cette date :
- ne pas en créer un second ;
- journaliser ;
- passer à l’abonné suivant.

Sauf en mode `force` avant envoi :
- si le digest existe et n’est pas `sent` ou `sending`, il peut être recalculé ;
- supprimer/remplacer les EmailDigestOffer existants ;
- mettre à jour offer_count et payload_preview ;
- respecter les contraintes UNIQUE(digest_id, offer_id) et UNIQUE(digest_id, position).

Cas 1 : aucune offre éligible

Créer un EmailDigest avec :
- subscriber_id
- digest_date
- status = skipped_empty
- offer_count = 0
- skipped_reason = "no_matching_offer"
- scheduled_for = heure d’envoi cible
- template_version = v1

Ne pas envoyer d’email.

Cas 2 : offres éligibles

Créer un EmailDigest avec :
- subscriber_id
- digest_date
- status = queued
- offer_count = nombre d’offres retenues
- subject = sujet du digest
- scheduled_for = heure d’envoi cible
- template_version = v1
- payload_preview éventuel, léger

Puis créer les lignes EmailDigestOffer :
- digest_id
- offer_id
- position = 1, 2, 3...

Contraintes à respecter :
- UNIQUE(digest_id, offer_id)
- UNIQUE(digest_id, position)

--------------------------------------------------
ENVOI DU DIGEST
--------------------------------------------------

La tâche `send_digest(digest_id)` doit :

1. Charger le digest.
2. Vérifier que le digest est en `queued`.
3. Vérifier que l’abonné est toujours éligible :
   - status = active ;
   - non désinscrit ;
   - non bounced ;
   - non deleted ;
   - pas en pause future.
4. Si abonné non éligible :
   - passer le digest en `cancelled` ;
   - skipped_reason = "subscriber_unsubscribed" ou raison appropriée ;
   - ne pas envoyer l’email.
5. Sinon :
   - passer le digest en `sending` ;
   - générer le contenu HTML et texte ;
   - envoyer via le provider email ;
   - tracer la tentative dans EmailDeliveryAttempt.

Provider email :

Réutiliser le provider existant si le projet a déjà un service email, notamment Resend pour la confirmation.

Sinon créer une abstraction :

EmailProviderProtocol:
  - send(message) -> EmailSendResult

Implémentations :
- ResendEmailProvider
- MockEmailProvider pour les tests

Configuration :
- EMAIL_PROVIDER=resend
- EMAIL_FROM="JobAlert CI <bonjour@jobalert.ci>"
- PUBLIC_BASE_URL=https://jobalert.ci

Ne jamais logger la clé API.
Ne jamais exposer la clé API dans les réponses.

--------------------------------------------------
TENTATIVES D’ENVOI ET ARTICULATION DES RETRIES
--------------------------------------------------

Il existe deux niveaux potentiels de retry.

Tu dois éviter toute ambiguïté.

Niveau 1 — Retry automatique dans send_digest

`send_digest` est responsable des tentatives automatiques d’un digest donné.

Règles :
- maximum 3 tentatives ;
- chaque tentative est enregistrée dans EmailDeliveryAttempt ;
- attempt_no doit rester dans 1, 2, 3 ;
- backoff entre tentatives ;
- retry uniquement sur erreurs temporaires :
  - timeout réseau,
  - erreur 429,
  - erreur 5xx,
  - erreur Redis/DB temporaire.
- pas de retry sur :
  - email invalide,
  - clé API invalide,
  - domaine non vérifié,
  - erreur 4xx non retentable.

Niveau 2 — Tâche retry_failed_digests

La tâche `retry_failed_digests()` ne doit pas créer une boucle de retry parallèle qui se superpose à `send_digest`.

Rôle exact :
- récupérer uniquement les digests en échec qui peuvent encore être retraités ;
- ne pas dépasser la contrainte `attempt_no` 1–3 ;
- ne rejouer que les digests dont les tentatives n’ont pas toutes été consommées, ou dont l’échec est dû à un problème technique clairement récupérable ;
- si les 3 tentatives sont épuisées, ne pas retenter automatiquement ;
- une relance manuelle admin peut être prévue, mais elle doit être explicite.

Configuration recommandée :
- EMAIL_MAX_RETRIES=3
- EMAIL_RETRY_BACKOFF_SECONDS=30
- RETRY_FAILED_DIGESTS_ENABLED=false par défaut

Si `RETRY_FAILED_DIGESTS_ENABLED=true` :
- prévoir une exécution très encadrée, par exemple après 08h45 ;
- journaliser chaque relance ;
- produire une alerte si un digest échoue définitivement.

Pour chaque tentative :

- attempt_no = numéro de tentative
- status = pending puis success ou failed
- provider = resend ou mock
- provider_message_id = ID renvoyé par le provider si succès
- started_at
- finished_at
- error_message si échec

Résultat final :

Si succès :
- EmailDigest.status = sent
- EmailDigest.sent_at = maintenant
- Subscriber.last_email_sent_at = maintenant

Si échec définitif après 3 tentatives :
- EmailDigest.status = failed

Si abonné désinscrit entre-temps :
- EmailDigest.status = cancelled
- skipped_reason = "subscriber_unsubscribed"

--------------------------------------------------
CONTENU DE L’EMAIL
--------------------------------------------------

Créer un template de digest.

Formats :
- HTML
- texte brut

Variables disponibles :
- full_name
- email
- digest_date
- offers
- manage_preferences_url
- unsubscribe_url
- site_name
- support_email
- daily_tip optionnel si subscriber.wants_career_tips = true

Pour chaque offre, afficher :
- titre
- entreprise
- localisation
- contrat
- expérience
- filière
- date de publication
- lien vers la fiche offre sur JobAlert CI
- lien secondaire vers l’offre source si pertinent

Lien offre recommandé :

{PUBLIC_BASE_URL}/offres/{id}

Fallback :
- source_url si la page détail publique n’est pas disponible.

Style :
- simple,
- lisible,
- responsive,
- compatible email clients.

Sujet recommandé :

Vos offres du jour sur JobAlert CI — {digest_date}

ou :

{offer_count} nouvelles offres pour vous sur JobAlert CI

--------------------------------------------------
LIENS SIGNÉS : DÉSABONNEMENT ET PRÉFÉRENCES
--------------------------------------------------

Chaque email doit contenir deux liens :

1. Gestion des préférences :
   - purpose = manage_alert
   - lien sans login

2. Désinscription :
   - purpose = unsubscribe
   - lien sans login

Utiliser la table SubscriberToken.

Règles :
- ne jamais stocker le token en clair ;
- utiliser la fonction existante `token_hash()` ;
- utiliser `secrets.token_urlsafe(32)` pour générer le token brut ;
- créer ou réutiliser un token actif pour le même subscriber et le même purpose ;
- pour unsubscribe, le token doit être à usage unique ;
- pour manage_alert, le token peut être réutilisable tant qu’il n’est pas révoqué.
- Attention stricte sur la requête en base de données : L'URL des endpoints recevra le token brut. Avant de faire la requête `SELECT` via SQLAlchemy pour trouver le `SubscriberToken`, tu DOIS d'abord hasher le token brut reçu avec la fonction `token_hash()`. Ta clause WHERE doit comparer le hash généré avec la colonne `token_hash` en base. Ne cherche jamais le token brut directement dans la base de données.

Token fields :
- subscriber_id
- purpose
- token_hash
- expires_at nullable
- used_at nullable
- revoked_at nullable

Liens recommandés :

{PUBLIC_BASE_URL}/preferences/{token}
{PUBLIC_BASE_URL}/desinscription/{token}

Si le frontend utilise les endpoints API directement :

GET /api/subscriptions/preferences/{token}
PUT /api/subscriptions/preferences/{token}
POST /api/subscriptions/unsubscribe/{token}

Ne pas casser les endpoints existants.

--------------------------------------------------
DÉSINSCRIPTION
--------------------------------------------------

Lorsqu’un utilisateur clique sur le lien de désinscription :

1. Valider le token.
2. Vérifier :
   - purpose = unsubscribe
   - token non utilisé
   - token non révoqué
   - token non expiré.
3. Marquer le token comme utilisé.
4. Créer un UnsubscribeEvent.
5. Mettre à jour Subscriber :
   - status = unsubscribed
   - unsubscribed_at = maintenant
   - unsubscribe_reason si fournie.
6. Exclure automatiquement l’abonné des prochains digests.
7. Afficher une page ou réponse de confirmation.

Règles :
- aucune authentification requise ;
- action idempotente si l’abonné est déjà désinscrit ;
- ne pas envoyer d’erreur violente si le token est déjà utilisé : afficher message approprié.

--------------------------------------------------
GESTION DES PRÉFÉRENCES SANS LOGIN
--------------------------------------------------

Le lien `manage_alert` doit permettre à l’abonné de modifier ses préférences sans créer de compte.

Utiliser le schéma existant :

SubscriberPreferencesUpdate

Champs :
- filieres : 1 à 3 obligatoires
- contract_types : optionnel
- wants_career_tips : optionnel

Règles :
- valider le token `manage_alert` ;
- vérifier qu’il n’est pas expiré ou révoqué ;
- mettre à jour SubscriberFiliere ;
- mettre à jour SubscriberContractPreference ;
- respecter la contrainte 1 à 3 filières ;
- respecter la contrainte UNIQUE(subscriber_id, priority) ;
- respecter la contrainte UNIQUE(subscriber_id, filiere_id).

Tu dois impérativement corriger le bug de remplacement des filières :
- supprimer les anciennes lignes ;
- flush ;
- ajouter les nouvelles ;
- ou utiliser une stratégie transactionnelle sûre équivalente.

--------------------------------------------------
CONFIGURATION ET VARIABLES D’ENVIRONNEMENT
--------------------------------------------------

Variables recommandées :

DAILY_DIGEST_PREPARE_HOUR=7
DAILY_DIGEST_PREPARE_MINUTE=30
DAILY_DIGEST_SEND_HOUR=8
DAILY_DIGEST_SEND_MINUTE=0
DIGEST_TIMEZONE=Africa/Abidjan

DIGEST_MAX_OFFERS=3
DIGEST_MIN_OFFERS=1
DIGEST_SEND_IF_BELOW_MIN=true

DIGEST_INCLUDE_NO_CONTRACT_OFFERS=false
DIGEST_INCLUDE_NO_LOCATION_OFFERS=true

EXPERIENCE_MATCH_MODE=compatible
EXPERIENCE_MATCH_TOLERANCE_YEARS=1

CITY_MATCH_MODE=normalized_exact
INCLUDE_REMOTE_OFFERS=true
INCLUDE_REMOTE_OFFERS_FOR_UNMATCHED_CITY=true
DIGEST_CITY_MODE=prefer_city

EMAIL_PROVIDER=resend
EMAIL_FROM="JobAlert CI <bonjour@jobalert.ci>"
PUBLIC_BASE_URL=https://jobalert.ci

EMAIL_MAX_RETRIES=3
EMAIL_RETRY_BACKOFF_SECONDS=30

DIGEST_PREPARE_LOCK_TTL_SECONDS=7200
DIGEST_SEND_LOCK_TTL_SECONDS=7200

SEND_IF_PREPARATION_INCOMPLETE=false
RETRY_FAILED_DIGESTS_ENABLED=false

Si le projet utilise SiteSetting :
- stocker les paramètres non sensibles dans SiteSetting ;
- garder les secrets dans les variables d’environnement ;
- clé recommandée : `digest_max_offers`.

--------------------------------------------------
GESTION DU CAS OÙ LA PRÉPARATION N’EST PAS TERMINÉE
--------------------------------------------------

La phase d’envoi doit vérifier l’état de la phase de préparation.

Si le marqueur de préparation est absent ou à `failed` :

Cas par défaut recommandé :
- `SEND_IF_PREPARATION_INCOMPLETE=false`
- ne pas envoyer les digests ;
- créer une alerte admin ;
- journaliser l’erreur.

Si configuration permissive :
- `SEND_IF_PREPARATION_INCOMPLETE=true`
- envoyer uniquement les digests déjà en `queued` ;
- créer une alerte indiquant que la préparation est incomplète.

Si le marqueur est `partial_failure` :
- envoyer les digests `queued` ;
- créer une alerte contenant les abonnés ou lots en erreur.

--------------------------------------------------
ENDPOINTS À CRÉER OU ADAPTER
--------------------------------------------------

Admin :

POST /api/admin/sending/prepare
- déclenche manuellement la phase de préparation.

POST /api/admin/sending/send
- déclenche manuellement la phase d’envoi.

POST /api/admin/sending/run
- déclenche soit les deux phases, soit une phase précise.

Body compatible avec SendTrigger si possible :

{
  "subscriber_id": null,
  "filiere_code": null,
  "date_override": null
}

GET /api/admin/sending/stats
- Response compatible avec SendingStatsRead.

Public / token :

GET /api/subscriptions/preferences/{token}
PUT /api/subscriptions/preferences/{token}
POST /api/subscriptions/unsubscribe/{token}

Ne pas casser les endpoints existants.

--------------------------------------------------
TESTS À PRODUIRE
--------------------------------------------------

Écris des tests pytest couvrant :

1. Architecture deux phases :
   - préparation crée les digests à 07h30 ;
   - envoi récupère uniquement les digests queued ;
   - les deux phases utilisent des verrous séparés ;
   - un même run ne peut pas se déclencher deux fois.

2. Préparation :
   - la tâche orchestrateur fan-out vers build_and_queue_digest ;
   - un abonné en erreur ne bloque pas les autres ;
   - le marqueur de préparation est positionné ;
   - les statistiques de préparation sont enregistrées.

3. Envoi :
   - send_daily_digests sélectionne les digests queued du jour ;
   - send_digest envoie un digest valide ;
   - send_digest annule un digest si abonné désinscrit ;
   - send_digest échoue proprement si provider en erreur.

4. Vérification préparation incomplète :
   - si marqueur absent et SEND_IF_PREPARATION_INCOMPLETE=false, aucun envoi ;
   - si marqueur absent et SEND_IF_PREPARATION_INCOMPLETE=true, envoi des queued seulement ;
   - alerte créée.

5. Matching filière :
   - offre avec filière priorité 1 sélectionnée ;
   - offre avec filière priorité 3 sélectionnée mais moins bien classée ;
   - offre hors filières exclue.

6. Matching contrat :
   - abonné avec contrats préférés reçoit seulement offres compatibles ;
   - abonné sans contrats reçoit offres sans filtre contrat ;
   - offre sans contrat exclue si config stricte.

7. Matching expérience :
   - abonné débutant reçoit offres sans expérience ;
   - abonné 1-3 ans reçoit offres compatibles ;
   - offre trop senior exclue selon config ;
   - le scoring ne contredit pas les filtres durs.

8. Matching ville :
   - ville exacte normalisée matche ;
   - accents et casse ignorés ;
   - format "Ville - Quartier" géré ;
   - offre remote incluse si config ;
   - ville non matchée journalisée ;
   - abonné sans ville reçoit offres selon config ;
   - offre sans localisation incluse ou exclue selon config.

9. Fraîcheur et dé-doublonnage :
   - offre déjà envoyée n’est pas renvoyée ;
   - offre ancienne non envoyée peut être exclue selon config ;
   - dernier digest skipped_empty ne bloque pas les nouvelles offres.

10. Digest :
   - EmailDigest créé avec skipped_empty si aucune offre ;
   - EmailDigest créé avec queued si offres présentes ;
   - EmailDigestOffer créés avec positions ;
   - DIGEST_MAX_OFFERS respecté ;
   - nombre configurable via SiteSetting si disponible.

11. Envoi et retries :
   - digest passe en sending ;
   - provider mock appelé ;
   - EmailDeliveryAttempt créé ;
   - digest passe en sent si succès ;
   - digest passe en failed après 3 tentatives ;
   - retry_failed_digests ne crée pas de tentative au-delà de 3.

12. Liens token :
   - lien unsubscribe valide ;
   - lien manage_alert valide ;
   - token expiré refusé ;
   - token déjà utilisé refusé ou idempotent selon cas ;
   - token_hash existant réutilisé.

13. Désinscription :
   - UnsubscribeEvent créé ;
   - Subscriber.status = unsubscribed ;
   - prochain digest ignoré ;
   - digest queued annulé lors de l’envoi.

14. Préférences sans login :
   - modification des filières ;
   - remplacement sûr des filières sans violation de contrainte ;
   - validation 1 à 3 filières ;
   - flush correct entre suppression et ajout.

--------------------------------------------------
MIGRATIONS ET DONNÉES
--------------------------------------------------

Tu dois produire les migrations Alembic nécessaires uniquement si besoin.

Évolutions possibles :

1. Ajouter `Subscriber.city_normalized` :
   - string(120) nullable,
   - indexé.

2. Ajouter éventuellement `Subscriber.last_digest_sent_at` :
   - datetime nullable,
   - si nécessaire pour optimiser.

3. Ajouter des index utiles uniquement s’ils manquent :
   - EmailDigest(status, digest_date)
   - JobOffer(status, visible_site, published_at)
   - JobOffer(primary_filiere_id)
   - JobOffer(contract_type_id)
   - JobOffer(experience_level_id)

Aucune migration ne doit supprimer ou retaper une colonne existante.

Si l’index `ix_job_offers_feed` existe déjà, ne pas le recréer.

--------------------------------------------------
DOCUMENTATION À PRODUIRE
--------------------------------------------------

Produis un README ou une section de documentation expliquant :

1. Fonctionnement du digest quotidien en deux phases.
2. Configuration Celery Beat.
3. Variables d’environnement.
4. Règles de matching.
5. Séparation filtres durs / scoring.
6. Gestion de la ville texte libre.
7. Retry d’envoi et rôle de retry_failed_digests.
8. Liens de désinscription et préférences.
9. Tests avec mock email provider.
10. Déclenchement manuel.
11. Statistiques d’envoi.
12. Comportement des offres arrivées entre 07h30 et 08h00.

--------------------------------------------------
CRITÈRES D’ACCEPTATION
--------------------------------------------------

Le module sera considéré comme valide si :

1. La préparation des digests s’exécute à 07h30.
2. L’envoi des digests s’exécute à 08h00.
3. Les deux phases utilisent des verrous Redis séparés avec TTL explicite.
4. La granularité des tâches isole les erreurs par abonné.
5. Les abonnés actifs reçoivent un digest quotidien.
6. Les offres envoyées sont status=active et visible_site=true.
7. Les offres correspondent aux filières de l’abonné.
8. Les contrats préférés sont respectés si renseignés.
9. L’expérience est gérée de façon tolérante mais cohérente.
10. La ville texte libre est comparée proprement avec Location.city.
11. Les offres remote peuvent être incluses selon configuration.
12. Une offre déjà envoyée n’est jamais renvoyée.
13. Un digest vide est créé avec skipped_empty.
14. Chaque envoi est tracé dans EmailDeliveryAttempt.
15. Le digest passe correctement par queued, sending, sent, failed ou cancelled.
16. Les retries automatiques sont limités à 3 tentatives.
17. retry_failed_digests ne duplique pas le mécanisme de retry automatique.
18. Les liens unsubscribe et manage_alert fonctionnent sans login.
19. La désinscription crée un UnsubscribeEvent.
20. Un abonné désinscrit est exclu des prochains runs.
21. Les contraintes UNIQUE des tables existantes sont respectées.
22. Le bug de remplacement des filières est corrigé avec flush.
23. Les migrations sont additives.
24. Les tests passent avec un provider email mock.
25. Le matching ville est journalisé et configurable.
26. Le code est modulaire, testable et prêt pour la production.

--------------------------------------------------
FORMAT DE RÉPONSE ATTENDU ET MODE OPÉRATOIRE
--------------------------------------------------

Ce cahier des charges est dense. Pour garantir un code complet et sans troncature, nous allons procéder par étapes.
Pour ta première réponse, je te demande UNIQUEMENT de :
1. Confirmer que tu as compris l'intégralité des contraintes (réponds par un bref résumé de l'architecture en 2 phases et des verrous).
2. Générer le code du service `city_matching_service.py` et la logique de scoring.
3. T'arrêter là et me demander : "Veux-tu que je génère maintenant les tâches Celery d'orchestration et d'envoi ?"

Important :
- Ne casse pas les modèles existants.
- Ne crée pas de table inutile si une table existante suffit.
- N’envoie jamais une offre déjà envoyée à un même abonné.
- Prévois un mock email provider pour les tests.
- Le matching ville doit être prudent, configurable et journalisé.
- Ne réinvente pas normalize_text() ni token_hash().
- Respecte la configuration EMAIL_FROM existante.
- Sépare clairement filtres durs et facteurs de classement.
- Utilise des verrous Redis avec TTL explicite.