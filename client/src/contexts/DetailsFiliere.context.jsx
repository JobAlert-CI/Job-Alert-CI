// src/pages/filieres/detail/filiere-detail.context.jsx
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react"
import { useParams } from "react-router-dom"
import { useUrlFilters } from "@/hooks/use-url-filters"
import { HUES, BRAND_HUE } from "@/lib/hues"
import { mergeOffers } from "@/lib/offers-adapter"
import { SORTS } from "@/lib/referentiels"
import {
  buildEntrepriseCounts, buildFeedItems, getPeriodLabel, getLocationLabel, labelOf,
} from "@/lib/offres-helpers"
import { useReferentialsQuery } from "@/lib/referentiels-query"
import { 
  CONFIG_FILTRES, 
  adaptFiliere, 
  adaptFiliereOffers,
  useFiliereFeedQuery, 
  useFiliereQuery,
  buildApiParams, 
  buildScopedCounts, 
  filterOffers
} from "@/tools/filiere-detail.tools"

/* ════════════════════════════════════════════════════════════════════
   CONTEXTE DE PAGE — chaque section lit la filière, les filtres et le
   flux ici : zéro prop drilling. La frappe clavier vit dans la barre
   de filtres, donc elle ne re-rend jamais le héro ni le flux.
════════════════════════════════════════════════════════════════════ */
const FiliereDetailContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useFiliereDetail = () => {
  const ctx = useContext(FiliereDetailContext)
  if (!ctx) throw new Error("useFiliereDetail doit être utilisé sous <FiliereDetailProvider>")
  return ctx
}

export const FiliereDetailProvider = ({ children }) => {
  const { filiere: slug } = useParams()

  /* ── Filière ── */
  const filiereQuery = useFiliereQuery(slug)
  const meta = useMemo(() => adaptFiliere(filiereQuery.data), [filiereQuery.data])
  const hue = meta ? HUES[meta.hue] || BRAND_HUE : BRAND_HUE

  /* ── Référentiels — cache partagé avec /offres ── */
  const referentialsQuery = useReferentialsQuery()
  const refs = referentialsQuery.data

  /* ── Filtres URL (état commité uniquement) ── */
  const { filters, valeurs, toggle, setScalar, setPeriod, reset } = useUrlFilters(CONFIG_FILTRES)
  const sort = SORTS.some((s) => s.k === valeurs.sort) ? valeurs.sort : "recent"
  const view = valeurs.view === "grid" ? "grid" : "list"
  const locationId = valeurs.location || null

  const setSort = useCallback((k) => setScalar("sort", k), [setScalar])
  const setView = useCallback((v) => setScalar("view", v), [setScalar])
  const setLocation = useCallback((id) => setScalar("location", id ?? ""), [setScalar])
  const resetTout = useCallback(() => reset(), [reset])

  /* ── Flux paginé + logique de filtrage corrigée ── */
  const apiParams = useMemo(
    () => buildApiParams({
      meta, refs, filters, sort, locationId,
      query: valeurs.query, period: filters.period,
    }),
    [meta, refs, filters, sort, locationId, valeurs.query]
  )
  const feedQuery = useFiliereFeedQuery(slug, apiParams)

  /* Pages → offres adaptées (avec code de spécialité) et dé-dupliquées */
  const offresChargees = useMemo(
    () =>
      (feedQuery.data?.pages ?? []).reduce(
        (acc, page) => mergeOffers(acc, adaptFiliereOffers(page)),
        []
      ),
    [feedQuery.data]
  )

  /* Multi-sélection garantie côté client */
  const filtered = useMemo(
    () => filterOffers(offresChargees, { filters, query: valeurs.query, locationId }),
    [offresChargees, filters, valeurs.query, locationId]
  )

  /* Dérivés O(n) mémoïsés */
  const counts = useMemo(() => buildScopedCounts(offresChargees), [offresChargees])
  const feedItems = useMemo(() => buildFeedItems(filtered, sort), [filtered, sort])
  const entrepriseCounts = useMemo(() => buildEntrepriseCounts(filtered), [filtered])

  /* Favoris locaux — réinitialisés à chaque filière
     (avant : ils persistaient d'une filière à l'autre) */
  const [saved, setSaved] = useState(() => new Set())
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSaved(new Set()) }, [slug])
  const toggleSave = useCallback((uid) => {
    setSaved((prev) => {
      const next = new Set(prev)
      next.has(uid) ? next.delete(uid) : next.add(uid)
      return next
    })
  }, [])

  const activeCount = useMemo(
    () =>
      filters.sources.size + filters.contrats.size + filters.experiences.size +
      filters.niveaux.size + filters.specialites.size +
      (locationId ? 1 : 0) +
      (filters.period.start || filters.period.end ? 1 : 0),
    [filters, locationId]
  )

  const value = useMemo(
    () => ({
      slug, meta, hue,
      filiereQuery, referentialsQuery, refs,
      filters, valeurs, toggle, setScalar, setPeriod, reset,
      sort, view, locationId,
      setSort, setView, setLocation, resetTout,
      activeCount,
      feedQuery, offresChargees, filtered,
      counts, feedItems, entrepriseCounts,
      saved, toggleSave,
    }),
    [slug, meta, hue, filiereQuery, referentialsQuery, refs, filters, valeurs,
     toggle, setScalar, setPeriod, reset, sort, view, locationId, setSort,
     setView, setLocation, resetTout, activeCount, feedQuery, offresChargees,
     filtered, counts, feedItems, entrepriseCounts, saved, toggleSave]
  )

  return (
    <FiliereDetailContext.Provider value={value}>
      {children}
    </FiliereDetailContext.Provider>
  )
}

/** Chips des filtres actifs — spécialités incluses (codes, pas labels). */
// eslint-disable-next-line react-refresh/only-export-components
export const useFiliereActiveChips = () => {
  const { filters, toggle, setLocation, setPeriod, locationId, meta, refs } = useFiliereDetail()

  return useMemo(() => {
    const chips = []
    filters.specialites.forEach((sp) => {
      const spMeta = meta?.specialites.find((s) => s.code === sp)
      chips.push({ key: `sp-${sp}`, label: spMeta?.label || sp, rm: () => toggle("specialites", sp) })
    })
    filters.sources.forEach((c) => chips.push({ key: `s-${c}`, label: labelOf(refs.sources, c), rm: () => toggle("sources", c) }))
    filters.contrats.forEach((c) => chips.push({ key: `c-${c}`, label: labelOf(refs.contrats, c), rm: () => toggle("contrats", c) }))
    filters.experiences.forEach((x) => chips.push({ key: `e-${x}`, label: labelOf(refs.experiences, x), rm: () => toggle("experiences", x) }))
    filters.niveaux.forEach((n) => chips.push({ key: `n-${n}`, label: labelOf(refs.niveaux, n), rm: () => toggle("niveaux", n) }))
    if (locationId) {
      chips.push({ key: "loc", label: getLocationLabel(refs.locations, locationId), rm: () => setLocation(null) })
    }
    if (filters.period.start) {
      chips.push({ key: "p", label: getPeriodLabel(filters.period), rm: () => setPeriod({ start: null, end: null }) })
    }
    return chips
  }, [filters, locationId, meta, refs, toggle, setLocation, setPeriod])
}