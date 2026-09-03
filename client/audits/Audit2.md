J'ai chargé le protocole d'audit frontend et l'inventaire du repo est fait. Je passe maintenant à la collecte de preuves réelles (routes, tokens CSS, SEO, sécurité, bundle) avant de te livrer le plan + les constats.Intéressant — le code référence déjà un `Audit.md` avec des correctifs appliqués (P0-2, P1-13, P2-5...). Je vérifie s'il existe, puis je lance les gates et les greps en parallèle.Lint passe (0 erreur). Pas de `Audit.md` dans le repo — les commentaires y renvoient mais le fichier n'existe plus. Je lance le build + greps en parallèle.Le `cd` précédent a persisté — je relance avec des chemins absolus.# Audit Frontend JobAlert CI — Rapport d'évidence + Plan d'action

J'ai audité le code avec preuves réelles (lint, build, greps, lecture croisée client/backend). Constat général : **une bonne partie des piliers est déjà traitée** — le code cite un `Audit.md` (P0-1, P0-2, P0-6, P1-4, P1-8, P2-5…) qui a visiblement existé mais **n'est plus dans le repo**. L'audit ci-dessous vérifie ce qui tient, ce qui reste cassé, et ce qui manque.

---

## Preuves mécaniques (état actuel)

| Gate | Résultat |
|---|---|
| `npm run lint` | ✅ 0 erreur, 0 warning |
| `npm run build` | ✅ OK en 7.6s — chunk principal **281 kB (84.7 gz)**, `shared` 272 kB (86 gz), `query-helpers` 210 kB (71 gz). Aucun chunk > 500 kB |
| Code-splitting | ✅ 13 routes lazy (`App.jsx:15-28`), Home seul en statique pour le LCP |
| XSS (`dangerouslySetInnerHTML`/`innerHTML`) | ✅ 0 occurrence dans `src/` |
| Liens externes `target="_blank"` | ⚠️ 9 sites : 7 ont `rel="noopener noreferrer"`, **4 n'ont que `rel="noreferrer"`** (détail plus bas) |
| Fonts | ✅ `@fontsource-variable/montserrat` + `inter` uniquement (`index.css:4-5`), aucun Google Fonts `<link>`, Geist installé mais jamais importé |

---

## Pilier 1 — Architecture, Routing & SEO

**Points de contrôle & bonnes pratiques attendues** : route catch-all, canonical dynamiques, OG/Twitter Cards, sitemap frais, JSON-LD typé.

**État du code :**

| # | Constat | Preuve | Sévérité |
|---|---|---|---|
| 1.1 | ✅ Catch-all `*` → page 404 dédiée avec `noindex`, liens de reprise, sur-thème | `App.jsx:91`, `PageIntrouvable/index.jsx:20-25` | — |
| 1.2 | ✅ SEO centralisé dans `Seo.jsx` + `lib/seo.js` (source unique), `index.html` minimaliste, JSON-LD par page (Organization/WebSite/Service/FAQ/Breadcrumb/ItemList) | `Seo.jsx:58-93` | — |
| 1.3 | ✅ Sitemap **dynamique côté backend** depuis la DB (offres actives + articles publiés), rewrite Vercel `/sitemap.xml` → API | `server/api/v1/public/sitemap.py:54-135`, `vercel.json` | — |
| 1.4 | ⚠️ **SPA = plafond SEO structurel**. Tout le head est posé en `useEffect` : Googlebot indexe parfois, mais Facebook/LinkedIn/WhatsApp ne exécutent pas JS → les partages d'offres (`og:title` dynamique de `offreSeo()`) montrent un titre générique ou vide. C'est LA limite du projet | `Seo.jsx:58` | 🔴 structurel |
| 1.5 | 🟡 OG image unique `/screen.png` (screenshot du site) pour toutes les offres/articles — pas d'OG par contenu | `seo.js:327` | 🟡 |
| 1.6 | 🟢 `ScrollToTop` clé sur `pathname` seulement (`App.jsx:32-38`) : pas de conflit hash détecté (ancres gérées par `Sommaire`) | — | — |

**Correctifs concrets proposés (Lot SEO)** :
- **1.4** — deux options, à trancher : (a) *middleware edge Vercel* qui injecte les meta OG serveur-side pour `/offres/:id` et `/conseils/:slug` (léger, garde la SPA) ; (b) migration SSG/ISR Next.js (coûteux, à planifier). Je recommande (a).
- **1.5** — générer une OG image par offre/article (route backend `@vercel/og` ou image template) ; à défaut, au moins OG par filière.

## Pilier 2 — Design System & A11y

**Points de contrôle** : tokens stricts, contrastes WCAG, dark mode cohérent, focus visible, reduced-motion.

| # | Constat | Preuve | Sévérité |
|---|---|---|---|
| 2.1 | ✅ Tokens bien construits : navy/orange en `@theme inline` (`index.css:55-56`), pont shadcn complet, échelle radius fixe | — | — |
| 2.2 | ✅ **Le piège classique orange-sur-blanc est déjà corrigé** : `--primary: #f5a623` avec `--primary-foreground: #0f2d4d` (ratio ≈ 6.3:1 AA) — commenté P0-6 dans le code | `index.css:166-169` | — |
| 2.3 | 🔴 **Dark mode fantôme** : `<meta name="color-scheme" content="light">` (`index.html:11`), **aucun bloc `.dark`**, aucune logique de toggle — pourtant ton énoncé annonce « support Dark Mode ». Le dark mode **n'existe pas** dans l'implémentation actuelle. Décision requise : le compléter ou l'assumer light-only | `index.html:11`, grep `"dark"` = usages cosmétiques tone="dark" seulement | 🔴 décision |
| 2.4 | 🟡 ~78 occurrences `bg-white/text-white/#hex` hors tokens. La plupart légitimes (sur fondes navy `text-white` correct), mais des hex littéraux traînent : `#B45309`, `#0A66C2` LinkedIn, `#10b981`… | `OfferCard.jsx:109`, `EnTeteArticle.jsx:254`, `ConfirmationInscription/index.jsx:197-207` | 🟡 |
| 2.5 | ✅ Focus-visible global défini une fois en `@layer base` (`index.css:232-242`), `MotionConfig reducedMotion="user"` (`App.jsx:68`) + media query CSS pour marquee | — | — |
| 2.6 | ✅ A11y sémantique au-dessus de la moyenne : `aria-live="polite"` sur le compteur du flux (`OffersFeed.jsx:106`), `aria-pressed` sur les cartes filières (`EtapePreferences.jsx:96`), `role="status"` | — | — |

**Correctifs** : Lot 2 = décision dark mode (compléter via bloc `.dark` + tokens, ou supprimer l'ambiguïté), puis remplacement des hex littéraux récurrents par des tokens (`--color-amber-700` etc.).

## Pilier 3 — Data Fetching, State & API

| # | Constat | Preuve | Sévérité |
|---|---|---|---|
| 3.1 | ✅ TanStack Query bien configuré : staleTime 5min, gcTime 30min, retry 2, refetchOnWindowFocus off (`queryClient.js`) | — | — |
| 3.2 | ✅ Adaptateur défensif exemplaire : relations imbriquées null-safe (`raw.company?.name ?? "Entreprise non précisée"`), dédup pagination `mergeOffers` par uid | `offers-adapter.js:24-78` | — |
| 3.3 | ✅ Le bug historique params-in-body est corrigé et documenté : `unsubscribe(token, {reason})` passe bien `{ params }` en 3e arg axios, avec commentaire citant la signature FastAPI | `subscriptions.js:33-42` | — |
| 3.4 | ✅ Contrat d'erreur sain : `formatApiError()` retourne `string \| null`, annulations court-circuitées (`isCanceledError`), et les callers lisent le status sur `err.response.status` directement (plus de branche morte `.status === 409` sur un string) | `errors.js:10-36`, `Registered.context.jsx:179-184` | — |
| 3.5 | 🟡 Formulaire d'inscription : limite 1→3 filières bien enforceée en state (`plein && !sel`, tooltip explicatif, jauge 3 segments) — très bon. Mais **pas de préfill depuis URL** ni de gestion de scroll entre étapes | `EtapePreferences.jsx:25,88,140-148` | 🟢 mineur |
| 3.6 | 🟡 `withCredentials` absent (bien), mais `baseURL: import.meta.env.VITE_API_URL \|\| ""` — en prod Vercel, si `VITE_API_URL` n'est pas set, `/api/*` tombe sur le domaine front sans proxy runtime → dépendance totale aux rewrites. À documenter/vérifier en env vars Vercel | `axiosInstance.js:6` | 🟡 à vérifier |

## Pilier 4 — Performance & CWV

| # | Constat | Preuve | Sévérité |
|---|---|---|---|
| 4.1 | ✅ Route-level lazy loading partout, Home en entrée, fallback Suspense léger | `App.jsx:11-28` | — |
| 4.2 | ✅ Listes : dérivés `useMemo` O(n), headers mémoïsés, pagination "load more" (pas besoin de virtualisation à PAGE_SIZE par jour). Pas de lib virtualizer inutilisée | `OffersFeed.jsx:74-75` | — |
| 4.3 | ✅ Logos entreprise : `loading="lazy"` + fallback initiales navy sur `onError` | `LogoEntreprise.jsx:12-17` | — |
| 4.4 | 🟡 **framer-motion (~40 kB gz) dans les items de liste** (`OffersFeed`, `FeedOffreCard`, animations par carte). Le chunk `shared` fait 86 kB gz dont une part vient de là. Les transitions CSS suffiraient sur les cartes répétées | imports framer-motion ×16 fichiers | 🟡 |
| 4.5 | 🟡 Dépendances mortes à purger : `@fontsource-variable/geist` (jamais importé), `shadcn` en dependency (CLI, pas runtime), `repomix` en devDep du package client, `react.svg`/`vite.svg` dans assets | `package.json`, grep geist = 0 import | 🟢 |
| 4.6 | 🟢 `hero.png` dans assets — vérifier poids/format (à convertir WebP/AVIF si >100 kB) | `assets/hero.png` | 🟢 |

## Pilier 5 — Sécurité

⚠️ **Ton brief mentionne un espace admin avec rôles (`super_admin`, `gestionnaire_offres`) : il n'existe aucun code admin dans `client/src`.** Soit il est ailleurs, soit c'est du scope futur — précise-moi.

| # | Constat | Preuve | Sévérité |
|---|---|---|---|
| 5.1 | 🔴 **4 liens externes sans `noopener`** (seulement `rel="noreferrer"`). `noreferrer` implique noopener donc pas de faille tabnabbing, MAIS casse le référencement des clics sortants (analytics attribution). Homogénéiser vers `noopener noreferrer` | `EnTeteArticle.jsx:253`, `CarteSource.jsx:144,212` | 🟢 faible |
| 5.2 | ✅ Zéro `innerHTML`/`dangerouslySetInnerHTML` : le contenu scrapé (`source_text`, blocks articles) est rendu en texte React → XSS-safe by construction | grep = 0 | — |
| 5.3 | ✅ Token de confirmation en path, validation GET serveur, gestion 400/410 expirée avec formulaire de renvoi. Manque juste `history.replaceState` après validation pour ne pas laisser le token dans l'historique | `ConfirmationInscription/index.jsx:59-94` | 🟡 |

## Pilier 6 — UX spécifique

✅ Points forts : parcours confirmation en 3 états (loading/succès/erreur) avec renvoi d'email et compte à rebours 8h00 ; email dupliqué → message 409 dédié (`Registered.context.jsx:180-181`) ; skeletons calqués sur le gabarit OfferCard (`SkeletonsOffres.jsx:4-6`) ; filière/contrat/source affichés via adaptateur.
🟡 Manques : **salaire mappé côté client** (`salaire` dans `offers-adapter.js:40`) — vérifier qu'il est affiché sur OfferCard/DetailsOffre ; deadline `application_deadline_at` mappée aussi — idem ; OG images par contenu (cf. 1.5).

## Pilier 7 — Qualité du code

✅ Structure propre (`api/` / `contexts/` / `tools/` / `hooks/` / `lib/` / `Pages/*/sections+components`), composants partagés réellement mutualisés (`OfferCard`, `CtaLink`, `Ticker`, filters/), ErrorBoundary par section sur toutes les pages, commentaires en français qui référencent les décisions d'audit.
🟡 Dettes : dossier `tools/` contient en réalité hooks + query keys (nommage mensonger → `hooks/` existe déjà, fusionner) ; fixture 84 kB dans `client/fixtures/api_responses.json` et mock `src/data/offres.js` encore importés par `registered.tools.js:13` (risque de bundling de données mortes) ; `Audit.md` supprimé alors que ~15 commentaires y renvoient.

---

# Plan d'action en Lots

Conformément au protocole : je propose, tu arbitres, on avance lot par lot (lint + build vérifiés après chaque lot).

| Lot | Contenu | Effort |
|---|---|---|
| **Lot 1 — P0 & sécurité/cohérence** | 5.1 homogénéiser `rel="noopener noreferrer"` (4 fichiers) · 5.3 `history.replaceState` post-confirmation · purge deps mortes (geist, shadcn dep, repomix, svgs) | ~1h |
| **Lot 2 — Design system & a11y** | 2.3 décision dark mode puis implémentation ou nettoyage · 2.4 remplacement des hex littéraux par tokens | 2-4h selon décision |
| **Lot 3 — Performance** | 4.4 remplacer framer-motion par transitions CSS dans les items de liste répétés · 4.6 audit hero.png/images sources | 2-3h |
| **Lot 4 — UX data gaps** | vérifier affichage salaire/deadline (mappés mais peut-être non rendus) · préfill inscription depuis URL · consolidation OfferCard | 2h |
| **Lot 5 — SEO structurel** | 1.4 middleware edge OG tags pour `/offres/:id` + `/conseils/:slug` · 1.5 OG images dynamiques · restaurer un `docs/Audit.md` (les commentaires y renvoient) | 3-4h |
| **Lot 6 — Dette code** | fusion `tools/` → `hooks/` · sortir fixtures de `src/` · retirer mock `data/offres.js` de registered.tools | 1-2h |

**Deux décisions qui conditionnent les lots :**
1. Dark mode : **on le complète** (bloc `.dark` + toggle) ou on **assume light-only** (je nettoie les traces) ?
2. Les fixes touchant le backend (OG middleware, OG images) sont-ils dans le scope ?

Dis-moi **« C'est parti pour le Lot N »** (et tes réponses aux 2 questions), et j'attaque la revue ligne par ligne avec correctifs appliqués et lint/build vérifiés à chaque lot.