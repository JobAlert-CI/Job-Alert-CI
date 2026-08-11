// src/pages/offres/detail/components/CartePostuler.jsx
import { motion } from "framer-motion"
import {
  ArrowUpRight, Bookmark, BookmarkCheck, Check, Clock, Link2, ShieldCheck,
} from "lucide-react"
import { FaLinkedin } from "react-icons/fa6"
import { cn } from "@/lib/utils"
import { ChipSource, SourceLogo } from "@/components/shared"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { publieLabel } from "@/lib/dates"
import { OFFRE_META_ROWS } from "@/tools/offre-detail.tools"
import { useOffreDetail } from "@/contexts/DetailsOffre.context"

/* Panneau postuler — carte blanche sur décalé navy (signature du site).
   Zéro prop : tout vient du contexte de page. */
const CartePostuler = () => {
  const { offre, hue, hash, saved, isSaving, toggleSave, copied, copyLink } =
    useOffreDetail()

  return (
    <motion.div
      initial={{ opacity: 0, y: 32, rotate: 1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full min-w-0 max-md:mx-auto max-md:max-w-md"
    >
      <div className={cn("absolute -inset-8 rounded-full blur-3xl", hue.glow)} aria-hidden />
      <div
        className="absolute inset-0 translate-x-4 translate-y-5 rotate-2 overflow-hidden rounded-2xl bg-brand-navy"
        aria-hidden
      >
        <div className="absolute inset-0 bg-pattern opacity-20" />
      </div>

      {/* Badges flottants */}
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1, y: [0, -7, 0] }}
        transition={{ delay: 0.9, opacity: { duration: 0.4 }, scale: { duration: 0.4 }, y: { duration: 4.6, repeat: Infinity, ease: "easeInOut" } }}
        className={cn(
          "absolute -top-4 left-5 z-20 inline-flex -rotate-3 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold text-white shadow-lg sm:-left-4",
          hue.solid
        )}
      >
        <Clock className="size-3" aria-hidden />
        {publieLabel(offre.jours)}
      </motion.span>
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.05, duration: 0.4 }}
        className="absolute -top-3 right-6 z-20 inline-flex rotate-2 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-600 shadow-soft"
      >
        <ShieldCheck className="size-3" aria-hidden />
        0 doublon
      </motion.span>

      {/* Carte */}
      <div className="relative overflow-hidden rounded-2xl border border-outline-variant/40 bg-white shadow-[0_24px_48px_-16px_rgba(15,45,77,0.22)]">
        <div className="flex items-center gap-3 border-b border-outline-variant/40 bg-surface-container-low/60 px-5 py-4">
          <SourceLogo code={offre.source} className="size-9 rounded-md" />
          <div className="min-w-0 flex-1">
            <p className="font-heading text-sm font-bold text-brand-navy">Annonce d'origine</p>
            <p className="text-[11px] text-muted-foreground">Collectée à 6h02 · lien direct</p>
          </div>
          <ChipSource source={offre.source} />
        </div>

        <div className="px-5 py-5">
          <a
            href={offre.lien || "#offre"}
            onClick={(e) => (offre.lien ? undefined : e.preventDefault())}
            className="group flex h-12 items-center justify-center gap-2.5 rounded-lg bg-brand-orange text-[15px] font-bold text-white shadow-[0_12px_28px_-8px_rgba(245,166,35,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Postuler sur {offre.sourceLabel || offre.source}
            {offre.source === "linkedin"
              ? <FaLinkedin className="size-4.5 transition-transform duration-300 group-hover:scale-110" aria-hidden />
              : <ArrowUpRight className="size-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />}
          </a>

          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <motion.button
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={toggleSave}
              disabled={isSaving}
              aria-live="polite"
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-lg border text-xs font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                saved
                  ? "border-brand-orange/50 bg-brand-orange/10 text-brand-orange"
                  : "border-outline-variant/60 bg-white text-on-surface-variant hover:border-brand-navy/40 hover:text-brand-navy"
              )}
            >
              {saved
                ? <BookmarkCheck className="size-4" aria-hidden />
                : <Bookmark className="size-4" aria-hidden />}
              {saved ? "Enregistrée" : "Enregistrer"}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={copyLink}
              aria-live="polite"
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-lg border text-xs font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                copied
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700"
                  : "border-outline-variant/60 bg-white text-on-surface-variant hover:border-brand-navy/40 hover:text-brand-navy"
              )}
            >
              {copied
                ? <Check className="size-4" aria-hidden />
                : <Link2 className="size-4" aria-hidden />}
              {copied ? "Lien copié" : "Copier le lien"}
            </motion.button>
          </div>

          {/* Métadonnées — configuration externalisée */}
          <dl className="mt-5 space-y-3 border-t border-outline-variant/40 pt-4">
            {OFFRE_META_ROWS.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-container-low text-on-surface-variant">
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <dt className="w-24 shrink-0 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {label}
                </dt>
                <dd className="min-w-0 flex-1 truncate text-[13px] font-semibold capitalize text-brand-navy">
                  {value(offre)}
                </dd>
              </div>
            ))}
          </dl>

          {/* Empreinte — focusable au clavier pour la tooltip */}
          <div className="mt-4 flex items-center justify-between rounded-lg bg-surface-container-low px-3.5 py-2.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              Empreinte de dédoublonnage
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <code
                  tabIndex={0}
                  className="cursor-help rounded-sm font-mono text-[11px] font-bold text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {hash.slice(0, 4)}…{hash.slice(-3)}
                </code>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-56 text-center">
                Calculée depuis le lien de l'annonce — garantit qu'elle n'est
                envoyée qu'une seule fois.
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default CartePostuler