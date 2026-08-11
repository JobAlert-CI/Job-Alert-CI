// src/pages/offres/sections/HeroOffres.jsx
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowRight, Bell, Check, ChevronRight, Clock, Fingerprint,
  Mail, ShieldCheck, Zap,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { CountUp, CountdownEnvoi, CtaLink, SourceLogo, Ticker } from "@/components/shared"
import { HUES, BRAND_HUE } from "@/lib/hues"
import { todayLong } from "@/lib/dates"
import { StatSkeleton } from "@/components/shared/SkeletonsOffres"
import { 
  ABONNES, 
  PIPELINE,
  useOffresFeedModel,
  useOfferReferentialsQuery, 
  useOffersOverviewQuery
} from "@/tools/offres.tools"

/* Variantes définies une seule fois au niveau module (pas recréées à chaque rendu). */
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}

/* ─────────────── Ticker — se sert dans le même cache que le feed ─────────────── */
export const OffresTicker = () => {
  const { offers } = useOffresFeedModel()
  const { data: refs } = useOfferReferentialsQuery()

  if (offers.length === 0) return null
  return (
    <Ticker
      variant="dark"
      duration={160}
      items={offers.slice(0, 24).map((o) => ({
        key: o.uid,
        dot: (HUES[refs.filieres.find((f) => f.code === o.filiere)?.hue] ?? BRAND_HUE).dot,
        titre: o.titre,
        entreprise: o.entreprise,
      }))}
    />
  )
}

/* ─────────────── FluxCard — zéro prop, lit la vue d'ensemble ─────────────── */
const FluxCard = () => {
  const { data: overview, isPending } = useOffersOverviewQuery()
  const { parSource = [], nouveaux = 0 } = overview ?? {}

  return (
    <motion.div
      initial={{ opacity: 0, y: 32, rotate: 1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full min-w-0 max-md:mx-auto max-md:max-w-md"
    >
      <div className="absolute -inset-8 rounded-full bg-brand-orange/10 blur-3xl" aria-hidden />
      <div className="absolute inset-0 translate-x-4 translate-y-5 rotate-2 overflow-hidden rounded-2xl bg-brand-navy" aria-hidden>
        <div className="absolute inset-0 bg-pattern opacity-20" />
      </div>

      {/* Badges flottants */}
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1, y: [0, -7, 0] }}
        transition={{ delay: 0.9, opacity: { duration: 0.4 }, scale: { duration: 0.4 }, y: { duration: 4.6, repeat: Infinity, ease: "easeInOut" } }}
        className="absolute -top-4 left-5 z-20 inline-flex -rotate-3 items-center gap-1.5 rounded-full bg-brand-orange px-3.5 py-1.5 text-[11px] font-bold text-white shadow-lg"
      >
        <Zap className="size-3" aria-hidden />
        +{nouveaux} offres ce matin
      </motion.span>
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.05, duration: 0.4 }}
        className="absolute -top-3 right-6 z-20 inline-flex rotate-2 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-600 shadow-soft"
      >
        <Fingerprint className="size-3" aria-hidden />
        0 doublon
      </motion.span>
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
        transition={{ delay: 1.2, opacity: { duration: 0.4 }, scale: { duration: 0.4 }, y: { duration: 5.2, repeat: Infinity, ease: "easeInOut", delay: 0.6 } }}
        className="absolute -bottom-4 right-8 z-20 inline-flex rotate-2 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white px-3.5 py-1.5 text-[11px] font-bold text-on-surface shadow-hover"
      >
        <Mail className="size-3 text-brand-orange" aria-hidden />
        Envoyé à {ABONNES.toLocaleString("fr-FR")} abonnés
      </motion.span>

      {/* Carte principale */}
      <div className="relative overflow-hidden rounded-2xl border border-outline-variant/40 bg-white shadow-[0_24px_48px_-16px_rgba(15,45,77,0.22)]">
        <div className="flex items-center gap-3 border-b border-outline-variant/40 bg-surface-container-low/60 px-5 py-4">
          <span className="relative flex size-2.5 shrink-0" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-sm font-bold text-brand-navy">
              {parSource.length || 0} source{parSource.length > 1 ? "s" : ""} → 1 flux
            </p>
            <p className="text-[11px] text-muted-foreground">Collecte terminée aujourd'hui · 06:02</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-navy px-2.5 py-1 text-[10px] font-bold text-white">
            <Clock className="size-3" aria-hidden />
            06:02
          </span>
        </div>

        <div className="px-5 pb-5 pt-4">
          {/* Les sources collectées (données API) */}
          <div className={cn("grid gap-2", parSource.length >= 4 || isPending ? "grid-cols-4" : "grid-cols-3")}>
            {isPending && parSource.length === 0
              ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-18 rounded-lg" />)
              : parSource.map((s, i) => (
                <motion.div
                  key={s.code}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 + i * 0.1, duration: 0.4 }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="relative flex cursor-default flex-col items-center gap-1.5 rounded-lg border border-outline-variant/50 bg-surface-container-low/50 px-1 py-2.5 transition-colors hover:border-brand-navy/30 hover:bg-surface-container-low">
                        <span className="absolute right-1 top-1 grid size-3.5 place-items-center rounded-full bg-emerald-500 text-white" aria-hidden>
                          <Check className="size-2" strokeWidth={4} />
                        </span>
                        <SourceLogo code={s.code} className="size-7 rounded-md text-[9px]" />
                        <span className="leading-none">
                          <span className="block font-heading text-[12px] font-extrabold text-brand-navy">+{s.nouveaux}</span>
                          <span className="mt-0.5 block text-[9px] font-semibold text-muted-foreground">{s.total} au total</span>
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {s.nouveaux} nouvelle{s.nouveaux > 1 ? "s" : ""} offre{s.nouveaux > 1 ? "s" : ""} via {s.label ?? s.code} · {s.total} active{s.total > 1 ? "s" : ""}
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              ))}
          </div>

          {/* Convergence animée vers le dé-doublonnage */}
          <svg viewBox="0 0 320 40" className="mt-1 w-full" fill="none" aria-hidden>
            {[40, 120, 200, 280].map((x, i) => (
              <motion.path
                key={x}
                d={`M${x} 0 C${x} 22 160 16 160 40`}
                stroke="#F5A623"
                strokeOpacity="0.55"
                strokeWidth="1.5"
                strokeDasharray="3 5"
                animate={{ strokeDashoffset: [0, -16] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "linear", delay: i * 0.15 }}
              />
            ))}
          </svg>

          {/* Sortie du funnel */}
          <div className="-mt-1 flex items-center gap-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2.5">
            <Fingerprint className="size-4 shrink-0 text-emerald-600" aria-hidden />
            <p className="text-xs font-bold text-emerald-700">{nouveaux} nouvelles offres · 0 doublon</p>
            <span className="ml-auto font-mono text-[10px] text-emerald-600/70 max-sm:hidden">hash_unique ✓</span>
          </div>

          {/* Pipeline du matin */}
          <div className="mt-4 rounded-lg border border-outline-variant/40 bg-surface-container-low/40 px-3.5 py-3">
            <div className="flex items-center">
              {PIPELINE.map((s, i) => (
                <span key={s.t} className="contents">
                  {i > 0 && (
                    <span className="relative mx-2 h-px flex-1 overflow-hidden bg-outline-variant/60" aria-hidden>
                      <motion.span
                        className="absolute inset-y-0 w-3 rounded-full bg-brand-orange/80"
                        animate={{ left: ["-15%", "110%"] }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
                      />
                    </span>
                  )}
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn(
                      "relative grid size-7 shrink-0 place-items-center rounded-full border bg-white",
                      s.done ? "border-emerald-500/40 text-emerald-600" : "border-brand-orange/50 text-brand-orange"
                    )}>
                      <s.icon className="size-3.5" aria-hidden />
                      {s.done && (
                        <span className="absolute -right-0.5 -top-0.5 grid size-3 place-items-center rounded-full bg-emerald-500 text-white" aria-hidden>
                          <Check className="size-2" strokeWidth={4.5} />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 leading-tight max-sm:hidden">
                      <span className="block truncate text-[10px] font-black text-brand-navy">{s.t}</span>
                      <span className="block truncate text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{s.l}</span>
                    </span>
                  </span>
                </span>
              ))}
            </div>
          </div>

          <CountdownEnvoi className="mt-8 py-4" />
        </div>
      </div>
    </motion.div>
  )
}

/* ─────────────── Héro — zéro prop, lit la vue d'ensemble ─────────────── */
const HeroOffres = () => {
  const { data: overview, isPending } = useOffersOverviewQuery()
  const { total = 0, nouveaux = 0, parSource = [] } = overview ?? {}

  const COMPTEURS = [
    { valeur: total, label: "offres en ligne" },
    { valeur: nouveaux, label: "nouvelles ce matin" },
    { valeur: parSource.length, label: "sources scannées" },
  ]

  return (
    <section className="relative overflow-hidden hero-gradient">
      <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
      <div className="absolute -top-32 right-[-10%] size-140 rounded-full bg-brand-orange/8 blur-3xl" aria-hidden />
      <div className="absolute -bottom-40 -left-40 size-120 rounded-full bg-brand-navy/5 blur-3xl" aria-hidden />

      {/* Desktop-first : paddings desktop en base, déclassement via max-md */}
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
          <span className="font-semibold text-brand-navy" aria-current="page">Offres d'emploi</span>
        </motion.nav>

        <div className="mt-8 grid grid-cols-[1.05fr_0.95fr] items-center gap-16 max-lg:grid-cols-1 max-lg:gap-14">
          {/* Colonne gauche */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex min-w-0 flex-col items-start gap-5"
          >
            {/* Badges collecte */}
            <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-[11px] font-bold text-emerald-700">
                <span className="relative flex size-1.5" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-70" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                </span>
                Collecte du jour : {todayLong()}, 06h02
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white/80 px-3.5 py-1.5 text-[11px] font-bold text-on-surface-variant">
                <ShieldCheck className="size-3 text-brand-orange" aria-hidden />
                {parSource.length || 0} source{parSource.length > 1 ? "s" : ""} scannée{parSource.length > 1 ? "s" : ""} · 0 doublon en base
              </span>
            </motion.div>

            {/* Titre */}
            <motion.h1
              variants={fadeUp}
              className="font-heading text-6xl font-black leading-[1.04] tracking-tight text-brand-navy max-xl:text-5xl max-sm:text-4xl"
            >
              Les offres{" "}
              <span className="relative whitespace-nowrap text-brand-orange">
                du jour
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
              ,<br className="max-sm:hidden" /> déjà triées.
            </motion.h1>

            {/* Message */}
            <motion.p variants={fadeUp} className="max-w-xl text-lg leading-relaxed text-on-surface-variant max-md:text-base">
              {nouveaux > 0 ? `${nouveaux} nouvelle` : "Aucune"} opportunité{nouveaux > 1 ? "s" : ""} collectée{nouveaux > 1 ? "s" : ""} ce matin sur{" "}
              {parSource.length ? parSource.map((s) => s.label ?? s.code).join(", ") : "nos sources partenaires"},
              dé-dupliquées par hash puis taggées par filière. Demain, inutile de
              revenir : votre sélection arrive par email à{" "}
              <strong className="font-bold text-brand-navy">8h00 précises</strong>.
            </motion.p>

            {/* CTA */}
            <motion.div variants={fadeUp} className="mt-1 flex gap-3 max-sm:flex-col">
              <CtaLink to="/inscription" icon={Bell} animateIcon>
                Créer mon alerte 8h00
              </CtaLink>
              <CtaLink to="/comment-ca-marche" variant="secondary" iconRight={ArrowRight}>
                Comment ça marche
              </CtaLink>
            </motion.div>

            {/* Compteurs */}
            <motion.dl variants={fadeUp} className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-4">
              {COMPTEURS.map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  {isPending ? (
                    <StatSkeleton />
                  ) : (
                    <>
                      <dd className="font-heading text-3xl font-black text-brand-navy">
                        <CountUp to={s.valeur} />
                      </dd>
                      <dd className="text-xs font-medium text-muted-foreground">{s.label}</dd>
                    </>
                  )}
                </div>
              ))}
            </motion.dl>
          </motion.div>

          {/* Colonne droite */}
          <FluxCard />
        </div>
      </div>
    </section>
  )
}

export default HeroOffres