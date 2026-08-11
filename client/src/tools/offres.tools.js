import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { formatApiError } from "@/api/errors"
import { getOffers } from "@/api/public/offers"
import { useOffresFilters } from "@/contexts/Offres.context"
import {
  getOfferSats, getOfferSatsByContract, getOfferSatsByFiliere, getOfferSatsBySource,
} from "@/api/public/stats"
import { Radar, Fingerprint, Send } from "lucide-react"
import { useMemo} from "react"
import { adaptOffers, mergeOffers, toIsoEnd, toIsoStart } from "@/lib/offers-adapter"
import { settled } from "@/lib/query-helpers"
import { getLocationLabel } from "./offres.tools"
import { getPeriodLabel } from "./offres.tools"
import { labelOf } from "./offres.tools"
import { useOfferReferentialsQuery } from "./offres.tools"

export { useReferentialsQuery as useOfferReferentialsQuery } from "@/lib/referentiels-query"
export { labelOf, getPeriodLabel, getLocationLabel, buildEntrepriseCounts, buildFeedItems } from "@/lib/offres-helpers"

export const ABONNES = 10550
export const PAGE_SIZE = 12

/** Pipeline du matin affiché dans la FluxCard (décoratif). */
export const PIPELINE = [
  { icon: Radar, t: "06:02", l: "Collecte", done: true },
  { icon: Fingerprint, t: "06:04", l: "Dédoublonnage", done: true },
  { icon: Send, t: "08:00", l: "Envoi", done: false },
]

/** Filtres ↔ URL : /offres?fil=tech-dev&src=linkedin&loc=<uuid>&tri=az */
export const CONFIG_FILTRES = {
  sets: [
    { key: "filieres", param: "fil" },
    { key: "sources", param: "src" },
    { key: "contrats", param: "ct" },
    { key: "experiences", param: "exp" },
    { key: "niveaux", param: "niv" },
  ],
  scalars: [
    { key: "sort", param: "tri", defaut: "recent" },
    { key: "view", param: "vue", defaut: "list" },
    { key: "query", param: "q", defaut: "" },
    { key: "location", param: "loc", defaut: "" },
  ],
  period: { debut: "du", fin: "au" },
}


/* ════════════════════════════════════════════════════════════════════
   CLÉS DE CACHE — une seule source de vérité pour toute la page.
   Chaque section consomme ces hooks : zéro prop drilling, zéro requête
   dupliquée (TanStack déduplique par queryKey).
════════════════════════════════════════════════════════════════════ */
export const offresKeys = {
  root: ["offres"],
  referentials: ["offres", "referentials"],
  counts: ["offres", "counts"],
  overview: ["offres", "overview"],
  feed: (params) => ["offres", "feed", params],
}

/* ─────────────── Compteurs par option de filtre ─────────────── */
const toCountMap = (buckets) =>
  (Array.isArray(buckets) ? buckets : []).reduce((acc, b) => {
    if (b?.code) acc[b.code] = b.total_offers ?? 0
    return acc
  }, {})

export const useOfferCountsQuery = () =>
  useQuery({
    queryKey: offresKeys.counts,
    queryFn: async () => {
      const [byFiliere, bySource, byContract] = await Promise.allSettled([
        getOfferSatsByFiliere(),
        getOfferSatsBySource(),
        getOfferSatsByContract(),
      ])
      return {
        filieres: toCountMap(settled(byFiliere)),
        sources: toCountMap(settled(bySource)),
        contrats: toCountMap(settled(byContract)),
      }
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: { filieres: {}, sources: {}, contrats: {} },
  })

/* ─────────────── Vue d'ensemble (héro + FluxCard) ─────────────── */
export const useOffersOverviewQuery = () =>
  useQuery({
    queryKey: offresKeys.overview,
    queryFn: async () => {
      const [summary, bySource] = await Promise.allSettled([
        getOfferSats({ new_since_days: 1 }),
        getOfferSatsBySource({ new_since_days: 1 }),
      ])
      const s = summary.status === "fulfilled" ? summary.value : null
      return {
        total: s?.total_offers ?? 0,
        nouveaux: s?.new_offers ?? 0,
        parSource: settled(bySource).slice(0, 4).map((b) => ({
          code: b.code,
          label: b.label ?? b.code,
          total: b.total_offers ?? 0,
          nouveaux: b.new_offers ?? 0,
        })),
        error: summary.status === "rejected" ? formatApiError(summary.reason) : null,
      }
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: { total: 0, nouveaux: 0, parSource: [], error: null },
  })

/* ─────────────── Flux paginé — remplace useOffersFeed ───────────────
   · signal transmis à l'API → annulation automatique des requêtes obsolètes
     quand les filtres changent (remplace AbortController + requestId)
   · keepPreviousData → l'ancienne liste reste affichée pendant le
     changement de filtres : pas de flash de squelettes                  */
export const useOffersFeedQuery = (params) =>
  useInfiniteQuery({
    queryKey: offresKeys.feed(params),
    queryFn: ({ pageParam, signal }) =>
      getOffers(
        { ...params, limit: PAGE_SIZE, offset: pageParam * PAGE_SIZE },
        { signal }
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      Array.isArray(lastPage) && lastPage.length === PAGE_SIZE
        ? allPages.length
        : undefined,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })



/* ════════════════════════════════════════════════════════════════════
   ÉTAT DE PAGE — filtres (URL) + view-models dérivés.
   Le contexte ne contient que l'état COMMITÉ : la frappe clavier vit
   dans la barre de filtres, donc elle ne re-rend jamais le feed.
════════════════════════════════════════════════════════════════════ */


/** Paramètres API sérialisés — une seule identité par combinaison de filtres. */
export const useApiParams = () => {
  const { filters, valeurs, sort, locationId } = useOffresFilters()
  return useMemo(() => {
    const q = valeurs.query.trim()
    return {
      sort,
      filieres: [...filters.filieres],
      sources: [...filters.sources],
      contrats: [...filters.contrats],
      experiences: [...filters.experiences],
      niveaux: [...filters.niveaux],
      location_id: locationId || undefined,
      q: q.length >= 2 ? q : undefined,
      published_since: toIsoStart(filters.period.start),
      published_until: toIsoEnd(filters.period.end),
    }
  }, [filters, valeurs.query, sort, locationId])
}

/**
 * View-model du feed : pages → offres adaptées & dé-dupliquées.
 * Consommé par le SEO, la barre de filtres et le flux — le cache
 * garantit qu'une seule requête part, quel que soit le nombre d'usages.
 */
export const useOffresFeedModel = () => {
  const params = useApiParams()
  const query = useOffersFeedQuery(params)
  const {
    data, isPending, isError, error,
    isFetchingNextPage, isPlaceholderData,
    fetchNextPage, refetch,
  } = query

  const offers = useMemo(
    () =>
      (data?.pages ?? []).reduce(
        (acc, page) => mergeOffers(acc, adaptOffers(page)),
        []
      ),
    [data]
  )

  return {
    offers,
    isLoading: isPending,
    /** Changement de filtres : l'ancienne liste reste affichée (fluidité). */
    isSwitching: isPlaceholderData,
    isLoadingMore: isFetchingNextPage,
    hasMore: query.hasNextPage,
    error: isError ? formatApiError(error) : null,
    loadMore: fetchNextPage,
    reload: refetch,
  }
}

/** Chips des filtres actifs — consomme contexte + cache, zéro prop. */
export const useActiveChips = () => {
  const { filters, toggle, setLocation, setPeriod, locationId } = useOffresFilters()
  const { data: refs } = useOfferReferentialsQuery()

  return useMemo(() => {
    const chips = []
    filters.filieres.forEach((c) => chips.push({ key: `f-${c}`, label: labelOf(refs.filieres, c), rm: () => toggle("filieres", c) }))
    filters.sources.forEach((c) => chips.push({ key: `s-${c}`, label: labelOf(refs.sources, c), rm: () => toggle("sources", c) }))
    filters.contrats.forEach((c) => chips.push({ key: `c-${c}`, label: labelOf(refs.contrats, c), rm: () => toggle("contrats", c) }))
    filters.experiences.forEach((c) => chips.push({ key: `e-${c}`, label: labelOf(refs.experiences, c), rm: () => toggle("experiences", c) }))
    filters.niveaux.forEach((c) => chips.push({ key: `n-${c}`, label: labelOf(refs.niveaux, c), rm: () => toggle("niveaux", c) }))
    if (locationId) {
      chips.push({ key: "loc", label: getLocationLabel(refs.locations, locationId), rm: () => setLocation(null) })
    }
    if (filters.period.start) {
      chips.push({ key: "p", label: getPeriodLabel(filters.period), rm: () => setPeriod({ start: null, end: null }) })
    }
    return chips
  }, [filters, locationId, refs, toggle, setLocation, setPeriod])
}