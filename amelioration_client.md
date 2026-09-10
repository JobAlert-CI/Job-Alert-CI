Voici le bilan — **côté public, quasiment rien ne bouge** (les routes publiques n'ont eu que des changements internes) ; **c'est l'admin qui est désynchronisé**, avec 2 pages qui affichent aujourd'hui des informations devenues fausses.

---

## 🔴 A. Pages qui affichent des infos FAUSSES (corrections prioritaires)

| # | Page | Problème | Correction |
|---|------|----------|------------|
| **A1** | `Admin/TableauDeBord/sections/TopOffres.jsx` | Affiche **« depuis toujours »** alors que le serveur (H.2) filtre désormais `days=7` par défaut sur `last_seen_at`. Le libellé ment déjà aujourd'hui. | Passer `days` explicite (7/30 j) + sélecteur de fenêtre, libellé dynamique « 7 derniers jours » |
| **A2** | `Admin/Systeme/index.jsx` | 3 mensonges hérités : ① la carte Files affiche « profondeur Redis non exposée » alors que le serveur renvoie maintenant les **vraies profondeurs LLEN** (`ingestion_depth`, `ai_depth`, `emails_depth`, `default_depth`) ; ② la note pédagogique du bas répète la même chose ; ③ le bandeau `degraded` ne parle que de Celery — or il se déclenche maintenant aussi sur panne **Resend/IA** | Mettre à jour `ContenuIndicateur` (les 4 profondeurs + état « broker injoignable »), la note de bas de page, et le texte du bandeau |
| **A3** | `Admin/Journal/sections/CompteursJournal.jsx` | Le compteur « **Total historique** » lit `stats.total` qui est désormais **fenêtré 30 j** (K.1) — plus un total historique | Renommer « Total (30 j) » ou dériver le vrai historique autrement |
| **A4** | `Admin/Journal/index.jsx` | Le filtre Actions ne propose pas **`deconnexion`** (nouvel `AdminAction.LOGOUT`, A.2) — les logs de déconnexion existent mais sont infiltrables, et le badge n'a pas de variante | Ajouter l'option + libellé + variante de badge |
| **A5** | `Admin/LogsPage/sections/OngletContacts.jsx` | Les chips de statut (`contacts_par_statut`) sont passées silencieusement d'un comptage **all-time** à **fenêtre `days`** (K.1) — un vieux contact n'est plus compté | Ajouter la mention « sur 30 j » sur les chips (le reste reste correct) |

## 🟠 B. Nouveaux endpoints serveur sans consommateur côté client

| # | Endpoint | Suggestion UI |
|---|----------|---------------|
| **B1** | `GET /api/admin/system/events` (G.1) — journal des événements système (source `celery\|email\|scraping\|ia\|api`, severity `info\|warning\|error\|critical`, `days≤90`, enveloppe `{total, events[]}` paginée) | **Onglet « Événements » sur la page Systeme** (même périmètre super_admin) : filtres source/sévérité/fenêtre, badges de sévérité, contexte JSON dépliable. C'est la réponse à « pourquoi mon digest du matin a échoué » sans SSH |
| **B2** | `GET /api/admin/system/schedule` (F.2) — planification beat réelle : `timezone`, `scraper_beat_enabled`, `retry_failed_digests_enabled`, `no_offer_email_enabled`, `entries[]` (heure locale+UTC, queue, kill-switch) | **Onglet « Planification » sur la page Systeme** : table des entrées beat + badges kill-switch. Remplace le « scraping à 06:00–06:30 » figé dans la doc |
| **B3** | `PATCH /api/admin/scraping/runs/{id}` (C.4) — annotation d'un run après coup | `DetailRun.jsx` : le run affiche déjà `run.notes` en lecture seule (l.121) → bouton crayon + dialog d'édition (c'est l'usage forensique prévu : « source down, on relancera demain ») |
| **B4** | `GET /runs/{id}/logs` désormais borné + filtre `level` SQL (C.6) | Passer `level` au lieu du filtre client (DetailRun filtre encore en local l.83), garder la pagination `limit/offset` honnête |
| **B5** | `EmailDigestRead.match_tier` (H.1) — le palier T0–T5 du digest est exposé dans les réponses | `DetailAbonne` Onglet Envois : badge palier par digest (le donut `match_kind` par offre existe déjà ; il manque le **tier global** du digest) |
| **B6** | `date_debut`/`date_fin` (AAAA-MM-JJ, 400 explicite si malformé) sur `/logs/audit` ET `/logs/events` (A.7) | Filtre plage de dates sur Journal + OngletEvents — cible une période sans paginer 200 par 200 |

## 🟡 C. Améliorations découlant des nouveaux comportements

- **C1 — 409 double-trigger scraping (C.2)** : le serveur refuse un 2e run le même jour par le même admin. `messageErreurScraping` affiche déjà le `detail` français, mais l'UX peut faire mieux : désactiver/griser le bouton « Toutes les sources » si un run `admin:` du jour existe déjà dans `getRuns` (croisement local, zéro endpoint).
- **C2 — 503 broker injoignable** : nouveau cas d'erreur au trigger → message explicite « run marqué failed » (le `detail` serveur passe déjà par `formatApiError`).
- **C3 — `supports_scraping` dans le trigger** : seules les sources actives *et scrapables* partent — le tag « Lecture manuelle » existe déjà sur Sources ✅, rien à faire.
- **C4 — `last_sweep_at` IA** : le champ était servi `null` à vie (corrigé) — `OngletPilotage` l'affiche déjà ; il va enfin se remplir, rien à coder.
- **C5 — Fixtures** (`client/public/fixtures/api_responses_admin.json`) : le bloc `system/health` est à l'ancien format (`ingestion_depth: "N/A (simulee…)"`, sans `email_provider`/`ai_provider`) → à régénérer avant tout codage (contrat du skill : vérifier fixtures vs live). Les nouveaux endpoints (B1/B2/B3) n'y figurent pas.
- **C6 — Statuts `degraded`/`disabled`** : `COULEUR_STATUT` de la page Systeme ne connaît que ok/warning/error — le fallback amber masque la distinction. Ajouter `degraded` (orange soutenu) et `disabled` (gris) quand les cartes providers (B1 du point santé ci-dessous) arrivent.

## 🟢 D. Côté PUBLIC — presque rien, sauf un chantier visible

- Les routes publiques n'ont **aucun changement de contrat** (les diffs sont internes : `from __future__`, extraction IP/user-agent côté service). Offres, filières, stats, sources : **rien à toucher**.
- **Le vrai point public : `Support/Contact.jsx` est un mock**. Le `submit` (l.104) fait un `setTimeout(1400)` et affiche « envoyé » — le module `api/public/contact.js` existe et n'est **jamais appelé**. L'audit 4 a justement durci ce chemin (rate-limit 429 avec header `Retry-After`, service testable). À brancher réellement : appel `createContact`, gestion 429 (« patientez X s », lisible via `err.response.headers["retry-after"]`), et suppression du faux succès.

---

### Ordre de traitement que je recommande

1. **Lot « fausses infos »** (A1–A5) — corrections ponctuelles, quick wins, fixtures régénérées d'abord.
2. **Page Systeme v2** (A2 + B1 + B2 + C6) — la page devient l'hôte des 3 vues santé/événements/planification, en onglets.
3. **Scraping** (B3 + B4 + C1/C2).
4. **Journal/Logs dates** (B6) puis **match_tier** (B5) et **Contact public** (D).
