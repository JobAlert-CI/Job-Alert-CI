// src/pages/offres/detail/sections/HeroOffre.jsx
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowUpRight, Bell, CalendarDays, ChevronRight, GraduationCap, MapPin, Zap,
} from "lucide-react"
import { FaLinkedin } from "react-icons/fa6"
import { cn } from "@/lib/utils"
import { BadgeNouveau, CompanyHover, CtaLink } from "@/components/shared"
import { publieLabel } from "@/lib/dates"
import { ENTREPRISE_TOTAL_FALLBACK } from "@/tools/offre-detail.tools"
import { useOffreDetail } from "@/contexts/DetailsOffre.context"
import ProvenanceStrip from "../components/ProvenanceStrip"
import CartePostuler from "../components/CartePostuler"

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}

/* Héro — identité de l'offre + provenance + panneau postuler.
   Zéro prop : tout vient du contexte. */
const HeroOffre = () => {
  const { offre, meta, hue } = useOffreDetail()

  return (
    <section className="relative overflow-hidden hero-gradient">
      <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
      <div className={cn("absolute -top-32 right-[-10%] size-140 rounded-full blur-3xl", hue.glow)} aria-hidden />
      <div className="absolute -bottom-40 -left-40 size-120 rounded-full bg-brand-navy/5 blur-3xl" aria-hidden />

      {/* Desktop-first : paddings desktop en base, repli via max-md */}
      <div className="relative z-10 mx-auto max-w-7xl px-12 pb-16 pt-10 max-md:px-6 max-md:pb-14 max-md:pt-8">
        {/* Fil d'Ariane */}
        <motion.nav
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          aria-label="Fil d'Ariane"
        >
          <Link to="/" className="rounded-sm transition-colors hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Accueil
          </Link>
          <ChevronRight className="size-3" aria-hidden />
          <Link to="/offres" className="rounded-sm transition-colors hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Offres d'emploi
          </Link>
          <ChevronRight className="size-3" aria-hidden />
          <span className="max-w-55 truncate font-semibold text-brand-navy sm:max-w-none" aria-current="page">
            {offre.titre}
          </span>
        </motion.nav>

        {/* Desktop-first : 2 colonnes en base, empilé en repli */}
        <div className="mt-8 grid grid-cols-[1.05fr_0.95fr] items-start gap-16 max-lg:grid-cols-1 max-lg:gap-14">
          {/* Colonne gauche — l'offre */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex min-w-0 flex-col items-start gap-5"
          >
            <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2.5">
              <Link
                to={`/filieres/${meta.code}`}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border border-transparent px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  hue.tile
                )}
              >
                <meta.icon className="size-3.5" aria-hidden />
                {offre.filiereLabel}
              </Link>
              {offre.isNouveau && <BadgeNouveau />}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white/80 px-3.5 py-1.5 text-[11px] font-bold text-on-surface-variant">
                <CalendarDays className="size-3 text-brand-orange" aria-hidden />
                {publieLabel(offre.jours)}
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="font-heading text-5xl font-black leading-[1.06] tracking-tight text-brand-navy max-sm:text-4xl"
            >
              {offre.titre}
            </motion.h1>

            <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <CompanyHover offre={offre} totalOffres={ENTREPRISE_TOTAL_FALLBACK} />
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-3.5" aria-hidden />
                {offre.ville}
              </span>
              <span className="rounded-md border border-outline-variant/60 bg-white/80 px-2.5 py-0.5 text-xs font-bold text-on-surface-variant">
                {offre.contrat}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-outline-variant/60 bg-white/80 px-2.5 py-0.5 text-xs font-semibold text-on-surface-variant">
                <GraduationCap className="size-3" aria-hidden />
                {offre.niveau}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-outline-variant/60 bg-white/80 px-2.5 py-0.5 text-xs font-semibold text-on-surface-variant">
                <Zap className="size-3" aria-hidden />
                {offre.experience}
              </span>
            </motion.div>

            <motion.div variants={fadeUp} className="w-full">
              <ProvenanceStrip />
            </motion.div>

            {/* CTA — rangée en base (desktop), colonne en repli mobile */}
            <motion.div variants={fadeUp} className="mt-1 flex flex-row gap-3 max-sm:flex-col">
              <a
                href={offre.lien || "#offre"}
                onClick={(e) => (offre.lien ? undefined : e.preventDefault())}
                className="group inline-flex items-center justify-center gap-2.5 rounded-lg bg-brand-orange px-7 py-3.5 text-base font-bold text-white shadow-[0_12px_28px_-8px_rgba(245,166,35,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Postuler sur {offre.sourceLabel || offre.source}
                {offre.source === "linkedin"
                  ? <FaLinkedin className="size-4.5 transition-transform duration-300 group-hover:scale-110" aria-hidden />
                  : <ArrowUpRight className="size-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />}
              </a>
              <CtaLink to={`/inscription?filieres=${meta.code}`} variant="secondary" icon={Bell}>
                Recevoir cette filière à 8h00
              </CtaLink>
            </motion.div>
          </motion.div>

          {/* Colonne droite — le panneau d'action (autonome) */}
          <CartePostuler />
        </div>
      </div>
    </section>
  )
}

export default HeroOffre