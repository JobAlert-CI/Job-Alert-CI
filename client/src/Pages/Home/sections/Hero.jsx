// src/pages/home/sections/Hero.jsx
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, BadgeCheck, Bell, Check, Clock, Radar } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getImgSource } from "@/utils/utilsSource"
import { CountUp, CtaLink } from "@/components/shared"
import { Skeleton } from "@/components/ui/skeleton"
import { HUES } from "@/lib/hues"
import chipFloat from "@/lib/chipFloat"
import { REASSURANCES, JOBS_APERCU } from "@/data/constanteMetier"
import {
  containerVariants, 
  fadeUp,
  SCRAPE_TIME,
  EMAIL_DELIVERY_TIME,
  MAX_PREVIEW_OFFERS,
  useHomeStats,
  useFiliereStats,
  useRecentOffers,
  resolveSourceCount
} from "@/tools/home.tools"

/* ------------------------------------------------------------------ */
/*  Badge d'état de la collecte — early returns, plus de doubles blocs */
/* ------------------------------------------------------------------ */
const PulseDot = ({ color }) => (
  <span className="relative flex size-2">
    <span
      className={cn(
        "absolute inline-flex size-full animate-ping rounded-full opacity-75",
        color
      )}
    />
    <span className={cn("relative inline-flex size-2 rounded-full", color)} />
  </span>
)

const CollecteBadge = ({ isPending, isError, count }) => {
  if (isPending) return null

  if (isError) {
    return (
      <motion.div variants={fadeUp}>
        <span className="inline-flex items-center gap-2.5 rounded-full border border-amber-500/25 bg-amber-500/10 py-1.5 pl-2.5 pr-4 text-xs font-semibold text-amber-700">
          <PulseDot color="bg-amber-500" />
          Collecte du jour en cours de vérification
        </span>
      </motion.div>
    )
  }

  return (
    <motion.div variants={fadeUp}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-default items-center gap-2.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 py-1.5 pl-2.5 pr-4 text-xs font-semibold text-emerald-700">
            <PulseDot color="bg-emerald-500" />
            {count > 0
              ? `Collecte terminée · ${count} offre${count !== 1 ? "s" : ""} à ${SCRAPE_TIME}`
              : `Collecte terminée à ${SCRAPE_TIME}`}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-62.5 text-center">
          Nos scrapers analysent les sources chaque matin. Votre récapitulatif
          part à {EMAIL_DELIVERY_TIME}.
        </TooltipContent>
      </Tooltip>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Hero — consomme le cache directement, aucune prop reçue            */
/* ------------------------------------------------------------------ */
const Hero = () => {
  const {
    data: stats,
    isPending: statsPending,
    isError: statsError,
  } = useHomeStats()
  const {
    data: statsFil,
    isPending: filPending,
    isError: filError,
  } = useFiliereStats()
  const {
    data: offers,
    isPending: offersPending,
    isError: offersError,
  } = useRecentOffers()

  const hasValidOffers = !offersError && offers?.length > 0
  const displayOffers = hasValidOffers
    ? offers.slice(0, MAX_PREVIEW_OFFERS)
    : JOBS_APERCU.slice(0, MAX_PREVIEW_OFFERS)

  const newOffersCount = stats?.new_offers ?? 0
  const filieresCount = statsFil?.length
  const sourceCount = resolveSourceCount(statsFil, {
    isPending: filPending,
    isError: filError,
  })
  const remainingOffers = Math.max(0, newOffersCount - MAX_PREVIEW_OFFERS)
  const showRemainingBadge = !statsPending && !statsError && remainingOffers > 0

  // Bandeau de stats : 0 pendant le chargement ou en cas d'erreur
  const statsUnavailable = statsPending || filPending || statsError || filError
  const getStatValue = (value) => (statsUnavailable ? 0 : value)

  const STATS = [
    { value: getStatValue(newOffersCount), suffix: "", label: "offres collectées ce matin" },
    { value: getStatValue(sourceCount), suffix: "", label: "sources scannées à 6h00" },
    { value: getStatValue(filieresCount), suffix: "", label: "filières métiers couvertes" },
    { value: 8, suffix: "h00", label: "envoi quotidien garanti" },
  ]

  return (
    <section className="relative overflow-hidden hero-gradient">
      {/* Fonds décoratifs */}
      <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,166,35,0.10),transparent_50%)]"
        aria-hidden
      />
      <div
        className="absolute -bottom-40 -left-40 size-120 rounded-full bg-brand-navy/4 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 mx-auto md:max-w-7xl px-4 pb-16 pt-8 md:px-12 md:pb-20 lg:pt-10">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-16">
          {/* ═══ Colonne gauche ═══════════════════════════════════════ */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-start gap-5"
          >
            <CollecteBadge
              isPending={statsPending}
              isError={statsError}
              count={newOffersCount}
            />

            {/* Titre principal */}
            <motion.h1
              variants={fadeUp}
              className="font-heading text-4xl font-black leading-[1.06] tracking-tight text-brand-navy sm:text-5xl xl:text-6xl"
            >
              Ne cherchez plus votre emploi.{" "}
              <span className="relative whitespace-nowrap text-brand-orange">
                Il vient à vous
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
              .
            </motion.h1>

            {/* Sous-titre */}
            <motion.p
              variants={fadeUp}
              className="max-w-xl md:text-lg leading-relaxed text-on-surface-variant"
            >
              Chaque matin à{" "}
              <strong className="font-semibold text-brand-navy">
                {EMAIL_DELIVERY_TIME}
              </strong>
              , recevez par email les meilleures offres d'emploi de Côte
              d'Ivoire, filtrées selon votre métier.{" "}
              <strong className="font-semibold text-brand-navy">
                {filPending || filError ? "Plusieurs" : filieresCount}{" "}
                filière{filieresCount !== 1 ? "s" : ""}
              </strong>{" "}
              scannée{filieresCount !== 1 ? "s" : ""}, un seul email, zéro
              doublon.
            </motion.p>

            {/* Appels à l'action */}
            <motion.div
              variants={fadeUp}
              className="mt-1 flex flex-col gap-3 sm:flex-row"
            >
              <CtaLink to="/inscription" icon={Bell} animateIcon>
                Créer mon alerte gratuite
              </CtaLink>
              <CtaLink to="/offres" variant="secondary" iconRight={ArrowRight}>
                Voir les offres du jour
              </CtaLink>
            </motion.div>

            {/* Réassurances */}
            <motion.ul
              variants={fadeUp}
              className="flex flex-wrap gap-x-5 gap-y-2"
              role="list"
            >
              {REASSURANCES.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-1.5 text-xs font-medium text-on-surface-variant"
                >
                  <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500/10">
                    <Check
                      className="size-2.5 text-emerald-600"
                      strokeWidth={3}
                      aria-hidden
                    />
                  </span>
                  {item}
                </li>
              ))}
            </motion.ul>
          </motion.div>

          {/* ═══ Colonne droite — Carte email ═══════════════════════════ */}
          <motion.div
            initial={{ opacity: 0, y: 36, rotate: 1.5 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.7, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-md min-w-0 md:max-w-none"
          >
            {/* Halo décoratif */}
            <div
              className="absolute -inset-8 rounded-full bg-brand-orange/10 blur-3xl"
              aria-hidden
            />
            <div
              className="absolute inset-0 translate-x-4 translate-y-5 rotate-2 overflow-hidden rounded-2xl bg-brand-navy"
              aria-hidden
            >
              <div className="absolute inset-0 bg-pattern opacity-20" />
            </div>

            {/* Chip "8h00" */}
            <motion.span
              {...chipFloat(0.9, 4.5)}
              className="absolute -top-4 left-4 z-20 inline-flex -rotate-3 items-center gap-1.5 rounded-full bg-brand-orange px-3.5 py-1.5 text-[11px] font-bold text-white shadow-lg sm:-left-5"
            >
              <Clock className="size-3" aria-hidden />
              Envoyé à {EMAIL_DELIVERY_TIME} pile
            </motion.span>

            {/* Chip sources */}
            <motion.span
              {...chipFloat(1.1, 5.2)}
              className="absolute -right-2 top-1/4 z-20 inline-flex rotate-3 items-center gap-1.5 rounded-full bg-brand-navy px-3.5 py-1.5 text-[11px] font-bold text-white shadow-lg sm:-right-5"
            >
              <Radar className="size-3 text-brand-orange" aria-hidden />
              {filPending || filError
                ? "Sources"
                : `${sourceCount} source${sourceCount !== 1 ? "s" : ""}`}{" "}
              · {SCRAPE_TIME}
            </motion.span>

            {/* Chip 0 doublon */}
            <motion.span
              {...chipFloat(1.3, 4.8)}
              className="absolute -bottom-4 right-8 z-20 inline-flex rotate-2 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white px-3.5 py-1.5 text-[11px] font-bold text-on-surface shadow-hover"
            >
              <BadgeCheck className="size-3.5 text-emerald-500" aria-hidden />
              0 doublon envoyé
            </motion.span>

            {/* Carte email */}
            <div className="relative overflow-hidden rounded-2xl border border-outline-variant/40 bg-white shadow-[0_24px_48px_-16px_rgba(15,45,77,0.22)]">
              {/* En-tête email */}
              <div className="flex items-center gap-3 border-b border-outline-variant/40 bg-surface-container-low/60 px-5 py-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-transparent font-heading text-[11px] font-black text-white">
                  <img
                    src="/logo2.svg"
                    alt="JobAlert CI"
                    className="size-6"
                    loading="lazy"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-on-surface">
                    JobAlert CI{" "}
                    <span className="font-medium text-muted-foreground">
                      &lt;bonjour@jobalert.ci&gt;
                    </span>
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Objet : Votre récapitulatif du jour
                    {!statsPending &&
                      !statsError &&
                      newOffersCount > 0 &&
                      ` (${newOffersCount} offre${newOffersCount !== 1 ? "s" : ""})`}
                  </p>
                </div>
                <time
                  className="shrink-0 text-[11px] font-semibold text-muted-foreground"
                  dateTime="08:00"
                >
                  08:00
                </time>
              </div>

              {/* Corps email */}
              <div className="px-5 py-4">
                <p className="text-sm text-on-surface-variant">Bonjour 👋</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  <strong className="font-semibold text-on-surface">
                    {statsPending || statsError ? "Plusieurs" : newOffersCount}{" "}
                    {newOffersCount !== 1 ? "nouvelles offres" : "nouvelle offre"}
                  </strong>{" "}
                  correspondent à vos filières :
                </p>

                <ul className="mt-3 space-y-2" role="list">
                  {offersPending ? (
                    Array.from({ length: MAX_PREVIEW_OFFERS }).map((_, index) => (
                      <li
                        key={index}
                        className="rounded-lg border border-outline-variant/40 bg-white px-3.5 py-2.5"
                      >
                        <div className="flex items-center gap-3">
                          <Skeleton className="size-2 shrink-0 rounded-full" />
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <Skeleton className="h-3.5 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                          <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
                        </div>
                      </li>
                    ))
                  ) : (
                    displayOffers.map((offer, index) => (
                      <motion.li
                        key={offer.id ?? index}
                        initial={{ opacity: 0, x: -14 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: 0.75 + index * 0.14,
                          duration: 0.4,
                          ease: "easeOut",
                        }}
                        className="group flex items-center gap-3 rounded-lg border border-outline-variant/40 bg-white px-3.5 py-2.5 transition-all duration-200 hover:border-brand-orange/60 hover:shadow-soft"
                      >
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            HUES[offer.primary_filiere?.hue ?? "sky"]?.dot
                          )}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-on-surface">
                            {offer.title}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {offer.company?.name || "Entreprise"}
                          </p>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="shrink-0 gap-1 rounded-full border-outline-variant/60 bg-surface-container-low/60 px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant"
                            >
                              <img
                                src={getImgSource(
                                  offer.source?.code || offer.source?.name
                                )}
                                alt={offer.source?.name || "Source"}
                                className="size-8 object-contain"
                                loading="lazy"
                              />
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Collectée sur {offer.source?.name || "source partenaire"} à{" "}
                            {SCRAPE_TIME}
                          </TooltipContent>
                        </Tooltip>
                      </motion.li>
                    ))
                  )}
                </ul>

                {/* Pied de liste */}
                <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-surface-container-low px-3.5 py-2.5">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {showRemainingBadge &&
                      `+ ${remainingOffers} autre${remainingOffers !== 1 ? "s" : ""} offre${remainingOffers !== 1 ? "s" : ""} dans votre email`}
                  </span>
                  <Link
                    to="/inscription"
                    className="shrink-0 rounded-md bg-brand-navy px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-brand-navy/90"
                  >
                    Ouvrir le récap'
                  </Link>
                </div>
              </div>

              {/* Pied email */}
              <footer className="flex items-center gap-2 border-t border-outline-variant/40 bg-surface-container-low/40 px-5 py-2.5 text-[10px] font-medium text-muted-foreground">
                <button
                  type="button"
                  className="transition-colors hover:text-on-surface-variant hover:underline"
                >
                  Gérer mes filières
                </button>
                <span className="text-outline-variant" aria-hidden>
                  ·
                </span>
                <button
                  type="button"
                  className="transition-colors hover:text-on-surface-variant hover:underline"
                >
                  Me désinscrire en 1 clic
                </button>
              </footer>
            </div>
          </motion.div>
        </div>

        {/* ═══ Bandeau statistiques ═══════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-outline-variant/50 pt-8 md:grid-cols-4"
          role="list"
        >
          {STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1.5" role="listitem">
              <span className="h-1 w-8 rounded-full bg-brand-orange/70" aria-hidden />
              <p className="font-heading text-3xl font-black text-brand-navy md:text-4xl">
                <CountUp to={stat.value} suffix={stat.suffix} />
              </p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

export default Hero