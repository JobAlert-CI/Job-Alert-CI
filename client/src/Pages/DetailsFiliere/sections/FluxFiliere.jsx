// src/pages/filieres/detail/sections/FluxFiliere.jsx
import { Link } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  AlertTriangle, Bell, CheckCircle2, ChevronDown, Loader2, RefreshCw, SearchX, X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatApiError } from "@/api/errors"
import { OfferCard } from "@/components/shared"
import { jourLabel } from "@/lib/dates"
import { SORTS } from "@/lib/referentiels"
import { useIsMobile } from "@/hooks/use-mobile"
import { OffersSkeletonList } from "@/components/shared/SkeletonsOffres"
import { PAGE_SIZE } from "@/tools/filiere-detail.tools"
import { useFiliereActiveChips, useFiliereDetail } from "@/contexts/DetailsFiliere.context"

/* En-tête de jour mémoïsable — jourLabel calculé une seule fois. */
const DayHeader = ({ jours, count }) => {
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
}

/* Le flux — tous les états délégués : chargement / erreur / vide /
   « vide à cause des filtres » / contenu / fin. */
const FluxFiliere = () => {
  const isMobile = useIsMobile()
  const {
    meta, hue, view, activeCount,
    filtered, offresChargees, feedItems, entrepriseCounts,
    saved, toggleSave, resetTout,
    feedQuery, referentialsQuery, refs,
  } = useFiliereDetail()
  const chips = useFiliereActiveChips()

  const {
    isPending, isError, error,
    isFetchingNextPage, isPlaceholderData,
    fetchNextPage, refetch, hasNextPage,
  } = feedQuery
  const errorMessage = isError ? formatApiError(error) : null

  /* Desktop-first : liste en base, grille en repli mobile */
  const effectiveView = view === "grid" || isMobile ? "grid" : "list"
  const isSwitching = isPlaceholderData
  const isDone = !isPending && !isFetchingNextPage && !hasNextPage && filtered.length > 0
  const progressPct = meta.actives > 0 ? Math.min(100, (filtered.length / meta.actives) * 100) : 0

  /* Corrigé : on distingue « aucune offre dans la filière » de
     « des offres existent mais les filtres les écartent ». */
  const videFauteDeFiltres = filtered.length === 0 && offresChargees.length > 0

  return (
    <section
      aria-label={`Flux des offres ${meta.label}`}
      className="border-b border-outline-variant/30 bg-background py-16 max-md:py-12"
    >
      <div className="mx-auto max-w-7xl px-12 max-md:px-6">
        {/* En-tête */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-orange">
            <span className="h-px w-6 bg-brand-orange" aria-hidden />
            Collecte du jour
          </p>
          <h2 className="mt-3 font-heading text-4xl font-extrabold tracking-tight text-brand-navy max-sm:text-3xl">
            Les offres <span className="text-brand-orange">{meta.label}</span> du moment
          </h2>
          <p className="mt-2 text-sm text-muted-foreground" role="status" aria-live="polite">
            {isPending ? "Chargement des offres…" : (
              <>
                <strong className="font-heading font-bold text-brand-navy">
                  {filtered.length}{hasNextPage ? "+" : ""}
                </strong>{" "}
                offre{filtered.length > 1 ? "s" : ""}
                {activeCount > 0 ? ` · ${activeCount} filtre${activeCount > 1 ? "s" : ""} actif${activeCount > 1 ? "s" : ""}` : ""}
                {" "}triées par « {(SORTS.find((s) => s.k === view === "recent" ? "recent" : view)?.l ?? SORTS.find((s) => s.k === "recent")?.l ?? "").toLowerCase()} » 
              </>
            )}
          </p>
        </motion.div>
                {/* Référentiels en repli : on prévient sans bloquer */}
        {refs.isFallback && !referentialsQuery.isPending && (
          <div role="alert" className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-semibold text-amber-800">
            <AlertTriangle className="size-4" aria-hidden />
            Les listes de filtres n'ont pas pu être chargées — options par défaut affichées.
            <button
              type="button"
              onClick={() => referentialsQuery.refetch()}
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

        {/* ── Flux : chaque état est un rendu dédié ──
             isSwitching (keepPreviousData) : l'ancienne liste reste visible,
             légèrement atténuée, pendant le changement de filtres. */}
        <div
          aria-busy={isPending || isFetchingNextPage || isSwitching}
          className={cn("transition-opacity duration-300", isSwitching && "opacity-60")}
        >
          {isPending ? (
            <>
              <span className="sr-only" role="status">Chargement des offres…</span>
              <div aria-hidden="true">
                <OffersSkeletonList view={effectiveView} count={PAGE_SIZE / 2} className="mt-8" />
              </div>
            </>
          ) : isError && filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              role="alert"
              className="mt-10 rounded-xl border border-destructive/30 bg-destructive/5 p-12 text-center"
            >
              <AlertTriangle className="mx-auto size-10 text-destructive/70" aria-hidden />
              <h3 className="mt-4 font-heading text-lg font-bold text-brand-navy">Le flux n'a pas pu être chargé</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{errorMessage}</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-5 inline-flex items-center gap-2 rounded-lg border border-brand-navy/20 px-5 py-2.5 text-sm font-bold text-brand-navy transition-all hover:border-brand-navy hover:bg-brand-navy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RefreshCw className="size-4" aria-hidden /> Réessayer
              </button>
            </motion.div>
          ) : filtered.length === 0 && !videFauteDeFiltres ? (
            /* Aucune offre dans la filière, avec ou sans filtres */
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              role="status"
              className="mt-10 rounded-xl border border-dashed border-outline-variant/60 bg-white p-12 text-center"
            >
              <SearchX className="mx-auto size-10 text-muted-foreground/50" aria-hidden />
              <h3 className="mt-4 font-heading text-lg font-bold text-brand-navy">Aucune offre trouvée</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Le flux est vide pour le moment — la prochaine collecte est prévue à 6h02.
              </p>
            </motion.div>
          ) : videFauteDeFiltres ? (
            /* Corrigé : des offres existent mais les filtres les écartent */
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              role="status"
              className="mt-10 rounded-xl border border-dashed border-outline-variant/60 bg-white p-12 text-center"
            >
              <SearchX className="mx-auto size-10 text-muted-foreground/50" aria-hidden />
              <h3 className="mt-4 font-heading text-lg font-bold text-brand-navy">
                Aucune offre ne correspond à vos filtres
              </h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {offresChargees.length} offre{offresChargees.length > 1 ? "s" : ""} chargée{offresChargees.length > 1 ? "s" : ""} dans cette filière, mais aucune ne passe votre sélection.
                {hasNextPage && " D'autres pages restent à charger."}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={resetTout}
                  className="inline-flex items-center gap-2 rounded-lg border border-brand-navy/20 px-5 py-2.5 text-sm font-bold text-brand-navy transition-all hover:border-brand-navy hover:bg-brand-navy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Réinitialiser les filtres
                </button>
                {hasNextPage && (
                  <button
                    type="button"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage || isSwitching}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-orange px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Charger la suite
                  </button>
                )}
              </div>
            </motion.div>
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
                      hue={hue}
                      showFiliereChip={false}
                      showSpecialite
                      saved={saved.has(item.o.uid)}
                      onToggleSave={toggleSave}
                      getDetailLink={(of) => `/offres/${of.id}`}
                      entrepriseTotal={entrepriseCounts.get(item.o.entreprise) ?? 1}
                    />
                  )
                )}
              </AnimatePresence>
            </div>
          ) : (
            /* Desktop-first : 3 colonnes en base, repli 2 puis 1 */
            <div className="mt-8 grid grid-cols-3 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
              <AnimatePresence mode="popLayout">
                {feedItems.filter((x) => x.type === "offre").map((item, i) => (
                  <OfferCard
                    key={item.o.uid}
                    offre={item.o}
                    index={i}
                    view="grid"
                    hue={hue}
                    showFiliereChip={false}
                    showSpecialite
                    saved={saved.has(item.o.uid)}
                    onToggleSave={toggleSave}
                    getDetailLink={(of) => `/offres/${of.id}`}
                    entrepriseTotal={entrepriseCounts.get(item.o.entreprise) ?? 1}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Squelettes pendant « charger plus » */}
        {isFetchingNextPage && (
          <>
            <span className="sr-only" role="status">Chargement de la page suivante…</span>
            <div aria-hidden="true">
              <OffersSkeletonList view={effectiveView} count={3} className="mt-3" />
            </div>
          </>
        )}

        {/* Erreur non bloquante sur une page suivante */}
        {isError && filtered.length > 0 && (
          <div role="alert" className="mt-6 flex flex-wrap items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs font-semibold text-destructive">
            <AlertTriangle className="size-4" aria-hidden />
            {errorMessage}
            <button
              type="button"
              onClick={() => fetchNextPage()}
              className="inline-flex items-center gap-1 rounded-sm font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RefreshCw className="size-3" aria-hidden /> Réessayer
            </button>
          </div>
        )}

        {/* Charger plus — par lots de PAGE_SIZE */}
        {hasNextPage && !isPending && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
            className="mt-10 flex flex-col items-center gap-3.5"
          >
            <div className="w-full max-w-xs">
              <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground" aria-live="polite">
                <span>{filtered.length} affichée{filtered.length > 1 ? "s" : ""}</span>
                {meta.actives > 0 && <span>{meta.actives} au total</span>}
              </div>
              <div
                className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-container-high"
                role="progressbar"
                aria-valuenow={Math.round(progressPct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progression du chargement des offres"
              >
                <motion.div
                  className="h-full rounded-full bg-brand-navy"
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage || isSwitching}
              className="group inline-flex h-12 items-center gap-2.5 rounded-lg border border-brand-navy/25 bg-white px-7 text-sm font-bold text-brand-navy shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-navy hover:bg-brand-navy hover:text-white hover:shadow-hover active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Chargement des offres…
                </>
              ) : (
                <>
                  <ChevronDown className="size-4 transition-transform duration-300 group-hover:translate-y-0.5" aria-hidden />
                  Charger {PAGE_SIZE} offres de plus ?
                </>
              )}
            </button>
            <p className="text-[11px] text-muted-foreground">
              Par lots de {PAGE_SIZE} · groupées jour par jour
            </p>
          </motion.div>
        )}

        {/* Fin du flux */}
        <AnimatePresence>
          {isDone && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              role="status"
              className="mt-10 overflow-hidden rounded-xl border border-outline-variant/40 bg-white text-center shadow-soft"
            >
              <div className="mx-auto h-1 w-24 rounded-b-full bg-emerald-500" aria-hidden />
              <div className="px-6 py-10">
                <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="size-7 text-emerald-600" aria-hidden />
                </span>
                <h3 className="mt-4 font-heading text-xl font-extrabold text-brand-navy">Vous êtes à jour.</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  C'est tout pour aujourd'hui — demain à 6h02, on remet ça. Ou mieux :
                  recevez le flux directement à 8h00, sans avoir à revenir.
                </p>
                <div className="mt-6 flex flex-row items-center justify-center gap-3 max-sm:flex-col">
                  <Link
                    to={`/inscription?filieres=${meta.code}`}
                    className="group inline-flex items-center gap-2 rounded-lg bg-brand-orange px-6 py-3 text-sm font-bold text-white shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Bell className="size-4 transition-transform duration-300 group-hover:rotate-12" aria-hidden />
                    Créer mon alerte 8h00
                  </Link>
                  <button
                    type="button"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/60 px-6 py-3 text-sm font-bold text-on-surface-variant transition-all hover:border-brand-navy/40 hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Retour en haut
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn("size-1.5 rounded-full", hue.dot)} aria-hidden />
          Mises à jour chaque matin à 6h02 · lien direct vers l'annonce d'origine
        </p>
      </div>
    </section>
  )
}

export default FluxFiliere