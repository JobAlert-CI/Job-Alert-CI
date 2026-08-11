// src/pages/conseils/sections/HeroConseils.jsx
import { useMemo } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Bell, ChevronDown, ChevronRight } from "lucide-react"
import { formatApiError } from "@/api/errors"
import { CountUp, CtaLink, StatusChip } from "@/components/shared"
import { moyenneLecture, containerVariants, fadeUp, useArticlesQuery, useCategoriesQuery, useFeaturedQuery, } from "@/tools/conseils.tools"
import CarteUne from "../components/CarteUne"
import { EtatErreur } from "../components/Etats"
import { CompteursSkeleton, Skel } from "../components/SkeletonsConseils"

/* Héro autonome : compteurs ← articles, carrousel ← « à la une ».
   Chaque zone gère SON chargement (squelette local, pas de blocage global). */
const HeroConseils = () => {
  const { data: articles, isPending: articlesPending } = useArticlesQuery()
  const { data: categories } = useCategoriesQuery()
  const featured = useFeaturedQuery()

  const moyenne = useMemo(() => moyenneLecture(articles), [articles])

  const COMPTEURS = [
    { valeur: articles.length, label: "conseils publiés" },
    { valeur: categories.length, label: "thèmes couverts" },
    { valeur: moyenne, label: "min de lecture moyenne" },
  ]

  return (
    <section className="relative overflow-hidden hero-gradient">
      <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
      <div className="absolute -top-32 right-[-10%] size-140 rounded-full bg-brand-orange/8 blur-3xl" aria-hidden />
      <div className="absolute -bottom-40 -left-40 size-120 rounded-full bg-brand-navy/5 blur-3xl" aria-hidden />

      {/* Desktop-first : paddings desktop en base, repli via max-md */}
      <div className="relative z-10 mx-auto max-w-7xl px-12 pb-16 pt-10 max-md:px-6 max-md:pb-14 max-md:pt-8">
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
          <span className="font-semibold text-brand-navy" aria-current="page">Conseils & Analyses</span>
        </motion.nav>

        {/* Desktop-first : 2 colonnes en base, empilé en repli */}
        <div className="mt-8 grid grid-cols-[1.05fr_0.95fr] items-center gap-16 max-lg:grid-cols-1 max-lg:gap-14">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-start gap-5"
          >
            <motion.div variants={fadeUp}>
              <StatusChip tooltip="Un nouveau conseil publié chaque mardi à 6h02, en même temps que la collecte des 4 sources.">
                Nouveau conseil chaque mardi · 6h02
              </StatusChip>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="font-heading text-6xl font-black leading-[1.06] tracking-tight text-brand-navy max-xl:text-5xl max-sm:text-4xl"
            >
              Le marché de l'emploi ivoirien,{" "}
              <span className="relative whitespace-nowrap text-brand-orange">
                décodé
                <svg className="absolute -bottom-1.5 left-0 w-full" viewBox="0 0 200 9" fill="none" preserveAspectRatio="none" aria-hidden>
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

            <motion.p variants={fadeUp} className="max-w-xl text-lg leading-relaxed text-on-surface-variant max-md:text-base">
              CV, entretiens, salaires, tendances par filière : des conseils concrets,
              écrits à partir des offres collectées chaque matin sur nos sources.
              Pas de théorie, du terrain.
            </motion.p>

            {/* CTA — rangée en base (desktop), colonne en repli mobile */}
            <motion.div variants={fadeUp} className="mt-1 flex flex-row gap-3 max-sm:flex-col">
              <CtaLink to="/inscription" icon={Bell} animateIcon>
                Recevoir conseils + offres à 8h00
              </CtaLink>
              <CtaLink
                to="#bibliotheque"
                variant="secondary"
                iconRight={ChevronDown}
                iconRightClassName="group-hover:translate-x-0 group-hover:translate-y-0.5"
              >
                Explorer la bibliothèque
              </CtaLink>
            </motion.div>

            {/* Compteurs — squelette délégué à la requête articles */}
            <motion.dl variants={fadeUp} className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-4">
              {articlesPending ? (
                <CompteursSkeleton />
              ) : (
                COMPTEURS.map((s) => (
                  <div key={s.label}>
                    <dt className="sr-only">{s.label}</dt>
                    <dd className="font-heading text-3xl font-black text-brand-navy">
                      <CountUp to={s.valeur} />
                    </dd>
                    <dd className="text-xs font-medium text-muted-foreground">{s.label}</dd>
                  </div>
                ))
              )}
            </motion.dl>
          </motion.div>

          {/* À la une — son propre chargement / erreur / vide */}
          <div>
            {featured.isPending && featured.data.length === 0 ? (
              <Skel className="h-112 w-full rounded-2xl" />
            ) : featured.isError && featured.data.length === 0 ? (
              <EtatErreur
                compact
                title="À la une indisponible"
                detail={formatApiError(featured.error)}
                onRetry={() => featured.refetch()}
              />
            ) : (
              <CarteUne articles={featured.data} />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroConseils