// src/pages/conseils/components/ConseilDuJour.jsx
import { useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Lightbulb, MoveHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { HUES } from "@/lib/hues"
import useCarrousel from "@/hooks/use-carrousel"
import { useGlissement } from "@/hooks/use-glissement"
import { SegmentsProgression } from "@/components/shared"
import { DUREE_CONSEIL, variantsGlissementDoux, adaptConseilsQuotidiens, useDailyTipsQuery, useCategoriesQuery } from "@/tools/conseils.tools"
import { ConseilDuJourSkeleton } from "./SkeletonsConseils"

const ConseilDuJourVide = () => (
  <section className="border-y border-outline-variant/40 bg-surface-container-lowest">
    <div className="mx-auto flex max-w-7xl flex-row items-center justify-between gap-3 px-12 py-4 max-md:flex-col max-md:items-start max-md:px-6">
      <div className="flex items-center gap-2.5">
        <span className="relative flex size-2" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-orange opacity-70" />
          <span className="relative inline-flex size-2 rounded-full bg-brand-orange" />
        </span>
        <span className="whitespace-nowrap text-[11px] font-black uppercase tracking-[0.16em] text-brand-navy">
          Conseil du jour
        </span>
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Lightbulb className="size-4 text-brand-orange" aria-hidden />
        Pas de conseil du jour pour le moment.
      </div>
    </div>
  </section>
)

const ConseilDuJourCarrousel = ({ tips }) => {
  const { idx, setIdx, progression, pause, reprendre } = useCarrousel({
    count: tips.length,
    duree: DUREE_CONSEIL,
  })
  const { direction, onSelect, propsGlissement } = useGlissement({
    count: tips.length, idx, setIdx, pause, reprendre,
  })

  const indexSur = ((idx % tips.length) + tips.length) % tips.length
  const conseil = tips[indexSur]
  if (!conseil) return <ConseilDuJourVide />
  const hue = HUES[conseil.cat?.hue] || HUES.sky

  return (
    <section
      onMouseEnter={pause}
      onMouseLeave={reprendre}
      className="border-y border-outline-variant/40 bg-surface-container-lowest"
      aria-label="Conseil du jour"
    >
      {/* Desktop-first : rangée en base, colonne en repli mobile */}
      <div className="mx-auto flex max-w-7xl flex-row items-stretch px-12 max-md:flex-col max-md:px-6">
        <div className="z-10 flex shrink-0 items-center gap-2.5 border-outline-variant/40 py-4 pr-5 md:border-r">
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-orange opacity-70" />
            <span className="relative inline-flex size-2 rounded-full bg-brand-orange" />
          </span>
          <span className="whitespace-nowrap text-[11px] font-black uppercase tracking-[0.16em] text-brand-navy">
            Conseil du jour
          </span>
        </div>

        <motion.div
          {...propsGlissement}
          className="flex flex-1 cursor-grab select-none flex-row items-center gap-5 py-4 pl-5 active:cursor-grabbing max-sm:flex-col max-sm:items-stretch max-sm:gap-3"
        >
          <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg transition-colors duration-500", hue.tile)}>
            <Lightbulb className="size-4.5" aria-hidden />
          </span>
          <div className="min-h-10 flex-1 max-sm:min-h-12">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={indexSur}
                custom={direction}
                variants={variantsGlissementDoux}
                initial="entrer"
                animate="visible"
                exit="sortir"
              >
                <p className="text-sm font-medium leading-relaxed text-on-surface max-sm:text-[13px]">
                  {conseil.t}
                </p>
                <p className={cn("mt-1 text-[10px] font-bold uppercase tracking-[0.14em]", hue.accent)}>
                  {conseil.cat?.label}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex shrink-0 items-center gap-3.5">
            <SegmentsProgression
              count={tips.length}
              idx={indexSur}
              progression={progression}
              onSelect={onSelect}
              tone="light"
              className="w-28 max-sm:w-24"
              labels={tips.map((c) => c.t)}
            />
            <span className="rounded-full bg-surface-container px-2.5 py-1 text-[10px] font-bold text-on-surface-variant">
              n° {indexSur + 1} / {tips.length}
            </span>
            <MoveHorizontal className="pointer-coarse:block hidden size-3.5 text-muted-foreground/60" aria-hidden />
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* Délégation complète : squelette / erreur / vide / contenu. */
const ConseilDuJour = () => {
  const { data: rawTips, isPending, isError, refetch } = useDailyTipsQuery()
  const { data: categories } = useCategoriesQuery()

  const tips = useMemo(
    () => adaptConseilsQuotidiens(rawTips, categories),
    [rawTips, categories]
  )

  if (isPending) return <ConseilDuJourSkeleton />
  if (isError && tips.length === 0) {
    return (
      <section className="border-y border-outline-variant/40 bg-surface-container-lowest">
        <div className="mx-auto max-w-7xl px-12 py-4 max-md:px-6">
          <p className="text-sm text-muted-foreground" role="status">
            Conseil du jour momentanément indisponible.{" "}
            <button
              type="button"
              onClick={() => refetch()}
              className="font-bold text-brand-orange underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Recharger
            </button>
          </p>
        </div>
      </section>
    )
  }
  if (!tips.length) return <ConseilDuJourVide />
  return <ConseilDuJourCarrousel tips={tips} />
}

export default ConseilDuJour