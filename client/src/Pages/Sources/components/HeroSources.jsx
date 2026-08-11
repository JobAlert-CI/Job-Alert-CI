// src/pages/sources/components/HeroSources.jsx
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowRight, Bell, ChevronRight, ShieldCheck,
} from "lucide-react"
import { CountUp, CtaLink } from "@/components/shared"
import { containerVariants, fadeUp } from "@/tools/sources.tools"
import { useSourcesContext } from "@/contexts/Sources.context"
import ConsoleScan from "./ConsoleScan"

const HeroSources = () => {
  const { totalNouveaux, nbSources } = useSourcesContext()

  return (
    <section className="relative overflow-hidden hero-gradient">
      <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
      <div
        className="absolute -top-32 right-[-10%] size-140 rounded-full bg-brand-orange/8 blur-3xl"
        aria-hidden
      />
      <div
        className="absolute -bottom-40 -left-40 size-120 rounded-full bg-brand-navy/5 blur-3xl"
        aria-hidden
      />

      {/* Desktop-first : paddings desktop en base, repli max-md */}
      <div className="relative z-10 mx-auto max-w-7xl px-12 pb-14 pt-10 max-md:px-6 max-md:pb-16 max-md:pt-8">
        <motion.nav
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          aria-label="Fil d'Ariane"
        >
          <Link to="/" className="transition-colors hover:text-brand-navy">
            Accueil
          </Link>
          <ChevronRight className="size-3" aria-hidden />
          <span className="font-semibold text-brand-navy" aria-current="page">
            Sources partenaires
          </span>
        </motion.nav>

        {/* Desktop-first : 2 colonnes en base, empilé en repli */}
        <div className="mt-8 grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 max-lg:grid-cols-1">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-start gap-5"
          >
            <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-1.5 text-[11px] font-bold text-emerald-700">
                <span className="relative flex size-1.5" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-70" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                </span>
                Collecte terminée · {nbSources}/{nbSources} sources · 06h02
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white/80 px-3.5 py-1.5 text-[11px] font-bold text-on-surface-variant">
                <ShieldCheck className="size-3 text-brand-orange" aria-hidden />
                Lecture respectueuse, zéro doublon
              </span>
            </motion.div>

            {/* Desktop-first : 6xl en base, 5xl, 4xl */}
            <motion.h1
              variants={fadeUp}
              className="font-heading text-4xl font-black leading-[1.04] tracking-tight text-brand-navy sm:text-5xl xl:text-6xl"
            >
              {nbSources} sources scannées.
              <br />
              <span className="relative whitespace-nowrap text-brand-orange">
                1 récapitulatif.
                <svg
                  className="absolute -bottom-1.5 left-0 w-full"
                  viewBox="0 0 200 9"
                  fill="none"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <motion.path
                    d="M2 6.5C60 2.5 140 2.5 198 6.5"
                    stroke="#F5A623"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    whileInView={{ pathLength: 1, opacity: 0.85 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.94, ease: "easeOut", delay: 0.5 }}
                  />
                </svg>
              </span>
              <span className="mt-1 block">0 doublon.</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="max-w-xl leading-relaxed text-on-surface-variant md:text-lg"
            >
              Chaque matin à{" "}
              <strong className="font-semibold text-brand-navy">6h00</strong>, nos scrapers
              parcourent les {nbSources} grandes plateformes d'emploi d'Afrique de l'Ouest
              pour n'en garder que l'essentiel :{" "}
              <strong className="font-semibold text-brand-navy">vos offres</strong>. Voici
              qui elles sont, et comment on les lit.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-1 flex flex-col gap-3 sm:flex-row">
              <CtaLink to="/inscription" icon={Bell} animateIcon>
                Créer mon alerte 8h00
              </CtaLink>
              <CtaLink to="/offres" variant="secondary" iconRight={ArrowRight}>
                Voir les offres du jour
              </CtaLink>
            </motion.div>

            <motion.dl
              variants={fadeUp}
              className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-4"
            >
              {[
                { valeur: nbSources, label: "sources scannées" },
                { valeur: totalNouveaux, label: "offres ce matin" },
                { valeur: 0, label: "doublon envoyé" },
                { valeur: 100, suffix: " %", label: "automatique" },
              ].map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="font-heading text-3xl font-black text-brand-navy">
                    <CountUp to={s.valeur} suffix={s.suffix ?? ""} />
                  </dd>
                  <dd className="text-xs font-medium text-muted-foreground">{s.label}</dd>
                </div>
              ))}
            </motion.dl>
          </motion.div>

          <ConsoleScan />
        </div>
      </div>
    </section>
  )
}

export default HeroSources