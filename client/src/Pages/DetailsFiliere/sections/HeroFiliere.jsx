// src/pages/filieres/detail/sections/HeroFiliere.jsx
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Bell, ChevronRight, LayoutGrid, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { CountUp, CtaLink } from "@/components/shared"
import { useFiliereDetail } from "@/contexts/DetailsFiliere.context"
import RecapCard from "../components/RecapCard"

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}

/* Héro — identité de la filière, zéro prop : tout vient du contexte. */
const HeroFiliere = () => {
  const { meta, hue, offresChargees } = useFiliereDetail()
  const nouvelles = offresChargees.filter((o) => o.jours === 0).length

  const COMPTEURS = [
    { valeur: meta.actives, label: "offres actives" },
    { valeur: nouvelles, label: "nouvelles cette semaine" },
    { valeur: meta.abonnes, label: "abonnés à l'alerte" },
  ]

  return (
    <section className="relative overflow-hidden hero-gradient">
      <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
      <div className={cn("absolute -top-32 right-[-10%] size-140 rounded-full blur-3xl", hue.glow)} aria-hidden />
      <div className="absolute -bottom-40 -left-40 size-120 rounded-full bg-brand-navy/4 blur-3xl" aria-hidden />

      {/* Desktop-first : paddings desktop en base, repli via max-md */}
      <div className="relative z-10 mx-auto max-w-7xl px-12 pb-20 pt-10 max-md:px-4 max-md:pb-16 max-md:pt-8">
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
          <Link to="/filieres" className="rounded-sm transition-colors hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Filières
          </Link>
          <ChevronRight className="size-3" aria-hidden />
          <span className="font-semibold text-brand-navy" aria-current="page">{meta.label}</span>
        </motion.nav>

        {/* Desktop-first : 2 colonnes en base, empilé en repli */}
        <div className="mt-8 grid grid-cols-[1.05fr_0.95fr] items-center gap-16 max-lg:grid-cols-1 max-lg:gap-14">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-start gap-5"
          >
            <motion.div variants={fadeUp} className="flex items-center gap-3.5">
              <span className={cn("flex size-16 items-center justify-center rounded-xl shadow-soft", hue.tile)}>
                <meta.icon className="size-8" strokeWidth={1.8} aria-hidden />
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-outline-variant/50 bg-white/80 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant backdrop-blur-sm">
                <span className={cn("size-1.5 rounded-full", hue.dot)} aria-hidden />
                Filière métier
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="font-heading text-6xl font-black leading-[1.05] tracking-tight text-brand-navy max-xl:text-5xl max-sm:text-4xl"
            >
              {meta.label}
              <span className="mt-2 block text-2xl font-bold leading-snug text-on-surface-variant max-sm:text-xl">
                en Côte d'Ivoire.
              </span>
            </motion.h1>

            <motion.div variants={fadeUp}>
              <p className={cn("font-heading text-lg font-bold max-sm:text-base", hue.accent)}>{meta.tagline}</p>
              <p className="mt-2 max-w-xl text-lg leading-relaxed text-on-surface-variant max-md:text-base">
                {meta.desc} Recevez les nouveautés de la filière chaque matin à
                8h00 directement dans votre boîte mail, sans recherche, sans doublon.
              </p>
            </motion.div>

            <motion.div variants={fadeUp}>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                <Sparkles className="size-3.5 text-brand-orange" aria-hidden />
                Mots-clés de matching automatique
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {meta.keywords.map((kw) => (
                  <Tooltip key={kw}>
                    <TooltipTrigger asChild>
                      <span
                        tabIndex={0}
                        className="cursor-help rounded-full border border-outline-variant/60 bg-white/80 px-3 py-1 text-xs font-medium text-on-surface-variant backdrop-blur-sm transition-colors hover:border-brand-navy/40 hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {kw}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-56 text-center">
                      Les offres contenant « {kw} » sont automatiquement tagguées {meta.label}.
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </motion.div>

            {/* CTA — rangée en base (desktop), colonne en repli mobile */}
            <motion.div variants={fadeUp} className="mt-1 flex flex-row gap-3 max-sm:flex-col">
              <Link
                to={`/inscription?filieres=${meta.code}`}
                className={cn(
                  "group inline-flex items-center justify-center gap-2.5 rounded-lg px-7 py-3.5 text-base font-bold text-white shadow-[0_12px_28px_-8px_rgba(15,45,77,0.4)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  hue.solid
                )}
              >
                <Bell className="size-5 transition-transform duration-300 group-hover:rotate-12" aria-hidden />
                Créer une alerte {meta.label}
              </Link>
              <CtaLink to="/filieres" variant="secondary" icon={LayoutGrid}>
                Toutes les filières
              </CtaLink>
            </motion.div>

            <motion.dl variants={fadeUp} className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-4">
              {COMPTEURS.map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="font-heading text-3xl font-black text-brand-navy">
                    <CountUp to={s.valeur} />
                  </dd>
                  <dd className="text-xs font-medium text-muted-foreground">{s.label}</dd>
                </div>
              ))}
            </motion.dl>
          </motion.div>

          {/* Colonne droite — autonome */}
          <RecapCard />
        </div>
      </div>
    </section>
  )
}

export default HeroFiliere