# JobAlert CI — Pages Admin (v3) : gestion complète du site

*Spécification fonctionnelle page par page, pour la gestion complète du site JobAlert CI.*

---

## Comment lire ce document

Pour chaque page :
- **À quoi elle sert** : le besoin métier qu'elle couvre.
- **Pour qui** : rôle(s) admin autorisé(s).
- **Ce qu'on y voit** : les données affichées à l'écran.
- **Fonctionnalités à intégrer** : actions concrètes que l'utilisateur doit pouvoir faire.
- **Comment ça fonctionne** : le flux réel côté backend (endpoints, effets de bord, ce qui se passe en asynchrone).
- **Points d'attention** : pièges, garde-fous, ou éléments backend encore incomplets à connaître avant de coder.

---

## 1. Connexion admin — `/admin/connexion`

**À quoi elle sert** : porte d'entrée du back-office — désormais avec un vrai parcours de récupération d'accès.

**Pour qui** : public (page publique, avant authentification).

**Ce qu'on y voit** : formulaire email + mot de passe, plus un lien « Mot de passe oublié ? ».

**Fonctionnalités à intégrer** :
- Connexion classique.
- **Nouveau** : lien « mot de passe oublié » → formulaire de saisie d'email → confirmation générique (« si ce compte existe, un email a été envoyé ») → lien reçu par email → formulaire de nouveau mot de passe.
- Message d'erreur distinct pour un compte verrouillé après échecs répétés.

**Comment ça fonctionne** :
1. `POST /api/admin/auth/login` — inchangé, mais désormais **rate-limité par IP** et protégé par un verrouillage progressif après échecs répétés (`services.rate_limit`).
2. `POST /api/admin/auth/forgot-password` : ne révèle **jamais** si l'email existe ou non (protection contre l'énumération de comptes) ; envoie un email réel via le fournisseur configuré si le compte existe, avec un token à usage unique valable 60 minutes.
3. `POST /api/admin/auth/reset-password` : consomme le token (marqué usage unique), impose un nouveau mot de passe ≥ 8 caractères.
4. Le rafraîchissement de session (`POST /auth/refresh`) est désormais protégé par une **rotation avec détection de réutilisation** : si un refresh token déjà utilisé est présenté une seconde fois (signe possible de vol de token), **toute la famille de tokens de cet admin est révoquée immédiatement** — l'admin est déconnecté partout et doit se reconnecter.

**Points d'attention** :
- Le message de confirmation après « mot de passe oublié » doit rester générique côté frontend (ne pas dire « aucun compte trouvé pour cet email », qui permettrait de deviner quels emails sont des comptes admin).
- Prévoir un message clair en cas de révocation de session pour réutilisation détectée (« Votre session a été fermée pour des raisons de sécurité, veuillez vous reconnecter ») plutôt qu'une erreur générique.

---

## 2. Tableau de bord — `/admin`

**À quoi elle sert** : donner en un coup d'œil la santé du système au démarrage de chaque session admin — c'est la première chose que voit n'importe quel rôle après connexion.

**Pour qui** : tous les rôles.

**Ce qu'on y voit** :
- 6 compteurs : offres totales / offres actives, abonnés totaux / actifs, messages de contact nouveaux, sources actives.
- État du dernier run de scraping (date, statut).
- Nombre de digests en file d'attente (`queued`).
- Un mini-historique des derniers runs (avec lien vers la page Scraping).
- un widget « Qualité du matching cette semaine » (distribution T0 à T5).
- un bloc « Top 10 offres les plus consultées ».
- une barre de recherche globale en en-tête, accessible depuis toutes les pages admin.

**Fonctionnalités à intégrer** :
- Chargement d'un seul appel agrégé pour tout l'en-tête de la page.
- Cartes cliquables qui renvoient vers la page détaillée correspondante (ex. clic sur « offres actives » → `/admin/offres?status=active`).
- Rafraîchissement manuel ou automatique (polling léger, ex. toutes les 60 secondes) pour suivre un scraping ou un envoi en cours.
- Graphique ou barres empilées pour la distribution des paliers de matching (`tier_distribution`).
- Liste cliquable des offres les plus vues, avec lien direct vers leur fiche.
- Champ de recherche globale avec résultats groupés par type (offres / abonnés / entreprises), plafonnés par groupe.

**Comment ça fonctionne** :
- `GET /api/admin/dashboard/overview` exécute 6 requêtes `COUNT` ciblées et une lecture du dernier `ScrapeRun` — tout est calculé à la demande (pas de cache), donc les chiffres sont toujours à jour à l'appel.
- `GET /api/admin/dashboard/runs` fournit un historique paginé pour le mini-tableau des runs récents.
- `GET /api/admin/sending/tier-stats?period_days=7` renvoie deux distributions : `tier_distribution` (par digest, T0-T5, par jour + global) et `match_kind_distribution` (par offre : primary/secondary/fallback_contract/fallback_freshness/fallback_experience/fallback_city).
- `GET /api/admin/dashboard/top-viewed-offers?days=7&limit=10` — **note technique** : le paramètre `days` est actuellement accepté mais pas encore branché sur un vrai filtre temporel (le tri se fait sur `view_count` total, pas sur les vues de la période) ; le trier comme un « top all-time » plutôt que « top 7 jours » tant que cette évolution n'est pas faite côté backend.
- `GET /api/admin/search?q=...&per_type_limit=10` — recherche unique sur offres (titre), abonnés (email/nom), entreprises (nom), résultats groupés par type dans une seule réponse.

**Points d'attention** :
- Un palier T2+ élevé dans le widget de qualité du matching est un signal d'alerte produit (le référentiel de filières ou de villes est trop strict) — envisager d'afficher ce widget avec un code couleur (vert si T0/T1 dominant, orange/rouge si T3+ dominant) pour qu'il serve d'alerte visuelle immédiate, pas juste d'un graphique informatif.

---

## 3. Gestion des offres — `/admin/offres`

**À quoi elle sert** : superviser et corriger le contenu collecté automatiquement — c'est l'écran où l'équipe passe le plus de temps au quotidien, car le scraping n'est jamais parfait (titres mal formatés, offres expirées non détectées, doublons résiduels), enrichi d'un accès à la file de doublons et à l'import en masse.

**Pour qui** : `gestionnaire_offres`, `super_admin`.

**Ce qu'on y voit** : table paginée des offres (titre, entreprise, source, filière, statut, visibilité publique, date de collecte), avec filtres et boutons de tri et de recherche + un badge « X doublons potentiels à vérifier » qui renvoie vers un sous-écran dédié.
****
**Fonctionnalités à intégrer** :
- Recherche texte sur le titre.
- Filtres combinables : filière, source, statut, visibilité, origine (scraping/manuel/import).
- Toggle rapide « visible sur le site » directement dans la liste, sans ouvrir la fiche.
- Changement de statut à la volée (menu déroulant sur chaque ligne).
- Sélection multiple + action groupée (ex. « archiver la sélection »).
- Bouton « Nouvelle offre » → page 4.
- Suppression (avec confirmation « archiver », pas « supprimer » — voir Points d'attention).
- Bouton « Importer un fichier » (CSV ou JSON) en haut de la liste.
- Lien vers l'écran « Doublons à vérifier ».

**Comment ça fonctionne** :
- `GET /api/admin/offers` avec les query params de filtre ; la liste admin inclut **toutes** les offres, y compris masquées ou archivées (contrairement à la liste publique du site).
- Le toggle de visibilité appelle `PATCH /{id}/visibility` isolément, sans recharger toute la fiche.
- L'action groupée appelle `POST /bulk-status` qui exécute une seule requête `UPDATE` SQL sur tous les IDs sélectionnés (pas de boucle, donc rapide même sur un grand volume).
- La suppression appelle `DELETE /{id}` qui pose `deleted_at` — l'offre disparaît de la liste publique et de la liste admin par défaut, mais reste en base (traçabilité).

**Comment ça fonctionne — Import en masse** :
- `POST /api/admin/offers/import` (multipart, fichier CSV ou JSON).
- Contraintes strictes côté serveur : extension et type MIME validés, taille max **5 Mo**, traitement par lots de 50 lignes (**une erreur sur une ligne n'annule pas tout le fichier**, seul le lot concerné est annulé si une erreur de transaction survient).
- La réponse détaille : nombre créé, nombre ignoré, et la liste des erreurs ligne par ligne (avec le numéro de ligne et la donnée en cause) — l'écran doit afficher ce rapport clairement, pas juste un message de succès global.
- Chaque ligne passe par le même `create_offer_service` que la création manuelle unitaire → **même dédoublonnage automatique par hash**.

**Points d'attention** : 
- Le libellé du bouton de suppression doit dire « Archiver » plutôt que « Supprimer » pour être honnête sur le comportement réel (soft delete).
- le frontend doit fournir un modèle de fichier téléchargeable (colonnes attendues : `title`, `company_name`, `source_code`, `source_url`, `filiere_code`, etc. — liste exacte des colonnes acceptées à documenter dans l'interface) pour éviter les imports ratés faute de format connu.

---

## 4. Créer / modifier une offre — `/admin/offres/nouvelle` (et `/admin/offres/:id` en édition)

**À quoi elle sert** : permettre à l'équipe d'ajouter une offre qui n'a pas été captée par le scraping (partenariat direct avec une entreprise, offre reçue par email) ou de corriger une offre mal extraite.

**Pour qui** : `gestionnaire_offres`, `super_admin`.

**Ce qu'on y voit** : un formulaire complet — titre, entreprise, source, URL, filière, localisation, type de contrat, niveau d'expérience, niveau d'études, dates, puis un bloc de contenu détaillé (intro, missions, profil recherché, avantages, tags).

**Fonctionnalités à intégrer** :
- Sélecteurs de référentiel (filière, contrat, expérience, éducation) alimentés par les listes de la page Référentiels.
- Champs de liste dynamiques pour missions / profil / avantages / tags (ajout/suppression de lignes).
- Prévisualisation optionnelle de la fiche telle qu'elle apparaîtra sur le site public.
- Message clair si l'offre soumise correspond déjà à une offre existante (dédoublonnage silencieux — voir ci-dessous).

**Comment ça fonctionne** :
- `POST /api/admin/offers` (création) ou `PUT /api/admin/offers/{id}` (édition).
- **Important** : les champs de référence (`filiere_code`, `source_code`, `contract_type_code`…) sont transmis par **code**, pas par UUID — le formulaire doit donc envoyer le code du référentiel sélectionné, pas son identifiant technique.
- Le service `create_offer` calcule le même hash de dédoublonnage que le scraping automatique. Si une offre identique existe déjà, **l'API renvoie l'offre existante sans erreur** — le frontend doit donc afficher un message du type « Cette offre existe déjà, vous êtes redirigé vers sa fiche » plutôt que de laisser croire qu'une nouvelle offre a été créée.
- L'offre créée porte `origin=manuel` et `admin_id` = l'admin connecté, visibles sur la fiche.

**Points d'attention** : bien anticiper le décalage code/UUID dans les sélecteurs, sinon les créations échoueront silencieusement ou avec des erreurs peu claires.


---

## 5. Doublons à vérifier — `/admin/offres/doublons`

**À quoi elle sert** : détecter et traiter les offres qui se ressemblent fortement (même entreprise, titre très proche) sans avoir le même hash exact — un doublon que le dédoublonnage automatique ne peut pas capturer seul.

**Pour qui** : `gestionnaire_offres`, `super_admin`.

**Ce qu'on y voit** : une liste de paires d'offres suspectes, avec un score de similarité (0-100), les titres et l'entreprise concernée, filtrable par entreprise et par seuil de similarité minimal.

**Fonctionnalités à intégrer** :
- Réglage du seuil de similarité (curseur ou champ numérique, défaut 80).
- Pour chaque paire : bouton « Fusionner » (marque l'offre B comme doublon de A) avec un champ de motif optionnel.
- Bouton « Ce n'est pas un doublon » (rejette la paire).

**Comment ça fonctionne** :
- `GET /api/admin/offers/duplicates/candidates?company_id=...&min_similarity=80` — le scan peut être **tronqué** au-delà d'un certain volume ; dans ce cas, un header HTTP `X-Scan-Truncated: true` est renvoyé (à lire côté frontend pour afficher un avertissement « résultats partiels, affinez les filtres »).
- `POST /api/admin/offers/{offer_b_id}/mark-duplicate` — marque B comme doublon de A ; refuse les cas invalides (A = B, ou création d'un cycle de doublons).
- `POST /api/admin/offers/duplicates/reject` — enregistre explicitement que la paire (A, B) a été examinée et jugée non-doublon, dans une table dédiée (`RejectedDuplicatePair`) **pour que cette paire ne réapparaisse plus dans les scans suivants**.

**Points d'attention** : cette page peut générer beaucoup de faux positifs si le seuil de similarité est bas — prévoir un tri par score décroissant pour que l'admin traite d'abord les cas les plus évidents.

---

## 6. Gestion des entreprises — `/admin/entreprises`

**À quoi elle sert** : gérer le référentiel `Company`, créé automatiquement à chaque offre scrapée, sujet à des doublons de nommage (« Orange CI » vs « ORANGE CI SA »).

**Pour qui** : `super_admin` uniquement (choix délibéré : les entreprises impactent l'affichage public, accès restreint « en profondeur »).

**Ce qu'on y voit** : liste des entreprises (nom, nombre d'offres actives), un classement « Top recruteurs », un formulaire d'édition (site web, logo, description, filière principale).

**Fonctionnalités à intégrer** :
- Recherche par nom.
- Tri par nombre d'offres actives (« qui recrute le plus »).
- Édition d'une fiche entreprise (logo, site, description).
- **Fusion** de deux entreprises en doublon.
- Suppression (logique).

**Comment ça fonctionne** :
- CRUD standard sur `/api/admin/companies`.
- `GET /companies/top-recruiters?limit=10` — calcul en une seule requête agrégée SQL (pas de boucle applicative).
- `POST /companies/{target_id}/merge/{source_id}` — réattribue **toutes** les offres de l'entreprise source vers l'entreprise cible, puis désactive (soft-delete) la source. Le nombre d'offres réattribuées est renvoyé dans la réponse et journalisé dans le détail de l'action d'audit.

**Points d'attention** : la fusion est une opération à fort impact silencieux (elle change la propriété de potentiellement des dizaines d'offres) — l'écran doit obligatoirement afficher un écran de confirmation qui montre le nombre d'offres qui vont être déplacées **avant** de valider l'action, pas seulement après.

---

## 7. Gestion des utilisateurs — `/admin/utilisateurs`

**À quoi elle sert** : avoir une vue sur la base d'abonnés — combien sont actifs, qui s'est désinscrit, qui rebondit (email invalide) — et pouvoir agir individuellement.

**Pour qui** : `gestionnaire_utilisateurs`, `super_admin`.

**Ce qu'on y voit** : table (email, nom, statut, filières choisies, date d'inscription), filtrable.

**Fonctionnalités à intégrer** :
- Recherche par email ou nom.
- Filtre par statut (actif, désinscrit, en rebond, en pause, en attente, supprimé).
- Filtre par filière.
- Clic sur une ligne → page détail (page 6).
- Une mini onglet "Actions" sur la ligne de l'abonné avec les actions de gestion de l'abonné (activer, desactiver, rejeter, supprimer, etc.).

**Comment ça fonctionne** :
- `GET /api/admin/subscribers` avec les filtres `q`, `status`, `filiere_id`.
- Le paramètre `status` utilise un **vocabulaire API** légèrement différent du vocabulaire interne : la valeur affichée/envoyée est `bouncing`, alors que la base stocke `bounced`. Le frontend doit utiliser exactement les valeurs API (`active`, `unsubscribed`, `bouncing`, `paused`, `pending`, `deleted`), pas les valeurs de la base.

**Points d'attention** : ne pas construire ce filtre en copiant les noms internes des enums — utiliser la table d'alias documentée dans le fichier « Modèles & Schémas Admin ».

---

## 8. Détail utilisateur — `/admin/utilisateurs/:id`

**À quoi elle sert** : centraliser tout ce qu'on sait sur un abonné pour le support (« pourquoi je ne reçois plus d'offres ? ») et pour une intervention ciblée.

**Pour qui** : `gestionnaire_utilisateurs`, `super_admin`.

**Ce qu'on y voit** : 
- profil (nom, ville, statut, filières choisies avec leur priorité, canal de notification), notes internes, historique des envois reçus (digests automatiques et personnalisés), préférence « conseils carrière ».
- Un onglet « Emails transactionnels » listant les confirmations, renvois, gestions d'alerte et désinscriptions envoyés à cet abonné, avec leur statut (en file / envoyé / échoué).

**Fonctionnalités à intégrer** :
- Édition des champs administratifs : nom, ville, notes internes, préférence conseils.
- Changement de statut (réactiver, mettre en pause, marquer désinscrit avec motif).
- Historique des envois avec statut de chaque digest (envoyé, échoué, sauté) et éventuellement le palier de matching atteint (voir Points d'attention).
- Bouton « Envoyer une sélection » → page 7.
- Bouton de suppression, clairement identifié comme une **anonymisation RGPD**.

**Comment ça fonctionne** : 
- `GET /{id}` pour charger le profil, `PUT /{id}` pour l'édition administrative (ne touche jamais aux filières — ce choix reste au candidat via son lien email), `PATCH /{id}/status` pour le changement de statut.
- `GET /{id}/sends` renvoie l'historique des `EmailDigest` de l'abonné, triés du plus récent au plus ancien.
- La suppression (`DELETE /{id}`) ne fait **pas** disparaître l'abonné de la base : elle écrase l'email par une valeur anonymisée (`deleted_{id}@anonymized.local`), efface le nom et les notes, et passe le statut à `deleted`. L'historique d'envois reste intact pour la cohérence des statistiques globales.
- `GET /api/admin/transactional-emails?subscriber_id={id}` — même route que la page 16, filtrée sur l'abonné courant.

**Points d'attention persistants** : 
- Le schéma `EmailDigestRead` actuel n'expose pas encore le palier de matching (`match_tier`) ni le détail (`match_kind`) par offre — si l'équipe veut afficher « cet abonné a reçu des offres élargies (T3) » dans l'historique, il faudra d'abord enrichir ce schéma côté backend.
- Le bouton de suppression doit afficher un texte de confirmation qui dit explicitement « anonymiser » et non « supprimer définitivement le compte », pour éviter toute confusion côté utilisateur du back-office.

---

## 9. Envoi personnalisé — `/admin/utilisateurs/:id/envoyer`

**À quoi elle sert** : permettre à l'équipe d'envoyer manuellement une sélection d'offres à un abonné précis — utile pour un cas particulier (relance après une réclamation, offre spéciale négociée directement), **enrichi d'un aperçu avant envoi**

**Pour qui** : `gestionnaire_utilisateurs`, `super_admin`.

**Ce qu'on y voit** : un sélecteur d'offres (réutilisant la recherche/filtre de la page Offres, limité aux offres visibles et actives) et un champ d'objet d'email optionnel.

**Fonctionnalités à intégrer** :
- Recherche et sélection multiple d'offres.
- Aperçu de la sélection avant envoi.
- Champ d'objet personnalisable (sinon objet par défaut « Sélection personnalisée JobAlert CI »).
- Confirmation avant envoi effectif.
- Bouton « Aperçu » qui affiche le rendu HTML réel de l'email avant confirmation.
- Bascule entre « aperçu de ma sélection » et « aperçu automatique selon les filières de l'abonné » (si aucune offre n'est encore sélectionnée).

**Comment ça fonctionne** :
- `POST /api/admin/subscribers/{id}/send` vérifie d'abord que toutes les offres sélectionnées existent (sinon `400` avec la liste des IDs manquants), puis crée un `EmailDigest` en statut `queued` avec `template_version="manual"` et les lignes `EmailDigestOffer` associées, dans l'ordre de sélection.
- L'envoi SMTP réel n'a pas lieu à cet instant : il est pris en charge de façon asynchrone par le worker d'envoi (la même mécanique que les digests quotidiens).
- `POST /api/admin/sending/preview?subscriber_id=...&offer_ids=...` — renvoie le rendu HTML du digest **sans l'envoyer**.
- Si `offer_ids` est fourni, l'aperçu ne contient que ces offres ; sinon, il affiche automatiquement les 5 premières offres correspondant aux filières de l'abonné (utile pour visualiser « ce que cet abonné recevrait aujourd'hui s'il était traité par la cascade normale »).

**Points d'attention** : 
- après l'appel, rediriger vers la page 6 en indiquant que l'envoi est **en file d'attente**, pas encore confirmé délivré — éviter un message du type « Email envoyé » qui serait trompeur tant que le worker n'a pas confirmé.
- Pour l'aperçu, il faut afficher l'aperçu dans un cadre isolé (iframe ou zone stylée à part) pour ne pas laisser le CSS de l'email interférer avec le reste de l'interface admin.

---

## 10. Gestion du scraping — `/admin/scraping`

**À quoi elle sert** : surveiller la collecte automatique quotidienne (les 3 sources : GoAfrica 6h00, JobIvoire 6h05, Éducarrière 6h10) et pouvoir la relancer manuellement en cas de problème.

**Pour qui** : `super_admin` uniquement — action jugée sensible.

**Ce qu'on y voit** : une carte par source (dernier passage, durée, dernière erreur, nombre total de runs), un bouton de déclenchement manuel, un historique des runs récents.

**Fonctionnalités à intégrer** :
- Déclenchement d'un scraping pour toutes les sources actives, ou pour une source spécifique.
- Indicateur d'état « en cours » avec rafraîchissement automatique (le déclenchement crée seulement une ligne `pending`, l'exécution réelle est asynchrone).
- Lien vers le détail de chaque run (page 9).

**Comment ça fonctionne** :
1. `POST /api/admin/scraping/trigger` sélectionne les sources actives concernées, crée un `ScrapeRun` (`pending`) et un `SourceScrapeRun` par source, puis renvoie immédiatement — **rien n'est encore exécuté à ce stade**.
2. Le worker Celery (`tasks.scrapers.run_source_scraper`) prend en charge l'exécution réelle (requêtes HTTP, extraction, normalisation) et fait avancer les statuts `pending → running → success/failed` de façon totalement découplée de cet appel API.
3. `GET /api/admin/scraping/status` interroge, pour chaque source, son dernier `SourceScrapeRun` — c'est la vue de référence pour savoir si tout va bien.

**Points d'attention** :
- Le rafraîchissement de l'écran doit être en **polling** (pas de websocket dans ce backend) — prévoir un intervalle raisonnable (ex. 5–10 secondes) pendant qu'un run est `pending`/`running`.
- `404` si aucune source active ne correspond au déclenchement demandé (ex. toutes les sources sont en pause) — message clair à afficher plutôt qu'une erreur générique.

---

## 11. Détail d'un run — `/admin/scraping/runs/:id`

**À quoi elle sert** : diagnostiquer précisément ce qui s'est passé lors d'un run donné — indispensable quand une source échoue (structure HTML modifiée, blocage anti-scraping) ou quand le volume d'offres collectées semble anormal.

**Pour qui** : `super_admin`.

**Ce qu'on y voit** : statistiques globales du run (offres brutes, insérées, mises à jour, doublons, erreurs), détail par source, et un journal d'événements filtrable par niveau.

**Fonctionnalités à intégrer** :
- Tableau récapitulatif par source avec statut, durée, code HTTP éventuel.
- Journal d'événements avec filtre par niveau (info / warning / error).
- Lien de retour vers `/admin/scraping`.

**Comment ça fonctionne** :
- `GET /api/admin/scraping/runs/{id}` charge le run avec ses `source_runs` préchargés.
- `GET /api/admin/scraping/runs/{id}/logs` reconstruit un journal lisible à partir de `OfferIngestionEvent` (une ligne par offre traitée), avec un niveau calculé automatiquement : `failed → error`, `skipped → warning`, `duplicate/updated/inserted → info`.

**Points d'attention** : ce journal est **spécifique au scraping** — il ne remonte aucune autre catégorie d'événement technique (pas d'événements liés à l'envoi ou à l'IA), à garder en tête si l'équipe veut un jour un vrai journal technique transverse.

---

## 12. Gestion des filières — `/admin/filieres`

**À quoi elle sert** : configurer le référentiel métier le plus stratégique du produit — chaque décision ici a un effet direct sur la qualité du matching offre ↔ abonné, et donc sur la pertinence perçue du service, mais l'édition des mots-clés n'est **plus une opération à l'aveugle**.

**Pour qui** : `super_admin`.

**Ce qu'on y voit** : liste des filières (avec ordre d'affichage), et pour chacune : ses mots-clés de matching (avec poids) et ses spécialités.

**Fonctionnalités à intégrer** :
- CRUD complet sur une filière (code, libellé, slug, icône, description, ordre).
- **Éditeur de mots-clés** : liste dynamique keyword + poids (1 à 100), ajout/suppression/modification, avec enregistrement en un clic.
- Sous-table des spécialités rattachées.
- Avertissement explicite : « ces mots-clés s'appliqueront au **prochain** scraping, pas rétroactivement aux offres déjà collectées ».
- Bouton « Tester l'impact » avant de sauvegarder une modification de mots-clés — simule le nouveau matching sur les offres récentes sans rien modifier en base.

**Comment ça fonctionne** :
- CRUD standard sur `/api/admin/referentials/filieres`.
- `PUT /filieres/{id}/keywords` **remplace intégralement** la liste de mots-clés à chaque sauvegarde (suppression totale puis réinsertion) — donc l'écran doit envoyer la liste complète à chaque fois, pas un delta.
- Chaque mot-clé est normalisé côté serveur (accents, casse) et son poids est borné entre 1 et 100.
- `POST /api/admin/referentials/filieres/simulate` avec `{filiere_code, keywords}` — exécute la logique de matching avec la liste de mots-clés proposée (pas encore sauvegardée) contre un échantillon d'offres existantes, et renvoie le résultat (ex. nombre d'offres qui seraient taguées, avec quelques exemples).

**Points d'attention** : 
- comme la sauvegarde remplace tout, un enregistrement partiel accidentel (ex. l'utilisateur n'a pas fini de charger la liste existante avant de sauvegarder) écraserait silencieusement des mots-clés — bien charger la liste actuelle avant d'autoriser la modification, et prévoir une confirmation avant sauvegarde si la liste a beaucoup rétréci.
- La simulace test reste une **simulation** — les offres déjà collectées ne sont jamais re-taguées rétroactivement même après sauvegarde des nouveaux mots-clés (seul le prochain passage de scraping en tiendra compte) ; l'écran doit rappeler cette limite juste après avoir montré le résultat de la simulation, pour éviter toute confusion.

---

## 13. Gestion des sources — `/admin/sources`

**À quoi elle sert** : piloter l'état des sites scrapés (GoAfrica, JobIvoire, Éducarrière…) — activer/désactiver rapidement une source en cas d'incident (blocage anti-scraping, changement de structure HTML), sans toucher au code.

**Pour qui** : `super_admin`.

**Ce qu'on y voit** : liste des sources avec badge de statut (active / en pause / en erreur / désactivée), niveau de protection anti-scraping, priorité.

**Fonctionnalités à intégrer** :
- CRUD complet (nom, URL de base, URL des offres, niveau anti-scraping 0–5, priorité).
- Action rapide « mettre en pause » / « réactiver » isolée du formulaire complet.

**Comment ça fonctionne** :
- CRUD standard sur `/api/admin/referentials/sources`, avec `PATCH /{id}/status` dédié pour le changement d'état rapide.
- Mettre une source en pause l'exclut immédiatement des prochains déclenchements de scraping (`POST /scraping/trigger` ne sélectionne que les sources `active`).

**Points d'attention** : le déclenchement automatique quotidien (planification Celery) est câblé sur des codes de source en dur (`goafrica`, `jobivoire`, `educarriere`) — désactiver une source dans l'admin l'exclut du traitement mais ne modifie pas la planification elle-même ; ajouter une nouvelle source nécessitera une intervention côté code (planification), pas seulement une création dans cet écran.

---

## 14. Gestion du contenu — `/admin/contenu`

**À quoi elle sert** : alimenter le site public en contenu éditorial (articles de blog/conseils carrière), gérer les pages statiques obligatoires (mentions légales, etc.) et à terme la FAQ.

**Pour qui** : `moderateur`, `super_admin`.

**Ce qu'on y voit** : à construire en 4 onglets distincts.

### 12.1 Onglet Articles

**Fonctionnalités à intégrer** :
- Liste avec filtres (statut, catégorie, recherche titre).
- Éditeur d'article complet : métadonnées (titre, extrait, SEO), sections structurées avec blocs de contenu (texte, citation, image), points clés à retenir, chiffres clés, glisser-déposer pour réordonner les sections.
- Toggle « à la une » avec ordre d'affichage.
- Publication / dépublication / archivage.

**Comment ça fonctionne** :
- La création (`POST /content/articles`) crée en une seule opération la `ContentPage` (type=`article`, statut=`draft`) et l'`Article` associé.
- La publication (`PATCH /articles/{id}/status`) fixe automatiquement `published_at` à la première mise en `published` — cette date **ne bouge plus** ensuite même si l'article repasse en brouillon puis republié.
- Le réordonnancement des sections (`PUT /articles/{id}/sections/reorder`) passe par une astuce technique interne (positions temporaires négatives) pour éviter un conflit de contrainte — transparent pour le frontend, qui envoie simplement la liste d'IDs dans le nouvel ordre.

### 12.2 Onglet Catégories & séries

**Fonctionnalités à intégrer** : CRUD des catégories d'articles ; CRUD des séries + composition d'une série (sélection et ordre des articles qui la composent).

**Comment ça fonctionne** : `PUT /series/{id}/articles` remplace intégralement la composition d'une série — même logique de remplacement total que les mots-clés de filière.

### 12.3 Onglet Conseils du jour

**Fonctionnalités à intégrer** : CRUD sur les conseils, avec un sélecteur de créneau de rotation (0 à 6, un par jour de la semaine).

**Comment ça fonctionne** : `rotation_order` est **unique** — créer un conseil sur un créneau déjà pris renvoie une erreur `409` explicite, à afficher clairement (« Ce créneau est déjà occupé par tel conseil »).

### 12.4 Onglet Pages statiques

**Fonctionnalités à intégrer** : CRUD simple (titre, contenu, statut) pour les mentions légales, la politique de confidentialité, etc.

**⚠️ À ne pas construire tel quel** : le backend a un TODO non résolu — les routes `POST`/`PUT /pages` n'ont pas de schéma de validation dédié (`ContentPageCreate`/`ContentPageUpdate` sont référencés en commentaire mais n'existent pas). **Il faut demander la création de ces schémas côté backend avant de construire cet onglet**, sous peine de formulaire non validé côté serveur.

### 12.5 FAQ *(non disponible actuellement)*

Les modèles `FaqCategory` et `FaqItem` existent en base, mais **aucune route admin ne les expose**. Cet onglet ne peut pas être construit tant que les routes correspondantes n'ont pas été ajoutées au backend — à signaler comme prérequis, pas comme bug à corriger dans l'existant.

---

## 15. Gestion des administrateurs — `/admin/administrateurs`

**À quoi elle sert** : gérer qui a accès au back-office et avec quel niveau de droits — c'est la page de sécurité la plus sensible du site.

**Pour qui** : `super_admin` uniquement.

**Ce qu'on y voit** : liste des comptes admin (nom, email, rôle, statut actif, dernière connexion).

**Fonctionnalités à intégrer** :
- Création d'un compte (email, mot de passe initial, nom, rôle).
- Édition (email, nom, statut actif).
- Changement de rôle.
- Activation / désactivation rapide.
- Suppression définitive.

**Comment ça fonctionne** :
- CRUD standard sur `/api/admin/admins`, avec **quatre garde-fous distincts** codés côté serveur pour empêcher un `super_admin` de s'auto-saboter :
  1. Impossible de désactiver son propre compte (`PUT /{id}` avec `is_active=false` sur soi-même → `400`).
  2. Impossible de retirer son propre rôle `super_admin` (`PATCH /{id}/role` → `400`).
  3. Impossible de changer le statut de son propre compte via le toggle rapide (`PATCH /{id}/status` → `400`).
  4. Impossible de se supprimer soi-même (`DELETE /{id}` → `400`).

**Points d'attention** : le frontend doit **désactiver visuellement** ces actions sur sa propre ligne (griser les boutons, plutôt que de laisser l'utilisateur cliquer et recevoir une erreur) — ça évite une confusion inutile, même si l'API bloque déjà correctement le cas.

---

## 16. Journal d'activité — `/admin/journal`

**À quoi elle sert** : traçabilité complète de qui a fait quoi dans le back-office — indispensable en cas de litige ou d'erreur à comprendre a posteriori.

**Pour qui** : `super_admin`.

**Ce qu'on y voit** : table chronologique (date, admin auteur, type d'action, table concernée, ID concerné), avec le détail JSON de l'action.

**Fonctionnalités à intégrer** :
- Filtres par admin, par type d'action, par table cible.
- Panneau d'affichage du JSON `details` pour comprendre précisément ce qui a changé.

**Comment ça fonctionne** :
- `GET /api/admin/logs/audit` avec filtres.
- **Chaque** mutation faite depuis n'importe quel routeur admin (création, édition, suppression, envoi, déclenchement de scraping) appelle systématiquement `log_admin_action(...)`, dans la **même transaction** que l'opération elle-même — donc le journal est garanti cohérent avec l'état réel de la base (pas de risque d'action journalisée sans effet, ou l'inverse).

**Points d'attention** : les connexions (`action=connexion`) ne sont en réalité **jamais journalisées** malgré la présence de cette valeur dans l'enum — la page ne pourra pas afficher d'historique de connexions tant que cette instrumentation n'est pas ajoutée côté `auth.py`.

---

## 17. Journal des erreurs & Emails transactionnels — `/admin/logs`

**À quoi elle sert** : diagnostic technique transverse — suivre les incidents de scraping, gérer la boîte de réception des messages de contact du site public et gerer les emails transactionnels — utile pour tout le support lié aux inscriptions et désinscriptions, pas seulement pour un abonné précis (page 8).

**Pour qui** : `super_admin`.

**Ce qu'on y voit** : deux onglets distincts.

### 15.1 Onglet Événements techniques
Filtrable par niveau (info/warning/error) et par source. **Actuellement, la seule catégorie d'événements disponible est le scraping** — un filtre « module » qui proposerait d'autres valeurs (envoi, IA...) renverrait toujours une liste vide, puisque le backend ne construit ces événements qu'à partir du suivi d'ingestion des offres.

### 15.2 Onglet Messages de contact
Liste des messages envoyés via le formulaire public, avec changement de statut (nouveau / lu / répondu / archivé / spam).

**Fonctionnalités à intégrer** :
- Filtre par statut sur les deux onglets.
- Action de changement de statut sur un message de contact.

### 15.3 Onglet Emails transactionnels
- Liste filtrable par motif (`confirm_email`, `resend_confirmation`, `manage_alert`, `unsubscribe`) et par statut (`queued`, `sent`, `failed`).
- Recherche par adresse email destinataire.
- Un badge de comptage (ex. « 12 échecs aujourd'hui ») visible sans ouvrir la liste complète.

### Comment ça fonctionne :
- `GET /logs/events` reconstruit le journal à partir de `OfferIngestionEvent` — le filtrage par niveau se fait **après** la requête SQL (sur-fetch puis filtrage en mémoire), ce qui veut dire que la pagination peut être légèrement imprécise quand un filtre de niveau est actif sur un gros volume.
- `GET /logs/contacts` / `PATCH /contacts/{id}/status` utilisent une table d'alias (`new`, `read`, `replied`, `archived`, `spam`) qui diffère des noms internes stockés (`NEW`, `IN_PROGRESS`, `REPLIED`, `CLOSED`, `SPAM`) — utiliser strictement les valeurs API côté frontend.
- `GET /api/admin/transactional-emails` avec les filtres `purpose`, `status`, `to_email` (exact ou motif `%` pour une recherche partielle), `subscriber_id`.
- `GET /api/admin/transactional-emails/count` — comptage rapide pour le badge, sans pagination, pensé pour un affichage dans le menu ou le tableau de bord.
- **Sécurité** : le payload brut de la requête/réponse à Resend (`request_payload`/`response_payload`) n'est **jamais exposé** par cette route, par principe de sécurité — seuls le motif, le statut et les métadonnées sont visibles.

**Points d'attention** : un taux d'échec élevé sur `confirm_email` peut indiquer un problème côté fournisseur d'email (Resend) plutôt qu'un problème d'inscription — ce badge peut donc servir de signal d'alerte opérationnel, à faire remonter sur le tableau de bord si le volume de réclamations augmente.

---

## 18. Paramètres du site — `/admin/parametres`

**À quoi elle sert** : centraliser la configuration éditable sans déploiement (heure d'envoi, textes du site, coordonnées de contact) — permet à l'équipe non-technique d'ajuster ces éléments sans intervention développeur.

**Pour qui** : `super_admin`.

**Ce qu'on y voit** : liste clé/valeur avec description de chaque paramètre.

**Fonctionnalités à intégrer** :
- Édition inline de la valeur d'un paramètre existant.
- Formulaire de sauvegarde groupée pour modifier plusieurs paramètres en un clic.
- Création d'une nouvelle clé si besoin (upsert transparent).

**Comment ça fonctionne** :
- `PUT /{key}` fait un **upsert** : crée le paramètre s'il n'existe pas encore, sinon met à jour sa valeur — le frontend n'a jamais besoin de distinguer « créer » et « modifier ».
- `POST /bulk` accepte un dictionnaire clé→valeur pour tout sauvegarder en un seul appel.

**Points d'attention** : ce module est **entièrement fonctionnel** côté backend (contrairement à un signalement antérieur de module inachevé) — rien ne bloque la construction de cet écran.

---

## 19. Normalisation IA — `/admin/ia`

**À quoi elle sert** : piloter le pipeline de normalisation automatique des offres brutes par intelligence artificielle (nettoyage, tagging de filière, détection de doublons subtils) avec la boucle de revue des suggestions de filière effectivement fermée.

**Pour qui** : `super_admin`.

**Ce qu'on y voit** :
- Table des clés API IA configurées (fournisseur, priorité, quotas, statut, clé masquée).
- Historique des jobs de normalisation (compteurs : traitées, activées, en revue, rejetées, à retraiter).
- Liste d'alertes (ex. clé désactivée automatiquement après échecs répétés).
- Liste des suggestions IA (`PENDING` par défaut), avec le code et libellé proposés, la raison donnée par l'IA, et l'offre d'origine qui a déclenché la suggestion.
- Bouton « Approuver » / « Rejeter » par suggestion.

**Comment ça fonctionne** :
- La clé API n'est **jamais renvoyée en clair** après sa création : seul un champ masqué (ex. `****ab12`, calculé à partir des 4 derniers caractères stockés séparément) est exposé — le formulaire d'édition ne doit donc jamais pré-remplir le champ clé avec une valeur lisible.
- `POST /ai/run` déclenche un cycle de normalisation de façon asynchrone (résultat non immédiat) — même logique de polling que la page Scraping.
- Le pipeline complet fonctionne aussi en tâche de fond planifiée toutes les 5 minutes (`sweep_raw_offers`), indépendamment de toute action admin — la page IA sert donc surtout à **surveiller** et à **intervenir en cas d'anomalie**, pas à déclencher le fonctionnement normal du système.
- `GET /api/admin/ai/suggestions?status_filter=pending` — liste triée par date de création décroissante.
- `PATCH /api/admin/ai/suggestions/{id}` avec `{status: "approved"}` : **crée automatiquement la nouvelle filière** (avec un premier mot-clé initial basé sur le libellé suggéré, poids 50) si elle n'existe pas déjà, puis marque la suggestion `APPROVED` avec l'admin et la date de revue. Un rejet marque simplement `REJECTED` sans autre effet.
- Gère le cas de concurrence (deux admins approuvant la même suggestion en parallèle) avec une erreur `409` explicite plutôt qu'un doublon de filière silencieux.

**Points d'attention** : l'approbation crée une filière **active immédiatement** avec un seul mot-clé de départ (poids 50, basé uniquement sur le libellé) — l'écran doit rediriger l'admin vers `/admin/filieres/{nouvelle_filiere}` juste après approbation pour l'inviter à enrichir la liste de mots-clés, sinon la nouvelle filière restera sous-alimentée en matching.

---

## 20. Santé du système — `/admin/systeme`

**À quoi elle sert** : donner à l'équipe un point de vérité unique pour savoir si l'infrastructure fonctionne correctement — indispensable pour diagnostiquer rapidement un « aucun email envoyé ce matin » sans devoir se connecter en SSH sur le serveur.

**Pour qui** : `super_admin` uniquement.

**Ce qu'on y voit** : cinq indicateurs de santé, chacun avec un statut (ok / warning / error / degraded) :
1. **Base de données** — accessible ou non.
2. **Celery** — nombre de workers actifs détectés.
3. **Files d'attente** — nombre de digests en attente d'envoi (`queued`).
4. **Heartbeat** — horodatage de la dernière offre créée (signal indirect que le pipeline de collecte est vivant).
5. **Authentification admin** — rôle et statut de la session courante (auto-diagnostic).

**Fonctionnalités à intégrer** :
- Affichage en cartes colorées (vert/orange/rouge) par indicateur.
- Un statut global (`overall_status`) agrégé en tête de page.
- Rafraîchissement manuel (bouton) plutôt qu'automatique, pour éviter de solliciter Celery en continu.

**Comment ça fonctionne** :
- `GET /api/admin/system/health` interroge en parallèle la base (`SELECT COUNT` simple sur `job_offers`), Celery (`celery_app.control.inspect(timeout=2.0).active()`), le nombre de digests `queued` en base, et la date de la dernière offre créée.
- Le `overall_status` global suit une logique de dégradation : `error` si la base est inaccessible, `degraded` si Celery ne répond pas ou si la vérification des files échoue, `ok` sinon.

**Points d'attention** :
- L'inspection Celery a un **timeout de 2 secondes** — en cas de worker lent à répondre (pas forcément mort), l'indicateur peut afficher `warning` alors que le système fonctionne, juste plus lentement que d'habitude. Formuler le message en conséquence (« aucun worker détecté dans le délai imparti » plutôt que « système en panne »).
- Les profondeurs de file « ingestion » et « IA » ne sont **pas encore réellement mesurées** (le backend renvoie littéralement `"N/A"` pour ces deux valeurs, faute d'inspection directe de Redis) — ne pas construire de graphique dessus tant que cette donnée n'est pas branchée, un simple texte suffit pour l'instant.

---

## 21. Export de données — accessible depuis Offres, Utilisateurs, Envois *(fonctionnalité transverse, pas une page à part)*

**À quoi elle sert** : permettre à l'équipe d'extraire un jeu de données filtré pour analyse externe (tableur) ou sauvegarde ponctuelle, sans accès direct à la base de production.

**Pour qui** : selon la ressource — `super_admin` + `gestionnaire_offres` pour les offres, `super_admin` + `gestionnaire_utilisateurs` pour les abonnés et les envois.

**Fonctionnalités à intégrer** :
- Un bouton « Exporter » sur les pages Offres, Utilisateurs et  Envois, qui respecte **les filtres actuellement appliqués** à l'écran (mêmes query params que la liste).
- Choix du format : CSV ou JSON.
- Pour les abonnés : filtre additionnel par ville et par email exact/partiel.
- Pour les envois : filtre additionnel par palier de matching (`match_tier`) — **premier endroit où cette donnée est enfin exposée**, même si ce n'est que pour l'export et pas encore dans l'interface de détail (voir §11).

**Comment ça fonctionne** :
- `GET /api/admin/exports/data-export/{offers|subscribers|sending}?format=csv|json&...filtres`.
- Réponse en **streaming** (`StreamingResponse` + itération SQLAlchemy `yield_per`) — conçu pour ne pas saturer la mémoire même avec plus de 100 000 lignes ; le frontend doit donc traiter la réponse comme un téléchargement de fichier direct, pas comme un appel JSON classique à parser entièrement en mémoire.
- Le nom de fichier et le type MIME sont fournis par le serveur via l'en-tête `Content-Disposition`.

**Points d'attention** : les routes sont volontairement placées sous `/data-export/...` plutôt que `/offers/export` pour éviter un conflit avec la route `GET /offers/{offer_id}` (qui aurait autrement interprété « export » comme un identifiant d'offre) — sans incidence côté frontend, mais bon à savoir si un jour l'URL semble étrange dans les logs réseau.

---

## 22. Récapitulatif — 21 pages/fonctionnalités pour la gestion complète du site

| # | Page / fonctionnalité | Nouveau en v3 ? | Rôle |
| --- | --- | --- | --- |
| 1 | Connexion (+ mot de passe oublié) | Enrichi | public |
| 2 | Tableau de bord (+ qualité matching, top offres, recherche) | Enrichi | tous |
| 3 | Offres (+ import en masse) | Enrichi | gestionnaire_offres |
| 4 | Créer/modifier une offre | Inchangé | gestionnaire_offres |
| 5 | Doublons à vérifier | **Nouveau** | gestionnaire_offres |
| 6 | Entreprises | **Nouveau** | super_admin |
| 7 | Utilisateurs (liste) | Inchangé | gestionnaire_utilisateurs |
| 8 | Détail utilisateur (+ onglet emails transactionnels) | Enrichi | gestionnaire_utilisateurs |
| 9 | Envoi personnalisé (+ aperçu) | Enrichi | gestionnaire_utilisateurs |
| 10 | Scraping | Inchangé | super_admin |
| 11 | Détail d'un run | Inchangé | super_admin |
| 12 | Filières (+ simulation d'impact) | Enrichi | super_admin |
| 13 | Sources | Inchangé | super_admin |
| 14 | Contenu | Inchangé (limitations persistantes) | moderateur |
| 15 | Administrateurs | Inchangé | super_admin |
| 16 | Journal d'activité | Inchangé | super_admin |
| 17 | Logs (+ onglet emails transactionnels) | Enrichi | super_admin |
| 18 | Paramètres | Inchangé | super_admin |
| 19 | IA (+ onglet suggestions de filière) | Enrichi | super_admin |
| 20 | Santé du système | **Nouveau** | super_admin |
| 21 | Export de données (transverse) | **Nouveau** | selon ressource |

---

## 23. Ce qui reste à faire avant d'avoir un back-office « complet »

| # | Sujet | État |
| --- | --- | --- |
| 1 | Schémas `ContentPageCreate`/`ContentPageUpdate` manquants | 🔴 toujours présent — bloque une validation propre des pages statiques |
| 2 | Routes admin FAQ (`FaqCategory`/`FaqItem`) | 🔴 toujours absentes |
| 3 | `EmailDigestRead` n'expose pas `match_tier`/`match_kind` | 🟡 partiellement contourné (visible en agrégat sur tier-stats et en détail sur l'export CSV « sending »), mais pas dans l'écran de détail abonné |
| 4 | Filtre temporel réel sur `top-viewed-offers` (`days`) | 🟡 paramètre accepté mais non branché |
| 5 | Profondeur réelle des files Redis (ingestion, IA) sur la page Santé | 🟡 renvoie `"N/A"` actuellement |
| 6 | 2FA (TOTP) pour les comptes admin | 🔴 non traité (le reset de mot de passe seul est en place) |
| 7 | Segments d'abonnés sauvegardés | 🔴 non traité |
| 8 | Matrice de permissions plus fine que les 4 rôles actuels | 🔴 non traité — à garder en réserve tant que l'équipe reste petite |

Ces 8 points constituent une base de backlog raisonnable pour une itération suivante, une fois les 21 pages/fonctionnalités ci-dessus construites côté frontend.
