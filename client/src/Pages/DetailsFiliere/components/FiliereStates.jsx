import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { AlertTriangle, LayoutGrid, RefreshCw, SearchX } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

/* ═══ SKELETON LOADER (Remplace le spinner) ═══
   Conçu pour correspondre exactement à la structure de la page 
   afin d'éliminer le Cumulative Layout Shift (CLS). */
export const FiliereLoading = () => (
  <main className="bg-background">
    {/* Hero Skeleton */}
    <section className="relative overflow-hidden hero-gradient">
      <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
      <div className="relative z-10 mx-auto max-w-7xl px-12 pb-20 pt-10 max-md:px-4 max-md:pb-16 max-md:pt-8">
        <div className="mt-8 grid grid-cols-[1.05fr_0.95fr] items-center gap-16 max-lg:grid-cols-1 max-lg:gap-14">
          <div className="flex flex-col items-start gap-5">
            <div className="flex items-center gap-3.5">
              <Skeleton className="size-16 rounded-xl" />
              <Skeleton className="h-6 w-32 rounded-full" />
            </div>
            <Skeleton className="h-14 w-full max-w-xl rounded-lg" />
            <Skeleton className="h-6 w-3/4 rounded-lg" />
            <Skeleton className="h-20 w-full max-w-md rounded-lg" />
            <div className="flex gap-3">
              <Skeleton className="h-12 w-40 rounded-lg" />
              <Skeleton className="h-12 w-32 rounded-lg" />
            </div>
          </div>
          <div className="w-full">
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </section>
    {/* Filters Skeleton */}
    <div className="sticky top-0 z-40 border-b border-outline-variant/40 bg-background/85 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-12 py-3 max-md:px-6 flex gap-2">
        <Skeleton className="h-9 w-56 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
    </div>
    {/* Flux Skeleton */}
    <section className="border-b border-outline-variant/30 bg-background py-16 max-md:py-12">
      <div className="mx-auto max-w-7xl px-12 max-md:px-6">
        <Skeleton className="h-8 w-64 rounded-lg mb-2" />
        <Skeleton className="h-10 w-96 rounded-lg mb-8" />
        <div className="mt-8 flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </section>
  </main>
)

/** Erreur réseau / serveur — distincte de la 404, avec « Réessayer ». */
export const FiliereError = ({ code, message, onRetry }) => (
  <section className="hero-gradient flex min-h-[60vh] items-center justify-center px-6 py-20">
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      role="alert"
      className="max-w-md text-center"
    >
      <span className="mx-auto flex size-16 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-8" strokeWidth={1.8} aria-hidden />
      </span>
      <h1 className="mt-5 font-heading text-3xl font-black tracking-tight text-brand-navy">
        Impossible de charger la filière « {code} »
      </h1>
      <p className="mt-3 text-on-surface-variant">
        {message || "Une erreur inattendue est survenue."} Les autres filières, elles, sont bien là.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg border border-brand-navy/20 px-5 py-2.5 text-sm font-bold text-brand-navy transition-all hover:border-brand-navy hover:bg-brand-navy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw className="size-4" aria-hidden /> Réessayer
        </button>
        <Link
          to="/filieres"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-orange px-6 py-3 text-sm font-bold text-white transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LayoutGrid className="size-4" aria-hidden />
          Voir toutes les filières
        </Link>
      </div>
    </motion.div>
  </section>
)

/** 404 réelle — la filière n'existe pas ou a été renommée. */
export const FiliereIntrouvable = ({ code }) => (
  <section className="hero-gradient flex min-h-[60vh] items-center justify-center px-6 py-20">
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      role="status"
      className="max-w-md text-center"
    >
      <span className="mx-auto flex size-16 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange">
        <SearchX className="size-8" strokeWidth={1.8} aria-hidden />
      </span>
      <h1 className="mt-5 font-heading text-3xl font-black tracking-tight text-brand-navy">
        Filière « {code} » introuvable
      </h1>
      <p className="mt-3 text-on-surface-variant">
        Cette filière n'existe pas ou a été renommée. Découvrez les filières
        couvertes par JobAlert CI.
      </p>
      <div className="mt-6 flex justify-center">
        <Link
          to="/filieres"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-orange px-6 py-3 text-sm font-bold text-white transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LayoutGrid className="size-4" aria-hidden />
          Voir toutes les filières
        </Link>
      </div>
    </motion.div>
  </section>
)