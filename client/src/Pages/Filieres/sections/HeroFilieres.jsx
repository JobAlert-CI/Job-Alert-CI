// src/pages/filieres/sections/HeroFilieres.jsx
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, Bell, ChevronRight, LayoutGrid } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { CountUp, CtaLink } from "@/components/shared"
import { useFilieresAdapted, useGlobalStatsQuery } from "@/tools/filieres.tools"
import CollectePanel from "../components/CollectePanel"

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}

/* Héro — chaque compteur/badge dépend de SA requête :
   les stats globales n'attendent ni les filières, ni les sources, ni le ticker. */
const HeroFilieres = () => {
  const { filieres, isPending: filieresPending } = useFilieresAdapted()
  const { data: globalStats, isPending: statsPending } = useGlobalStatsQuery()

  const COMPTEURS = [
    { valeur: globalStats.new_today ?? 0, label: "nouvelles ce matin" },
    { valeur: globalStats.active_offers ?? 0, label: "offres actives" },
    { valeur: globalStats.subscribers ?? 0, label: "abonnés servis" },
  ]

  return (
    <section className="relative overflow-hidden hero-gradient">
      <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
      <div className="absolute -top-32 right-[-10%] size-140 rounded-full bg-brand-orange/8 blur-3xl" aria-hidden />
      <div className="absolute -bottom-40 -left-40 size-120 rounded-full bg-brand-navy/5 blur-3xl" aria-hidden />

      {/* Desktop-first : paddings desktop en base, repli via max-md */}
      <div className="relative z-10 mx-auto max-w-7xl px-12 pb-16 pt-14 max-md:px-6 max-md:pb-14 max-md:pt-10">
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
          <span className="font-semibold text-brand-navy" aria-current="page">Filières</span>
        </motion.nav>

        {/* Desktop-first : 2 colonnes en base, empilé en repli */}
        <div className="mt-8 grid grid-cols-[1.05fr_0.95fr] items-center gap-16 max-lg:grid-cols-1 max-lg:gap-14">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-start gap-5"
          >
            {/* Badges — chacun n'apparaît que lorsque SA donnée est prête */}
            <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2.5">
              {!filieresPending && (
                <span className="inline-flex items-center gap-2 rounded-full border border-outline-variant/50 bg-white/80 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant backdrop-blur-sm">
                  <LayoutGrid className="size-3 text-brand-orange" aria-hidden />
                  {filieres.length} filière{filieres.length > 1 ? "s" : ""} couverte{filieres.length > 1 ? "s" : ""}
                </span>
              )}
              {!statsPending && (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-1.5 text-[11px] font-bold text-emerald-700">
                  <span className="relative flex size-1.5" aria-hidden>
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-70" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                  </span>
                  Collecte 06:02 terminée
                </span>
              )}
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="font-heading text-6xl font-black leading-[1.04] tracking-tight text-brand-navy max-xl:text-5xl max-sm:text-4xl"
            >
              {filieresPending ? "Nos filières" : `${filieres.length} filières`}. Un récap.
              <span className="mt-2 block text-brand-orange">Chaque matin à 8h00.</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="max-w-xl text-lg leading-relaxed text-on-surface-variant max-md:text-base"
            >
              JobAlert CI scanne chaque jour les plus grandes plateformes d'emploi
              ivoiriennes et vous envoie le meilleur de vos filières sans recherche,
              sans doublon, sans connexion.
            </motion.p>

            {/* CTA — rangée en base (desktop), colonne en repli mobile */}
            <motion.div variants={fadeUp} className="mt-1 flex flex-row gap-3 max-sm:flex-col">
              <CtaLink to="/inscription" icon={Bell} animateIcon>
                Créer mon alerte 8h00
              </CtaLink>
              <CtaLink to="/comment-ca-marche" variant="secondary" iconRight={ArrowRight}>
                Comment ça marche
              </CtaLink>
            </motion.div>

            {/* Compteurs — squelette délégué à la requête stats uniquement */}
            <motion.dl variants={fadeUp} className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-4">
              {COMPTEURS.map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  {statsPending ? (
                    <Skeleton className="h-8 w-16" aria-hidden />
                  ) : (
                    <dd className="font-heading text-3xl font-black text-brand-navy">
                      <CountUp to={s.valeur} />
                    </dd>
                  )}
                  <dd className="text-xs font-medium text-muted-foreground">{s.label}</dd>
                </div>
              ))}
            </motion.dl>
          </motion.div>

          {/* Colonne droite — autonome, zéro prop */}
          <CollectePanel />
        </div>
      </div>
    </section>
  )
}

export default HeroFilieres