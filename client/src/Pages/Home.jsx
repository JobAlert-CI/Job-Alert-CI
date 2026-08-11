import { useCallback, useMemo, useRef } from "react"
import { Link } from "react-router-dom"
import { motion, useScroll, useSpring } from "framer-motion"
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Bell, Check, Clock, Fingerprint,
  MessageCircleQuestion, Radar, Send, SlidersHorizontal, Zap,
} from "lucide-react"

import { cn } from "@/lib/utils"
import Seo from "@/components/seo/Seo"
import { Badge } from "@/components/ui/badge"
import { homeSeo } from "@/lib/seo"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getImgSource } from "@/utils/utilsSource"
import {
  CountUp,
  SectionHeading,
  CtaLink,
  FeedOffreCard,
  TemoignageCard,
  FaqSection,
} from "@/components/shared"
import { getOfferSats, getOfferSatsByFiliere } from "@/api/public/stats"
import { getOffers } from "@/api/public/offers"
import { useFetchData } from "@/hooks/use-fetch-data"
import { Skeleton } from "@/components/ui/skeleton"
import { HUES } from "@/lib/hues"
import getFiliereTheme from "@/lib/filiere-theme"
import chipFloat from "@/lib/chipFloat"
import { REASSURANCES, QUESTIONS, TEMOIGNAGES, JOBS_APERCU } from "@/data/constanteMetier"

/* ------------------------------------------------------------------ */
/*  Constantes métier                                                 */
/* ------------------------------------------------------------------ */

const SCRAPE_TIME = "6h02"
const EMAIL_DELIVERY_TIME = "8h00"
const MAX_PREVIEW_OFFERS = 4
const MAX_RECENT_OFFERS = 6
const SOURCE_COUNT_FALLBACK = 4

/* ------------------------------------------------------------------ */
/*  Animations                                                        */
/* ------------------------------------------------------------------ */

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
const buildRepartition = (statsFil) => {
  const rows = Array.isArray(statsFil) ? statsFil : []
  const hasNewOffers = rows.some((row) => (row?.new_offers ?? 0) > 0)

  const items = rows
    .map((row) => {
      const theme = getFiliereTheme(row?.code)
      const count = hasNewOffers
        ? row?.new_offers ?? 0
        : row?.total_offers ?? 0

      return {
        id: row?.id ?? row?.code ?? row?.label,
        code: row?.code,
        label: row?.label ?? "Filière",
        count,
        color: theme.bar,
      }
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  const max = Math.max(...items.map((item) => item.count), 1)
  const totalMetric = rows.reduce(
    (acc, row) =>
      acc + (hasNewOffers ? row?.new_offers ?? 0 : row?.total_offers ?? 0),
    0
  )

  return {
    mode: hasNewOffers ? "new" : "total",
    totalMetric,
    items: items.map((item) => ({
      ...item,
      pct: Math.max(8, Math.round((item.count / max) * 100)),
    })),
  }
}

/* ------------------------------------------------------------------ */
/*  Skeletons                                                         */
/* ------------------------------------------------------------------ */

const OfferSkeleton = () => (
  <li className="rounded-xl border border-outline-variant/40 bg-white p-5">
    <div className="flex items-start gap-4">
      <Skeleton className="size-12 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2.5">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-8 w-24 shrink-0 rounded-full" />
    </div>
  </li>
)

const RepartitionSkeleton = () => (
  <div className="mt-5 flex flex-1 flex-col">
    <Skeleton className="h-12 w-24 rounded-md bg-white/20" />
    <Skeleton className="mt-3 h-3 w-44 rounded-full bg-white/20" />

    <div className="mt-6 space-y-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index}>
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3 w-2/3 rounded-full bg-white/20" />
            <Skeleton className="h-3 w-6 rounded-full bg-white/15" />
          </div>
          <Skeleton className="mt-2 h-1.5 w-full rounded-full bg-white/15" />
        </div>
      ))}
    </div>
  </div>
)

const EmptyOffers = ({ onRetryOffers }) => (
  <li className="rounded-xl border border-dashed border-outline-variant/70 bg-surface-container-low/40 px-6 py-12 text-center">
    <p className="font-heading text-base font-bold text-brand-navy">
      Aucune nouvelle offre pour le moment.
    </p>
    <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
      La prochaine collecte arrive à 6h00. Inscrivez-vous pour recevoir votre
      récapitulatif personnalisé à 8h00.
    </p>

    <div className="flex items-center justify-center-safe gap-3">
      <Link
        to="/inscription"
        className="mt-5 inline-flex items-center gap-2 rounded-md bg-brand-orange px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-orange/90"
      >
        <Bell className="size-4" aria-hidden />
        Créer mon alerte gratuite
      </Link>

      {onRetryOffers && (
        <button
          type="button"
          onClick={onRetryOffers}
          className="mt-5 inline-flex items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-1.5 font-bold text-amber-900 transition-colors hover:bg-amber-100"
        >
          Réessayer
        </button>
      )}
    </div>
  </li>
)


/* ------------------------------------------------------------------ */
/*  Page Home                                                         */
/* ------------------------------------------------------------------ */

const Home = () => {
  const fetchStats = useCallback(async () => {
    return await getOfferSats()
  }, [])

  const fetchFiliereStats = useCallback(async () => {
    return await getOfferSatsByFiliere({ limit: 28 })
  }, [])

  const fetchOffers = useCallback(async () => {
    return await getOffers({ limit: MAX_RECENT_OFFERS })
  }, [])

  const statsQuery = useFetchData(fetchStats)
  const statsFilQuery = useFetchData(fetchFiliereStats)
  const offersQuery = useFetchData(fetchOffers)

  const activeSourcesCount = statsFilQuery.data?.filter(
    (filiere) => (filiere?.new_offers ?? 0) > 0
  )?.length

  return (
    <>
      <Seo {...homeSeo} />

      <main>
        <Hero
          stats={statsQuery.data}
          loadingStats={statsQuery.isLoading}
          errorStats={statsQuery.error}
          statsFil={statsFilQuery.data}
          loadingStatsFil={statsFilQuery.isLoading}
          errorStatsFill={statsFilQuery.error}
          offers={offersQuery.data}
          loadingOffers={offersQuery.isLoading}
          errorOffers={offersQuery.error}
        />

        <HowItWorks sourcesAct={activeSourcesCount} />

        <RecentOffers
          stats={statsQuery.data}
          loadingStats={statsQuery.isLoading}
          errorStats={statsQuery.error}
          statsFil={statsFilQuery.data}
          loadingStatsFil={statsFilQuery.isLoading}
          errorStatsFill={statsFilQuery.error}
          offers={offersQuery.data}
          loadingOffers={offersQuery.isLoading}
          errorOffers={offersQuery.error}
          onRetryStatsFil={statsFilQuery.reload}
          onRetryOffers={offersQuery.reload}
        />

        <FaqSection
          eyebrow="FAQ"
          title="Vos questions, nos réponses."
          sub="Le fonctionnement de JobAlert CI, expliqué sans jargon. Et si quelque chose manque, on vous répond."
          questions={QUESTIONS}
          separated={false}
          aside={{
            icon: MessageCircleQuestion,
            title: "Vous ne trouvez pas votre réponse ?",
            text: "Écrivez-nous via le formulaire de contact — réponse en moins de 24 h ouvrées.",
            to: "/contact",
            cta: "Poser ma question",
          }}
        />

        <Testimonials />
      </main>
    </>
  )
}


/* ------------------------------------------------------------------ */
/*  Hero                                                              */
/* ------------------------------------------------------------------ */

const Hero = ({
  stats,
  loadingStats,
  errorStats,
  statsFil,
  loadingStatsFil,
  errorStatsFill,
  offers,
  loadingOffers,
  errorOffers,
}) => {

  const hasValidOffers = !errorOffers && offers?.length > 0
  const displayOffers = hasValidOffers
    ? offers?.slice(0, MAX_PREVIEW_OFFERS)
    : JOBS_APERCU.slice(0, MAX_PREVIEW_OFFERS)

  const newOffersCount = stats?.new_offers ?? 0
  const filieresCount = statsFil?.length
  const activeSourcesCount = statsFil?.filter(
    (filiere) => (filiere?.new_offers ?? 0) > 0
  ).length

  const sourceCount =
    !loadingStatsFil && !errorStatsFill && activeSourcesCount > 0
      ? activeSourcesCount
      : SOURCE_COUNT_FALLBACK

  const remainingOffers = Math.max(0, newOffersCount - MAX_PREVIEW_OFFERS)
  const showRemainingBadge =
    !loadingStats && !errorStats && remainingOffers > 0

  const statsLoading = loadingStats || loadingStatsFil
  const statsError = errorStats || errorStatsFill

  const getStatValue = (value) => {
    if (statsLoading || statsError) return 0
    return value
  }

  const STATS = [
    {
      value: getStatValue(newOffersCount),
      suffix: "",
      label: "offres collectées ce matin",
    },
    {
      value: getStatValue(sourceCount),
      suffix: "",
      label: "sources scannées à 6h00",
    },
    {
      value: getStatValue(filieresCount),
      suffix: "",
      label: "filières métiers couvertes",
    },
    {
      value: 8,
      suffix: "h00",
      label: "envoi quotidien garanti",
    },
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
            {!loadingStats && errorStats && (
              <motion.div variants={fadeUp}>
                <span className="inline-flex items-center gap-2.5 rounded-full border border-amber-500/25 bg-amber-500/10 py-1.5 pl-2.5 pr-4 text-xs font-semibold text-amber-700">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-500 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
                  </span>
                  Collecte du jour en cours de vérification
                </span>
              </motion.div>
            )}

            {!loadingStats && !errorStats && (
              <motion.div variants={fadeUp}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-default items-center gap-2.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 py-1.5 pl-2.5 pr-4 text-xs font-semibold text-emerald-700">
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                      </span>
                      {newOffersCount > 0
                        ? `Collecte terminée · ${newOffersCount} offre${newOffersCount !== 1 ? "s" : ""
                        } à ${SCRAPE_TIME}`
                        : `Collecte terminée à ${SCRAPE_TIME}`}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    className="max-w-62.5 text-center"
                  >
                    Nos scrapers analysent les sources chaque matin. Votre
                    récapitulatif part à {EMAIL_DELIVERY_TIME}.
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            )}

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
                {loadingStatsFil || errorStatsFill
                  ? "Plusieurs"
                  : filieresCount}{" "}
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
              {loadingStatsFil || errorStatsFill
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
                    {!loadingStats &&
                      !errorStats &&
                      newOffersCount > 0 &&
                      ` (${newOffersCount} offre${newOffersCount !== 1 ? "s" : ""
                      })`}
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
                    {loadingStats || errorStats ? "Plusieurs" : newOffersCount}{" "}
                    {newOffersCount !== 1 ? "nouvelles offres" : "nouvelle offre"}
                  </strong>{" "}
                  correspondent à vos filières :
                </p>

                <ul className="mt-3 space-y-2" role="list">
                  {loadingOffers ? (
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
                      `+ ${remainingOffers} autre${remainingOffers !== 1 ? "s" : ""
                      } offre${remainingOffers !== 1 ? "s" : ""} dans votre email`}
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
              <span
                className="h-1 w-8 rounded-full bg-brand-orange/70"
                aria-hidden
              />
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

/* ------------------------------------------------------------------ */
/*  HowItWorks                                                        */
/* ------------------------------------------------------------------ */

const HowItWorks = ({ sourcesAct = 0 }) => {
  const timelineRef = useRef(null)
  const sourceCount =
    Number.isFinite(sourcesAct) && sourcesAct > 0
      ? Math.max(sourcesAct, SOURCE_COUNT_FALLBACK)
      : SOURCE_COUNT_FALLBACK

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
                          step.highlight
                            ? "text-brand-orange"
                            : "text-emerald-600"
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

/* ------------------------------------------------------------------ */
/*  RecentOffers                                                      */
/* ------------------------------------------------------------------ */

const RecentOffers = ({
  stats,
  loadingStats,
  errorStats,
  statsFil,
  loadingStatsFil,
  errorStatsFill,
  offers,
  loadingOffers,
  errorOffers,
  onRetryStatsFil,
  onRetryOffers,
}) => {

  const repartition = useMemo(
    () => buildRepartition(statsFil),
    [statsFil]
  )

  const newOffersCount = !loadingStats && !errorStats
    ? stats?.new_offers ?? null
    : null

  const totalOffersCount = !loadingStats && !errorStats
    ? stats?.total_offers ?? null
    : null

  const countForTitle =
    newOffersCount ??
    (!loadingStatsFil && !errorStatsFill ? repartition.totalMetric : null)

  const bigNumber =
    newOffersCount ??
    totalOffersCount ??
    (!loadingStatsFil && !errorStatsFill ? repartition.totalMetric : 0)

  const getTitle = () => {
    if (loadingStats && loadingStatsFil) {
      return (
        <>
          Ce matin,{" "}
          <span className="text-brand-orange">la collecte</span> est en cours.
        </>
      )
    }

    if (countForTitle === null) {
      return (
        <>
          Ce matin,{" "}
          <span className="text-brand-orange">plusieurs offres</span> sont
          arrivées.
        </>
      )
    }

    if (countForTitle === 0) {
      return (
        <>
          Ce matin,{" "}
          <span className="text-brand-orange">vos offres</span> sont prêtes.
        </>
      )
    }

    if (countForTitle === 1) {
      return (
        <>
          Ce matin,{" "}
          <span className="text-brand-orange">1 offre</span> est arrivée.
        </>
      )
    }

    return (
      <>
        Ce matin,{" "}
        <span className="text-brand-orange">
          <CountUp to={countForTitle} /> offres
        </span>{" "}
        sont arrivées.
      </>
    )
  }

  const getSub = () => {
    if (loadingStats || loadingStatsFil || loadingOffers) {
      return "La collecte du jour est en cours. Votre aperçu arrive dans quelques instants."
    }

    if (errorStats || errorStatsFill || errorOffers) {
      return "Certaines données sont momentanément indisponibles. Voici un aperçu des offres disponibles."
    }

    return "Un aperçu de la collecte. Les autres vous attendent dans le récapitulatif de 8h00."
  }

  const getLinkLabel = () => {
    if (loadingStats || errorStats || countForTitle === null) {
      return "Voir toutes les offres"
    }

    if (countForTitle === 1) {
      return "Voir l'offre du jour"
    }

    if (countForTitle > 1) {
      return `Voir les ${countForTitle} offres du jour`
    }

    return "Voir les offres"
  }

  return (
    <section className="border-y border-outline-variant/30 bg-background py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow={`Collecte du jour · ${SCRAPE_TIME}`}
            title={getTitle()}
            sub={getSub()}
          />

          <Link
            to="/offres"
            className="group hidden items-center gap-2 rounded-md border border-brand-navy/15 bg-white px-5 py-3 text-sm font-bold text-brand-navy transition-all duration-300 hover:border-brand-navy/40 hover:shadow-soft md:inline-flex"
          >
            {getLinkLabel()}
            <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Feed d'offres */}
          <div>
            <ul className="flex flex-col gap-2.5" role="list">
              {loadingOffers ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <OfferSkeleton key={index} />
                ))
              ) : errorOffers ? (
                <EmptyOffers onRetryOffers={onRetryOffers} />
              ) : offers.map((offre, index) => (
                <FeedOffreCard key={offre.id} offre={offre} index={index} />
              ))}
            </ul>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-5 text-center md:hidden"
            >
              <Link
                to="/offres"
                className="inline-flex items-center gap-2 text-sm font-bold text-brand-navy transition-colors hover:text-brand-orange"
              >
                {getLinkLabel()}
                <ArrowRight className="size-4" />
              </Link>
            </motion.div>
          </div>

          {/* Répartition du jour */}
          <motion.aside
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex flex-col overflow-hidden rounded-xl bg-brand-navy p-6 text-white"
          >
            <div
              className="pointer-events-none absolute inset-0 bg-pattern opacity-20"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,166,35,0.16),transparent_55%)]"
              aria-hidden
            />

            <div className="relative flex flex-1 flex-col">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/90">
                <Zap className="size-3 text-brand-orange" aria-hidden />
                Run du jour · terminé
              </span>

              {loadingStatsFil ? (
                <RepartitionSkeleton />
              ) : errorStatsFill ? (
                <div className="mt-5 flex flex-1 flex-col">
                  <p className="text-sm leading-relaxed text-white/80">
                    La répartition du jour est momentanément indisponible.
                  </p>

                  {onRetryStatsFil && (
                    <button
                      type="button"
                      onClick={onRetryStatsFil}
                      className="mt-4 w-fit rounded-md border border-white/25 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/10"
                    >
                      Recharger les statistiques
                    </button>
                  )}
                </div>
              ) : repartition.items.length === 0 ? (
                <div className="mt-5 flex flex-1 flex-col">
                  <p className="font-heading text-4xl font-black leading-none">
                    0
                  </p>
                  <p className="mt-2 text-sm text-white/70">
                    Aucune statistique par filière n'est disponible pour le
                    moment.
                  </p>
                </div>
              ) : (
                <>
                  <p className="mt-5 font-heading text-5xl font-black leading-none">
                    <CountUp to={Math.max(bigNumber ?? 0, 0)} />
                  </p>
                  <p className="mt-1.5 text-sm text-white/70">
                    {repartition.mode === "new"
                      ? "nouvelles offres ce matin, réparties ainsi :"
                      : "offres actives, réparties ainsi :"}
                  </p>

                  <div className="mt-6 space-y-3.5">
                    {repartition.items.map((item, index) => (
                      <div key={item.id ?? item.label}>
                        <div className="flex items-baseline justify-between gap-3 text-[11px] font-semibold">
                          <span className="truncate text-white/80">
                            {item.label}
                          </span>
                          <span className="shrink-0 text-white/50">
                            {item.count}
                          </span>
                        </div>

                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${item.pct}%` }}
                            viewport={{ once: true }}
                            transition={{
                              duration: 0.9,
                              delay: 0.3 + index * 0.08,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            className={cn("h-full rounded-full", item.color)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <p className="mt-6 border-t border-white/10 pt-4 text-[11px] leading-relaxed text-white/50">
                Vous ne recevez que vos filières. Jamais le reste.
              </p>

              <CtaLink
                to="/inscription"
                size="md"
                icon={Bell}
                animateIcon
                className="mt-4 w-full"
              >
                Recevoir ma sélection à 8h00
              </CtaLink>
            </div>
          </motion.aside>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Testimonials                                                      */
/* ------------------------------------------------------------------ */

const Testimonials = () => (
  <section className="overflow-hidden border-t border-outline-variant/30 bg-background py-20 md:py-24">
    <div className="mx-auto max-w-7xl px-6 md:px-12">
      <SectionHeading
        eyebrow="Témoignages"
        title={
          <>
            Ils ont arrêté de chercher.{" "}
            <span className="text-brand-orange">Ils ont été trouvés.</span>
          </>
        }
        sub="Le push, ça marche : voici ce que racontent ceux qui reçoivent leur récap chaque matin."
      />
    </div>

    <div
      className="group relative mt-12"
      role="region"
      aria-label="Témoignages d'abonnés"
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-linear-to-r from-background via-background/80 to-transparent sm:w-28 lg:w-40"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-linear-to-l from-background via-background/80 to-transparent sm:w-28 lg:w-40"
        aria-hidden
      />

      <div className="overflow-hidden">
        <div className="flex w-max will-change-transform motion-safe:animate-marquee group-hover:paused">
          {[0, 1].map((copie) => (
            <div
              key={copie}
              className="flex shrink-0 gap-5 pr-5"
              aria-hidden={copie === 1}
            >
              {TEMOIGNAGES.map((temoignage) => (
                <TemoignageCard
                  key={`${copie}-${temoignage.nom}`}
                  t={temoignage}
                  variant={temoignage.vedette ? "vedette" : "standard"}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="mx-auto mt-10 flex max-w-7xl flex-col items-center justify-center gap-2.5 px-6 text-center sm:flex-row sm:gap-4">
      <p className="text-xs text-muted-foreground">
        Qu'est-ce que vous attendez ?
      </p>
      <span
        className="hidden size-1 rounded-full bg-outline-variant sm:block"
        aria-hidden
      />
      <Link
        to="/inscription"
        className="group inline-flex items-center gap-1.5 text-sm font-bold text-brand-navy transition-colors hover:text-brand-orange"
      >
        Rejoindre les abonnés du récap
        <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
      </Link>
    </div>
  </section>
)

export default Home