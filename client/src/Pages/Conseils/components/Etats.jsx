// src/pages/conseils/components/Etats.jsx
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { AlertTriangle, ChevronRight, Inbox, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

export const EtatErreur = ({
  title = "Une erreur est survenue",
  detail,
  onRetry,
  compact = false,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    role="alert"
    className={cn(
      "rounded-xl border border-error/20 bg-error-container/25 text-center",
      compact ? "p-6" : "p-12"
    )}
  >
    <span className="mx-auto grid size-10 place-items-center rounded-full bg-error-container text-error">
      <AlertTriangle className="size-5" aria-hidden />
    </span>
    <h3 className="mt-4 font-heading text-lg font-bold text-brand-navy">{title}</h3>
    <p className="mt-1 text-sm text-muted-foreground">
      {detail || "Certaines données n'ont pas pu être récupérées."}
    </p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <RefreshCw className="size-4" aria-hidden />
        Réessayer
      </button>
    )}
  </motion.div>
)

export const EtatVide = ({
  title = "Aucun contenu pour le moment",
  description = "",
  action,
  icon: Icon = Inbox,
  compact = false,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    role="status"
    className={cn(
      "rounded-xl border border-dashed border-outline-variant/60 bg-white text-center",
      compact ? "p-6" : "p-12"
    )}
  >
    <span className="mx-auto grid size-10 place-items-center rounded-full bg-surface-container text-muted-foreground">
      <Icon className="size-5" aria-hidden />
    </span>
    <h3 className="mt-4 font-heading text-lg font-bold text-brand-navy">{title}</h3>
    {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    {action && <div className="mt-5 flex justify-center">{action}</div>}
  </motion.div>
)

/** Erreurs non bloquantes : chaque section dégradée est signalée, sans bloquer. */
export const BandeauErreurPartielle = ({ erreurs, onRetry }) => {
  const nb = Object.keys(erreurs || {}).length
  if (!nb) return null
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-error/20 bg-error-container/20 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-error" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-brand-navy">
            {nb} section{nb > 1 ? "s" : ""} n'a{nb > 1 ? "ont" : ""} pas pu être chargée{nb > 1 ? "s" : ""}.
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Les données affichées peuvent être incomplètes.
          </p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-brand-navy/20 px-4 py-2 text-xs font-bold text-brand-navy transition-all hover:border-brand-navy hover:bg-brand-navy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw className="size-3.5" aria-hidden />
          Recharger
        </button>
      )}
    </div>
  )
}

/** Erreur fatale : la bibliothèque ne peut pas s'afficher du tout. */
export const PageErreur = ({ onRetry }) => (
  <section className="relative overflow-hidden hero-gradient">
    <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
    <div className="relative z-10 mx-auto max-w-7xl px-12 pb-16 pt-10 max-md:px-6 max-md:pb-14 max-md:pt-8">
      <nav className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground" aria-label="Fil d'Ariane">
        <Link to="/" className="rounded-sm transition-colors hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Accueil
        </Link>
        <ChevronRight className="size-3" aria-hidden />
        <span className="font-semibold text-brand-navy" aria-current="page">Conseils & Analyses</span>
      </nav>
      <div className="mx-auto mt-16 max-w-2xl">
        <EtatErreur
          title="Impossible de charger la page Conseils"
          detail="Vérifiez votre connexion internet, puis réessayez."
          onRetry={onRetry}
        />
      </div>
    </div>
  </section>
)