// src/pages/offres/components/FeedStates.jsx
import { memo } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
  AlertTriangle, Bell, CheckCircle2, ChevronDown, Loader2, RefreshCw, SearchX,
} from "lucide-react"
import { PAGE_SIZE } from "@/tools/offres.tools"

/* États du flux — composants présentationnels mémoïsés (props simples,
   un seul niveau : pas de drilling). */

export const FeedErrorState = memo(function FeedErrorState({ message, onRetry }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      role="alert"
      className="mt-10 rounded-xl border border-destructive/30 bg-destructive/5 p-12 text-center"
    >
      <AlertTriangle className="mx-auto size-10 text-destructive/70" aria-hidden />
      <h3 className="mt-4 font-heading text-lg font-bold text-brand-navy">
        Le flux n'a pas pu être chargé
      </h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-lg border border-brand-navy/20 px-5 py-2.5 text-sm font-bold text-brand-navy transition-all hover:border-brand-navy hover:bg-brand-navy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <RefreshCw className="size-4" aria-hidden /> Réessayer
      </button>
    </motion.div>
  )
})

export const FeedEmptyState = memo(function FeedEmptyState({ hasActiveFilters, onReset }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      role="status"
      className="mt-10 rounded-xl border border-dashed border-outline-variant/60 bg-white p-12 text-center"
    >
      <SearchX className="mx-auto size-10 text-muted-foreground/50" aria-hidden />
      <h3 className="mt-4 font-heading text-lg font-bold text-brand-navy">
        Aucune offre trouvée
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasActiveFilters
          ? "Élargissez vos filtres — ou attendez la collecte de demain 6h02."
          : "Le flux est vide pour le moment — la prochaine collecte est prévue à 6h02."}
      </p>
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onReset}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-brand-navy/20 px-5 py-2.5 text-sm font-bold text-brand-navy transition-all hover:border-brand-navy hover:bg-brand-navy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Réinitialiser les filtres
        </button>
      )}
    </motion.div>
  )
})

export const LoadMoreBlock = memo(function LoadMoreBlock({
  shown, total, isLoadingMore, disabled, onLoadMore,
}) {
  const pct = total > 0 ? Math.min(100, (shown / total) * 100) : 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45 }}
      className="mt-10 flex flex-col items-center gap-3.5"
    >
      <div className="w-full max-w-xs">
        <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground" aria-live="polite">
          <span>{shown} affichée{shown > 1 ? "s" : ""}</span>
          {total > 0 && <span>{total} au total</span>}
        </div>
        <div
          className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-container-high"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progression du chargement des offres"
        >
          <motion.div
            className="h-full rounded-full bg-brand-navy"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onLoadMore}
        disabled={isLoadingMore || disabled}
        className="group inline-flex h-12 items-center gap-2.5 rounded-lg border border-brand-navy/25 bg-white px-7 text-sm font-bold text-brand-navy shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-navy hover:bg-brand-navy hover:text-white hover:shadow-hover active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {isLoadingMore ? (
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
  )
})

export const FeedEndState = memo(function FeedEndState() {
  return (
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
        <h3 className="mt-4 font-heading text-xl font-extrabold text-brand-navy">
          Vous êtes à jour.
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          C'est tout pour aujourd'hui — demain à 6h02, on remet ça. Ou mieux :
          recevez le flux directement à 8h00, sans avoir à revenir.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3 max-sm:flex-col">
          <Link
            to="/inscription"
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
  )
})