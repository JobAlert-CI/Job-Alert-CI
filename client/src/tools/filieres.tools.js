import { Mail, MousePointerClick, Radar } from "lucide-react"
import { useCallback, useEffect, useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { getFilieres } from "@/api/public/filieres"
import { getOffers } from "@/api/public/offers"
import { getGlobalSats, getOfferSatsBySource } from "@/api/public/stats"
import { useUrlFilters } from "@/hooks/use-url-filters"
import getFiliereTheme from "@/lib/filiere-theme"

export const TICKER_LIMIT = 24
export const TOP_FILIERES_COUNT = 3
export const DEBOUNCE_MS = 350
export const SORT_MODES = ["volume", "az"]

/** Filtres ↔ URL : /filieres?tri=volume&q=tech */
export const CONFIG_FILTRES = {
  scalars: [
    { key: "sort", param: "tri", defaut: "volume" },
    { key: "query", param: "q", defaut: "" },
  ],
}

export const ETAPES_MECHANIQUE = [
  {
    icon: MousePointerClick,
    titre: "Je choisis 1 à 3 filières",
    texte: "À l'inscription, en 2 minutes. Aucun mot de passe requis.",
  },
  {
    icon: Radar,
    titre: "On scanne 4 sources chaque nuit",
    texte: "EmploiDakar CI, GoAfrica, Novojob et LinkedIn, dédoublonnées par hash.",
  },
  {
    icon: Mail,
    titre: "Je reçois mon récap à 8h00",
    texte: "Les offres de mes filières, rien que ça. Désinscription en 1 clic.",
  },
]

/* ════════════════════════════════════════════════════════════════════
   ADAPTATEUR API → UI (FILIÈRES)
   Le backend retourne FiliereWithStats. On produit l'objet attendu par
   FiliereCard (icon, hue, bar, tile, actives, nouvelles, abonnes…).
   Tout est défensif : une relation manquante ne casse jamais le rendu.
════════════════════════════════════════════════════════════════════ */
export const adaptFiliere = (raw) => {
  if (!raw || typeof raw !== "object") return null
  const theme = getFiliereTheme(raw.code)
  const stats = raw.stats || {}
  return {
    id: raw.id,
    code: raw.code,
    slug: raw.slug || raw.code,
    label: raw.label || raw.code,
    tagline: raw.tagline || "",
    description: raw.description || "",
    icon: theme.icon,
    hue: raw.hue,
    bar: theme.bar,
    tile: theme.tile,
    tileHover: theme.tileHover,
    hover: theme.hover,
    actives: Number(stats.active_offers ?? 0),
    nouvelles: Number(stats.new_offers ?? 0),
    abonnes: Number(stats.subscribers ?? 0),
    keywords: Array.isArray(raw.specialties)
      ? raw.specialties
          .filter((s) => s && s.is_active !== false)
          .map((s) => (s.label || s.code || "").toLowerCase())
          .filter(Boolean)
      : [],
    sort_order: Number(raw.sort_order ?? 99),
    is_active: raw.is_active !== false,
  }
}

export const adaptFilieres = (list) =>
  (Array.isArray(list) ? list : [])
    .map(adaptFiliere)
    .filter(Boolean)
    .filter((f) => f.is_active)

/* ─── Sources pour le panneau de collecte ───
   Corrigé : les buckets bruts exposent total_offers/new_offers,
   le panneau lit total/nouveaux → l'adaptation est indispensable. */
export const adaptSourceStat = (s) => {
  if (!s) return null
  return {
    code: s.code,
    label: s.label || s.name || s.code,
    total: Number(s.total_offers ?? 0),
    nouveaux: Number(s.new_offers ?? 0),
    color_hex: s.color_hex,
  }
}

export const adaptSourceStats = (list) =>
  (Array.isArray(list) ? list : []).map(adaptSourceStat).filter(Boolean)



/** Top N filières par volume d'offres actives (codes). */
export const computeTop3 = (filieres, limit = TOP_FILIERES_COUNT) =>
  [...filieres]
    .sort((a, b) => b.actives - a.actives)
    .slice(0, limit)
    .map((f) => f.code)

/** Recherche pure sur label / tagline / mots-clés. */
export const filterFilieres = (filieres, query) => {
  const q = (query ?? "").trim().toLowerCase()
  if (!q) return filieres
  return filieres.filter(
    (f) =>
      f.label.toLowerCase().includes(q) ||
      f.tagline.toLowerCase().includes(q) ||
      f.keywords.some((k) => k.includes(q))
  )
}

/** Tri pur : volume d'offres actives ou alphabétique. */
export const sortFilieres = (filieres, sort) => {
  const list = [...filieres]
  if (sort === "az") return list.sort((a, b) => a.label.localeCompare(b.label, "fr"))
  return list.sort((a, b) => b.actives - a.actives)
}

/**
 * Répartition cartes larges (top 3, sans recherche) / compactes.
 * Corrigé : Set + un seul passage → O(n) au lieu de `includes` → O(n²).
 */
export const splitLargeCompact = (filieres, top3Codes, hasQuery) => {
  const topSet = new Set(top3Codes)
  const large = []
  const compact = []
  filieres.forEach((f) => {
    if (!hasQuery && topSet.has(f.code)) large.push(f)
    else compact.push(f)
  })
  return { large, compact }
}


/* ════════════════════════════════════════════════════════════════════
   CLÉS DE CACHE — préfixées par domaine : des requêtes identiques
   (stats globales, stats par source, ticker) sont partagées entre
   pages au lieu d'être re-fetchées à chaque navigation.
════════════════════════════════════════════════════════════════════ */
export const filieresKeys = {
  root: ["filieres"],
  liste: ["filieres", "liste"],
  statsGlobal: ["stats", "global"],
  statsParSource: ["stats", "offers", "by-source"],
  ticker: ["offers", "ticker", { limit: TICKER_LIMIT, sort: "recent" }],
}

/* ─────────────── Liste des filières ─────────────── */
export const useFilieresQuery = () =>
  useQuery({
    queryKey: filieresKeys.liste,
    queryFn: getFilieres,
    staleTime: 10 * 60 * 1000,
    placeholderData: [],
  })

/** Filières adaptées + mémoïsées — consommées par le SEO, le héro et la grille. */
export const useFilieresAdapted = () => {
  const query = useFilieresQuery()
  const filieres = useMemo(() => adaptFilieres(query.data), [query.data])
  return { ...query, filieres }
}

/* ─────────────── Statistiques globales (compteurs du héro) ─────────────── */
export const useGlobalStatsQuery = () =>
  useQuery({
    queryKey: filieresKeys.statsGlobal,
    queryFn: getGlobalSats,
    staleTime: 5 * 60 * 1000,
    placeholderData: { active_offers: 0, new_today: 0, subscribers: 0, sources: 0 },
  })

/* ─────────────── Stats par source (panneau de collecte) ─────────────── */
export const useStatsParSourceQuery = () =>
  useQuery({
    queryKey: filieresKeys.statsParSource,
    queryFn: () => getOfferSatsBySource(),
    staleTime: 5 * 60 * 1000,
    placeholderData: [],
  })

/* ─────────────── Ticker d'offres récentes ───────────────
   signal transmis → annulation automatique si l'utilisateur quitte la page. */
export const useTickerOffersQuery = () =>
  useQuery({
    queryKey: filieresKeys.ticker,
    queryFn: ({ signal }) =>
      getOffers({ limit: TICKER_LIMIT, sort: "recent" }, { signal }),
    staleTime: 5 * 60 * 1000,
    placeholderData: [],
  })


/**
 * Logique de filtrage centralisée :
 * · tri + recherche pilotés par l'URL → état partageable et conservé au refresh
 * · champ local réactif → URL debouncée (la frappe ne spamme pas l'historique)
 * · la recherche filtre instantanément la liste (retour immédiat à la frappe)
 */
export const useFilieresSearch = () => {
  const { valeurs, setScalar } = useUrlFilters(CONFIG_FILTRES)

  const sort = SORT_MODES.includes(valeurs.sort) ? valeurs.sort : "volume"
  const setSort = useCallback((mode) => setScalar("sort", mode), [setScalar])

  /* Champ local → URL debouncée */
  const [queryLocale, setQueryLocale] = useState(valeurs.query)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQueryLocale(valeurs.query)
  }, [valeurs.query])
  useEffect(() => {
    if (queryLocale === valeurs.query) return
    const timer = setTimeout(() => setScalar("query", queryLocale), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [queryLocale, valeurs.query, setScalar])

  const resetQuery = useCallback(() => setQueryLocale(""), [])

  /** Filtre + trie une liste — mémoïsé par (query, sort). */
  const applyTo = useCallback(
    (filieres) => sortFilieres(filterFilieres(filieres, queryLocale), sort),
    [queryLocale, sort]
  )

  return {
    queryLocale,
    setQueryLocale,
    resetQuery,
    sort,
    setSort,
    applyTo,
    hasQuery: queryLocale.trim().length > 0,
  }
}