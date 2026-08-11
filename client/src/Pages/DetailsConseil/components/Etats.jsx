// src/pages/conseils/detail/components/Etats.jsx
import { motion } from "framer-motion"
import { AlertTriangle, ArrowRight, Inbox, RefreshCw, SearchX } from "lucide-react"
import { cn } from "@/lib/utils"
import { CtaLink } from "@/components/shared"

/* Brique de base (locale — ne pas confondre avec le Skeleton shadcn). */
export const Skel = ({ className }) => (
  <div aria-hidden className={cn("animate-pulse rounded-lg bg-surface-container-high", className)} />
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

/* Squelette complet — chaque zone reprend la structure desktop-first réelle
   (aucun saut de mise en page à l'arrivée des données). */
export const DetailSkeleton = () => (
  <main aria-busy="true">
    <span className="sr-only" role="status">Chargement de l'article…</span>

    <section className="relative overflow-hidden hero-gradient">
      <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
      <div className="relative z-10 mx-auto max-w-7xl px-12 pb-16 pt-10 max-md:px-6 max-md:pb-14 max-md:pt-8">
        <Skel className="h-4 w-72" />
        <div className="mt-8 grid grid-cols-[1.05fr_0.95fr] items-start gap-16 max-lg:grid-cols-1 max-lg:gap-14">
          <div className="space-y-5">
            <Skel className="h-7 w-56 rounded-full" />
            <Skel className="h-12 w-full max-w-xl" />
            <Skel className="h-5 w-full max-w-2xl" />
            <Skel className="h-12 w-full max-w-md" />
            <Skel className="h-12 w-full max-w-lg" />
          </div>
          <Skel className="h-120 w-full rounded-2xl" />
        </div>
      </div>
    </section>

    <section className="border-b border-outline-variant/30 bg-background py-18 max-md:py-14">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_320px] gap-10 px-12 max-lg:grid-cols-1 max-md:px-6">
        <div className="space-y-6">
          {[0, 1, 2, 3].map((i) => <Skel key={`corps-skel-${i}`} className="h-24 w-full rounded-xl" />)}
        </div>
        <div className="space-y-6">
          <Skel className="h-40 rounded-xl" />
          <Skel className="h-64 rounded-xl" />
          <Skel className="h-52 rounded-xl" />
        </div>
      </div>
    </section>

    <section className="bg-surface-container-lowest py-20 max-md:py-16">
      <div className="mx-auto max-w-7xl px-12 max-md:px-6">
        <Skel className="h-8 w-72" />
        <div className="mt-10 grid grid-cols-3 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
          {[0, 1, 2].map((i) => <Skel key={`carte-skel-${i}`} className="h-56 rounded-xl" />)}
        </div>
      </div>
    </section>
  </main>
)

/** Erreur réseau / serveur — distincte de la 404, avec « Réessayer ». */
export const ErreurDetail = ({ slug, detail, onRetry }) => (
  <section className="hero-gradient flex min-h-[60vh] items-center justify-center px-6 py-20">
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      role="alert"
      className="max-w-md text-center"
    >
      <span className="mx-auto flex size-16 items-center justify-center rounded-xl bg-error-container/40 text-error">
        <AlertTriangle className="size-8" strokeWidth={1.8} aria-hidden />
      </span>
      <h1 className="mt-5 font-heading text-3xl font-black tracking-tight text-brand-navy">
        Impossible de charger ce conseil
      </h1>
      <p className="mt-3 text-on-surface-variant">
        {detail || "Une erreur est survenue pendant la récupération de l'article."}
      </p>
      {slug && (
        <p className="mt-2 text-xs text-muted-foreground">
          Référence : <span className="font-semibold">{slug}</span>
        </p>
      )}
      <div className="mt-6 flex flex-row items-center justify-center gap-3 max-sm:flex-col">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw className="size-4" aria-hidden />
            Réessayer
          </button>
        )}
        <CtaLink to="/conseils" variant="outline" iconRight={ArrowRight}>
          Voir tous les conseils
        </CtaLink>
      </div>
    </motion.div>
  </section>
)

/** 404 réelle — l'article n'existe pas ou a été archivé. */
export const ConseilIntrouvable = ({ slug }) => (
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
        Conseil introuvable
      </h1>
      <p className="mt-3 text-on-surface-variant">
        L'article « {slug || "inconnu"} » n'existe pas ou a été archivé.
        La bibliothèque, elle, est bien à jour.
      </p>
      <div className="mt-6 flex justify-center">
        <CtaLink to="/conseils" iconRight={ArrowRight}>
          Voir tous les conseils
        </CtaLink>
      </div>
    </motion.div>
  </section>
)