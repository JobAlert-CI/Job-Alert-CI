Tu es un ingénieur backend senior Python spécialisé dans les architectures asynchrones fiables, les intégrations LLM structurées, les systèmes de retry/fallback et les pipelines de traitement de données.

Tu dois initialiser le module IA du projet JobAlert CI.

JobAlert CI est une plateforme de veille automatisée pour le marché de l’emploi en Côte d’Ivoire. Des scrapers collectent des offres depuis plusieurs sources, puis les envoient à une API d’ingestion FastAPI. Les offres ingérées sont enregistrées avec un statut brut, en attente de traitement IA.

Le module IA doit maintenant être mis a jour pour traiter ces offres brutes après la fin des scrapers.

--------------------------------------------------
OBJECTIF PRINCIPAL
--------------------------------------------------

Mettre en place un pipeline IA complet, découplé, fiable et administrable, capable de :

1. Détecter que les scrapers ont terminé leur exécution.
2. Récupérer les offres ayant le statut `brut`.
3. Envoyer ces offres groupées à une API IA.
4. Utiliser plusieurs clés/fournisseurs IA configurables par l’administrateur (a initialiser).
5. Choisir la clé active ayant la priorité la plus haute.
6. Gérer les erreurs avec retry et fallback vers une autre clé.
7. Demander à l’IA de :
   - reformater les offres,
   - nettoyer/compléter le détail,
   - classifier les offres par filière existante,
   - proposer une nouvelle filière si aucune filière existante ne correspond(besoin d'une revue admin).
8. Empêcher l’affichage public des offres nécessitant une revue administrateur.
9. Renvoyer les offres traitées à l’API d’ingestion pour validation et changement de statut.
10. Continuer le traitement des autres offres si une offre est invalide.
11. Produire une alerte contenant les IDs des offres à retraiter.
12. Vérifier après 5, 10 et 15 minutes s’il reste des offres brutes oubliées.
13. Se mettre en veille s’il n’y a plus d’offres à traiter, jusqu’au prochain lancement (manuelle ou automatique) des scrapers.

IMPORTANT :
- Le traitement IA doit être découplé de l’ingestion.
- L’API d’ingestion ne doit pas attendre la réponse IA pour répondre aux scrapers.
- Le module IA doit être rejouable, idempotent et observable.
- Aucune offre brute ne doit être exposée publiquement.
- Aucune clé API IA ne doit être stockée en clair ou exposée dans les logs.

--------------------------------------------------
STACK TECHNIQUE À UTILISER
--------------------------------------------------

Le projet utilise déjà :

- Python 3.11+
- FastAPI
- Pydantic v2
- SQLAlchemy 2.x
- Alembic
- PostgreSQL
- Redis
- Celery
- Celery Beat

Tu dois intégrer le module IA dans cette stack.

Ajoute si nécessaire :

- httpx pour les appels HTTP vers les APIs IA,
- cryptography pour le chiffrement des clés API,
- un système de logs structurés,
- des tâches Celery dédiées à l’IA.

Ne pas ajouter de dépendance lourde inutile.
Si des SDK IA sont utilisés, ils doivent être optionnels ou chargés paresseusement.

--------------------------------------------------
CONTRAINTES D’INTÉGRATION AVEC L’EXISTANT
--------------------------------------------------

Tu dois respecter l’existant du projet JobAlert CI.

Les filières existantes doivent être chargées dynamiquement depuis la base de données.

Exemples de filières déjà présentes dans le système :
- tech-dev
- marketing-com
- commercial-vente
- comptabilite-finance
- ressources-humaines
- btp-genie-civil
- logistique-transport
- sante-medical
- administration
- education-formation
- hotellerie-restauration
- agriculture-agrobusiness
- securite-gardiennage

Les types de contrat peuvent inclure :
- cdi
- cdd
- stage
- mission
- alternance
- autre

Les niveaux d’expérience peuvent inclure :
- debutant
- 1-3
- 3-5
- 5-plus

Les niveaux de formation peuvent inclure :
- bepc
- bac-1
- bac-2
- bac-3
- bac-4
- bac-5

Tu ne dois pas coder ces valeurs en dur si elles existent déjà en base.
Tu dois les récupérer depuis les référentiels.

--------------------------------------------------
STATUTS DES OFFRES À PRÉVOIR
--------------------------------------------------

Le pipeline IA doit gérer les statuts suivants pour les offres.

Si les statuts n’existent pas encore dans le modèle JobOfferStatus, tu dois les ajouter proprement via enum Python et migration Alembic avec contrainte CHECK.

Statuts requis :

1. `brut`
   - offre fraîchement ingérée,
   - non visible publiquement,
   - en attente de traitement IA.

2. `ai_processing`
   - offre en cours de traitement IA,
   - verrouillée pour éviter les traitements concurrents,
   - non visible publiquement.

3. `active`
   - offre validée,
   - visible publiquement si `visible_site = true`.

4. `pending_review`
   - offre nécessitant une action administrateur,
   - par exemple si aucune filière existante ne correspond,
   - non visible publiquement.

5. `rejected`
   - offre invalide après plusieurs tentatives IA ou validation impossible,
   - non visible publiquement.

Règles :
- Une offre `brut` peut passer à `ai_processing`.
- Une offre `ai_processing` peut passer à `active`, `pending_review`, `rejected`, ou revenir à `brut` si elle doit être retraitée.
- Une offre `active` ne doit pas être retraitée automatiquement sauf action manuelle.
- Les offres `brut`, `ai_processing`, `pending_review`, `rejected` ne doivent jamais être exposées dans les endpoints publics.

--------------------------------------------------
DÉTECTION DE LA FIN DES SCRAPERS
--------------------------------------------------

Le traitement IA doit démarrer après que les scrapers ont fini leur scraping et l’envoi à l’API d’ingestion.

Tu dois prévoir deux mécanismes complémentaires.

1. Déclenchement orchestré

Si les scrapers sont pilotés par Celery, utilise un mécanisme de type group/chord :

- lancement des scrapers actifs,
- chaque scraper envoie ses offres à l’API d’ingestion,
- une fois tous les scrapers terminés, une tâche `trigger_ai_processing` est déclenchée.

Exemple conceptuel :

group(run_source_scraper.s(source_code) for source_code in active_sources)
| trigger_ai_processing.s()

2. Déclenchement par vérification d’état

Si les scrapers sont externes ou asynchrones, prévois une vérification d’état :

- récupérer les sources actives avec `supports_scraping = true`,
- vérifier les runs du jour en timezone Africa/Abidjan,
- considérer que le scraping est terminé si :
  - aucun run n’est en statut `running`,
  - toutes les sources actives ont au moins un run terminé,
  - les statuts terminés peuvent être : success, partial_failure, failed.
- s’il existe encore des scrapers en cours, ne pas lancer l’IA.
- si un ou plusieurs scrapers ont échoué mais que d’autres offres brutes existent, lancer quand même l’IA sur les offres disponibles et journaliser l’état dégradé.

Prévoir aussi :
- un endpoint admin pour déclencher manuellement l’IA,
- un mode `force=true` pour ignorer la vérification des scrapers lors d’un lancement manuel.

--------------------------------------------------
GESTION ADMINISTRATIVE DES CLÉS IA
--------------------------------------------------

L’administrateur doit pouvoir configurer plusieurs API IA depuis son tableau de bord.

Tu dois créer un modèle `AIApiKey` ou `ai_api_keys`.

Champs recommandés :

- id : UUID PK
- name : nom lisible pour l’admin
- provider_type : type de fournisseur
- base_url : URL de base API, nullable
- models : les modèles à utiliser
- api_key_encrypted : clé chiffrée
- api_key_last4 : derniers caractères de la clé, nullable
- priority : entier, plus petit valeur = priorité plus haute
- is_active : booléen
- max_concurrent_requests : entier, défaut 1
- timeout_seconds : entier, défaut 60
- max_retries : entier, défaut 2
- retry_backoff_seconds : entier, défaut 5
- rate_limit_per_minute : entier nullable
- notes : texte nullable
- last_used_at : datetime nullable
- last_error_at : datetime nullable
- disabled_until : datetime nullable, pour circuit breaker
- created_at / updated_at
- deleted_at : soft delete si pertinent

Provider types à supporter conceptuellement :

- openai_compatible
- openai
- mistral
- groq
- anthropic
- google_gemini
- ollama
- custom_http

Pour l’implémentation initiale, tu dois au minimum fournir :
- un adaptateur OpenAI-compatible,
- un adaptateur mock pour les tests,
- une interface propre pour ajouter d’autres fournisseurs.

Règles de sécurité :

La clé API ne doit jamais être stockée en clair.
- Utiliser Fernet ou équivalent avec une clé secrète issue de l’environnement (`AI_KEY_ENCRYPTION_SECRET`).
- **Le champ `api_key_last4` doit être calculé à partir de la clé en clair lors du POST/PATCH avant le chiffrement, puis stocké en base.**
- La clé chiffrée ne doit jamais être renvoyée en entier dans l’API. Dans les réponses admin, renvoyer uniquement le masque basé sur `api_key_last4` (ex: `****abcd`).
- Ne jamais logger la clé, ni la mettre dans les payloads Celery.
- Les changements de clés doivent être audités.

Endpoints admin à prévoir :

- GET /api/admin/ai/keys
- POST /api/admin/ai/keys
- PATCH /api/admin/ai/keys/{id}
- DELETE /api/admin/ai/keys/{id}
- POST /api/admin/ai/keys/{id}/test
- GET /api/admin/ai/jobs
- GET /api/admin/ai/alerts
- POST /api/admin/ai/run

Le endpoint `test` doit permettre de tester la connectivité sans traiter d’offres réelles.

--------------------------------------------------
WRAPPER / ADAPTATEUR IA
--------------------------------------------------

Tu dois créer un wrapper IA propre.

Objectif :
- envoyer la requête vers la bonne baseURL,
- ou initialiser le bon SDK selon le fournisseur,
- retourner une réponse structurée exploitable.

Interface recommandée :

AIProviderProtocol:
  - name: str
  - supports_structured_output: bool
  - generate_structured(prompt: str, schema_hint: dict | None = None) -> dict
  - test_connection() -> dict

Le wrapper doit être capable de :
- construire le client selon `provider_type`,
- utiliser `base_url` si fourni,
- utiliser `models`,
- appliquer timeout,
- appliquer max_tokens,
- demander une sortie JSON stricte si le fournisseur le supporte,
- parser la réponse JSON,
- lever des erreurs typées.

Adaptateurs à prévoir :

1. OpenAICompatibleAdapter
   - utilisable pour OpenAI, Mistral, Groq, Ollama, OpenRouter, autres compatibles.
   - endpoint : `{base_url}/chat/completions`
   - support de `response_format={"type": "json_object"}` si disponible.
   - fallback parsing JSON si `response_format` non supporté.

2. MockAIAdapter
   - pour les tests et le développement.
   - retourne des données structurées valides sans appel réseau.
   - peut simuler des erreurs selon configuration de test.

3. Adaptateurs futurs
   - prévoir une fabrique `AIProviderFactory`.
   - ne pas bloquer l’ajout futur de SDK spécifiques.

La sélection de l’adaptateur doit se faire via `provider_type`.

--------------------------------------------------
SÉLECTION DE LA CLÉ IA
--------------------------------------------------

Au moment de traiter un batch d’offres, le système doit choisir la clé IA à utiliser.

Règles de sélection :

1. Filtrer les clés :
   - `is_active = true`
   - non supprimées,
   - `disabled_until` null ou passé.

2. Trier par :
   - `priority` croissante,
   - `last_error_at` croissant si égalité,
   - `created_at` croissant si nécessaire.

3. Utiliser la première clé disponible.

4. Si aucune clé active n’est disponible :
   - créer une alerte administrateur,
   - journaliser l’erreur,
   - ne pas bloquer indéfiniment,
   - laisser les offres en `brut` pour un futur traitement manuel ou ultérieur.

--------------------------------------------------
GESTION DES ERREURS, RETRY ET FALLBACK
--------------------------------------------------

Tu dois mettre en place une gestion d’erreur robuste.

Les erreurs doivent être classées par type.

Types d’erreurs recommandés :

1. `timeout`
   - timeout réseau ou API.
   - retry possible sur la même clé avec backoff.

2. `network_error`
   - erreur de connexion.
   - retry possible sur la même clé.

3. `rate_limit`
   - HTTP 429 ou quota temporaire.
   - retry avec backoff plus long.
   - fallback vers une autre clé si plusieurs clés actives.

4. `authentication_error`
   - HTTP 401 ou 403.
   - ne pas retenter longtemps sur la même clé.
   - fallback immédiat vers une autre clé.
   - marquer la clé en erreur ou désactivation temporaire.

5. `quota_exceeded`
   - crédit insuffisant, quota dépassé.
   - fallback immédiat.
   - désactiver temporairement la clé si répété.

6. `model_not_found`
   - modèle indisponible.
   - fallback immédiat.

7. `server_error`
   - HTTP 5xx.
   - retry possible.
   - fallback après plusieurs échecs.

8. `invalid_json_response`
   - la réponse IA n’est pas un JSON valide.
   - retry avec prompt de réparation.
   - fallback si échec.

9. `content_policy_error`
   - contenu bloqué par le fournisseur.
   - fallback éventuel.
   - journaliser sans exposer le contenu.

10. `unknown_error`
   - erreur non classée.
   - retry limité puis fallback.

Règles de retry :

- Chaque clé possède son propre `max_retries`.
- Utiliser un backoff exponentiel simple.
- Ajouter du jitter si possible.
- Ne jamais retry à l’infini.
- Ne pas retry les erreurs fonctionnelles locales :
  - payload invalide,
  - offre manquante,
  - validation Pydantic échouée après plusieurs tentatives.

Règles de fallback :

- Si une clé échoue avec une erreur non récupérable ou répétée, passer à la clé suivante par priorité.
- Conserver le même batch d’offres.
- Ne pas dupliquer le traitement des offres déjà validées.
- Journaliser le changement de clé.
- Mettre à jour `last_error_at` sur la clé en échec.
- Possibilité de désactiver temporairement une clé via `disabled_until`.

Circuit breaker recommandé :

- après N échecs consécutifs sur une clé,
- définir `disabled_until = now + X minutes`,
- créer une alerte admin,
- empêcher l’utilisation de cette clé pendant la durée définie.

--------------------------------------------------
RÉCUPÉRATION DES OFFRES BRUTES
--------------------------------------------------

Crée une tâche Celery principale :

process_raw_offers(trigger_type: str = "auto")

Cette tâche doit :

1. Acquérir un verrou Redis global :
   - clé : `lock:ai:process_raw_offers`
   - durée limitée (**implémenter impérativement un TTL/Timeout sur le verrou pour éviter les deadlocks si le worker crashe**).
   - évite les exécutions concurrentes.

1. Vérifier si le scraping est terminé, sauf si `trigger_type = "manual"` avec force.

2. Récupérer les offres :
   - status = `brut`,
   - visible_site = false,
   - non verrouillées,
   - triées par `collected_at` ascendant.

3. Utiliser une sélection robuste :
   - SELECT ... FOR UPDATE SKIP LOCKED si pertinent,
   - ou verrou par offre,
   - afin d’éviter les traitements concurrents.

4. Marquer les offres sélectionnées :
   - status = `ai_processing`,
   - ai_status = `processing`,
   - ai_last_attempt_at = now.

5. Créer un `AIJob` pour tracer l’exécution.

6. Traiter les offres par lots configurables.

7. Ne jamais traiter une offre déjà active.

8. Ne jamais exposer une offre non validée.

Configuration recommandée :

- AI_BATCH_SIZE = 10
- AI_MAX_BATCH_TOKEN_ESTIMATION = configurable
- AI_MAX_ATTEMPTS_PER_OFFER = 3
- AI_PROCESSING_QUEUE = "ai"
- AI_REVIEW_CONFIDENCE_THRESHOLD = 0.65

--------------------------------------------------
GROUPAGE DES OFFRES POUR L’IA
--------------------------------------------------

L’IA doit recevoir les offres groupées.

Chaque batch envoyé à l’IA doit contenir une liste d’offres.

Pour chaque offre, envoyer au minimum :

- offer_id,
- title,
- company_name si disponible,
- source_code,
- source_url,
- location_raw,
- salary_raw,
- description ou source_text,
- raw_payload si utile,
- published_at,
- champs déjà connus si disponibles :
  - contract_type_code,
  - experience_level_code,
  - education_level_code,
  - primary_filiere_code.

Règles :
- Ne pas envoyer de champs inutiles ou sensibles.
- Tronquer les descriptions trop longues selon une limite configurable.
- Conserver `offer_id` pour permettre la correspondance au retour.
- Le batch doit être sérialisable en JSON.
- Le batch doit respecter une taille maximale configurable.

--------------------------------------------------
PROMPT IA À PRODUIRE
--------------------------------------------------

Tu dois créer un prompt système et un prompt utilisateur.

Le prompt système doit demander à l’IA :
- d’agir comme un spécialiste des offres d’emploi en Côte d’Ivoire,
- de retourner uniquement du JSON valide,
- de ne pas inventer d’URL,
- de ne pas inventer d’entreprise,
- de ne pas inventer de salaire si absent,
- de reformater proprement le détail,
- de classifier les offres parmi les filières existantes,
- de proposer une nouvelle filière seulement si aucune filière existante ne convient,
- de signaler les offres douteuses ou incomplètes.

Le prompt utilisateur doit inclure dynamiquement :

1. La liste des filières existantes :
   - code,
   - label,
   - specialties éventuelles.

2. La liste des types de contrat existants.

3. La liste des niveaux d’expérience existants.

4. La liste des niveaux de formation existants.

5. Les offres à traiter.

6. Le schéma JSON attendu.

--------------------------------------------------
FORMAT DE SORTIE IA ATTENDU
--------------------------------------------------

L’IA doit retourner un JSON valide.

Format recommandé :

{
  "results": [
    {
      "offer_id": "uuid",
      "primary_filiere_code": "tech-dev",
      "specialty_code": "tech-dev-deploiement",
      "filiere_confidence": 0.93,
      "requires_admin_review": false,
      "suggested_filiere": null,
      "contract_type_code": "cdd",
      "experience_level_code": "1-3",
      "education_level_code": "bac-2",
      "detail": {
        "intro": "Introduction claire de l'offre.",
        "missions": [
          "Mission 1",
          "Mission 2"
        ],
        "profile_requirements": [
          "Profil recherché 1",
          "Profil recherché 2"
        ],
        "benefits": [
          "Avantage 1",
          "Avantage 2"
        ],
        "tags": [
          "Tech & Dev",
          "CDD",
          "Abidjan",
          "Côte d'Ivoire"
        ]
      }
    }
  ]
}

Cas où aucune filière existante ne correspond :

{
  "results": [
    {
      "offer_id": "uuid",
      "primary_filiere_code": null,
      "specialty_code": null,
      "filiere_confidence": 0.4,
      "requires_admin_review": true,
      "suggested_filiere": {
        "code": "energie-renouvelable",
        "label": "Énergie & Renouvelable",
        "reason": "L'offre concerne un poste de technicien solaire qui ne correspond pleinement à aucune filière existante."
      },
      "contract_type_code": "cdi",
      "experience_level_code": "1-3",
      "education_level_code": "bac-2",
      "detail": {
        "intro": "...",
        "missions": [],
        "profile_requirements": [],
        "benefits": [],
        "tags": []
      }
    }
  ]
}

Règles :
- `offer_id` est obligatoire.
- Si `requires_admin_review = false`, alors `primary_filiere_code` doit être fourni et correspondre à une filière existante active.
- Si `requires_admin_review = true`, alors `primary_filiere_code` peut être null.
- `suggested_filiere` doit être présent si une nouvelle filière est proposée.
- `detail` doit être un objet structuré.
- Les listes doivent être des listes de chaînes.
- Ne pas accepter de texte markdown dans les champs structurés.

--------------------------------------------------
TRAITEMENT DES RÉPONSES IA
--------------------------------------------------

Après réception de la réponse IA :

1. Valider la réponse globale avec Pydantic.
2. Vérifier que chaque `offer_id` correspond à une offre du batch.
3. Ignorer les résultats inconnus.
4. Valider chaque résultat individuellement.
5. Ne pas bloquer tout le batch si un résultat est invalide.
6. Journaliser les résultats invalides.
7. Marquer les offres invalides comme à retraiter.

Si le JSON global est invalide :
- tenter une réparation avec un prompt dédié,
- maximum une tentative de réparation,
- si échec, fallback vers une autre clé ou marquage du batch en erreur.

--------------------------------------------------
RETOUR VERS L’API D’INGESTION
--------------------------------------------------

Les offres traitées par l’IA doivent être renvoyées à l’API d’ingestion pour validation et changement de statut.

Tu dois créer un endpoint interne :

POST /api/internal/ai/results

Cet endpoint doit être protégé par un token interne.

Header recommandé :

X-Internal-Token: token-secret

Variable d’environnement :

INTERNAL_API_TOKEN

Le worker IA ne doit pas modifier directement le statut final des offres s’il peut passer par cet endpoint.
Cela permet de centraliser la validation dans l’API d’ingestion.

Payload recommandé :

{
  "job_id": "uuid",
  "provider_key_id": "uuid",
  "results": [
    {
      "offer_id": "uuid",
      "primary_filiere_code": "tech-dev",
      "specialty_code": null,
      "filiere_confidence": 0.92,
      "requires_admin_review": false,
      "suggested_filiere": null,
      "contract_type_code": "cdd",
      "experience_level_code": "1-3",
      "education_level_code": "bac-2",
      "detail": {
        "intro": "...",
        "missions": [],
        "profile_requirements": [],
        "benefits": [],
        "tags": []
      }
    }
  ]
}

Réponse recommandée :

{
  "job_id": "uuid",
  "processed": 10,
  "activated": 8,
  "pending_review": 1,
  "rejected": 0,
  "reprocess_required": 1,
  "reprocess_offer_ids": [
    "uuid-offre-invalide"
  ],
  "errors": [
    {
      "offer_id": "uuid-offre-invalide",
      "message": "primary_filiere_code manquant alors que requires_admin_review est false"
    }
  ]
}

--------------------------------------------------
MINI-VALIDATION PAR L’API D’INGESTION
--------------------------------------------------

L’API d’ingestion doit effectuer une mini-vérification avant de changer le statut.

Pour chaque résultat reçu :

1. Vérifier que l’offre existe.
2. Vérifier que l’offre est dans un statut compatible :
   - brut,
   - ai_processing,
   - pending_review si retraitements autorisés.
3. Vérifier la présence de `offer_id`.
4. Vérifier la cohérence des référentiels :
   - primary_filiere_code existe si fourni,
   - specialty_code existe si fourni et compatible avec la filière,
   - contract_type_code existe si fourni,
   - experience_level_code existe si fourni,
   - education_level_code existe si fourni.
5. Vérifier le détail :
   - detail présent,
   - intro non vide,
   - missions est une liste,
   - profile_requirements est une liste,
   - benefits est une liste,
   - tags est une liste.
6. Vérifier la règle de revue admin :
   - si `requires_admin_review = false`, alors `primary_filiere_code` obligatoire,
   - si `requires_admin_review = true`, alors l’offre doit passer en `pending_review`.

Si la validation réussit et que l’offre ne nécessite pas de revue :

- mettre à jour l’offre :
  - status = `active`,
  - visible_site = true,
  - primary_filiere_id,
  - specialty_id si fourni,
  - contract_type_id si fourni,
  - experience_level_id si fourni,
  - education_level_id si fourni,
  - ai_status = `processed`,
  - ai_confidence,
  - ai_processed_at.
- mettre à jour ou créer `JobOfferDetail`.
- créer ou mettre à jour les associations de filières si nécessaire.
- journaliser le succès.

Si la validation réussit mais que l’offre nécessite une revue admin :

- status = `pending_review`,
- visible_site = false,
- enregistrer la suggestion de filière,
- ai_status = `review_required`,
- journaliser.

Si la validation échoue :

- ne pas activer l’offre,
- remettre l’offre à `brut` ou `ai_retry_pending` selon le modèle choisi,
- incrémenter le compteur de tentatives,
- enregistrer l’erreur,
- continuer avec les autres offres.

--------------------------------------------------
ALERTES ET MESSAGES DE RETRAITEMENT
--------------------------------------------------

Si certaines offres doivent être retraitées, le système doit produire une alerte.

Cette alerte doit être générée une fois le traitement de toutes les offres du batch terminé.

Contenu de l’alerte :

- job_id,
- date,
- nombre d’offres traitées,
- nombre d’offres activées,
- nombre d’offres en revue,
- nombre d’offres rejetées,
- liste des IDs d’offres à retraiter,
- messages d’erreur par offre.

Tu dois créer une table `ai_alerts` ou utiliser la table de logs existante si elle est adaptée.

Champs recommandés :

- id UUID
- job_id nullable
- type : reprocess_required, no_active_key, provider_error, validation_error, remaining_raw_offers
- severity : info, warning, error
- message
- payload JSONB
- acknowledged_at nullable
- acknowledged_by_admin_id nullable
- created_at

L’alerte doit être visible dans l’espace administrateur.
Elle peut aussi être enregistrée dans les logs techniques.

--------------------------------------------------
VÉRIFICATION PÉRIODIQUE DES OFFRES ORPHELINES
--------------------------------------------------

Au lieu de planifier des tâches Celery avec des `countdown` (qui risquent d'être perdues en cas de redémarrage du broker), utilise **Celery Beat** pour vérifier s'il reste des offres brutes oubliées.
Implémentation recommandée :
Créer une tâche périodique `sweep_remaining_raw_offers` configurée via Celery Beat pour s'exécuter toutes les 10 minutes.
Cette tâche doit :
1. Acquérir un verrou Redis (avec un timeout/TTL pour éviter un blocage éternel en cas de crash du worker).
2. Vérifier s'il existe des offres en statut `brut` dont la date de création (`collected_at`) remonte à plus de 10 minutes.
3. Vérifier si un job IA ou un scraping est déjà en cours (vérification du statut du pipeline).
4. Si aucune offre orpheline n'est trouvée :
   - Marquer le pipeline IA comme `idle` et se mettre en veille.

5. Si des offres orphelines (vieilles de plus de 10 min) sont trouvées :
   - Déclencher un nouveau job IA avec `trigger_type = "sweep"`.
   - Journaliser l'action.

6. Si des offres restent bloquées en `brut` depuis plus de 30 minutes (par exemple 3 cycles de sweep consécutifs) :
   - Créer une alerte admin de type `remaining_raw_offers` pour intervention manuelle.
   - Ne pas boucler indéfiniment sur ces offres bloquées.


--------------------------------------------------
MODÈLES DE DONNÉES À CRÉER OU ADAPTER
--------------------------------------------------

Tu dois produire les migrations Alembic nécessaires.

1. Table `ai_api_keys`

Champs :
- id UUID PK
- name
- provider_type
- base_url nullable
- models nullable
- api_key_encrypted
- api_key_last4 nullable
- priority integer
- is_active boolean
- max_concurrent_requests integer
- timeout_seconds integer
- max_retries integer
- retry_backoff_seconds integer
- rate_limit_per_minute integer nullable
- notes text nullable
- last_used_at datetime nullable
- last_error_at datetime nullable
- disabled_until datetime nullable
- created_at
- updated_at
- deleted_at nullable

2. Table `ai_jobs`

Champs :
- id UUID PK
- trigger_type : auto, manual, delayed_check, sweep
- status : pending, running, completed, partial_failure, failed
- started_at
- finished_at nullable
- offers_total integer
- offers_activated integer
- offers_pending_review integer
- offers_rejected integer
- offers_reprocess_required integer
- primary_api_key_id UUID FK nullable
- fallback_count integer default 0
- error_message text nullable
- celery_task_id string nullable
- created_at
- updated_at

3. Table `ai_offer_attempts` ou `ai_offer_results`

Champs :
- id UUID PK
- offer_id UUID FK
- ai_job_id UUID FK nullable
- ai_api_key_id UUID FK nullable
- attempt_number integer
- status : pending, success, invalid, failed, review_required
- error_type nullable
- error_message nullable
- response_metadata JSONB nullable
- duration_ms integer nullable
- created_at

4. Table `ai_alerts`

Champs :
- id UUID PK
- job_id UUID FK nullable
- type
- severity
- message
- payload JSONB
- acknowledged_at nullable
- acknowledged_by_admin_id UUID/bigint selon modèle admin existant
- created_at

5. Table `ai_filiere_suggestions`

Champs :
- id UUID PK
- offer_id UUID FK nullable
- job_id UUID FK nullable
- code
- label
- reason text nullable
- status : pending, approved, rejected
- reviewed_by_admin_id nullable
- reviewed_at nullable
- created_at
- updated_at

6. Colonnes à ajouter sur `job_offers` si absent :

- ai_status string/enum nullable ou default `pending`
- ai_attempts integer default 0
- ai_last_attempt_at datetime nullable
- ai_processed_at datetime nullable
- ai_error_message text nullable
- ai_confidence float nullable
- requires_admin_review boolean default false
- suggested_filiere_payload JSONB nullable

Si `ai_processing_job_id` est utile, tu peux aussi ajouter :
- ai_processing_job_id UUID FK nullable vers ai_jobs

7. Mise à jour de `JobOfferStatus`

Ajouter si absent :
- brut
- ai_processing
- pending_review
- rejected

Respecter les contraintes CHECK existantes.

--------------------------------------------------
SCHÉMAS PYDANTIC À CRÉER
--------------------------------------------------

Crée les schémas Pydantic nécessaires.

Admin AI keys :

- AIApiKeyCreate
- AIApiKeyUpdate
- AIApiKeyRead

Règles :
- ne jamais exposer `api_key` en lecture,
- accepter `api_key` uniquement à la création ou mise à jour,
- masquer la clé dans la réponse.

AI processing :

- AIBatchOfferInput
- AIBatchRequest
- AIProcessedOfferDetail
- AIProcessedOfferResult
- AIJobResultPayload
- AIInternalResultSubmission
- AIValidationSummary
- AIAlertRead
- AIJobRead

Validation :
- UUID valides,
- listes de chaînes,
- codes de référentiel optionnels mais validés,
- confidence entre 0 et 1,
- detail obligatoire pour validation finale.

--------------------------------------------------
ENDPOINTS À CRÉER
--------------------------------------------------

Admin :

- GET /api/admin/ai/keys
- POST /api/admin/ai/keys
- PATCH /api/admin/ai/keys/{id}
- DELETE /api/admin/ai/keys/{id}
- POST /api/admin/ai/keys/{id}/test
- GET /api/admin/ai/jobs
- GET /api/admin/ai/jobs/{id}
- GET /api/admin/ai/alerts
- POST /api/admin/ai/alerts/{id}/acknowledge
- POST /api/admin/ai/run
- GET /api/admin/offers/pending-review

Interne :

- POST /api/internal/ai/results

Optionnel mais utile :

- GET /api/admin/ai/status
- POST /api/admin/ai/offers/{offer_id}/retry
- POST /api/admin/ai/offers/{offer_id}/approve-suggested-filiere
- POST /api/admin/ai/offers/{offer_id}/assign-filiere

--------------------------------------------------
TÂCHES CELERY À CRÉER
--------------------------------------------------

Tu dois créer les tâches suivantes :

1. `trigger_ai_processing`
   - vérifie les conditions,
   - crée un job IA,
   - lance `process_raw_offers`.

2. `process_raw_offers`
   - récupère les offres brutes,
   - les verrouille,
   - choisit la clé IA,
   - appelle le wrapper IA,
   - envoie les résultats à l’API interne,
   - planifie les vérifications différées.

3. `check_remaining_raw_offers`
   - vérifie les offres brutes restantes après 5/10/15 minutes,
   - relance un traitement si nécessaire,
   - crée une alerte si blocage persistant.

4. `test_ai_key_connectivity`
   - teste une clé sans traiter d’offres réelles.

5. `retry_failed_ai_offers`
   - tâche optionnelle pour retraiter les offres en erreur après action admin.

Queues Celery recommandées :

- queue `ai`
- queue `ingestion`
- queue `scraping`

--------------------------------------------------
SÉCURITÉ ET OBSERVABILITÉ
--------------------------------------------------

Sécurité :

- Aucune clé IA en clair.
- Aucune clé IA dans les logs.
- Aucune clé IA dans les réponses API.
- Token interne requis pour `/api/internal/ai/results`.
- Endpoints admin protégés.
- Audit des actions admin.
- Validation stricte des payloads.

Observabilité :

- Logger chaque job IA.
- Logger les changements de clé.
- Logger les retries.
- Logger les fallbacks.
- Logger les offres invalides.
- Logger les vérifications différées.
- Ne jamais logger le contenu complet des prompts si volumineux ou sensible.
- Prévoir des métriques ou compteurs :
  - offres traitées,
  - offres activées,
  - offres en revue,
  - erreurs fournisseur,
  - temps moyen de traitement.

--------------------------------------------------
TESTS À PRODUIRE
--------------------------------------------------

Écris des tests pytest couvrant :

1. Gestion des clés IA :
   - création,
   - masquage de la clé,
   - chiffrement,
   - priorité,
   - désactivation,
   - suppression logique.

2. Sélection de clé :
   - la clé active avec priorité la plus haute est choisie,
   - une clé inactive n’est pas choisie,
   - une clé désactivée temporairement n’est pas choisie.

3. Retry/fallback :
   - timeout retry sur même clé,
   - authentication error fallback,
   - rate limit fallback après retries,
   - invalid JSON retry puis fallback,
   - circuit breaker après échecs répétés.

4. Traitement IA :
   - batch d’offres est envoyé groupé,
   - réponse valide active les offres,
   - réponse avec revue admin passe en pending_review,
   - offre sans filière existante propose une nouvelle filière,
   - offre invalide n’arrête pas le batch.

5. Validation interne :
   - primary_filiere_code valide accepté,
   - primary_filiere_code inconnu rejeté,
   - detail manquant rejeté,
   - offer_id inconnu ignoré ou signalé,
   - statut final correct.

6. Alertes :
   - alerte créée pour offres à retraiter,
   - alerte créée si aucune clé active,
   - alerte créée si offres brutes restantes après 15 minutes.

7. Vérifications différées :
   - check à 5 minutes,
   - check à 10 minutes,
   - check à 15 minutes,
   - pas de boucle infinie,
   - pipeline idle si aucune offre brute.

8. Compatibilité publique :
   - les offres brutes ne sont pas visibles,
   - les offres pending_review ne sont pas visibles,
   - les offres rejetées ne sont pas visibles,
   - les offres actives restent visibles.

--------------------------------------------------
DOCUMENTATION À PRODUIRE
--------------------------------------------------

Produis un README ou une section de documentation expliquant :

1. Architecture du module IA.
2. Configuration des variables d’environnement.
3. Gestion des clés IA par l’admin.
4. Fonctionnement du retry/fallback.
5. Format JSON attendu par l’IA.
6. Gestion des offres sans filière existante.
7. Validation finale par l’API d’ingestion.
8. Vérifications différées à 5/10/15 minutes.
9. Déclenchement manuel.
10. Surveillance et alertes.

Variables d’environnement à documenter :

- AI_ENABLED=true
- AI_ENCRYPTION_SECRET=...
- INTERNAL_API_TOKEN=...
- AI_BATCH_SIZE=10
- AI_MAX_ATTEMPTS_PER_OFFER=3
- AI_REVIEW_CONFIDENCE_THRESHOLD=0.65
- AI_DEFAULT_TIMEOUT_SECONDS=60
- AI_CHECK_REMAINING_DELAYS_SECONDS=300,600,900

--------------------------------------------------
CRITÈRES D’ACCEPTATION
--------------------------------------------------

Le module sera considéré comme valide si :

1. Les offres brutes sont récupérées après la fin des scrapers.
2. Le traitement IA est découplé de l’ingestion.
3. Plusieurs clés IA peuvent être configurées par l’administrateur.
4. La clé active avec la priorité la plus haute est utilisée en premier.
5. Le système retry sur erreurs temporaires.
6. Le système bascule sur une autre clé si nécessaire.
7. Les clés IA sont chiffrées et masquées.
8. Les offres sont envoyées groupées à l’IA.
9. L’IA retourne un JSON structuré.
10. Les offres sont reformatées, notamment le détail.
11. Les offres sont classées par filière existante.
12. Si aucune filière existante ne correspond, une suggestion est créée.
13. Les offres nécessitant une revue admin ne sont pas affichées publiquement.
14. Les résultats IA sont renvoyés à l’API d’ingestion.
15. L’API d’ingestion effectue une mini-validation.
16. Les offres invalides sont signalées par ID.
17. Le traitement continue pour les autres offres.
18. Une alerte est produite à la fin si des offres doivent être retraitées.
19. Trois vérifications différées ont lieu après 5, 10 et 15 minutes.
20. Le pipeline se met en veille s’il n’y a plus d’offres brutes.
21. Aucun appel IA réel n’est requis pour les tests grâce au mock.
22. Les migrations Alembic fonctionnent.
23. Les tests passent.
24. Les endpoints publics n’exposent aucune offre non validée.

--------------------------------------------------
MÉTHODOLOGIE DE TRAVAIL (TRÈS IMPORTANT)
--------------------------------------------------

Le volume de code à produire étant important, nous allons procéder étape par étape pour éviter que ta réponse ne soit coupée.

Pour ton premier message, je veux **UNIQUEMENT** que tu fasses ceci :

1. Fais un bref résumé de ton plan d'action (architecture globale).
2. Génère le code de l'Étape 1 : Les modèles SQLAlchemy mis à jour/créés (incluant ai_api_keys, les statuts, etc.) et les schémas Pydantic associés.

Demande-moi ensuite l'autorisation de passer à l'Étape 2 (qui sera le Wrapper IA et le système de sélection/fallback). Ne génère rien au-delà de l'Étape 1 pour le moment.