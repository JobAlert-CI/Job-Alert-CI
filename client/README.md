# Client JobAlert CI

Frontend React (SPA) du site public JobAlert CI : consultation des offres d'emploi, filières, conseils, sources et inscription à la newsletter.

## Stack

- **Vite 8** + **React 19** (JavaScript, pas de TypeScript)
- **React Router v7** (`BrowserRouter`, routes avec `loader` de prefetch)
- **TanStack Query v5** — cache et fetching des appels API
- **Tailwind CSS v4** via `@tailwindcss/vite` (pas de `tailwind.config.js`, config dans `src/index.css`)
- **shadcn/ui** (`components.json`, primitives dans `src/components/ui`) + Base UI, Radix-style
- **Axios** pour les appels HTTP

## Commandes

```powershell
npm install
npm run dev        # dev server sur :5173 (port strict, host ouvert)
npm run build      # build de prod → dist/
npm run preview    # sert le build
npm run lint       # ESLint (flat config, eslint.config.js)
```

## Configuration

- Développement : aucun `.env` requis. Le dev server proxifie `/api` vers `http://localhost:8000` (voir `vite.config.js`). L'API backend doit tourner.
- Production : `VITE_API_URL` et `VITE_SITE_URL` dans `.env.production`.
  - `VITE_API_URL` est la baseURL d'axios (`src/api/axiosInstance.js`) ; vide en dev → les appels passent par le proxy Vite.

## Structure de `src/`

```
api/            Couche réseau
  axiosInstance.js   instance axios (baseURL = VITE_API_URL, withCredentials)
  public/            un module par domaine API : offers, filieres, articles,
                     contact, subscriptions, sources, stats, referentials
  errors.js          gestion normalisée des erreurs API
components/
  ui/                primitives shadcn (button, badge, drawer, accordion…)
  shared/            composants métier réutilisables (cartes offres, filtres,
                     skeletons…) + filters/ (drawer de filtres, calendrier…)
  layouts/           Header, Footer
  seo/Seo.jsx        balises meta par page
contexts/           Contextes React par page (état local partagé page-level)
data/               constantes métier (constanteMetier.js) et données statiques
hooks/              hooks maison (use-mobile, use-url-filters,
                    use-recherche-debouncee…)
Pages/              une page = un dossier ; pages de support dans Pages/Support/
tools/              fonctions de chargement/parsing par page (home.tools.js,
                    offres.tools.js…) — utilisées comme loaders React Router
```

## Routing

Routes déclarées dans `src/App.jsx`, toutes imbriquées sous un `Layout` commun (Header + Footer). Principales :

| Route | Page |
|---|---|
| `/` | Home |
| `/offres`, `/offres/:id` | Liste et détail des offres |
| `/filieres`, `/filieres/:filiere` | Filières |
| `/conseils`, `/conseils/:slug` | Articles / conseils |
| `/sources` | Sources de collecte |
| `/inscription`, `/inscription/confirmation/:token` | Inscription newsletter + confirmation email |
| `/comment-ca-marche` | HowItWorks |
| `/contact`, `/faq`, `/mentions-legales` | Support |

Un `ScrollToTop` global remonte la fenêtre à chaque navigation.

## Conventions

- **Français partout** : noms de fichiers/composants (`BarreProgression`, `CarteArticle`), hooks (`use-glissement`), textes UI. Respecter cette convention.
- **Une page = un dossier dans `Pages/`** + un contexte éventuel dans `contexts/` + ses helpers dans `tools/`.
- Les appels API ne se font jamais directement dans les composants : passer par `src/api/public/*` (fonctions dédiées) et TanStack Query.
- Alias d'import `@/` → `src/` (configuré dans `vite.config.js` et `jsconfig.json`).
- Filtres d'offres synchronisés avec l'URL via `use-url-filters`.

## Lint & vérifications

```powershell
npm run lint      # avant tout commit côté client
npm run build     # vérifie que le bundle compile
```

Pas de tests automatisés côté client à ce jour.
