import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { formatApiError, isCanceledError } from "@/api/errors"
import { getOffers } from "@/api/public/offers"
import {
  getContractTypes, getEducationLevels, getExperienceLevels,
  getFilieres, getLocations, getSources,
} from "@/api/public/referentials"
import {
  getOfferSats, getOfferSatsByContract, getOfferSatsByFiliere, getOfferSatsBySource,
} from "@/api/public/stats"
import { adaptOffers, mergeOffers } from "@/lib/offers-adapter"
import {
  CONTRATS, EXPERIENCES, FILIERES_META, NIVEAUX, SOURCES,
} from "@/lib/referentiels"

/* ════════════════════════════════════════════════════════════════════
  HOOKS DONNÉES — page Offres
  · toutes les requêtes sont annulables (AbortController)
  · une réponse obsolète est ignorée (garde par requestId)
  · échec partiel = repli sur les constantes locales, jamais d'écran blanc
════════════════════════════════════════════════════════════════════ */

const settled = (result, fallback = []) =>
  result?.status === "fulfilled" && Array.isArray(result.value) ? result.value : fallback

const FALLBACK = {
  filieres: FILIERES_META.map((f) => ({ code: f.code, label: f.label, hue: f.hue })),
  sources: SOURCES.map((s) => ({ code: s.code, label: s.code })),
  contrats: CONTRATS.map((c) => ({ code: c, label: c })),
  experiences: EXPERIENCES.map((x) => ({ code: x, label: x })),
  niveaux: NIVEAUX.map((n) => ({ code: n, label: n })),
  locations: [],
}

/* ─────────────────────────────── Référentiels (filtres) ─────────────────────────────── */
export const useOfferReferentials = () => {
  const [state, setState] = useState({ data: FALLBACK, isLoading: true, error: null, isFallback: true })

  const load = useCallback(async (signal) => {
    setState((s) => ({ ...s, isLoading: true, error: null }))
    const results = await Promise.allSettled([
      getFilieres(),
      getSources(),
      getContractTypes(),
      getExperienceLevels(),
      getEducationLevels(),
      getLocations(),
    ])
    if (signal?.aborted) return

    const failed = results.filter((r) => r.status === "rejected")
    const data = {
      filieres: settled(results[0], FALLBACK.filieres).map((f) => ({
        code: f.code, label: f.label ?? f.code, hue: f.hue ?? null, id: f.id ?? null,
      })),
      sources: settled(results[1], FALLBACK.sources).map((s) => ({
        code: s.code, label: s.name ?? s.code, id: s.id ?? null,
      })),
      contrats: settled(results[2], FALLBACK.contrats).map((c) => ({ code: c.code, label: c.label ?? c.code })),
      experiences: settled(results[3], FALLBACK.experiences).map((x) => ({ code: x.code, label: x.label ?? x.code })),
      niveaux: settled(results[4], FALLBACK.niveaux).map((n) => ({ code: n.code, label: n.label ?? n.code })),
      locations: settled(results[5], FALLBACK.locations).map((l) => ({
        id: l.id, label: l.label ?? l.city, city: l.city ?? "", isRemote: !!l.is_remote,
      })),
    }

    setState({
      data,
      isLoading: false,
      isFallback: failed.length === results.length,
      error: failed.length ? formatApiError(failed[0].reason) : null,
    })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  return { ...state, reload: () => load() }
}

/* ─────────────────────────────── Compteurs par option ─────────────────────────────── */
const toCountMap = (buckets) =>
  (Array.isArray(buckets) ? buckets : []).reduce((acc, b) => {
    if (b?.code) acc[b.code] = b.total_offers ?? 0
    return acc
  }, {})

export const useOfferCounts = () => {
  const [counts, setCounts] = useState({ filieres: {}, sources: {}, contrats: {} })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const run = async () => {
      const [byFiliere, bySource, byContract] = await Promise.allSettled([
        getOfferSatsByFiliere(),
        getOfferSatsBySource(),
        getOfferSatsByContract(),
      ])
      if (!alive) return
      setCounts({
        filieres: toCountMap(settled(byFiliere)),
        sources: toCountMap(settled(bySource)),
        contrats: toCountMap(settled(byContract)),
      })
      setIsLoading(false)
    }
    run()
    return () => { alive = false }
  }, [])

  return { counts, isLoading }
}

/* ─────────────────────────────── Vue d'ensemble (héro) ─────────────────────────────── */
export const useOffersOverview = () => {
  const [state, setState] = useState({ total: 0, nouveaux: 0, parSource: [], isLoading: true, error: null })

  useEffect(() => {
    let alive = true
    const run = async () => {
      const [summary, bySource] = await Promise.allSettled([
        getOfferSats({ new_since_days: 1 }),
        getOfferSatsBySource({ new_since_days: 1 }),
      ])
      if (!alive) return
      const s = summary.status === "fulfilled" ? summary.value : null
      const buckets = settled(bySource)
      setState({
        total: s?.total_offers ?? 0,
        nouveaux: s?.new_offers ?? 0,
        parSource: buckets.slice(0, 4).map((b) => ({
          code: b.code,
          label: b.label ?? b.code,
          total: b.total_offers ?? 0,
          nouveaux: b.new_offers ?? 0,
        })),
        isLoading: false,
        error: summary.status === "rejected" ? formatApiError(summary.reason) : null,
      })
    }
    run()
    return () => { alive = false }
  }, [])

  return state
}

/* ─────────────────────────────── Flux paginé ───────────────────────────────
  params : objet sérialisable de filtres API (déjà nettoyé côté page).
  Retourne : offres cumulées, statuts fins, hasMore, loadMore, reload.
──────────────────────────────────────────────────────────────────────────── */
export const useOffersFeed = ({ params, pageSize = 12 }) => {
  const paramsKey = useMemo(() => JSON.stringify(params ?? {}), [params])
  const requestId = useRef(0)
  const controllers = useRef(new Set())

  const [state, setState] = useState({
    offers: [],
    isLoading: true,
    isLoadingMore: false,
    error: null,
    hasMore: false,
    loadedPages: 0,
  })

  const fetchPage = useCallback(async ({ page, append }) => {
    const id = ++requestId.current
    const controller = new AbortController()
    controllers.current.add(controller)

    setState((s) => ({
      ...s,
      error: null,
      isLoading: append ? s.isLoading : true,
      isLoadingMore: append,
    }))

    try {
      const parsed = JSON.parse(paramsKey)
      const data = await getOffers(
        { ...parsed, limit: pageSize, offset: page * pageSize },
        { signal: controller.signal },
      )
      if (id !== requestId.current) return
      const batch = adaptOffers(data)
      setState((s) => ({
        offers: append ? mergeOffers(s.offers, batch) : batch,
        isLoading: false,
        isLoadingMore: false,
        error: null,
        hasMore: batch.length === pageSize,
        loadedPages: page + 1,
      }))
    } catch (err) {
      if (isCanceledError(err) || id !== requestId.current) return
      setState((s) => ({
        ...s,
        offers: append ? s.offers : [],
        isLoading: false,
        isLoadingMore: false,
        error: formatApiError(err),
      }))
    } finally {
      controllers.current.delete(controller)
    }
  }, [paramsKey, pageSize])

  /* Rechargement à chaque changement de filtres / tri */
  useEffect(() => {
    fetchPage({ page: 0, append: false })
    return () => {
      controllers.current.forEach((c) => c.abort())
      controllers.current.clear()
    }
  }, [fetchPage])

  const loadMore = useCallback(() => {
    setState((s) => {
      if (s.isLoading || s.isLoadingMore || !s.hasMore) return s
      fetchPage({ page: s.loadedPages, append: true })
      return s
    })
  }, [fetchPage])

  const reload = useCallback(() => fetchPage({ page: 0, append: false }), [fetchPage])

  return { ...state, loadMore, reload, pageSize }
}
