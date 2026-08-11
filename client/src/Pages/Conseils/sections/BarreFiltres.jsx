// src/pages/conseils/sections/BarreFiltres.jsx
import {
  ArrowUpDown, Lightbulb, Search, SlidersHorizontal, X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ChipFiltre, ChipsFiltres, FilterGroup, StickyFilterBar } from "@/components/shared"
import {
  Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer"
import { useState } from "react"
import { MODES_TRI, TRI_DRAWER } from "@/tools/conseils.tools"
import { useBibliotheque } from "@/contexts/Conseils.context"

/* Barre sticky — consomme le contexte. Desktop-first : la barre complète
   est le rendu de base (max-lg:hidden), la variante mobile est le repli. */
const BarreFiltres = () => {
  const {
    chipsDefs, cat, setCat, sort, setSort,
    queryLocale, setQueryLocale, filtered, activeCount, resetFiltres,
  } = useBibliotheque()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <StickyFilterBar>
        {/* ═══ Desktop (rendu de base) ═══ */}
        <div className="flex flex-col gap-3 max-lg:hidden">
          <ChipsFiltres chips={chipsDefs} actif={cat} onSelect={setCat} />
          <div className="flex flex-row items-center gap-3 max-sm:flex-col max-sm:items-stretch">
            <div className="relative w-80 max-sm:w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                value={queryLocale}
                onChange={(e) => setQueryLocale(e.target.value)}
                placeholder="Rechercher un conseil…"
                aria-label="Rechercher un conseil"
                className="h-9 w-full rounded-lg border border-outline-variant/60 bg-white pl-9 pr-9 text-[13px] outline-none transition-all placeholder:text-muted-foreground/70 focus:border-brand-navy/50 focus:ring-2 focus:ring-brand-navy/10"
              />
              {queryLocale && (
                <button
                  type="button"
                  onClick={() => setQueryLocale("")}
                  aria-label="Effacer la recherche"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 ml-auto max-sm:ml-0">
              <span className="text-xs text-muted-foreground" role="status" aria-live="polite">
                <strong className="font-heading text-sm font-bold text-brand-navy">
                  {filtered.length}
                </strong>{" "}
                conseil{filtered.length > 1 ? "s" : ""}
              </span>
              <div className="flex rounded-lg border border-outline-variant/60 bg-white p-0.5 shadow-soft" role="group" aria-label="Trier les conseils">
                {MODES_TRI.map(({ k, l, I }) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSort(k)}
                    aria-pressed={sort === k}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      sort === k
                        ? "bg-brand-navy text-white shadow-soft"
                        : "text-muted-foreground hover:text-brand-navy"
                    )}
                  >
                    <I className="size-3.5" aria-hidden />
                    {l}
                  </button>
                ))}
              </div>
            </div>
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
              aria-label="Rechercher un conseil"
              className="h-10 w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest pl-9 pr-9 text-sm outline-none transition-all placeholder:text-muted-foreground/70 focus:border-brand-navy/50 focus:ring-2 focus:ring-brand-navy/10"
            />
            {queryLocale && (
              <button
                type="button"
                onClick={() => setQueryLocale("")}
                aria-label="Effacer la recherche"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              "inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
        </div>
      </StickyFilterBar>

      {/* Tiroir mobile */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[88vh]">
          <DrawerHeader className="border-b border-outline-variant/40 px-5 pb-4 pt-2">
            <DrawerTitle className="font-heading text-base font-bold text-brand-navy">Filtres</DrawerTitle>
            <DrawerDescription className="text-xs text-muted-foreground">
              {filtered.length} conseil{filtered.length > 1 ? "s" : ""} correspondant
              {filtered.length > 1 ? "s" : ""}. Bibliothèque mise à jour chaque mardi.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <FilterGroup title="Thème" icon={Lightbulb}>
              <div className="flex flex-wrap gap-2 px-1 pt-1">
                {chipsDefs.map((c) => (
                  <ChipFiltre key={c.code} {...c} actif={cat} onSelect={setCat} />
                ))}
              </div>
            </FilterGroup>
            <div className="mt-6 border-t border-outline-variant/40 pt-5">
              <FilterGroup title="Trier par" icon={ArrowUpDown}>
                <div className="grid grid-cols-2 gap-2 px-1">
                  {TRI_DRAWER.map((s) => (
                    <button
                      key={s.k}
                      type="button"
                      onClick={() => setSort(s.k)}
                      aria-pressed={sort === s.k}
                      className={cn(
                        "rounded-lg border px-3 py-2.5 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        sort === s.k
                          ? "border-brand-navy bg-brand-navy text-white shadow-soft"
                          : "border-outline-variant/60 bg-white text-on-surface-variant hover:border-brand-navy/40 hover:text-brand-navy"
                      )}
                    >
                      {s.l}
                    </button>
                  ))}
                </div>
              </FilterGroup>
            </div>
          </div>
          <DrawerFooter className="border-t border-outline-variant/40 px-5 py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={resetFiltres}
                className="rounded-sm text-[13px] font-bold text-muted-foreground transition-colors hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Réinitialiser
              </button>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex-1 rounded-lg bg-brand-orange py-3 text-sm font-bold text-white shadow-soft transition-all hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Voir {filtered.length} conseil{filtered.length > 1 ? "s" : ""}
              </button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}

export default BarreFiltres