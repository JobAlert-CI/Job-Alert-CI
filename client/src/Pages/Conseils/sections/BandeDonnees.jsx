// src/pages/conseils/sections/BandeDonnees.jsx
import { motion } from "framer-motion"
import { ArrowRight, Bell, TrendingUp } from "lucide-react"
import { CountUp, CtaLink } from "@/components/shared"
import { useArticlesQuery, useCategoriesQuery, useDailyTipsQuery } from "@/tools/conseils.tools"
import { Skel } from "../components/SkeletonsConseils"

/* Compteurs alimentés par le cache — chaque chiffre a son propre squelette. */
const BandeDonnees = () => {
  const { data: articles, isPending } = useArticlesQuery()
  const { data: categories } = useCategoriesQuery()
  const { data: rawDaily } = useDailyTipsQuery()

  const dailyCount = Array.isArray(rawDaily) ? rawDaily.length : rawDaily ? 1 : 0

  const STATS = [
    { v: articles.length, l: "conseils analysés" },
    { v: dailyCount, l: "conseils du jour" },
    { v: categories.length, l: "thèmes observés" },
  ]

  return (
    <section className="bg-surface-container-lowest pb-20 max-md:pb-16">
      <div className="mx-auto max-w-7xl px-12 max-md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-xl bg-brand-navy px-10 py-12 max-md:px-6 max-md:py-10"
        >
          <div className="pointer-events-none absolute inset-0 bg-pattern opacity-20" aria-hidden />
          <div className="pointer-events-none absolute -right-24 -top-24 size-105 rounded-full bg-brand-orange/15 blur-3xl" aria-hidden />
          <TrendingUp
            className="pointer-events-none absolute -bottom-10 -right-6 size-56 rotate-12 text-white/5"
            strokeWidth={1}
            aria-hidden
          />

          {/* Desktop-first : 2 colonnes en base, empilé en repli */}
          <div className="relative grid grid-cols-[1.1fr_0.9fr] items-center gap-8 max-lg:grid-cols-1">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                <TrendingUp className="size-3" aria-hidden />
                Nourri par la collecte
              </span>
              <h2 className="mt-4 font-heading text-3xl font-black leading-tight tracking-tight text-white max-sm:text-2xl">
                Nos conseils ne sortent pas de nulle part.
              </h2>
              <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-white/70">
                Chaque matin, nous analysons les offres collectées sur plusieurs sources :
                intitulés qui reviennent, compétences demandées, entreprises qui recrutent.
                C'est cette donnée qui nourrit nos conseils, pas l'inverse.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
              {STATS.map((s) => (
                <div key={s.l} className="rounded-lg border border-white/10 bg-white/5 px-3 py-4 text-center">
                  {isPending ? (
                    <Skel className="mx-auto h-9 w-14 bg-white/20" />
                  ) : (
                    <p className="font-heading text-3xl font-black text-brand-orange">
                      <CountUp to={s.v} />
                    </p>
                  )}
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-white/60">
                    {s.l}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-8 flex flex-row items-center justify-between gap-3 border-t border-white/10 pt-6 max-sm:flex-col max-sm:items-start">
            <p className="text-sm text-white/60">Curieux de voir la machine tourner ?</p>
            <div className="flex flex-row gap-2.5 max-sm:flex-col">
              <CtaLink to="/comment-ca-marche" size="md" iconRight={ArrowRight}>
                Voir le fonctionnement
              </CtaLink>
              <CtaLink to="/inscription" size="md" icon={Bell} animateIcon>
                Recevoir le brief
              </CtaLink>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default BandeDonnees