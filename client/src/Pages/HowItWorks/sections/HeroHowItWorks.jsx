// src/pages/comment-ca-marche/sections/HeroHowItWorks.jsx
import { motion } from "framer-motion"
import { Bell, LayoutGrid } from "lucide-react"
import {
  CountdownEnvoi,
  CtaLink,
  ReassuranceList,
  StatusChip,
} from "@/components/shared"
import { REASSURANCES } from "@/data/constanteMetier"
import { containerVariants, fadeUp } from "@/tools/ccm.tools"
import PipelineCard from "../components/PipelineCard"

/* Desktop-first : la grille, les paddings et la typo desktop sont la base ;
 * les variantes max-* dégradent vers tablette / mobile. */
const HeroHowItWorks = () => (
  <section className="relative overflow-hidden hero-gradient">
    <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
    <div
      className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,166,35,0.10),transparent_50%)]"
      aria-hidden
    />
    <div
      className="absolute -bottom-40 -left-40 size-120 rounded-full bg-brand-navy/4 blur-3xl"
      aria-hidden
    />

    <div className="relative z-10 mx-auto max-w-7xl px-12 pb-20 pt-18 max-md:px-6 max-md:pb-16 max-lg:pt-13">
      <div className="grid grid-cols-2 items-center gap-16 max-lg:grid-cols-1 max-lg:gap-14">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-start gap-5"
        >
          <motion.div variants={fadeUp} className="flex max-md:hidden">
            <StatusChip tooltip="Scraping à 6h00, dédoublonnage à 6h15, filtrage à 7h00, envoi à 8h00 chaque jour, week-end compris.">
              Chaîne quotidienne active · dernier run à 6h02
            </StatusChip>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="font-heading text-6xl font-black leading-[1.06] tracking-tight text-brand-navy max-sm:text-4xl max-xl:text-5xl"
          >
            4 étapes. 2 heures.{" "}
            <span className="relative whitespace-nowrap text-brand-orange">
              Zéro effort
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
                  transition={{ duration: 1.6, ease: "easeOut", delay: 0.5 }}
                />
              </svg>
            </span>
            .
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="max-w-xl text-lg leading-relaxed text-on-surface-variant max-md:text-base"
          >
            Chaque matin entre{" "}
            <strong className="font-semibold text-brand-navy">6h00 et 8h00</strong>,
            JobAlert CI déroule seul toute la chaîne : collecte des différentes
            sources, dédoublonnage, filtrage par filière, puis envoi de votre
            récapitulatif. Voici exactement ce qui se passe.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-1 flex flex-row gap-3 max-sm:flex-col">
            <CtaLink to="/inscription" icon={Bell} animateIcon>
              Créer mon alerte gratuite
            </CtaLink>
            <CtaLink to="/filieres" variant="secondary" icon={LayoutGrid}>
              Toutes les filières
            </CtaLink>
          </motion.div>

          <motion.div variants={fadeUp}>
            <ReassuranceList items={REASSURANCES} />
          </motion.div>

          <CountdownEnvoi variant="horloge" className="mx-auto mt-4 max-md:mt-0" />
        </motion.div>

        {/* S'alimente seul depuis le cache — aucune prop */}
        <PipelineCard />
      </div>
    </div>
  </section>
)

export default HeroHowItWorks