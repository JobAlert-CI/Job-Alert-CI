// src/pages/filieres/detail/components/RecapCard.jsx
import { Fragment } from "react"
import { motion } from "framer-motion"
import { Clock, Mail, ShieldCheck, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { ChipSource } from "@/components/shared"
import { AVATARS_ABONNES, PIPELINE_RECAP } from "@/tools/filiere-detail.tools"
import { useFiliereDetail } from "@/contexts/DetailsFiliere.context"

/* Récap du jour — autonome : lit le flux chargé depuis le contexte. */
const RecapCard = () => {
  const { meta, hue, offresChargees, feedQuery } = useFiliereDetail()

  const preview = [...offresChargees].sort((a, b) => a.jours - b.jours).slice(0, 3)
  const restants = Math.max(meta.actives - preview.length, 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 36, rotate: 1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full min-w-0 max-md:mx-auto max-md:max-w-md"
    >
      <div className={cn("absolute -inset-8 rounded-full blur-3xl", hue.glow)} aria-hidden />
      <div className="absolute inset-0 translate-x-4 translate-y-5 rotate-2 overflow-hidden rounded-2xl bg-brand-navy" aria-hidden>
        <div className="absolute inset-0 bg-pattern opacity-20" />
      </div>

      {/* Badges flottants */}
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1, y: [0, -7, 0] }}
        transition={{ delay: 0.9, opacity: { duration: 0.4 }, scale: { duration: 0.4 }, y: { duration: 4.6, repeat: Infinity, ease: "easeInOut" } }}
        className={cn("absolute -top-4 left-5 z-20 inline-flex -rotate-3 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold text-white shadow-lg sm:-left-4", hue.solid)}
      >
        <Zap className="size-3" aria-hidden />
        +{meta.nouvelles} offres cette semaine
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
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
        transition={{ delay: 1.2, opacity: { duration: 0.4 }, scale: { duration: 0.4 }, y: { duration: 5.2, repeat: Infinity, ease: "easeInOut", delay: 0.6 } }}
        className="absolute -bottom-4 right-8 z-20 inline-flex rotate-2 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white px-3.5 py-1.5 text-[11px] font-bold text-on-surface shadow-hover"
      >
        <Mail className="size-3 text-brand-orange" aria-hidden />
        Envoyé à {meta.abonnes.toLocaleString("fr-FR")} abonnés
      </motion.span>

      {/* Carte */}
      <div className="relative overflow-hidden rounded-2xl border border-outline-variant/40 bg-white shadow-[0_24px_48px_-16px_rgba(15,45,77,0.22)]">
        <div className="flex items-center gap-3 border-b border-outline-variant/40 bg-surface-container-low/60 px-5 py-4">
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", hue.tile)}>
            <meta.icon className="size-4.5" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-sm font-bold text-brand-navy">Récap du jour · {meta.label}</p>
            <p className="text-[11px] text-muted-foreground">Filtré, dédoublonné, prêt à postuler</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <Clock className="size-3" aria-hidden />
            08:00
          </span>
        </div>

        {/* Pipeline */}
        <div className="border-b border-outline-variant/40 bg-surface-container-low/40 px-5 py-3">
          <div className="flex items-center">
            {PIPELINE_RECAP.map((s, i) => (
              <Fragment key={s.t}>
                {i > 0 && (
                  <span className="relative mx-2 h-px flex-1 overflow-hidden bg-outline-variant/60" aria-hidden>
                    <motion.span
                      className="absolute inset-y-0 w-3 rounded-full bg-brand-orange/80"
                      animate={{ left: ["-15%", "110%"] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
                    />
                  </span>
                )}
                <span className="flex items-center gap-2">
                  <span className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full border bg-white",
                    i === 2 ? "border-brand-orange/50 text-brand-orange" : "border-outline-variant/60 text-muted-foreground"
                  )}>
                    <s.icon className="size-3.5" aria-hidden />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[10px] font-black text-brand-navy">{s.t}</span>
                    <span className="block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{s.l}</span>
                  </span>
                </span>
              </Fragment>
            ))}
          </div>
        </div>

        {/* Aperçu des offres les plus récentes */}
        <ul className="divide-y divide-outline-variant/30 px-3">
          {feedQuery.isPending && preview.length === 0
            ? [0, 1, 2].map((i) => (
              <li key={`recap-skeleton-${i}`} className="flex items-center gap-3 px-2 py-3.5" aria-hidden="true">
                <Skeleton className="size-2 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              </li>
            ))
            : preview.map((o, i) => (
              <motion.li
                key={o.uid}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.7 + i * 0.14, ease: "easeOut" }}
                className="group flex items-center gap-3 rounded-lg px-2 py-3.5 transition-colors hover:bg-surface-container-low/60"
              >
                <span className={cn("size-2 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-150", hue.dot)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-on-surface">{o.titre}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{o.entreprise} · {o.ville}</p>
                </div>
                {o.jours === 0 && (
                  <span className="hidden shrink-0 rounded-full bg-brand-orange/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#B45309] sm:inline">
                    Nouveau
                  </span>
                )}
                <ChipSource source={o.source} />
              </motion.li>
            ))}
        </ul>

        <div className="flex items-center justify-between gap-3 border-t border-outline-variant/40 bg-surface-container-low/40 px-5 py-3.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            + {restants} autres offres dans l'email
          </span>
          <span className="shrink-0 rounded-md bg-brand-navy px-3 py-1.5 text-[11px] font-bold text-white">
            Ouvrir le récap'
          </span>
        </div>

        <div className="flex items-center gap-3 border-t border-outline-variant/40 px-5 py-3">
          <div className="flex -space-x-2" aria-hidden>
            {AVATARS_ABONNES.map((a) => (
              <span key={a.init} className={cn("grid size-6 place-items-center rounded-full border-2 border-white text-[9px] font-bold text-white", a.cls)}>
                {a.init}
              </span>
            ))}
          </div>
          <p className="text-[11px] font-medium text-muted-foreground">
            <strong className="font-bold text-brand-navy">{meta.abonnes.toLocaleString("fr-FR")} abonnés</strong>{" "}
            reçoivent ce récap chaque matin
          </p>
        </div>
      </div>
    </motion.div>
  )
}

export default RecapCard