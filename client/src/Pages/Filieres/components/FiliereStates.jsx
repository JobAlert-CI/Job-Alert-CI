// src/pages/filieres/components/FiliereStates.jsx
import { motion } from "framer-motion"
import { AlertTriangle, RefreshCw, SearchX } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

/* États de la grille — composants présentationnels mémoïsables. */

export const FiliereGridSkeleton = ({ count = 12 }) => (
  <>
    <span className="sr-only" role="status">Chargement des filières…</span>
    <div
      className="mt-8 grid grid-cols-6 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1"
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={`filiere-skeleton-${i}`} className="h-40 rounded-xl" />
      ))}
    </div>
  </>
)

export const FiliereErrorState = ({ message, onRetry }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    role="alert"
    className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-12 text-center"
  >
    <AlertTriangle className="mx-auto size-10 text-destructive/70" aria-hidden />
    <h3 className="mt-4 font-heading text-lg font-bold text-brand-navy">
      Impossible de charger les filières
    </h3>
    <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
      {message || "Une erreur est survenue."}
    </p>
    <button
      type="button"
      onClick={onRetry}
      className="mt-5 inline-flex items-center gap-2 rounded-lg border border-brand-navy/20 px-5 py-2.5 text-sm font-bold text-brand-navy transition-all hover:border-brand-navy hover:bg-brand-navy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <RefreshCw className="size-4" aria-hidden /> Réessayer
    </button>
  </motion.div>
)

export const FiliereEmptyState = ({ onReset }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    role="status"
    className="mt-8 rounded-xl border border-dashed border-outline-variant/60 bg-white p-12 text-center"
  >
    <SearchX className="mx-auto size-10 text-muted-foreground/50" aria-hidden />
    <h3 className="mt-4 font-heading text-lg font-bold text-brand-navy">Aucune filière trouvée</h3>
    <p className="mt-1 text-sm text-muted-foreground">Essayez « tech », « santé », « transit »…</p>
    <button
      type="button"
      onClick={onReset}
      className="mt-5 inline-flex items-center gap-2 rounded-lg border border-brand-navy/20 px-5 py-2.5 text-sm font-bold text-brand-navy transition-all hover:border-brand-navy hover:bg-brand-navy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      Effacer la recherche
    </button>
  </motion.div>
)