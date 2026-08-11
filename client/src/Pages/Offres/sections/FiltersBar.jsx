// src/pages/offres/sections/FiltersBar.jsx
import { memo, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowUpDown, Briefcase, CalendarDays, Check, ChevronDown,
  GraduationCap, Layers, MapPin, Search, SlidersHorizontal, Sparkles, X, Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CheckRow, FilterPopover, FiltersDrawer, MiniCalendar, SourceLogo, ViewToggle,
} from "@/components/shared"
import { HUES, BRAND_HUE } from "@/lib/hues"
import { SORTS } from "@/lib/referentiels"
import useClickOutside from "@/hooks/use-click-outside"
import { 
  useOffresFeedModel,
  getLocationLabel, 
  getPeriodLabel,
  useOfferCountsQuery, 
  useOfferReferentialsQuery
} from "@/tools/offres.tools"
import { useOffresFilters } from "@/contexts/Offres.context"
import LocationPicker from "@/components/shared/filters/LocationPicker"
import OffresFilterGroups from "../components/OffresFilterGroups"

/* ════════════════════════════════════════════════════════════════════
   BARRE DE FILTRES STICKY
   · Desktop-first : la barre complète est le rendu de base (max-lg:hidden),
     la variante mobile est le déclassement (lg:hidden).
   · La frappe clavier vit ici (état local) → elle ne re-rend jamais
     le héro ni le flux.
════════════════════════════════════════════════════════════════════ */

/* Champ recherche partagé desktop / mobile */
const SearchField = memo(function SearchField({ value, onChange, className, placeholder }) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Rechercher une offre"
        className="h-9 w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest pl-9 pr-8 text-[13px] outline-none transition-all placeholder:text-muted-foreground/70 focus:border-brand-navy/50 focus:ring-2 focus:ring-brand-navy/10"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Effacer la recherche"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  )
})

/* Groupes d'options mémoïsés : ils ne re-rendent que sur changement de
   contexte (filtres commités) ou de cache — jamais à la frappe clavier. */
const FiliereOptions = memo(function FiliereOptions() {
  const { data: refs, isPending } = useOfferReferentialsQuery()
  const { data: counts } = useOfferCountsQuery()
  const { filters, toggle } = useOffresFilters()

  if (isPending && refs.filieres.length === 0) {
    return (
      <div className="max-h-72 overflow-y-auto pr-1" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="mb-1.5 h-8 w-full rounded-md" />)}
      </div>
    )
  }
  return (
    <div className="max-h-72 overflow-y-auto pr-1">
      {refs.filieres.map((f) => (
        <CheckRow
          key={f.code}
          checked={filters.filieres.has(f.code)}
          onToggle={() => toggle("filieres", f.code)}
          label={f.label}
          count={counts.filieres[f.code] ?? 0}
          lead={<span className={cn("size-2 shrink-0 rounded-full", (HUES[f.hue] ?? BRAND_HUE).dot)} aria-hidden />}
        />
      ))}
    </div>
  )
})

const SourceOptions = memo(function SourceOptions() {
  const { data: refs, isPending } = useOfferReferentialsQuery()
  const { data: counts } = useOfferCountsQuery()
  const { filters, toggle } = useOffresFilters()

  if (isPending && refs.sources.length === 0) {
    return (
      <div aria-hidden="true">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="mb-1.5 h-8 w-full rounded-md" />)}
      </div>
    )
  }
  return refs.sources.map((s) => (
    <CheckRow
      key={s.code}
      checked={filters.sources.has(s.code)}
      onToggle={() => toggle("sources", s.code)}
      label={s.label}
      count={counts.sources[s.code] ?? 0}
      lead={<SourceLogo code={s.code} className="size-5 rounded text-[8px]" />}
    />
  ))
})

const ContratOptions = memo(function ContratOptions() {
  const { data: refs } = useOfferReferentialsQuery()
  const { data: counts } = useOfferCountsQuery()
  const { filters, toggle } = useOffresFilters()
  return refs.contrats.map((c) => (
    <CheckRow
      key={c.code}
      checked={filters.contrats.has(c.code)}
      onToggle={() => toggle("contrats", c.code)}
      label={c.label}
      count={counts.contrats[c.code] ?? 0}
    />
  ))
})

const ExperienceOptions = memo(function ExperienceOptions() {
  const { data: refs } = useOfferReferentialsQuery()
  const { filters, toggle } = useOffresFilters()
  return refs.experiences.map((x) => (
    <CheckRow
      key={x.code}
      checked={filters.experiences.has(x.code)}
      onToggle={() => toggle("experiences", x.code)}
      label={x.label}
    />
  ))
})

const NiveauOptions = memo(function NiveauOptions() {
  const { data: refs } = useOfferReferentialsQuery()
  const { filters, toggle } = useOffresFilters()
  return refs.niveaux.map((n) => (
    <CheckRow
      key={n.code}
      checked={filters.niveaux.has(n.code)}
      onToggle={() => toggle("niveaux", n.code)}
      label={n.label}
    />
  ))
})

const FiltersBar = () => {
  const {
    filters, valeurs, setScalar, setPeriod,
    sort, view, locationId,
    setSort, setView, setLocation, resetTout, activeCount,
  } = useOffresFilters()
  const { data: refs, isPending: refsPending } = useOfferReferentialsQuery()
  const feed = useOffresFeedModel()

  /* Recherche : état local → URL debouncée. La frappe ne re-rend que cette barre. */
  const [queryLocale, setQueryLocale] = useState(valeurs.query)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setQueryLocale(valeurs.query) }, [valeurs.query])
  useEffect(() => {
    if (queryLocale === valeurs.query) return
    const t = setTimeout(() => setScalar("query", queryLocale), 350)
    return () => clearTimeout(t)
  }, [queryLocale, valeurs.query, setScalar])

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [openPop, setOpenPop] = useState(null)
  const sortRef = useRef(null)
  useClickOutside(sortRef, () => setOpenPop((p) => (p === "sort" ? null : p)))

  const pop = (k) => ({
    open: openPop === k,
    onToggle: () => setOpenPop((p) => (p === k ? null : k)),
    onClose: () => setOpenPop((p) => (p === k ? null : p)),
  })

  return (
    <div className="sticky top-1/10 z-40 border-b border-outline-variant/40 bg-background/85 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-12 py-3 max-md:px-6">
        {/* ═══ Desktop (rendu de base) ═══ */}
        <div className="flex flex-wrap items-center gap-2 max-lg:hidden">
          <SearchField
            value={queryLocale}
            onChange={setQueryLocale}
            className="w-56"
            placeholder="Rechercher un poste, une entreprise…"
          />

          <FilterPopover label="Filière" icon={Sparkles} count={filters.filieres.size} {...pop("filiere")} panelClassName="w-64">
            <FiliereOptions />
          </FilterPopover>

          <FilterPopover
            label={getLocationLabel(refs.locations, locationId)}
            icon={MapPin}
            count={locationId ? 1 : 0}
            panelClassName="w-72 p-3"
            {...pop("location")}
          >
            <LocationPicker
              locations={refs.locations}
              value={locationId}
              onChange={(id) => { setLocation(id); setOpenPop(null) }}
              isLoading={refsPending && refs.locations.length === 0}
            />
          </FilterPopover>

          <FilterPopover label="Sources" icon={Layers} count={filters.sources.size} {...pop("source")}>
            <SourceOptions />
          </FilterPopover>
          <FilterPopover label="Contrat" icon={Briefcase} count={filters.contrats.size} {...pop("contrat")}>
            <ContratOptions />
          </FilterPopover>
          <FilterPopover label="Expérience" icon={Zap} count={filters.experiences.size} {...pop("exp")}>
            <ExperienceOptions />
          </FilterPopover>
          <FilterPopover label="Niveau" icon={GraduationCap} count={filters.niveaux.size} {...pop("niveau")}>
            <NiveauOptions />
          </FilterPopover>
          <FilterPopover
            label={getPeriodLabel(filters.period)}
            icon={CalendarDays}
            count={filters.period.start || filters.period.end ? 1 : 0}
            align="right"
            panelClassName="w-[19.5rem] p-3"
            {...pop("period")}
          >
            <MiniCalendar range={filters.period} onChange={setPeriod} hue={BRAND_HUE} />
          </FilterPopover>

          <div className="ml-auto flex items-center gap-2.5">
            <span className="hidden text-xs text-muted-foreground xl:inline" role="status" aria-live="polite">
              {feed.isLoading ? (
                <Skeleton className="inline-block h-4 w-20 align-middle" />
              ) : (
                <>
                  <strong className="font-heading text-sm font-bold text-brand-navy">
                    {feed.offers.length}{feed.hasMore ? "+" : ""}
                  </strong>{" "}
                  offre{feed.offers.length > 1 ? "s" : ""}
                </>
              )}
            </span>

            {/* Tri — listbox accessible (aria-expanded, Échap, aria-selected) */}
            <div ref={sortRef} className="relative">
              <button
                type="button"
                onClick={() => setOpenPop((p) => (p === "sort" ? null : "sort"))}
                aria-haspopup="listbox"
                aria-expanded={openPop === "sort"}
                aria-controls="offres-tri-listbox"
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  openPop === "sort"
                    ? "border-brand-navy bg-brand-navy text-white"
                    : "border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant hover:border-brand-navy/40 hover:text-brand-navy"
                )}
              >
                <ArrowUpDown className="size-3.5" aria-hidden />
                {SORTS.find((s) => s.k === sort)?.l ?? "Trier"}
                <ChevronDown className={cn("size-3.5 transition-transform duration-200", openPop === "sort" && "rotate-180")} aria-hidden />
              </button>
              <AnimatePresence>
                {openPop === "sort" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    role="listbox"
                    id="offres-tri-listbox"
                    aria-label="Trier les offres"
                    onKeyDown={(e) => { if (e.key === "Escape") setOpenPop(null) }}
                    className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-1.5 shadow-hover"
                  >
                    {SORTS.map((s) => (
                      <button
                        key={s.k}
                        type="button"
                        role="option"
                        aria-selected={sort === s.k}
                        onClick={() => { setSort(s.k); setOpenPop(null) }}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors hover:bg-surface-container-low focus-visible:bg-surface-container-low focus-visible:outline-none"
                      >
                        {s.l}
                        {sort === s.k && <Check className="size-3.5 text-brand-orange" strokeWidth={3} aria-hidden />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <ViewToggle view={view} onChange={setView} />
          </div>
        </div>

        {/* ═══ Mobile (déclassement) ═══ */}
        <div className="flex items-center gap-2 lg:hidden">
          <SearchField
            value={queryLocale}
            onChange={setQueryLocale}
            className="flex-1"
            placeholder="Rechercher…"
          />
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-haspopup="dialog"
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-lg border px-3.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              activeCount > 0
                ? "border-brand-navy bg-brand-navy text-white shadow-soft"
                : "border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant"
            )}
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            Filtres
            {activeCount > 0 && (
              <span className="grid size-4.5 place-items-center rounded-full bg-brand-orange text-[10px] font-black text-white">
                <span aria-hidden>{activeCount}</span>
                <span className="sr-only">filtres actifs</span>
              </span>
            )}
          </button>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {/* Tiroir mobile — OffresFilterGroups est autonome (zéro prop) */}
      <FiltersDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        resultCount={feed.offers.length}
        sort={sort}
        onSort={setSort}
        onReset={resetTout}
      >
        <OffresFilterGroups />
      </FiltersDrawer>
    </div>
  )
}

export default FiltersBar