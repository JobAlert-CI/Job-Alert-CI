// src/pages/filieres/sections/ReferentielFilieres.jsx
import { useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowDownAZ, ArrowDownWideNarrow, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatApiError } from "@/api/errors"
import { FiliereCard } from "@/components/shared"
import { useFilieresAdapted, useFilieresSearch, computeTop3, splitLargeCompact } from "@/tools/filieres.tools"
import {
  FiliereEmptyState, FiliereErrorState, FiliereGridSkeleton,
} from "../components/FiliereStates"

const SORT_BUTTONS = [
  { k: "volume", l: "Volume", I: ArrowDownWideNarrow },
  { k: "az", l: "A → Z", I: ArrowDownAZ },
]

/* Barre recherche + tri — contrat présentationnel simple (un niveau). */
const SearchSortBar = ({ search, count }) => (
  <motion.div
    initial={{ opacity: 0, y: 18 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
    className="mt-8 flex flex-row items-center gap-3 max-sm:flex-col max-sm:items-stretch"
  >
    <div className="relative w-80 max-sm:w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        value={search.queryLocale}
        onChange={(e) => search.setQueryLocale(e.target.value)}
        placeholder="Rechercher une filière ou un métier…"
        aria-label="Rechercher une filière"
        className="h-10 w-full rounded-lg border border-outline-variant/60 bg-white pl-9 pr-9 text-sm outline-none transition-all placeholder:text-muted-foreground/70 focus:border-brand-navy/50 focus:ring-2 focus:ring-brand-navy/10"
      />
      {search.queryLocale && (
        <button
          type="button"
          onClick={search.resetQuery}
          aria-label="Effacer la recherche"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>

    <div className="ml-auto flex items-center gap-3 max-sm:ml-0">
      <span className="text-xs text-muted-foreground" role="status" aria-live="polite">
        <strong className="font-heading text-sm font-bold text-brand-navy">{count}</strong>{" "}
        filière{count > 1 ? "s" : ""}
      </span>
      <div
        className="flex rounded-lg border border-outline-variant/60 bg-white p-0.5 shadow-soft"
        role="group"
        aria-label="Trier les filières"
      >
        {SORT_BUTTONS.map(({ k, l, I }) => (
          <button
            key={k}
            type="button"
            onClick={() => search.setSort(k)}
            aria-pressed={search.sort === k}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              search.sort === k
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
  </motion.div>
)

/* Le référentiel — recherche, tri, grille et états.
   Chaque état (chargement / erreur / vide / contenu) est un composant dédié. */
const ReferentielFilieres = () => {
  const { filieres, isPending, isError, error, refetch } = useFilieresAdapted()
  const search = useFilieresSearch()

  /* Dérivés mémoïsés — recalculés uniquement quand la liste ou la recherche change */
  const filtered = useMemo(() => search.applyTo(filieres), [filieres, search])
  const top3 = useMemo(() => computeTop3(filieres), [filieres])
  const { large, compact } = useMemo(
    () => splitLargeCompact(filtered, top3, search.hasQuery),
    [filtered, top3, search.hasQuery]
  )

  return (
    <section className="bg-background py-18 max-md:py-14">
      <div className="mx-auto max-w-7xl px-12 max-md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-orange">
              <span className="h-px w-6 bg-brand-orange" aria-hidden />
              Référentiel métier
            </p>
            <h2 className="mt-3 font-heading text-4xl font-extrabold tracking-tight text-brand-navy max-sm:text-3xl">
              Choisissez votre <span className="text-brand-orange">terrain de chasse</span>.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              1 à 3 filières à l'inscription, le matching des offres est automatique,
              alimenté chaque matin par les mots-clés gérés depuis l'administration.
            </p>
          </motion.div>
        </div>

        <SearchSortBar search={search} count={filtered.length} />

        {/* États délégués : chargement / erreur / contenu+vide */}
        {isPending && filieres.length === 0 ? (
          <FiliereGridSkeleton />
        ) : isError ? (
          <FiliereErrorState message={formatApiError(error)} onRetry={refetch} />
        ) : (
          <>
            {/* Desktop-first : 6 colonnes en base, repli 2 puis 1 */}
            <div className="mt-8 grid grid-cols-6 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
              <AnimatePresence mode="popLayout">
                {/* Clés stables et uniques : le code de la filière */}
                {large.map((f, i) => (
                  <FiliereCard key={f.code} f={f} index={i} variant="large" />
                ))}
                {compact.map((f, i) => (
                  <FiliereCard key={f.code} f={f} index={i} variant="compact" />
                ))}
              </AnimatePresence>
            </div>
            {filtered.length === 0 && <FiliereEmptyState onReset={search.resetQuery} />}
          </>
        )}
      </div>
    </section>
  )
}

export default ReferentielFilieres