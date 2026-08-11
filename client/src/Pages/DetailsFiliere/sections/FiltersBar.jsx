// src/pages/filieres/detail/sections/FiltersBar.jsx
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowUpDown, Briefcase, CalendarDays, Check, ChevronDown, GraduationCap,
  Layers, MapPin, Search, SlidersHorizontal, X, Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { FilterPopover, FiltersDrawer, MiniCalendar, ViewToggle } from "@/components/shared"
import { BRAND_HUE } from "@/lib/hues"
import { SORTS } from "@/lib/referentiels"
import useClickOutside from "@/hooks/use-click-outside"
import { getPeriodLabel, getLocationLabel } from "@/lib/offres-helpers"
import LocationPicker from "@/components/shared/filters/LocationPicker"
import {
  ContratOptions, ExperienceOptions, NiveauOptions, SourceOptions,
} from "@/components/shared/filters/FilterOptions"
import { useFiliereDetail } from "@/contexts/DetailsFiliere.context"
import FiliereFilterGroups from "../components/FiliereFilterGroups"

/* Barre sticky — la frappe clavier vit ICI (état local debouncé) :
   elle ne re-rend jamais le héro ni le flux. */
const FiltersBar = () => {
  const {
    meta, hue, refs, filters, toggle, setPeriod,
    sort, view, locationId, filtered, counts,
    setSort, setView, setLocation, resetTout, activeCount,
  } = useFiliereDetail()

  /* Recherche : champ local → URL debouncée */
  const [queryLocale, setQueryLocale] = useState("")
  const { valeurs, setScalar } = useFiliereDetail()
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setQueryLocale(valeurs.query) }, [valeurs.query])
  useEffect(() => {
    if (queryLocale === valeurs.query) return
    const timer = setTimeout(() => setScalar("query", queryLocale), 350)
    return () => clearTimeout(timer)
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
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              value={queryLocale}
              onChange={(e) => setQueryLocale(e.target.value)}
              placeholder="Rechercher un poste, une entreprise…"
              aria-label="Rechercher une offre"
              className="h-9 w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest pl-9 pr-8 text-[13px] outline-none transition-all placeholder:text-muted-foreground/70 focus:border-brand-navy/50 focus:ring-2 focus:ring-brand-navy/10"
            />
            {queryLocale && (
              <button
                type="button"
                onClick={() => setQueryLocale("")}
                aria-label="Effacer la recherche"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            )}
          </div>

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
            />
          </FilterPopover>

          <FilterPopover label="Sources" icon={Layers} count={filters.sources.size} {...pop("sources")}>
            <SourceOptions filters={filters} toggle={toggle} counts={counts.sources} />
          </FilterPopover>
          <FilterPopover label="Contrat" icon={Briefcase} count={filters.contrats.size} {...pop("contrat")}>
            <ContratOptions filters={filters} toggle={toggle} counts={counts.contrats} />
          </FilterPopover>
          <FilterPopover label="Expérience" icon={Zap} count={filters.experiences.size} {...pop("exp")}>
            <ExperienceOptions filters={filters} toggle={toggle} />
          </FilterPopover>
          <FilterPopover label="Niveau" icon={GraduationCap} count={filters.niveaux.size} {...pop("niveau")}>
            <NiveauOptions filters={filters} toggle={toggle} />
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
              <strong className="font-heading text-sm font-bold text-brand-navy">
                {filtered.length}
              </strong>{" "}
              offre{filtered.length > 1 ? "s" : ""}
            </span>

            {/* Tri — listbox accessible (aria-expanded, Échap, aria-selected) */}
            <div ref={sortRef} className="relative">
              <button
                type="button"
                onClick={() => setOpenPop((p) => (p === "sort" ? null : "sort"))}
                aria-haspopup="listbox"
                aria-expanded={openPop === "sort"}
                aria-controls="filiere-tri-listbox"
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
                    id="filiere-tri-listbox"
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
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              value={queryLocale}
              onChange={(e) => setQueryLocale(e.target.value)}
              placeholder="Rechercher…"
              aria-label="Rechercher une offre"
              className="h-10 w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest pl-9 pr-3 text-sm outline-none transition-all placeholder:text-muted-foreground/70 focus:border-brand-navy/50 focus:ring-2 focus:ring-brand-navy/10"
            />
            {queryLocale && (
              <button
                type="button"
                onClick={() => setQueryLocale("")}
                aria-label="Effacer la recherche"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            )}
          </div>
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

      {/* Tiroir mobile — groupes autonomes */}
      <FiltersDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={`Filtres · ${meta.label}`}
        resultCount={filtered.length}
        sort={sort}
        onSort={setSort}
        onReset={resetTout}
        ctaClassName={hue.solid}
      >
        <FiliereFilterGroups />
      </FiltersDrawer>
    </div>
  )
}

export default FiltersBar