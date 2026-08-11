// src/pages/offres/detail/components/ProvenanceStrip.jsx
import { Fragment } from "react"
import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { buildProvenanceSteps } from "@/tools/offre-detail.tools"
import { useOffreDetail } from "@/contexts/DetailsOffre.context"

/* La chaîne de provenance — l'ADN veille, dès l'ouverture. */
const ProvenanceStrip = () => {
  const { offre, meta } = useOffreDetail()
  const steps = buildProvenanceSteps(offre, meta)

  return (
    <div className="rounded-xl border border-outline-variant/40 bg-white/70 px-4 py-3.5 backdrop-blur-sm">
      {/* Desktop-first : ligne horizontale en base, colonne en repli mobile */}
      <div className="flex flex-row items-center gap-3 max-sm:flex-col max-sm:items-start">
        {steps.map((step, i) => (
          <Fragment key={step.t}>
            {i > 0 && (
              <span
                className="relative mx-1 h-px flex-1 overflow-hidden bg-outline-variant/60 max-sm:hidden"
                aria-hidden
              >
                <motion.span
                  className="absolute inset-y-0 w-3 rounded-full bg-brand-orange/80"
                  animate={{ left: ["-15%", "110%"] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
                />
              </span>
            )}
            <span className="flex items-center gap-2.5">
              <span
                className={cn(
                  "relative grid size-8 shrink-0 place-items-center rounded-full border bg-white",
                  step.done
                    ? "border-emerald-500/40 text-emerald-600"
                    : "border-brand-orange/50 text-brand-orange"
                )}
              >
                <step.icon className="size-3.5" aria-hidden />
                {step.done && (
                  <span
                    className="absolute -right-0.5 -top-0.5 grid size-3 place-items-center rounded-full bg-emerald-500 text-white"
                    aria-hidden
                  >
                    <Check className="size-2" strokeWidth={4.5} />
                  </span>
                )}
              </span>
              <span className="leading-tight">
                <span className="block text-[10px] font-black text-brand-navy">{step.t}</span>
                <span className="block text-[10px] font-semibold text-muted-foreground">{step.l}</span>
              </span>
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  )
}

export default ProvenanceStrip