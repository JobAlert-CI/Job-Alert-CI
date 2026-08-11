// src/pages/offres/detail/components/OffreStates.jsx
import { motion } from "framer-motion"
import { AlertTriangle, ArrowRight, Loader2, RefreshCw, SearchX } from "lucide-react"
import { CtaLink } from "@/components/shared"

export const OffreLoading = () => (
  <main
    role="status"
    className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-background"
  >
    <Loader2 className="size-8 animate-spin text-brand-orange" aria-hidden />
    <span className="sr-only">Chargement de l'offre…</span>
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