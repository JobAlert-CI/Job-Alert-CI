import { motion } from "framer-motion"
import { AlertTriangle, ArrowRight, RefreshCw, SearchX } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { CtaLink } from "@/components/shared"

/**
 * État de chargement — skeleton qui mime la structure de la page détail offre
 * (hero + carte postuler + corps). Zéro prop, zéro changement de logique.
 */
export const OffreLoading = () => (
  <main aria-busy="true" className="bg-background">
    {/* ── Hero skeleton ── */}
    <section className="relative overflow-hidden hero-gradient">
      <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
      <div className="relative z-10 mx-auto max-w-7xl px-12 pb-16 pt-10 max-md:px-6 max-md:pb-14 max-md:pt-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-3 w-14 rounded" />
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-3 w-48 rounded" />
        </div>

        {/* 2 colonnes : offre + carte postuler */}
        <div className="mt-8 grid grid-cols-[1.05fr_0.95fr] items-start gap-16 max-lg:grid-cols-1 max-lg:gap-14">
          {/* Colonne gauche */}
          <div className="flex min-w-0 flex-col items-start gap-5">
            {/* Chips filière + date */}
            <div className="flex flex-wrap items-center gap-2.5">
              <Skeleton className="h-7 w-32 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-28 rounded-full" />
            </div>
            {/* Titre */}
            <Skeleton className="h-16 w-full max-w-2xl rounded-xl" />
            <Skeleton className="h-16 w-3/4 max-w-xl rounded-xl" />
            {/* Métadonnées entreprise / ville / salaire */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Skeleton className="h-5 w-36 rounded" />
              <Skeleton className="h-5 w-28 rounded" />
              <Skeleton className="h-5 w-32 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
            {/* Provenance strip */}
            <div className="w-full rounded-xl border border-outline-variant/40 bg-card/70 px-4 py-3.5">
              <div className="flex items-center gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    {i > 0 && <Skeleton className="h-px w-12 max-sm:hidden" />}
                    <Skeleton className="size-8 rounded-full" />
                    <div className="space-y-1.5 max-sm:hidden">
                      <Skeleton className="h-2.5 w-16" />
                      <Skeleton className="h-2 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* CTA */}
            <div className="mt-1 flex flex-row gap-3 max-sm:flex-col">
              <Skeleton className="h-12 w-56 rounded-lg" />
              <Skeleton className="h-12 w-48 rounded-lg" />
            </div>
          </div>

          {/* Colonne droite — carte postuler */}
          <div className="relative w-full min-w-0 max-md:mx-auto max-md:max-w-md">
            <div className="relative overflow-hidden rounded-2xl border border-outline-variant/40 bg-card shadow-soft">
              <div className="flex items-center gap-3 border-b border-outline-variant/40 bg-surface-container-low/60 px-5 py-4">
                <Skeleton className="size-9 rounded-md" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <div className="px-5 py-5 space-y-3">
                <Skeleton className="h-12 w-full rounded-lg" />
                <div className="grid grid-cols-2 gap-2.5">
                  <Skeleton className="h-10 rounded-lg" />
                  <Skeleton className="h-10 rounded-lg" />
                </div>
                <div className="space-y-3 border-t border-outline-variant/40 pt-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="size-8 rounded-lg" />
                      <Skeleton className="h-2.5 w-20" />
                      <Skeleton className="h-3.5 flex-1" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* ── Corps skeleton ── */}
    <section className="border-b border-outline-variant/30 bg-background py-18 max-md:py-14">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_360px] gap-10 px-12 max-lg:grid-cols-1 max-md:px-6">
        {/* Description */}
        <div className="min-w-0 space-y-6">
          <div className="rounded-xl border border-outline-variant/40 bg-card p-8 shadow-soft max-sm:p-6 space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <div className="mt-4 space-y-2.5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-6 w-24 rounded-full" />
              ))}
            </div>
          </div>
          {/* Entreprise */}
          <div className="rounded-xl border border-outline-variant/40 bg-card p-7 shadow-soft max-sm:p-6 space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="flex items-center gap-4">
              <Skeleton className="size-14 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-6 self-start max-lg:static">
          {/* Alerte */}
          <div className="rounded-xl bg-brand-navy p-6 space-y-3">
            <Skeleton className="h-6 w-28 rounded-full bg-white/10" />
            <Skeleton className="h-5 w-full bg-white/10" />
            <Skeleton className="h-5 w-3/4 bg-white/10" />
            <Skeleton className="h-4 w-full bg-white/10" />
            <Skeleton className="h-11 w-full rounded-md bg-white/10" />
            <Skeleton className="h-11 w-full rounded-md bg-white/10" />
          </div>
          {/* Mini collecte */}
          <div className="rounded-xl border border-outline-variant/40 bg-card p-5 shadow-soft space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-32" />
            <div className="flex items-center gap-2 border-t border-outline-variant/40 pt-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="size-6 rounded" />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>

    <span className="sr-only" role="status">Chargement de l'offre…</span>
  </main>
)

/** Erreur réseau / serveur — distincte de la 404, avec « Réessayer ». */
export const OffreError = ({ message, onRetry }) => (
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
        L'offre n'a pas pu être chargée
      </h1>
      <p className="mt-3 text-on-surface-variant">
        {message || "Une erreur inattendue est survenue."} Les offres du jour,
        elles, sont bien là.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg border border-brand-navy/20 px-5 py-2.5 text-sm font-bold text-brand-navy transition-all hover:border-brand-navy hover:bg-brand-navy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw className="size-4" aria-hidden /> Réessayer
        </button>
        <CtaLink to="/offres" iconRight={ArrowRight}>
          Voir les offres du jour
        </CtaLink>
      </div>
    </motion.div>
  </section>
)

/** 404 réelle — l'offre a été retirée ou le lien a expiré. */
export const OffreIntrouvable = ({ id }) => (
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
        Offre n° {id} introuvable
      </h1>
      <p className="mt-3 text-on-surface-variant">
        Elle a peut-être été retirée par le recruteur, ou son lien a expiré.
        Les offres du jour, elles, sont bien là.
      </p>
      <div className="mt-6 flex justify-center">
        <CtaLink to="/offres" iconRight={ArrowRight}>
          Voir les offres du jour
        </CtaLink>
      </div>
    </motion.div>
  </section>
)