// src/pages/home/home.constants.js
import { queryClient } from "@/lib/queryClient"
import { getOfferSats, getOfferSatsByFiliere } from "@/api/public/stats"
import { getOffers } from "@/api/public/offers"
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import getFiliereTheme from "@/lib/filiere-theme"

export const SCRAPE_TIME = "6h02"
export const EMAIL_DELIVERY_TIME = "8h00"
export const MAX_PREVIEW_OFFERS = 4
export const MAX_RECENT_OFFERS = 6
export const SOURCE_COUNT_FALLBACK = 4
export const FILIERE_STATS_LIMIT = 28

export const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
}

export const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
}


/**
 * Clés de requête centralisées : toute la page Home partage le même cache.
 * Chaque section appelle ces hooks → zéro prop drilling, zéro requête dupliquée
 * (TanStack déduplique automatiquement par queryKey).
 */
export const homeKeys = {
  root: ["home"],
  stats: ["home", "stats", "global"],
  filieres: ["home", "stats", "filieres"],
  offers: ["home", "offers", "recent", { limit: MAX_RECENT_OFFERS }],
}

export const useHomeStats = () =>
  useQuery({ queryKey: homeKeys.stats, queryFn: getOfferSats })

export const useFiliereStats = () =>
  useQuery({
    queryKey: homeKeys.filieres,
    queryFn: () => getOfferSatsByFiliere({ limit: FILIERE_STATS_LIMIT }),
  })

export const useRecentOffers = () =>
  useQuery({
    queryKey: homeKeys.offers,
    queryFn: () => getOffers({ limit: MAX_RECENT_OFFERS }),
  })

/** Stats filières + répartition dérivée (mémoïsée). */
export const useRepartition = () => {
  const query = useFiliereStats()
  const repartition = useMemo(
    () => buildRepartition(query.data),
    [query.data]
  )
  return { ...query, repartition }
}

/**
 * View-model des métriques dérivées de la Home.
 * Centralise la logique de repli (avant : ternaires dispersés dans 3 composants).
 */
export const useHomeMetrics = () => {
  const statsQuery = useHomeStats()
  const filieresQuery = useRepartition()

  const { data: stats, isPending: statsPending, isError: statsError } = statsQuery
  const { repartition, isPending: filieresPending, isError: filieresError } = filieresQuery

  const metrics = useMemo(() => {
    const statsReady = !statsPending && !statsError
    const filieresReady = !filieresPending && !filieresError

    const newOffersCount = statsReady ? stats?.new_offers ?? null : null
    const totalOffersCount = statsReady ? stats?.total_offers ?? null : null

    return {
      newOffersCount,
      countForTitle:
        newOffersCount ?? (filieresReady ? repartition.totalMetric : null),
      bigNumber:
        newOffersCount ??
        totalOffersCount ??
        (filieresReady ? repartition.totalMetric : 0),
    }
  }, [stats, statsPending, statsError, repartition, filieresPending, filieresError])

  return {
    statsQuery,
    filieresQuery,
    repartition,
    refetchFilieres: filieresQuery.refetch,
    ...metrics,
  }
}

/**
 * À utiliser comme loader de route (react-router) pour "chauffer" le cache
 * avant même le rendu de la page → premier paint avec données disponibles.
 * Exemple : { path: "/", element: <Home />, loader: prefetchHome }
 */
export const prefetchHome = () => {
  queryClient.prefetchQuery({ queryKey: homeKeys.stats, queryFn: getOfferSats })
  queryClient.prefetchQuery({
    queryKey: homeKeys.filieres,
    queryFn: () => getOfferSatsByFiliere({ limit: FILIERE_STATS_LIMIT }),
  })
  queryClient.prefetchQuery({
    queryKey: homeKeys.offers,
    queryFn: () => getOffers({ limit: MAX_RECENT_OFFERS }),
  })
  return null
}


/** Nombre de filières ayant reçu de nouvelles offres (proxy "sources actives"). */
export const getActiveSourcesCount = (statsFil) =>
  Array.isArray(statsFil)
    ? statsFil.filter((filiere) => (filiere?.new_offers ?? 0) > 0).length
    : 0

/** Nombre de sources affiché, avec repli si les données ne sont pas exploitables. */
export const resolveSourceCount = (statsFil, { isPending, isError }) => {
  const active = getActiveSourcesCount(statsFil)
  return !isPending && !isError && active > 0 ? active : SOURCE_COUNT_FALLBACK
}

/** Construit la répartition top 6 pour le panneau latéral. */
export const buildRepartition = (statsFil) => {
  const rows = Array.isArray(statsFil) ? statsFil : []
  const hasNewOffers = rows.some((row) => (row?.new_offers ?? 0) > 0)

  const items = rows
    .map((row) => {
      const theme = getFiliereTheme(row?.code)
      const count = hasNewOffers ? row?.new_offers ?? 0 : row?.total_offers ?? 0
      return {
        id: row?.id ?? row?.code ?? row?.label,
        code: row?.code,
        label: row?.label ?? "Filière",
        count,
        color: theme.bar,
      }
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  const max = Math.max(...items.map((item) => item.count), 1)
  const totalMetric = rows.reduce(
    (acc, row) =>
      acc + (hasNewOffers ? row?.new_offers ?? 0 : row?.total_offers ?? 0),
    0
  )

  return {
    mode: hasNewOffers ? "new" : "total",
    totalMetric,
    items: items.map((item) => ({
      ...item,
      pct: Math.max(8, Math.round((item.count / max) * 100)),
    })),
  }
}

/**
 * Retourne un état de vue unique — remplace toutes les combinaisons
 * isPending / isError dispersées dans les composants.
 * @returns {"loading" | "degraded" | "ready"}
 */
export const getViewState = (queries) => {
  if (queries.some((query) => query.isPending)) return "loading"
  if (queries.some((query) => query.isError)) return "degraded"
  return "ready"
}