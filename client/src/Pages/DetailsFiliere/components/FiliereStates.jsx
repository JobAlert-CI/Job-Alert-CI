// src/pages/filieres/detail/components/FiliereStates.jsx
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { AlertTriangle, LayoutGrid, Loader2, RefreshCw, SearchX } from "lucide-react"

export const FiliereLoading = () => (
  <main role="status" className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-background">
    <Loader2 className="size-8 animate-spin text-brand-orange" aria-hidden />
    <span className="sr-only">Chargement de la filière…</span>
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