import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { motion, useScroll, useSpring, AnimatePresence } from "framer-motion"
import { Link } from "react-router-dom"
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Check,
  Clock,
  Filter,
  MailCheck,
  Database,
  Fingerprint,
  Radar,
  RefreshCw,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  LayoutGrid,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Seo from "@/components/seo/Seo"
import { howItWorksSeo } from "@/lib/seo"
import {
  CountdownEnvoi,
  CtaLink,
  StatusChip,
  ReassuranceList,
  FaqSection,
  SectionHeading,
  StepBlock,
  VisualFrame,
  SourceLogo,
} from "@/components/shared"
import { getSources } from "@/api/public/sources"
import { useFetchData } from "@/hooks/use-fetch-data"
import chipFloat from "@/lib/chipFloat"
import { Skeleton } from "@/components/ui/skeleton"
import { STEPS_HOW, EMAIL_JOBS, OFFRES_FILTREES, QUESTIONS_HOW, REASSURANCES } from "@/data/constanteMetier"

/* ════════════════════════════════════════════════════════════════════
   ANIMATIONS
════════════════════════════════════════════════════════════════════ */
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}

/* ════════════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════════════ */
const getSourceStatus = (source) => {
  if (!source) return { status: "unknown", label: "Inconnu", color: "text-gray-500" }
  
  const isActive = source.status === "active"
  const lastScrape = source.stats?.last_scrape_status
  
  if (!isActive) {
    return { status: "inactive", label: "Inactif", color: "text-error" }
  }
  
  if (lastScrape === "failed") {
    return { status: "error", label: "Erreur", color: "text-error" }
  }
  
  if (lastScrape === "success") {
    return { status: "active", label: "Actif", color: "text-emerald-600" }
  }
  
  return { status: "active", label: "Actif", color: "text-emerald-600" }
}

const getSourceStats = (source) => {
  if (!source?.stats) return { active: 0, new: 0 }
  return {
    active: source.stats.active_offers ?? 0,
    new: source.stats.new_offers ?? 0,
  }
}

const formatDateFr = () => {
  const d = new Date().toLocaleDateString("fr-FR", { 
    weekday: "long", 
    day: "numeric", 
    month: "long" 
  })
  return d.charAt(0).toUpperCase() + d.slice(1)
}

/* ════════════════════════════════════════════════════════════════════
   HERO — le pipeline vivant
════════════════════════════════════════════════════════════════════ */
const PipelineCard = ({ sources, loading, error }) => {
  const dateFr = useMemo(() => formatDateFr(), [])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 6), 1700)
    return () => clearInterval(id)
  }, [])

  const delivered = tick >= 4
  const stateOf = (i) => (delivered || tick > i ? "done" : tick === i ? "active" : "pending")

  const PARAMS_CONFIG = [
    { cls: "-left-3 top-8 md:-left-6", dur: 4.4, delay: 0 },
    { cls: "-right-2 top-24 md:-right-5", dur: 5.2, delay: 0.8 },
    { cls: "-left-2 bottom-28 md:-left-7", dur: 4.8, delay: 1.4 },
    { cls: "-right-2 bottom-10 md:-right-4", dur: 5.6, delay: 0.4 },
  ]

  const chips = useMemo(() => {
    if (!Array.isArray(sources)) return []
    return sources.map((source, index) => {
      const configParams = PARAMS_CONFIG[index % PARAMS_CONFIG.length]
      return {
        ...source,
        ...configParams,
      }
    })
  }, [sources])

  const activeSourcesCount = useMemo(() => {
    if (!Array.isArray(sources)) return 0
    return sources.filter((s) => s.status === "active").length
  }, [sources])

  return (
    <motion.div
      initial={{ opacity: 0, y: 32, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" }}
      className="relative min-w-0"
    >
      {!loading && !error &&
        chips.map((chip) => (
          <motion.span
            key={chip.id || chip.code}
            {...chipFloat(chip.delay, chip.dur)}
            className={cn(
              "absolute z-20 hidden items-center gap-2 -rotate-3 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold shadow-hover md:flex",
              chip.cls
            )}
          >
            <SourceLogo code={chip.code || chip.name} />
            {chip.name}
          </motion.span>
        ))}

      {/* Console « run quotidien » */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-hover">
        {/* En-tête console */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider">Run quotidien</span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">{dateFr}</span>
        </div>

        {/* Pipeline */}
        <div className="p-5 sm:p-6">
          {STEPS_HOW.map((s, i) => {
            const st = stateOf(i)
            return (
              <div key={s.title} className="relative flex gap-4 pb-7 last:pb-0">
                {/* Connecteur vertical */}
                {i < STEPS_HOW.length - 1 && (
                  <span
                    className="absolute left-5 top-11 h-[calc(100%-2.5rem)] w-0.5 -translate-x-1/2 rounded bg-border"
                    aria-hidden
                  >
                    <motion.span
                      className="block w-full origin-top rounded bg-brand-orange"
                      initial={false}
                      animate={{ scaleY: st === "done" ? 1 : 0 }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                      style={{ height: "100%" }}
                    />
                  </span>
                )}

                {/* Nœud */}
                <div
                  className={cn(
                    "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500",
                    st === "pending" && "border-border bg-muted text-muted-foreground",
                    st === "active" && "scale-110 border-brand-orange bg-brand-orange/10 text-brand-orange",
                    st === "done" && "border-transparent text-white"
                  )}
                  style={st === "done" ? { backgroundColor: s.hex } : undefined}
                >
                  {st === "done" ? <Check className="h-4 w-4" /> : <s.icon className="h-4.5 w-4.5" />}
                  {st === "active" && (
                    <span
                      className="absolute inset-0 animate-ping rounded-full border-2 border-brand-orange opacity-50"
                      aria-hidden
                    />
                  )}
                </div>

                {/* Contenu étape */}
                <div className="min-w-0 pt-0.5">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="font-mono text-xs font-bold text-muted-foreground">{s.time}</span>
                    <span className="font-heading text-sm font-extrabold uppercase tracking-wide">
                      {s.title}
                    </span>

                    {/* Statut */}
                    <span className="relative inline-flex h-4 items-center">
                      <motion.span
                        animate={{ opacity: st === "active" ? 1 : 0 }}
                        transition={{ duration: 0.25 }}
                        className={cn(
                          "animate-pulse text-[10px] font-bold uppercase tracking-wider text-brand-orange",
                          st !== "active" && "hidden"
                        )}
                        aria-hidden={st !== "active"}
                      >
                        en cours…
                      </motion.span>
                      <motion.span
                        animate={{ opacity: st === "done" ? 1 : 0 }}
                        transition={{ duration: 0.25 }}
                        className={cn(
                          "absolute inset-0 flex items-center text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400",
                          st !== "done" && "hidden"
                        )}
                        aria-hidden={st !== "done"}
                      >
                        terminé
                      </motion.span>
                    </span>
                  </div>

                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.desc}</p>

                  <motion.p
                    initial={false}
                    animate={{ opacity: st === "done" ? 1 : 0, y: st === "done" ? 0 : 3 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="mt-0.5 text-[11px] font-bold"
                    style={{ color: s.hex === "#0F2D4D" ? undefined : s.hex }}
                    aria-hidden={st !== "done"}
                  >
                    <span className={s.hex === "#0F2D4D" ? "text-foreground" : ""}>
                      ▸ {s.metric}
                    </span>
                  </motion.p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Pied */}
        <div className="border-t border-border bg-muted/40 px-5 py-4 sm:px-6">
          {/* Ligne de statut */}
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center">
              <AnimatePresence mode="wait" initial={false}>
                {delivered ? (
                  <motion.span
                    key="sent"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3 }}
                    className="flex min-w-0 items-center gap-2 text-xs font-extrabold"
                  >
                    <MailCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="min-w-0 truncate">Récapitulatif envoyé — 08h00:02</span>
                  </motion.span>
                ) : (
                  <motion.span
                    key="waiting"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3 }}
                    className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 truncate">
                      Envoi programmé à{" "}
                      <span className="font-mono font-extrabold text-foreground">08h00</span>
                    </span>
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {/* Pastille droite */}
            <div className="flex h-5 shrink-0 items-center">
              <AnimatePresence mode="wait" initial={false}>
                {delivered ? (
                  <motion.span
                    key="badge"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.3 }}
                    className="rounded-full bg-brand-orange/15 px-2 py-0.5 text-[10px] font-bold text-[#8a5c00] dark:text-brand-orange"
                  >
                    {activeSourcesCount} sources actives
                  </motion.span>
                ) : (
                  <motion.span
                    key="dots"
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-1"
                  >
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1 w-1 animate-bounce rounded-full bg-brand-orange"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* 3 lignes */}
          <div className="mt-2.5 space-y-1.5">
            {EMAIL_JOBS.map((j, i) =>
              delivered ? (
                <motion.div
                  key={`job-${j.t}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.12, duration: 0.3 }}
                  className="flex h-7.5 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-[11px]"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-orange" />
                  <span className="min-w-0 truncate font-semibold">{j.t}</span>
                  <span className="min-w-0 truncate text-muted-foreground">— {j.e}</span>
                </motion.div>
              ) : (
                <div
                  key={`skeleton-${j.t}`}
                  className="flex h-7.5 animate-pulse items-center gap-2 rounded-md border border-border bg-card px-2.5"
                  style={{ animationDelay: `${i * 0.2}s` }}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/20" />
                  <span
                    className="h-2 rounded-full bg-muted-foreground/15"
                    style={{ width: `${68 - i * 14}%` }}
                  />
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

const HeroHowItWorks = ({ sources, loading, error }) => (
  <section className="relative overflow-hidden hero-gradient">
    <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
    <div
      className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,166,35,0.10),transparent_50%)]"
      aria-hidden
    />
    <div className="absolute -bottom-40 -left-40 size-120 rounded-full bg-brand-navy/4 blur-3xl" aria-hidden />

    <div className="relative z-10 mx-auto max-w-7xl px-6 pb-16 pt-13 md:px-12 md:pb-20 lg:pt-18">
      <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-16">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-start gap-5"
        >
          <motion.div variants={fadeUp} className="hidden md:flex">
            <StatusChip tooltip="Scraping à 6h00, dédoublonnage à 6h15, filtrage à 7h00, envoi à 8h00 chaque jour, week-end compris.">
              Chaîne quotidienne active · dernier run à 6h02
            </StatusChip>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="font-heading text-4xl font-black leading-[1.06] tracking-tight text-brand-navy sm:text-5xl xl:text-6xl"
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

          <motion.p variants={fadeUp} className="max-w-xl md:text-lg leading-relaxed text-on-surface-variant">
            Chaque matin entre <strong className="font-semibold text-brand-navy">6h00 et 8h00</strong>,
            JobAlert CI déroule seul toute la chaîne : collecte des différentes sources, dédoublonnage,
            filtrage par filière, puis envoi de votre récapitulatif. Voici exactement ce qui se passe.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-1 flex flex-col gap-3 sm:flex-row">
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

          <CountdownEnvoi variant="horloge" className="mx-auto md:mt-4" />
        </motion.div>

        <PipelineCard sources={sources} loading={loading} error={error} />
      </div>
    </div>
  </section>
)

/* ════════════════════════════════════════════════════════════════════
   LES 4 ÉTAPES EN DÉTAIL
════════════════════════════════════════════════════════════════════ */

const TRACE_VB = { w: 1000, h: 2400 }

const TRACE_PATH =
  "M 520 -120  " +
  "C 700 60, 848 150, 836 320  " +
  "C 824 490, 606 428, 452 528  " +
  "C 268 645, 146 748, 184 932  " +
  "C 218 1098, 432 1012, 622 1120  " +
  "C 818 1230, 874 1338, 824 1508  " +
  "C 772 1690, 542 1612, 390 1728  " +
  "C 212 1862, 140 1970, 210 2110  " +
  "C 292 2272, 512 2330, 498 2520 "

const SerpentineTrace = ({ progress }) => {
  const pathRef = useRef(null)

  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
      <svg className="h-full w-full" viewBox={`0 0 ${TRACE_VB.w} ${TRACE_VB.h}`} preserveAspectRatio="none">
        <path
          ref={pathRef}
          d={TRACE_PATH}
          fill="none"
          stroke="var(--color-brand-navy)"
          strokeOpacity="0.06"
          strokeWidth="80"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <motion.path
          d={TRACE_PATH}
          fill="none"
          stroke="var(--color-brand-orange)"
          strokeOpacity="0.05"
          strokeWidth="104"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ pathLength: progress }}
        />
        <motion.path
          d={TRACE_PATH}
          fill="none"
          stroke="var(--color-brand-orange)"
          strokeOpacity="0.10"
          strokeWidth="89"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ pathLength: progress }}
        />
        <motion.path
          d={TRACE_PATH}
          fill="none"
          stroke="var(--color-brand-orange)"
          strokeOpacity="0.5"
          strokeWidth="78"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ pathLength: progress }}
        />
      </svg>
    </div>
  )
}

/* ── Visuel 1 : statut des scrapers ─────────────────────────────────── */
const VisualCollecte = ({ sources, loading }) => (
  <VisualFrame time="06h00">
    <div className="flex items-center justify-between gap-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        Scrapers · statut du jour
      </p>
      {!loading && sources && (
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
          {sources.filter((s) => s.status === "active").length}/{sources.length} actifs
        </span>
      )}
    </div>

    <ul className="mt-3.5 space-y-2">
      {loading
        ? Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3.5 py-2.5"
            >
              <Skeleton className="size-2 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1 max-w-35" />
              <Skeleton className="size-5 shrink-0 rounded-full" />
              <Skeleton className="h-3 w-10 shrink-0" />
              <Skeleton className="h-5 w-12 shrink-0 rounded-full" />
            </div>
          ))
        : sources?.map((s, i) => {
            const status = getSourceStatus(s)
            const stats = getSourceStats(s)

            return (
              <motion.li
                key={s.id}
                initial={{ opacity: 0, x: -14 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.15 + i * 0.12, ease: "easeOut" }}
                className="flex items-center gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3.5 py-2.5"
              >
                <span className="relative flex size-2 shrink-0">
                  <span
                    className={cn(
                      "absolute inline-flex size-full animate-ping rounded-full opacity-75",
                      status.status === "active" ? "bg-emerald-400" : "bg-error"
                    )}
                  />
                  <span
                    className="relative inline-flex size-2 rounded-full"
                    style={{ background: s.color_hex || "#10b981" }}
                  />
                </span>

                <span className="flex-1 truncate text-[13px] font-semibold text-on-surface">
                  {s.name}
                </span>

                <SourceLogo code={s.code || s.name} />

                <span className="text-[11px] font-medium text-muted-foreground">
                  {s.stats?.new_offers ?? 0} nouvelles
                </span>

                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                    status.status === "active"
                      ? "text-emerald-700 bg-emerald-500/10"
                      : "text-error bg-error/10"
                  )}
                >
                  {status.label}
                </span>
              </motion.li>
            )
          })}
    </ul>

    {/* Flux vers la base */}
    <div className="flex justify-center py-2.5" aria-hidden>
      <div className="flex flex-col items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1 animate-pulse rounded-full bg-brand-orange"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
    </div>

    <div className="flex items-center gap-3 rounded-lg bg-brand-navy px-4 py-3 text-white">
      <Database className="size-4 shrink-0 text-brand-orange" />
      <p className="text-[13px] font-semibold">Base offres</p>
      <p className="ml-auto text-[11px] text-white/60">
        <strong className="font-heading text-brand-orange">
          +{sources?.reduce((acc, s) => acc + (s.stats?.new_offers ?? 0), 0) ?? 0}
        </strong>{" "}
        aujourd'hui
      </p>
    </div>

    <div className="flex flex-col md:flex-row gap-2 items-center justify-between pt-3">
      <p className="mt-3.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldAlert className="size-3.5 shrink-0 text-brand-orange" />
        Chaque échec est journalisé avec horodatage
      </p>
      <Link
        to="/sources"
        className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-bold bg-primary text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98]"
      >
        Voir nos sources
      </Link>
    </div>
  </VisualFrame>
)

/* ── Visuel 2 : le tampon "doublon" ─────────────────────────────────── */
const VisualDedup = () => (
  <VisualFrame time="06h15">
    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      6h15 — même annonce, deux sources
    </p>

    <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="rounded-lg border border-emerald-500/30 bg-emerald-50/40 p-3.5"
      >
        <div className="flex items-center justify-between gap-2">
          <Fingerprint className="size-4 text-emerald-600" />
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            ✓ Insérée
          </span>
        </div>
        <p className="mt-2.5 text-[13px] font-bold text-brand-navy">Comptable senior</p>
        <p className="text-[11px] text-muted-foreground">Groupe SIFCA · via Novojob</p>
        <p className="mt-2 rounded bg-surface-container-low px-2 py-1 font-mono text-[10px] text-on-surface-variant">
          hash: a3f8…9c2
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="relative rounded-lg border border-outline-variant/50 bg-surface-container-low/50 p-3.5 opacity-80"
      >
        <motion.span
          initial={{ scale: 1.7, opacity: 0, rotate: 16 }}
          whileInView={{ scale: 1, opacity: 1, rotate: 6 }}
          viewport={{ once: true }}
          transition={{ delay: 0.75, duration: 0.3, ease: "backOut" }}
          className="absolute right-2.5 top-2.5 rounded border-2 border-red-500/70 bg-white/80 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-red-600"
        >
          Doublon
        </motion.span>

        <Fingerprint className="size-4 text-muted-foreground" />
        <p className="mt-2.5 text-[13px] font-bold text-on-surface-variant line-through decoration-red-400/70">
          Comptable senior
        </p>
        <p className="text-[11px] text-muted-foreground">Groupe SIFCA · via GoAfrica</p>
        <p className="mt-2 rounded bg-surface-container px-2 py-1 font-mono text-[10px] text-muted-foreground">
          hash: a3f8…9c2
        </p>
        <p className="mt-1.5 text-[10px] font-semibold text-red-600/80">Écartée — déjà en base</p>
      </motion.div>
    </div>

    <p className="mt-3.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Fingerprint className="size-3.5 shrink-0 text-brand-orange" />
      Empreinte calculée depuis le lien de l'annonce — contrainte UNIQUE en base.
    </p>
  </VisualFrame>
)

/* ── Visuel 3 : le matching par filière ─────────────────────────────── */
const VisualFiltrage = () => (
  <VisualFrame time="07h00">
    <div className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-500 text-[11px] font-black text-white">
        AD
      </span>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-bold text-brand-navy">
          Awa D. <span className="font-medium text-muted-foreground">· abonnée depuis le 12/07</span>
        </p>
        <div className="mt-1 flex gap-1.5">
          <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-700">
            RH
          </span>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            Comptabilité
          </span>
        </div>
      </div>
    </div>

    <div className="my-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-outline-variant/50" aria-hidden />
      <span className="whitespace-nowrap rounded-full bg-surface-container px-2.5 py-1 text-[10px] font-bold text-on-surface-variant">
        47 offres du jour → 2 pour Awa
      </span>
      <span className="h-px flex-1 bg-outline-variant/50" aria-hidden />
    </div>

    <ul className="space-y-2">
      {OFFRES_FILTREES.map((o, i) => (
        <motion.li
          key={o.titre}
          initial={{ opacity: 0, x: -14 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 + i * 0.15, ease: "easeOut" }}
          className={cn(
            "flex items-center gap-3 rounded-lg border px-3.5 py-2.5",
            o.ok
              ? "border-brand-orange/40 border-l-2 border-l-brand-orange bg-orange-50/60"
              : "border-outline-variant/40 opacity-55"
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-on-surface">{o.titre}</p>
            <p className="truncate text-[11px] text-muted-foreground">{o.entreprise}</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
              o.ok ? "bg-brand-orange/10 text-orange-700" : "bg-surface-container text-muted-foreground"
            )}
          >
            {o.ok ? "→ Dans son récap" : "Hors filières"}
          </span>
        </motion.li>
      ))}
    </ul>

    <div className="flex flex-col md:flex-row gap-2 items-center justify-between pt-3">
      <p className="mt-3.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <SlidersHorizontal className="size-3.5 shrink-0 text-brand-orange" />
        Chaque abonné reçoit une liste différente — la sienne, et rien d'autre.
      </p>
      <Link
        to="/filieres"
        className="inline-flex h-8 items-center text-center gap-1 rounded-md px-2.5 text-xs font-bold bg-brand-orange text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98]"
      >
        Voir toutes les filières
      </Link>
    </div>
  </VisualFrame>
)

/* ── Visuel 4 : le récapitulatif de 8h00 ────────────────────────────── */
const VisualEnvoi = () => (
  <VisualFrame time="08h00">
    <span className="absolute -right-3 -top-3 z-10 inline-flex rotate-2 items-center gap-1.5 rounded-full bg-brand-navy px-3 py-1.5 text-[10px] font-bold text-white shadow-lg">
      <RefreshCw className="size-3 text-brand-orange" />
      3 tentatives si échec
    </span>

    <div className="overflow-hidden rounded-lg border border-outline-variant/40">
      <div className="flex items-center gap-2.5 border-b border-outline-variant/40 bg-surface-container-low/60 px-4 py-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-navy font-heading text-[9px] font-black text-white">
          JA
        </span>
        <p className="flex-1 truncate text-[12px] font-bold text-brand-navy">
          JobAlert CI <span className="font-medium text-muted-foreground">· Votre récapitulatif</span>
        </p>
        <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">08:00</span>
      </div>

      <div className="px-4 py-3.5">
        <p className="text-[12px] text-on-surface-variant">Bonjour Awa 👋</p>
        <p className="mt-0.5 text-[12px] text-on-surface-variant">
          <strong className="font-semibold text-on-surface">2 offres</strong> correspondent à vos filières :
        </p>

        <ul className="mt-2.5 space-y-1.5">
          {OFFRES_FILTREES.filter((o) => o.ok).map((o, i) => (
            <motion.li
              key={o.titre}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.4 + i * 0.15 }}
              className="flex items-center gap-2.5 rounded-md border border-outline-variant/40 px-3 py-2"
            >
              <span className="size-1.5 shrink-0 rounded-full bg-brand-orange" />
              <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-on-surface">{o.titre}</p>
              <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:block">{o.entreprise}</span>
            </motion.li>
          ))}
        </ul>
      </div>

      <div className="flex gap-2 border-t border-outline-variant/40 bg-surface-container-low/40 px-4 py-2 text-[10px] font-medium text-muted-foreground">
        <span>Gérer mes filières</span>
        <span aria-hidden>·</span>
        <span>Me désinscrire en 1 clic</span>
      </div>
    </div>

    <p className="mt-3.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <BadgeCheck className="size-3.5 shrink-0 text-emerald-500" />
      Chaque envoi est journalisé : statut, horodatage, nombre d'offres.
    </p>
  </VisualFrame>
)

/* ── Section assemblée ──────────────────────────────────────────────── */
const EtapesDetail = ({ sources, loading }) => {
  const stepsRef = useRef(null)

  const { scrollYProgress } = useScroll({
    target: stepsRef,
    offset: ["start 0.8", "end 0.55"],
  })

  const traceProgress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 26,
    restDelta: 0.001,
  })

  return (
    <section id="chaine" className="scroll-mt-24 overflow-hidden bg-surface-container-lowest py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <SectionHeading
          eyebrow="Sous le capot"
          title={
            <>
              Deux heures de mécanique,{" "}
              <span className="text-brand-orange">zéro intervention</span>.
            </>
          }
          sub="La chaîne s'exécute seule chaque matin, sans action humaine. Voici exactement ce que fait chaque maillon et ce qu'il ne fait pas."
        />

        {/* Les étapes, avec la serpentine en fond */}
        <div ref={stepsRef} className="relative mt-16">
          <SerpentineTrace progress={traceProgress} />

          <div className="relative z-10 space-y-20 lg:space-y-24">
            <StepBlock
              num="01"
              time="06h00"
              icon={Radar}
              title="Collecte & centralisation"
              intro="À 6h00 tapantes, plusieurs scrapers se lancent en parallèle. Chacun parcourt la page « dernières offres » de sa source, extrait titre, entreprise, lien et date de publication, puis nettoie le tout : accents, casse, espaces superflus."
              points={[
                "Un scraper isolé par source : une panne ne bloque jamais les trois autres",
                "Chaque offre reçoit un tag de filière par mots-clés (« ingénieur logiciel » → Tech & Dev)",
                "Chaque échec est journalisé avec horodatage",
              ]}
            >
              <VisualCollecte sources={sources} loading={loading} />
            </StepBlock>

            <StepBlock
              num="02"
              time="06h15"
              icon={Fingerprint}
              title="Dédoublonnage"
              reverse
              intro="Avant d'entrer en base, chaque offre reçoit une empreinte unique calculée depuis son lien d'annonce ou à défaut du couple titre + entreprise. Si l'empreinte existe déjà, l'offre est ignorée. Définitivement."
              points={[
                "Contrainte UNIQUE en base : une annonce ne peut physiquement pas être insérée deux fois",
                "Même offre repérée sur deux sources ? Une seule version est conservée",
                "Résultat : vous ne recevez jamais deux fois la même offre",
              ]}
            >
              <VisualDedup />
            </StepBlock>

            <StepBlock
              num="03"
              time="07h00"
              icon={SlidersHorizontal}
              title="Filtrage par filière"
              intro="Une fois le scraping terminé, le système croise les nouvelles offres du jour avec les filières de chaque abonné actif. Chacun reçoit une liste différente, la sienne, construite à partir de ses 1 à 3 filières choisies à l'inscription."
              points={[
                "Vos filières sont modifiables à tout moment via le lien en bas de chaque email",
                "Une offre n'entre dans votre email que si elle correspond à l'une de vos filières",
                "Aucune offre pertinente un jour donné ? Aucun email vide n'est envoyé",
              ]}
            >
              <VisualFiltrage />
            </StepBlock>

            <StepBlock
              num="04"
              time="08h00"
              icon={Send}
              title="Envoi du récapitulatif"
              reverse
              intro="À 8h00 précises, chaque abonné concerné reçoit son récapitulatif personnalisé : les offres filtrées, avec titre, entreprise, lien direct vers l'annonce d'origine et date de publication. Prêt à postuler avant tout le monde."
              points={[
                "Jusqu'à 3 tentatives espacées en cas d'échec d'envoi",
                "Chaque tentative (succès ou échec) est journalisée avec horodatage",
                "Lien de désinscription en bas de chaque email : un clic, zéro justification",
              ]}
            >
              <VisualEnvoi />
            </StepBlock>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════
   BANDEAU SOURCES
════════════════════════════════════════════════════════════════════ */
const SourcesBand = ({ sources, loading, error }) => (
  <section className="relative overflow-hidden bg-brand-navy py-10">
    <div className="pointer-events-none absolute inset-0 bg-pattern opacity-20" aria-hidden />

    <div className="relative mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-6 md:px-12">
      <div>
        <p className="font-heading text-lg font-bold text-white">
          Elles alimentent votre récapitulatif
        </p>
        <p className="mt-0.5 text-sm text-white/60">Scannées chaque matin à 6h00, dans cet ordre.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5"
            >
              <Skeleton className="size-5 shrink-0 rounded-full bg-white/20" />
              <Skeleton className="h-4 w-16 bg-white/20" />
            </div>
          ))
        ) : error ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-error/30 bg-error/10 px-3.5 py-1.5 text-[13px] font-semibold text-error">
            <AlertCircle className="size-4" />
            Erreur de chargement
          </div>
        ) : (
          <>
            {sources?.slice(0, 4)?.map((s) => (
              <a
                href={s.base_url}
                target="_blank"
                rel="noopener noreferrer"
                key={s.id || s.code}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/20"
              >
                <SourceLogo code={s.code || s.name} className="size-5" />
                {s.name}
              </a>
            ))}

            {sources?.length > 4 && (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[13px] font-semibold text-white">
                + {sources.length - 4}
              </span>
            )}
          </>
        )}

        <Link
          to="/sources"
          className="group inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold text-brand-orange transition-colors hover:text-white"
        >
          Notre méthode de collecte
          <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  </section>
)

/* ════════════════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════════════════ */
const HowItWorks = () => {
  const fetchSources = useCallback(async () => {
    return getSources()
  }, [])

  const SourcesQuery = useFetchData(fetchSources)

  return (
    <>
      <Seo {...howItWorksSeo} />

      <main>
        <HeroHowItWorks
          sources={SourcesQuery.data}
          loading={SourcesQuery.isLoading}
          error={SourcesQuery.error}
        />

        <EtapesDetail sources={SourcesQuery.data} loading={SourcesQuery.isLoading} />

        <SourcesBand
          sources={SourcesQuery.data}
          loading={SourcesQuery.isLoading}
          error={SourcesQuery.error}
        />

        <FaqSection
          background="bg-background"
          eyebrow="Questions de mécanique"
          title={
            <>
              Ce qu'on nous demande <span className="text-brand-orange">le plus souvent</span>.
            </>
          }
          sub="Le fonctionnement de la chaîne, expliqué sans jargon."
          questions={QUESTIONS_HOW}
          aside={{
            icon: Radar,
            title: "Curieux de voir d'où viennent les offres ?",
            text: "La page Sources détaille les 4 plateformes scannées et notre méthode de collecte, source par source.",
            to: "/sources",
            cta: "Explorer les sources",
          }}
        />
      </main>
    </>
  )
}

export default HowItWorks