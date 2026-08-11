// src/pages/offres/sections/OffersFeed.jsx
import { memo, useCallback, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { AlertTriangle, RefreshCw, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { OfferCard } from "@/components/shared"
import { jourLabel } from "@/lib/dates"
import { SORTS } from "@/lib/referentiels"
import { OffersSkeletonList } from "@/components/shared/SkeletonsOffres"
import {
  FeedEmptyState, FeedEndState, FeedErrorState, LoadMoreBlock,
} from "../components/FeedStates"
import {
  PAGE_SIZE,
  buildEntrepriseCounts,
  buildFeedItems,
  useActiveChips,
  useOffresFeedModel,
  useOfferReferentialsQuery,
  useOffersOverviewQuery
} from "@/tools/offres.tools"
import { useOffresFilters } from "@/contexts/Offres.context"

/* En-tête de jour mémoïsé — jourLabel calculé une seule fois. */
const DayHeader = memo(function DayHeader({ jours, count }) {
  const meta = jourLabel(jours)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 pt-5 first:pt-0"
    >
      <span className="relative flex size-2" aria-hidden>
        {meta.ping && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-orange opacity-70" />
        )}
        <span className={cn("relative inline-flex size-2 rounded-full", meta.ping ? "bg-brand-orange" : "bg-outline-variant")} />
      </span>
      <h3 className="font-heading text-sm font-extrabold uppercase tracking-[0.14em] text-brand-navy">
        {meta.label}
      </h3>
      <span className="text-[11px] font-semibold text-muted-foreground">
        {count} offre{count > 1 ? "s" : ""}
        {meta.sub && ` · ${meta.sub}`}
      </span>
      <span className="h-px flex-1 bg-outline-variant/50" aria-hidden />
    </motion.div>
  )
})

const OffersFeed = () => {
  const isMobile = useIsMobile()
  const { view, sort, activeCount, valeurs, resetTout } = useOffresFilters()
  const {
    offers, isLoading, isSwitching, isLoadingMore,
    error, hasMore, loadMore, reload,
  } = useOffresFeedModel()
  const { data: overview } = useOffersOverviewQuery()
  const { data: refs, isPending: refsPending, refetch: refsReload } = useOfferReferentialsQuery()

  /* Favoris (état purement local) */
  const [saved, setSaved] = useState(() => new Set())
  const toggleSave = useCallback((uid) => {
    setSaved((prev) => {
      const next = new Set(prev)
      next.has(uid) ? next.delete(uid) : next.add(uid)
      return next
    })
  }, [])

  /* Dérivés mémoïsés — O(n) partout */
  const feedItems = useMemo(() => buildFeedItems(offers, sort), [offers, sort])
  const entrepriseCounts = useMemo(() => buildEntrepriseCounts(offers), [offers])
  const chips = useActiveChips()

  /* Desktop-first : liste en base, grille en déclassement mobile */
  const effectiveView = view === "grid" || isMobile ? "grid" : "list"
  const isDone = !isLoading && !isLoadingMore && !hasMore && offers.length > 0
  const hasActiveFilters = activeCount > 0 || Boolean(valeurs.query)
  const isBusy = isLoading || isLoadingMore || isSwitching

  return (
    <section
      aria-labelledby="offres-flux-titre"
      className="border-b border-outline-variant/30 bg-background py-16 max-md:py-12"
    >
      <div className="mx-auto max-w-7xl px-12 max-md:px-6">
        {/* En-tête */}
        <div className="flex items-end justify-between gap-6 max-md:flex-col max-md:items-start">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-orange">
              <span className="h-px w-6 bg-brand-orange" aria-hidden />
              Le flux
            </p>
            <h2 id="offres-flux-titre" className="mt-3 font-heading text-4xl font-extrabold tracking-tight text-brand-navy max-sm:text-3xl">
              Les offres <span className="text-brand-orange">du moment</span>
            </h2>
            {/* Région vivante : le nombre d'offres est annoncé aux lecteurs d'écran */}
            <p className="mt-2 text-sm text-muted-foreground" role="status" aria-live="polite">
              {isLoading ? "Chargement du flux…" : (
                <>
                  <strong className="font-heading font-bold text-brand-navy">
                    {offers.length}{hasMore ? "+" : ""}
                  </strong> offre{offers.length > 1 ? "s" : ""}
                  {activeCount > 0 ? ` · ${activeCount} filtre${activeCount > 1 ? "s" : ""} actif${activeCount > 1 ? "s" : ""}` : ""}
                  {" "} triées par « {(SORTS.find((s) => s.k === sort)?.l ?? "").toLowerCase()} »
                </>
              )}
            </p>
          </motion.div>
        </div>

        {/* Référentiels en repli : on prévient sans bloquer */}
        {refs.isFallback && !refsPending && (
          <div role="alert" className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-semibold text-amber-800">
            <AlertTriangle className="size-4" aria-hidden />
            Les listes de filtres n'ont pas pu être chargées — options par défaut affichées.
            <button
              type="button"
              onClick={() => refsReload()}
              className="inline-flex items-center gap-1 rounded-sm font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RefreshCw className="size-3" aria-hidden /> Réessayer
            </button>
          </div>
        )}

        {/* Chips de filtres actifs */}
        <AnimatePresence>
          {chips.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-5 flex flex-wrap items-center gap-2" aria-label="Filtres actifs">
                {chips.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={c.rm}
                    aria-label={`Retirer le filtre : ${c.label}`}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-brand-navy/20 bg-brand-navy/5 px-3 py-1.5 text-xs font-semibold text-brand-navy transition-all hover:border-brand-orange/50 hover:bg-brand-orange/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {c.label}
                    <X className="size-3 text-muted-foreground transition-colors group-hover:text-brand-orange" aria-hidden />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={resetTout}
                  className="rounded-sm px-1 text-xs font-bold text-brand-orange transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Tout effacer
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Flux : chargement / erreur / vide / contenu ──
             isSwitching (keepPreviousData) : l'ancienne liste reste visible,
             légèrement atténuée, pendant le changement de filtres. */}
        <div
          aria-busy={isBusy}
          className={cn("transition-opacity duration-300", isSwitching && "opacity-60")}
        >
          {isLoading ? (
            <>
              <span className="sr-only" role="status">Chargement des offres…</span>
              <div aria-hidden="true">
                <OffersSkeletonList view={effectiveView} count={PAGE_SIZE / 2} className="mt-8" />
              </div>
            </>
          ) : error && offers.length === 0 ? (
            <FeedErrorState message={error} onRetry={reload} />
          ) : offers.length === 0 ? (
            <FeedEmptyState hasActiveFilters={hasActiveFilters} onReset={resetTout} />
          ) : effectiveView === "list" ? (
            <div className="mt-8 flex flex-col gap-3">
              <AnimatePresence mode="popLayout">
                {feedItems.map((item, i) =>
                  item.type === "header" ? (
                    <DayHeader key={`h-${item.jours}`} jours={item.jours} count={item.count} />
                  ) : (
                    <OfferCard
                      key={item.o.uid}
                      offre={item.o}
                      index={i}
                      view="list"
                      saved={saved.has(item.o.uid)}
                      onToggleSave={toggleSave}
                      entrepriseTotal={entrepriseCounts.get(item.o.entreprise) ?? 1}
                    />
                  )
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-3 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
              <AnimatePresence mode="popLayout">
                {feedItems.filter((x) => x.type === "offre").map((item, i) => (
                  <OfferCard
                    key={item.o.uid}
                    offre={item.o}
                    index={i}
                    view="grid"
                    saved={saved.has(item.o.uid)}
                    onToggleSave={toggleSave}
                    entrepriseTotal={entrepriseCounts.get(item.o.entreprise) ?? 1}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Squelettes pendant « charger plus » */}
        {isLoadingMore && (
          <>
            <span className="sr-only" role="status">Chargement de la page suivante…</span>
            <div aria-hidden="true">
              <OffersSkeletonList view={effectiveView} count={3} className="mt-3" />
            </div>
          </>
        )}

        {/* Erreur non bloquante sur une page suivante */}
        {error && offers.length > 0 && (
          <div role="alert" className="mt-6 flex flex-wrap items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs font-semibold text-destructive">
            <AlertTriangle className="size-4" aria-hidden />
            {error}
            <button
              type="button"
              onClick={loadMore}
              className="inline-flex items-center gap-1 rounded-sm font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RefreshCw className="size-3" aria-hidden /> Réessayer
            </button>
          </div>
        )}

        {/* Charger plus — par lots de PAGE_SIZE */}
        {hasMore && !isLoading && (
          <LoadMoreBlock
            shown={offers.length}
            total={overview?.total ?? 0}
            isLoadingMore={isLoadingMore}
            disabled={isSwitching}
            onLoadMore={loadMore}
          />
        )}

        {/* Fin du flux */}
        <AnimatePresence>
          {isDone && <FeedEndState />}
        </AnimatePresence>

        <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-brand-orange" aria-hidden />
          Mises à jour chaque matin à 6h02 · lien direct vers l'annonce d'origine
        </p>
      </div>
    </section>
  )
}

export default OffersFeed