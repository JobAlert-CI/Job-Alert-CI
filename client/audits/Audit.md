Voici l'audit complet, ancré dans des constats réels de votre repo — pas une checklist générique.

---

# Audit Frontend JobAlert CI

## Plan d'action proposé (ordre d'exécution)

| Phase | Contenu | Effort |
|---|---|---|
| **1. État des lieux automatisable** | `npm run lint`, `npm run build` + analyse bundle, Lighthouse CI sur `/`, `/offres`, `/offres/:id`, `/conseils/:slug` | ✅ fait ci-dessous |
| **2. Correctifs P0 (bugs réels)** | Erreur 409 inscription, route 404 manquante, hook `loader` inopérant, double chargement polices | ½ journée |
| **3. SEO structurel** | Décision SSR/pré-rendu, sitemap dynamique, métadonnées serveur | 2–3 j (décision architecturale) |
| **4. Design system & a11y** | Contrastes orange, dark mode (décider : livrer ou supprimer), focus states, reduced-motion | 1–2 j |
| **5. Performance** | Splitting par route, consolidation icônes, purge polices | 1–2 j |
| **6. UX données métier** | Salaire, deadline, logos, labels sources | 1 j |
| **7. Dettes qualité** | Lint à zéro, fusion composants dupliqués, convention `tools/`→`hooks/` | ½ j |

---

## Constat global immédiat (déjà exécuté)

- ✅ `vite build` **passe**, mais chunk principal **948 kB (254 kB gzip)** — warning >500 kB
- ❌ `eslint` : **19 erreurs** (imports morts, `setState` dans effect, assignements inutiles)
- ⚠️ Dépendance `@tanstack/react-virtual` installée mais **jamais importée** dans le code
- ⚠️ **3 bibliothèques d'icônes** simultanées : `lucide-react`, `react-icons`, `@icons-pack/react-simple-icons`

---

## Pilier 1 — Architecture, Routing & SEO

### Points de contrôle & pièges propres au projet

**🔴 P0-1 — Aucune route 404.** `client/src/App.jsx:52-70` : il n'existe pas de `<Route path="*">`. Toute URL invalide (`/offre-inexistante`) rend Header + Footer vides avec HTTP 200. Aggravé par `vercel.json` qui rewrites tout vers `index.html` → Google peut indexer des milliers de soft-404.

```jsx
// App.jsx — ajouter dans le <Route path="/">
<Route path="*" element={<PageIntrouvable />} />
```
Et côté Vercel, servir un vrai 404 pour les chemins hors routes connues (ou accepter le soft-404 mais avec un contenu `noindex` explicite).

**🔴 P0-2 — Les props `loader` sont silencieusement ignorées.** `App.jsx:54-55` : `<Route index element={<Home />} loader={prefetchHome} />`. Vous utilisez `BrowserRouter`, pas `createBrowserRouter` — **les loaders ne fonctionnent qu'avec le Data Router**. `prefetchHome` ne s'exécute donc probablement jamais (à moins d'être appelé ailleurs). Deux options :

```jsx
// Option A — rester en BrowserRouter, précharger au module-load :
prefetchHome() // top-level ou dans main.jsx

// Option B — migrer vers createBrowserRouter (recommandé RRv7)
const router = createBrowserRouter([...])
<RouterProvider router={router} />
```

**🟠 P1-3 — SEO : vous êtes en SPA pure, tout le SEO repose sur JS.** `Seo.jsx` injecte title/OG/canonical dans un `useEffect` → Googlebot lit ça *souvent*, mais pas les crawlers réseaux sociaux de manière fiable, et le HTML initial contient un **canonical figé sur `/`** (`index.html:26`) + un JSON-LD home dupliqué avec ce que recalcule `lib/seo.js`. Le partage d'une offre sur WhatsApp/LinkedIn (usage majoritaire en CI !) montrera systématiquement la carte de la home, jamais celle de l'offre — malgré votre excellent travail sur `offreSeo()`/`conseilSeo()`.

Correctif structurel recommandé (par ordre de coût) :
1. **Minimal** : garder la SPA, mais générer les métadonnées par route à l'edge (middleware Vercel qui réécrit le HTML de `/offres/:id` et `/conseils/:slug` en interrogeant l'API — ~50 lignes).
2. **Recommandé à terme** : migrer le site public vers Next.js (SSG/ISR) — vos adapters (`offers-adapter.js`, `conseil-detail.tools.js`) sont déjà découplés et se portent tels quels.

**🟠 P1-4 — `sitemap.xml` statique et périmé** (`lastmod 2026-07-26`). Il doit être généré depuis l'API (offres actives + articles). Avec FastAPI : une route `/sitemap.xml` côté server, et pointer Vercel dessus.

**🟡 P2-5 — Double source de vérité des métadonnées** (`index.html` vs `lib/seo.js`) : les descriptions divergent déjà (`index.html:31` ≠ `og:description:36`). Factoriser : garder dans `index.html` uniquement le strict minimum (charset, viewport, theme-color, favicon), laisser `Seo.jsx` gérer le reste, et supprimer le JSON-LD dupliqué.

**Piège à surveiller** : `ScrollToTop` (App.jsx:25) force un scroll top à chaque changement de `pathname` — vos ancres `SommaireFlottant` utilisent-elles des hash ? Si oui, distinguer `pathname` de `location.key`.

---

## Pilier 2 — Design System, UI & UX (vs `index.css`)

Votre `index.css` est **bien construit** (tokens Material + pont shadcn propre, échelle radius fixe assumée). Trois écarts réels :

**🔴 P0-6 — Contraste AA raté sur le CTA principal.** `--primary: #f5a623` avec `--primary-foreground: #ffffff` (`index.css:169-170`) : ratio ≈ **2.1:1**, fail WCAG AA (requis 4.5:1). Idem dans le formulaire d'inscription, `Registered/index.jsx:150` : `bg-brand-orange ... text-white`. Correctifs :
- texte **navy `#0F2D4D` sur orange** → ratio ≈ 6.3:1 ✅ (c'est d'ailleurs ce que fait votre dark mode avec `--primary-foreground: #291800`)
- ou assombrir l'orange des surfaces interactives vers `#B45309`/`#8A5A00` pour du texte

**🟠 P1-7 — Dark mode : déclaré partout, utilisé nulle part.** `.dark` est entièrement défini (`index.css:208-248`), `@custom-variant dark` existe… mais aucun toggle, aucune détection, et `index.html:8` force `color-scheme: light`. Pendant ce temps, les pages codent **`bg-white` en dur** (`OfferCard.jsx:96`, `Registered/index.jsx:101`, `CompanyHover.jsx:29`…) et des couleurs hors tokens comme `text-[#B45309]` (`OfferCard.jsx:91`). Décision à prendre : soit livrer le dark mode (remplacer tous les `bg-white` par `bg-card`, les hex par des tokens), soit supprimer `.dark` pour éviter un thème fantôme à moitié cassé.

**🟠 P1-8 — Reduced motion non global.** Framer Motion anime partout (cartes, ticker/marquee infini `--animate-marquee`) mais `prefers-reduced-motion` n'est respecté que dans Hero et BootLoader. Un `MotionConfig reducedMotion="user"` en racine d'App règle 90 % du problème en une ligne.

**🟡 P2-9 — Accessibilité ponctuelle** : les boutons du stepper (`Registered/index.jsx:132-150`) n'ont pas de style `focus-visible` explicite (le vôtre existe sur BackToTop — généralisez-le via `@layer base` sur `button` et `a`). `CompanyHover` : information clé (« Recrute via X ») inaccessible au tactile → prévoir affichage inline mobile.

---

## Pilier 3 — Data Fetching, State & API

Architecture globalement **solide** : adapters défensifs (`offers-adapter.js` ne casse jamais sur relation manquante ✓), query keys centralisés par page, contexts dédiés, ErrorBoundary par section (`Offres/index.jsx:19`), cache TanStack bien réglé (`queryClient.js` : staleTime 5 min, gcTime 30 min).

Mais deux bugs réels :

**🔴 P0-10 — La gestion du 409 « email déjà inscrit » est morte.** `api/errors.js` : `formatApiError` renvoie une **string** (ou `null` si requête annulée). Or `contexts/Registered.context.jsx` (~ligne 165) fait :

```js
const formatted = formatApiError(err)
if (formatted.status === 409) {        // ← undefined, toujours false
```
Résultat : l'utilisateur existant voit le message générique, jamais le message 409. Et si `err` est une annulation, `formatted` vaut `null` → `formatted.message` **throw**. Correctif :

```js
} catch (err) {
  if (isCanceledError(err)) return
  if (err?.response?.status === 409) {
    setApiError("Cet email est déjà inscrit...")
  } else {
    setApiError(formatApiError(err) || "Une erreur est survenue...")
  }
}
```

**🔴 P0-11 — `unsubscribe` envoie les params dans le body.** `api/public/subscriptions.js` :
```js
api.post(`${API_URL}/unsubscribe/${token}`, { params: cleanParams(params) })
```
Cela poste `{ params: {...} }` comme corps JSON. Si le backend attend des query params (comme partout ailleurs), c'est :
```js
api.post(`${API_URL}/unsubscribe/${token}`, {}, { params: cleanParams(params) })
```
À vérifier contre le schéma FastAPI, mais la forme actuelle est suspecte.

**🟡 P2-12** : `withCredentials: true` global (`axiosInstance.js`) — inutile pour un site public sans cookies, et contraignant côté CORS si l'API est séparée. À retirer sauf besoin réel. `client/src/api/api_responses.json` (~2000 lignes de fixtures) ne semble importé nulle part — à sortir de `src/api/` vers un dossier `fixtures/` pour éviter tout bundling accidentel.

---

## Pilier 4 — Performance & Core Web Vitals

**🔴 P1-13 — Bundle : 948 kB sur le chunk principal.** Causes identifiables :
1. **Aucun lazy-loading de route** — les 13 pages sont dans le chunk d'entrée. Seules 6 sections sont lazy (`Home/index.jsx:13-15`, etc.). Quick win massif :
   ```jsx
   const DetailsOffre = lazy(() => import("./Pages/DetailsOffre"))
   // + <Suspense fallback={<DetailSkeleton/>}> autour de <Routes>
   ```
2. **3 libs d'icônes** (`lucide-react` + `react-icons` + `@icons-pack/react-simple-icons`). `react-icons` importe des packs entiers si mal fait — consolidez sur lucide seul si possible.
3. `framer-motion` (≈40 kB gzip) utilisé jusque dans les OfferCard de liste — envisager CSS transitions pour les cartes répétées.

**🔴 P1-14 — Polices chargées deux fois.** `index.css:4-5` importe `@fontsource-variable/montserrat` + `inter` (auto-hébergées ✓), mais `index.html:60-66` charge **aussi** Google Fonts (Inter + Montserrat) **et Material Symbols Outlined** (que je ne vois utilisé nulle part — à confirmer puis supprimer). Supprimez les `<link>` Google Fonts : gain immédiat de 2 connexions tiers + risque de FOIT en double déclaration.

**🟡 P2-15 — Virtualisation** : `react-virtual` est installé mais inutilisé. Votre pagination infinie (`useInfiniteQuery` dans `offres.tools.js`) borne déjà le DOM — c'est acceptable jusqu'à quelques centaines de cartes ; si vous voulez tout charger, activez `useVirtualizer`. En attendant : retirer la dépendance.

**🟢 Bon point** : animations `whileInView once:true` sur les cartes, skeletons dédiés (`SkeletonsOffres.jsx`), images quasi absentes des listes (initiales textuelles) → LCP naturellement léger.

---

## Pilier 5 — Sécurité Frontend & Tokens

**🟢 Très bon état général** — le site public n'embarque aucune logique admin (les rôles `super_admin`/`gestionnaire_offres` vivent côté serveur, rien à guarder côté client).

- ✅ **Zéro `dangerouslySetInnerHTML`** dans tout `src/` — les blocks d'articles (`section.blocks[].content`) sont rendus en texte plat après nettoyage (`adapterSections`), et `source_text` n'est jamais injecté en HTML. Le risque XSS majeur des contenus scrapés est neutralisé par conception.
- ✅ Liens externes avec `rel="noopener noreferrer"` (`OfferCard.jsx:87`).
- 🟠 Token de confirmation dans l'URL (`/inscription/confirmation/:token`) : acceptable (pattern standard), mais assurez-vous côté API que : expiration courte, usage unique, et que `getPreferences/updatePreferences` par token ne fuient que les données du subscriber lui-même. Côté client, pensez à `history.replaceState` après validation pour ne pas laisser le token dans l'historique.
- 🟡 Vérifiez que `POST /unsubscribe/:token` (cf. P0-11) valide bien le token avant toute action.

---

## Pilier 6 — UX Spécifique

**Parcours d'inscription** : très soigné (stepper animé, max 3 filières enforce côté state ✓, préremplissage depuis l'URL `?filieres=...&email=...` ✓, scroll auto entre étapes ✓) — **mais le 409 est cassé (P0-10)**, c'est LE parcours critique à réparer.

**Affichage des offres — trous de données métier** :
- 🔴 **Le salaire n'est jamais affiché** alors que `salary_raw` existe en base (`server/schemas/offers.py:81`) et figure même dans vos fixtures. Pour un job board ivoirien où le salaire est un critère n°1, c'est le manque le plus visible. Correctif : mapper `salaire: raw.salary_raw ?? null` dans `offers-adapter.js:44` et l'afficher dans les chips méta de `OfferCard`.
- 🟠 `application_deadline_at` (date limite de candidature) également disponible côté API, jamais exploitée.
- 🟠 `CompanyHover.jsx:22` affiche `"Recrute via {offre.source}"` → le **code brut** (`goafrica`) au lieu de `offre.sourceLabel`.
- 🟡 `company.logo_url` disponible mais non utilisé (vos initiales navy sont un bon fallback — utilisez le logo avec fallback initiales).

**Lecture d'articles** : très bien traité — sections avec ancres, `key_figures` → stats triées par position, `takeaways` → « à retenir », sommaire flottant avec progression. Rien à redire de structurel.

---

## Pilier 7 — Qualité du Code

**Structure** : claire et cohérente (`Pages/`, `components/{ui,shared,layouts,seo}`, `contexts/`, `tools/`, `lib/`, `api/public/`). `OfferCard` est effectivement réutilisé sur 5 surfaces ✓.

Points de dette :
- **19 erreurs ESLint** à éradiquer : imports morts (`lib/filiere-theme.js:2-27`), `setState` synchrone dans effect (`hooks/use-mobile.js:14`), assignements inutiles (`tools/registered.tools.js:68-69`).
- **Duplication** : `Pages/Offres/sections/OffersFeed.jsx` vs `Pages/Home/components/OffersFeed.jsx` — à comparer et fusionner dans `components/shared/`.
- Naming : `tools/` contient en réalité des hooks + query keys — renommer `hooks/` (ou `features/`) alignerait la convention.
- Typon dans un JSX : `Offres/index.jsx:33` — un `.` orphelin en début de ligne (`." </div>`) qui se retrouve rendu dans l'ErrorBoundary.

---

## Récapitulatif des correctifs prioritaires

| # | Gravité | Fix | Fichier |
|---|---|---|---|
| 1 | 🔴 | Gestion 409 inscription + crash sur erreur annulée | `Registered.context.jsx`, `errors.js` |
| 2 | 🔴 | Route `*` 404 | `App.jsx` |
| 3 | 🔴 | Loaders ignorés → `createBrowserRouter` ou prefetch direct | `App.jsx` |
| 4 | 🔴 | Supprimer Google Fonts dupliqué (+ Material Symbols ?) | `index.html` |
| 5 | 🔴 | CTA orange/blanc → orange/navy | `index.css`, `Registered/index.jsx` |
| 6 | 🟠 | `unsubscribe` : params en query string | `subscriptions.js` |
| 7 | 🟠 | Afficher salaire + deadline + `sourceLabel` | `offers-adapter.js`, `OfferCard.jsx`, `CompanyHover.jsx` |
| 8 | 🟠 | Lazy-load des routes | `App.jsx` |
| 9 | 🟠 | Décision dark mode : livrer ou supprimer | `index.css`, pages |
| 10 | 🟡 | Sitemap dynamique, lint zéro, `MotionConfig`, fusion OffersFeed | divers |
