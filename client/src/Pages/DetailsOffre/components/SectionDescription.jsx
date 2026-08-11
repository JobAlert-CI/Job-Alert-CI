// src/pages/offres/detail/components/SectionDescription.jsx
import { motion } from "framer-motion"
import { Briefcase, Check, Sparkles } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useOffreDetail } from "@/contexts/DetailsOffre.context"

const SectionDescription = () => {
  const { meta, hue, detail } = useOffreDetail()
  const avantages = detail.benefits || detail.avantages

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-xl border border-outline-variant/40 bg-white shadow-soft"
      style={{ borderTop: `3px solid ${hue.hex}` }}
      aria-labelledby="description-poste"
    >
      <div className="p-8 max-sm:p-6">
        <h2
          id="description-poste"
          className="flex items-center gap-2.5 font-heading text-xl font-extrabold text-brand-navy"
        >
          <Briefcase className="size-5 text-brand-orange" aria-hidden />
          Description du poste
        </h2>
        <p className="mt-4 leading-relaxed text-on-surface-variant">{detail.intro}</p>

        <h3 className="mt-7 font-heading text-sm font-extrabold uppercase tracking-[0.14em] text-brand-navy">
          Vos missions
        </h3>
        <ul className="mt-3.5 space-y-2.5">
          {(detail.missions || []).map((m) => (
            <li key={m} className="flex items-start gap-2.5 text-sm leading-relaxed text-on-surface-variant">
              <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-brand-orange/10">
                <Check className="size-2.5 text-brand-orange" strokeWidth={3.5} aria-hidden />
              </span>
              {m}
            </li>
          ))}
        </ul>

        <h3 className="mt-7 font-heading text-sm font-extrabold uppercase tracking-[0.14em] text-brand-navy">
          Profil recherché
        </h3>
        <ul className="mt-3.5 space-y-2.5">
          {(detail.profile_requirements || detail.profil || []).map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-sm leading-relaxed text-on-surface-variant">
              <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-brand-navy/8">
                <Check className="size-2.5 text-brand-navy" strokeWidth={3.5} aria-hidden />
              </span>
              {p}
            </li>
          ))}
        </ul>

        {avantages && (
          <>
            <h3 className="mt-7 font-heading text-sm font-extrabold uppercase tracking-[0.14em] text-brand-navy">
              Avantages
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {avantages.map((a) => (
                <span
                  key={a}
                  className="rounded-full border border-outline-variant/60 bg-surface-container-low/60 px-3 py-1.5 text-xs font-semibold text-on-surface-variant"
                >
                  {a}
                </span>
              ))}
            </div>
          </>
        )}

        <div className="mt-7 border-t border-outline-variant/40 pt-5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <Sparkles className="size-3.5 text-brand-orange" aria-hidden />
            Mots-clés de matching automatique
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {(detail.tags || []).map((kw) => (
              <Tooltip key={kw}>
                <TooltipTrigger asChild>
                  <span className="cursor-help rounded-full border border-outline-variant/60 bg-white px-3 py-1 text-xs font-medium text-on-surface-variant transition-colors hover:border-brand-navy/40 hover:text-brand-navy">
                    {kw}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Les offres contenant « {kw} » sont tagguées {meta.label}.
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>
    </motion.article>
  )
}

export default SectionDescription