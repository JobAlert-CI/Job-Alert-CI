// src/pages/sources/components/Etats.jsx
import { motion } from "framer-motion"
import {
  AlertTriangle, ArrowRight, Inbox, RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CtaLink } from "@/components/shared"
import { formatApiError } from "@/api/errors"

/* Brique de base */
export const Skel = ({ className }) => (
  <div aria-hidden className={cn("animate-pulse rounded-lg bg-surface-container-high", className)} />
)

/* ─────────────── Squelette héro (desktop-first) ─────────────── */
export const HeroSkeleton = () => (
  <section className="relative overflow-hidden hero-gradient" aria-busy="true">
    <span className="sr-only" role="status">Chargement des sources…</span>
    <div className="relative z-10 mx-auto max-w-7xl px-12 pb-14 pt-10 max-md:px-6 max-md:pb-16 max-md:pt-8">
      <Skel className="h-4 w-40" />
      {/* Desktop-first : 2 colonnes en base, empilé en repli */}
      <div className="mt-8 grid items-start gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 max-lg:grid-cols-1">
        <div className="space-y-5">
          <Skel className="h-7 w-64 rounded-full" />
          <Skel className="h-14 w-full max-w-xl" />
          <Skel className="h-5 w-full max-w-2xl" />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Skel className="h-12 w-64 rounded-full" />
            <Skel className="h-12 w-52 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-8">
            <Skel className="h-14 w-20" />
            <Skel className="h-14 w-20" />
            <Skel className="h-14 w-20" />
          </div>
        </div>
        <Skel className="h-144 w-full rounded-2xl" />
      </div>
    </div>
  </section>
)

/* ─────────────── Squelette grille ─────────────── */
export const SourcesSkeleton = () => (
  <section className="bg-background py-16 md:py-20" aria-busy="true">
    <span className="sr-only" role="status">Chargement des cartes sources…</span>
    <div className="mx-auto max-w-7xl px-12 max-md:px-6">
      <div className="mb-10 space-y-3">
        <Skel className="h-4 w-32" />
        <Skel className="h-10 w-full max-w-lg" />
        <Skel className="h-4 w-full max-w-2xl" />
      </div>
      {/* Desktop-first : 6 colonnes en base, 2 en tablette, 1 en mobile */}
      <div className="grid gap-4 md:grid-cols-6">
        <Skel className="h-96 md:col-span-6 rounded-xl" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skel key={i} className="h-96 md:col-span-2 rounded-xl" />
        ))}
      </div>
    </div>
  </section>
)

/* ─────────────── Erreur globale (page entière bloquée) ─────────────── */
export const ErreurSources = ({ detail, onRetry }) => (
  <section className="hero-gradient flex min-h-[60vh] items-center justify-center px-6 py-20">
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      role="alert"
      className="max-w-md text-center"
    >
      <span className="mx-auto flex size-16 items-center justify-center rounded-xl bg-error-container/40 text-error">
        <AlertTriangle className="size-8" strokeWidth={1.8} />
      </span>
      <h1 className="mt-5 font-heading text-3xl font-black tracking-tight text-brand-navy">
        Impossible de charger les sources
      </h1>
      <p className="mt-3 text-on-surface-variant">
        {detail || "Une erreur est survenue pendant la récupération des données."}
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw className="size-4" />
            Réessayer
          </button>
        )}
        <CtaLink to="/" variant="outline" iconRight={ArrowRight}>
          Retour à l'accueil
        </CtaLink>
      </div>
    </motion.div>
  </section>
)

/* ─────────────── Aucune source active ─────────────── */
export const AucuneSource = ({ onRetry }) => (
  <section className="hero-gradient flex min-h-[60vh] items-center justify-center px-6 py-20">
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      role="status"
      className="max-w-md text-center"
    >
      <span className="mx-auto flex size-16 items-center justify-center rounded-xl bg-surface-container text-muted-foreground">
        <Inbox className="size-8" strokeWidth={1.8} />
      </span>
      <h1 className="mt-5 font-heading text-3xl font-black tracking-tight text-brand-navy">
        Aucune source active pour le moment
      </h1>
      <p className="mt-3 text-on-surface-variant">
        Nos partenaires sont en cours d'activation. Revenez bientôt pour découvrir
        les plateformes que nous scannons chaque matin.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw className="size-4" />
            Réessayer
          </button>
        )}
        <CtaLink to="/" variant="outline" iconRight={ArrowRight}>
          Retour à l'accueil
        </CtaLink>
      </div>
    </motion.div>
  </section>
)

/* ─────────────── Bandeau d'erreur partielle (non bloquant) ─────────────── */
export const BandeauErreurPartielle = ({ erreurs }) => {
  const messages = Object.values(erreurs || {})
    .map(formatApiError)
    .filter(Boolean)
  if (!messages.length) return null
  return (
    <div
      role="alert"
      className="mx-auto mb-6 mt-6 flex max-w-7xl flex-col gap-3 rounded-lg border border-error/20 bg-error-container/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between max-md:px-6"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-error" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-brand-navy">
            Certaines données n'ont pas pu être chargées.
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Les statistiques affichées peuvent être incomplètes.
          </p>
        </div>
      </div>
    </div>
  )
}