// src/pages/home/sections/HowItWorks.jsx
import { useRef } from "react"
import { Link } from "react-router-dom"
import { motion, useScroll, useSpring } from "framer-motion"
import {
  ArrowRight,
  Check,
  Clock,
  Fingerprint,
  Radar,
  Send,
  SlidersHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { SectionHeading } from "@/components/shared"
import { SOURCE_COUNT_FALLBACK, useFiliereStats, getActiveSourcesCount } from "@/tools/home.tools"

const HowItWorks = () => {
  // Se sert dans le même cache que Hero → aucune requête supplémentaire
  const { data: statsFil } = useFiliereStats()
  const activeCount = getActiveSourcesCount(statsFil)
  const sourceCount =
    Number.isFinite(activeCount) && activeCount > 0
      ? Math.max(activeCount, SOURCE_COUNT_FALLBACK)
      : SOURCE_COUNT_FALLBACK

  const timelineRef = useRef(null)
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start 0.85", "end 0.6"],
  })
  const railMobile = useSpring(scrollYProgress, {
    stiffness: 110,
    damping: 28,
    restDelta: 0.001,
  })

  const STEPS = [
    {
      time: "06h00",
      icon: Radar,
      title: "Collecte",
      text: `Nos ${sourceCount} scrapers parcourent les sites partenaires à la recherche des dernières publications.`,
      chip: `${sourceCount} sources scannées`,
    },
    {
      time: "06h15",
      icon: Fingerprint,
      title: "Dédoublonnage",
      text: "Chaque offre reçoit une empreinte unique calculée depuis son lien. Une offre déjà vue est ignorée, pour toujours.",
      chip: "0 doublon envoyé",
    },
    {
      time: "07h00",
      icon: SlidersHorizontal,
      title: "Filtrage",
      text: "Les nouvelles offres sont croisées avec les 1 à 3 filières métiers que vous avez choisies à l'inscription.",
      chip: "100 % pertinent",
    },
    {
      time: "08h00",
      icon: Send,
      title: "Votre récapitulatif",
      text: "Un seul email, vos offres, vos liens. Vous postulez pendant que les autres commencent à peine à chercher.",
      chip: "1 email par jour",
      highlight: true,
    },
  ]

  return (
    <section className="relative overflow-hidden bg-surface-container-lowest py-20 md:py-24">
      <div
        className="pointer-events-none absolute inset-0 bg-pattern opacity-40"
        aria-hidden
      />
      <div className="relative mx-auto max-w-7xl px-6 md:px-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="La chaîne quotidienne"
            title={
              <>
                Pendant que vous dormez, votre récap{" "}
                <span className="text-brand-orange">se prépare tout seul</span>.
              </>
            }
            sub="Chaque matin, la même chaîne s'exécute sans intervention humaine entre 6h00 et 8h00. Voici ce qui se passe pendant ce temps."
          />
          <span className="hidden items-center gap-2 rounded-full border border-outline-variant/50 bg-white px-4 py-2 text-xs font-semibold text-on-surface-variant md:inline-flex">
            <Clock className="size-3.5 text-brand-orange" aria-hidden />
            100 % automatique / 0 action de votre part
          </span>
        </div>

        <div ref={timelineRef} className="relative mt-12 lg:mt-16">
          {/* Rail mobile */}
          <div
            className="absolute bottom-8 left-6.75 top-8 w-0.5 bg-outline-variant/40 lg:hidden"
            aria-hidden
          />
          <motion.div
            style={{ scaleY: railMobile }}
            className="absolute bottom-8 left-6.75 top-8 w-0.5 origin-top bg-brand-orange lg:hidden"
            aria-hidden
          />
          {/* Rail desktop */}
          <div
            className="absolute left-0 right-0 top-7 hidden h-0.5 bg-outline-variant/40 lg:block"
            aria-hidden
          />
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            className="absolute left-0 right-0 top-7 hidden h-0.5 origin-left bg-brand-orange lg:block"
            aria-hidden
          />

          <div className="grid lg:grid-cols-4 lg:gap-8">
            {STEPS.map((step, index) => (
              <motion.div
                key={step.time}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.12,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="relative flex gap-5 lg:flex-col lg:gap-0"
              >
                <div className="relative z-10 shrink-0 lg:mb-6">
                  <span
                    className={cn(
                      "flex size-14 items-center justify-center rounded-full border-2 bg-white",
                      step.highlight
                        ? "border-brand-orange bg-brand-orange text-white shadow-[0_8px_20px_rgba(245,166,35,0.35)]"
                        : "border-outline-variant/60 text-brand-navy"
                    )}
                  >
                    <step.icon className="size-6" strokeWidth={2} />
                  </span>
                </div>
                <div
                  className={cn(
                    "flex-1 pb-10 lg:pb-0",
                    index === STEPS.length - 1 && "pb-0"
                  )}
                >
                  <div
                    className={cn(
                      step.highlight && "rounded-xl bg-brand-navy p-5 lg:p-6"
                    )}
                  >
                    <p
                      className={cn(
                        "font-heading text-2xl font-black tracking-tight",
                        step.highlight ? "text-brand-orange" : "text-brand-navy"
                      )}
                    >
                      {step.time}
                    </p>
                    <h3
                      className={cn(
                        "mt-1 font-heading text-lg font-bold",
                        step.highlight ? "text-white" : "text-brand-navy"
                      )}
                    >
                      {step.title}
                    </h3>
                    <p
                      className={cn(
                        "mt-2 text-sm leading-relaxed",
                        step.highlight ? "text-white/70" : "text-on-surface-variant"
                      )}
                    >
                      {step.text}
                    </p>
                    <span
                      className={cn(
                        "mt-3.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
                        step.highlight
                          ? "border-white/20 bg-white/10 text-white"
                          : "border-outline-variant/50 bg-surface-container-low/60 text-on-surface-variant"
                      )}
                    >
                      <Check
                        className={cn(
                          "size-3",
                          step.highlight ? "text-brand-orange" : "text-emerald-600"
                        )}
                        strokeWidth={3}
                        aria-hidden
                      />
                      {step.chip}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-14 flex flex-col items-start justify-between gap-4 rounded-xl border border-outline-variant/50 bg-surface-container-low/60 px-6 py-5 sm:flex-row sm:items-center"
        >
          <p className="text-sm text-on-surface-variant">
            <strong className="font-semibold text-brand-navy">
              Et vous, pendant ce temps ?
            </strong>{" "}
            Rien. C'est exactement le but : l'information vient à vous, jamais
            l'inverse.
          </p>
          <Link
            to="/comment-ca-marche"
            className="group inline-flex shrink-0 items-center gap-2 text-sm font-bold text-brand-navy transition-colors hover:text-brand-orange"
          >
            Voir le fonctionnement en détail
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

export default HowItWorks