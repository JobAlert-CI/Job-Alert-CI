import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  AlertTriangle, ArrowRight, ArrowUp, ArrowUpDown, Bell,
  Briefcase, CalendarDays, Check, CheckCircle2, ChevronDown,
  ChevronRight, Clock, Fingerprint, GraduationCap, Layers, Loader2,
  Mail, MapPin, Radar, RefreshCw, Search, SearchX, Send, ShieldCheck, SlidersHorizontal,
  Sparkles, X, Zap,
} from "lucide-react"
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import Seo from "@/components/seo/Seo"
import {
  CountUp, CountdownEnvoi, Ticker, OfferCard, SourceLogo,
  CheckRow, FilterPopover, MiniCalendar, ViewToggle, FiltersDrawer,
  CtaLink,
} from "@/components/shared"
import { HUES, BRAND_HUE } from "@/lib/hues"
import { SORTS } from "@/lib/referentiels"
import { sameDay, fmtDay, jourLabel, todayLong } from "@/lib/dates"
import { offresSeo } from "@/lib/seo"
import useClickOutside from "@/hooks/use-click-outside"
import { useUrlFilters } from "@/hooks/use-url-filters"
import { toIsoEnd, toIsoStart } from "@/lib/offers-adapter"
import {
  useOfferCounts, useOfferReferentials, useOffersFeed, useOffersOverview,
} from "@/hooks/use-offers-data"
import { OffersSkeletonList, StatSkeleton } from "../../components/ReuOffres/SkeletonsOffres"
import OffresFilterGroups, { LocationPicker } from "../../components/ReuOffres/FiltresOffres"

const ABONNES = 10550

const PIPELINE = [
  { icon: Radar, t: "06:02", l: "Collecte", done: true },
  { icon: Fingerprint, t: "06:04", l: "Dédoublonnage", done: true },
  { icon: Send, t: "08:00", l: "Envoi", done: false },
]


/* ════════════════════════════════════════════════════════════════════
  FLUX CARD améliorée — la chaîne du matin, en vivant
════════════════════════════════════════════════════════════════════ */

const FluxCard = ({ parSource = [], nouveaux = 0, isLoading = false }) => (
  <motion.div
    initial={{ opacity: 0, y: 32, rotate: 1.5 }}
    animate={{ opacity: 1, y: 0, rotate: 0 }}
    transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
    className="relative mx-auto w-full max-w-md min-w-0 md:max-w-none"
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
      className="absolute -top-4 left-5 z-20 inline-flex -rotate-3 items-center gap-1.5 rounded-full bg-brand-orange px-3.5 py-1.5 text-[11px] font-bold text-white shadow-lg sm:-left-4"
    >
      <Zap className="size-3" />
      +{nouveaux} offres ce matin
    </motion.span>

    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1.05, duration: 0.4 }}
      className="absolute -top-3 right-6 z-20 inline-flex rotate-2 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-600 shadow-soft"
    >
      <Fingerprint className="size-3" />
      0 doublon
    </motion.span>

    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
      transition={{ delay: 1.2, opacity: { duration: 0.4 }, scale: { duration: 0.4 }, y: { duration: 5.2, repeat: Infinity, ease: "easeInOut", delay: 0.6 } }}
      className="absolute -bottom-4 right-8 z-20 inline-flex rotate-2 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white px-3.5 py-1.5 text-[11px] font-bold text-on-surface shadow-hover"
    >
      <Mail className="size-3 text-brand-orange" />
      Envoyé à {ABONNES.toLocaleString("fr-FR")} abonnés
    </motion.span>

    {/* Carte principale */}
    <div className="relative overflow-hidden rounded-2xl border border-outline-variant/40 bg-white shadow-[0_24px_48px_-16px_rgba(15,45,77,0.22)]">
      <div className="flex items-center gap-3 border-b border-outline-variant/40 bg-surface-container-low/60 px-5 py-4">
        <span className="relative flex size-2.5 shrink-0">
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
          <Clock className="size-3" />
          06:02
        </span>
      </div>

      <div className="px-5 pb-5 pt-4">
        {/* Les sources collectées (données API) */}
        <div className={cn("grid gap-2", parSource.length >= 4 || isLoading ? "grid-cols-4" : "grid-cols-3")}>
          {isLoading && parSource.length === 0
            ? [0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-18 rounded-lg" />
            ))
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
                      <span className="absolute right-1 top-1 grid size-3.5 place-items-center rounded-full bg-emerald-500 text-white">
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
          <Fingerprint className="size-4 shrink-0 text-emerald-600" />
          <p className="text-xs font-bold text-emerald-700">{nouveaux} nouvelles offres · 0 doublon</p>
          <span className="ml-auto hidden font-mono text-[10px] text-emerald-600/70 sm:inline">hash_unique ✓</span>
        </div>

        {/* Pipeline du matin */}
        <div className="mt-4 rounded-lg border border-outline-variant/40 bg-surface-container-low/40 px-3.5 py-3">
          <div className="flex items-center">
            {PIPELINE.map((s, i) => (
              <Fragment key={s.t}>
                {i > 0 && (
                  <span className="relative mx-2 h-px flex-1 overflow-hidden bg-outline-variant/60">
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
                    <s.icon className="size-3.5" />
                    {s.done && (
                      <span className="absolute -right-0.5 -top-0.5 grid size-3 place-items-center rounded-full bg-emerald-500 text-white">
                        <Check className="size-2" strokeWidth={4.5} />
                      </span>
                    )}
                  </span>
                  <span className="hidden min-w-0 leading-tight sm:block">
                    <span className="block truncate text-[10px] font-black text-brand-navy">{s.t}</span>
                    <span className="block truncate text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{s.l}</span>
                  </span>
                </span>
              </Fragment>
            ))}
          </div>
        </div>

        {/* Compte à rebours vers l'envoi */}
        <CountdownEnvoi className="mt-8 py-4" />
      </div>
    </div>
  </motion.div>
)

/* ════════════════════════════════════════════════════════════════════
  HERO — ticker + breadcrumb + titre test1 + CTA & compteurs test2
════════════════════════════════════════════════════════════════════ */
const HeroOffres = ({ total = 0, nouveaux = 0, parSource = [], isLoading = false }) => (
  <section className="relative overflow-hidden hero-gradient">
    <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
    <div className="absolute -top-32 right-[-10%] size-140 rounded-full bg-brand-orange/8 blur-3xl" aria-hidden />
    <div className="absolute -bottom-40 -left-40 size-120 rounded-full bg-brand-navy/5 blur-3xl" aria-hidden />

    <div className="relative z-10 mx-auto max-w-7xl px-6 pb-14 pt-8 md:px-12 md:pb-16 md:pt-10">
      {/* Fil d'Ariane */}
      <motion.nav
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
        aria-label="Fil d'Ariane"
      >
        <Link to="/" className="transition-colors hover:text-brand-navy">Accueil</Link>
        <ChevronRight className="size-3" />
        <span className="font-semibold text-brand-navy">Offres d'emploi</span>
      </motion.nav>

      <div className="mt-8 grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        {/* Colonne gauche */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } } }}
          className="flex min-w-0 flex-col items-start gap-5"
        >
          {/* Badges collecte */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}
            className="flex flex-wrap items-center gap-2.5"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-[11px] font-bold text-emerald-700">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-70" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
              </span>
              Collecte du jour : {todayLong()}, 06h02
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white/80 px-3.5 py-1.5 text-[11px] font-bold text-on-surface-variant">
              <ShieldCheck className="size-3 text-brand-orange" />
              {parSource.length || 0} source{parSource.length > 1 ? "s" : ""} scannée{parSource.length > 1 ? "s" : ""} · 0 doublon en base
            </span>
          </motion.div>

          {/* Titre */}
          <motion.h1
            variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}
            className="font-heading text-4xl font-black leading-[1.04] tracking-tight text-brand-navy sm:text-5xl xl:text-6xl"
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
            ,<br className="hidden sm:block" /> déjà triées.
          </motion.h1>

          {/* Message */}
          <motion.p
            variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}
            className="max-w-xl md:text-lg leading-relaxed text-on-surface-variant"
          >
            {nouveaux > 0 ? `${nouveaux} nouvelle` : "Aucune"}{" "} opportunité{nouveaux > 1 ? "s" : ""} collectée{nouveaux > 1 ? "s" : ""} ce matin sur {parSource.length ? parSource.map((s) => s.label ?? s.code).join(", ") : "nos sources partenaires"}
            , dé-dupliquées par hash puis taggées par filière. Demain, inutile de
            revenir : votre sélection arrive par email à{" "}
            <strong className="font-bold text-brand-navy">8h00 précises</strong>.
          </motion.p>

          {/* CTA */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}
            className="mt-1 flex flex-col gap-3 sm:flex-row"
          >
            <CtaLink to="/inscription" icon={Bell} animateIcon>
              Créer mon alerte 8h00
            </CtaLink>
            <CtaLink to="/comment-ca-marche" variant="secondary" iconRight={ArrowRight}>
              Comment ça marche
            </CtaLink>
          </motion.div>

          {/* Compteurs */}
          <motion.dl
            variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}
            className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-4"
          >
            {[
              { valeur: total, label: "offres en ligne" },
              { valeur: nouveaux, label: "nouvelles ce matin" },
              { valeur: parSource.length, label: "sources scannées" },
            ].map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                {isLoading ? (
                  <StatSkeleton />
                ) : (
                  <>
                    <dd className="font-heading text-3xl font-black text-brand-navy"><CountUp to={s.valeur} /></dd>
                    <dd className="text-xs font-medium text-muted-foreground">{s.label}</dd>
                  </>
                )}
              </div>
            ))}
          </motion.dl>
        </motion.div>

        {/* Colonne droite */}
        <FluxCard parSource={parSource} nouveaux={nouveaux} isLoading={isLoading} />
      </div>
    </div>
  </section>
)

/* ════════════════════════════════════════════════════════════════════
  PAGE
════════════════════════════════════════════════════════════════════ */
const PAGE_SIZE = 12

/* ═══ Filtres ↔ URL : /offres?fil=tech-dev&src=linkedin&loc=<uuid>&tri=az ═══ */
const CONFIG_FILTRES = {
  sets: [
    { key: "filieres", param: "fil" },
    { key: "sources", param: "src" },
    { key: "contrats", param: "ct" },
    { key: "experiences", param: "exp" },
    { key: "niveaux", param: "niv" },
  ],
  scalars: [
    { key: "sort", param: "tri", defaut: "recent" },
    { key: "view", param: "vue", defaut: "list" },
    { key: "query", param: "q", defaut: "" },
    { key: "location", param: "loc", defaut: "" },
  ],
  period: { debut: "du", fin: "au" },
}

const Offres = () => {
  const isMobile = useIsMobile()

  /* ═══ Filtres pilotés par l'URL ═══ */
  const { filters, valeurs, toggle, setScalar, setPeriod, reset } = useUrlFilters(CONFIG_FILTRES)
  const sort = SORTS.some((s) => s.k === valeurs.sort) ? valeurs.sort : "recent"
  const view = valeurs.view === "grid" ? "grid" : "list"
  const locationId = valeurs.location || null
  const setSort = (k) => setScalar("sort", k)
  const setView = (v) => setScalar("view", v)
  const setLocation = useCallback((id) => setScalar("location", id ?? ""), [setScalar])

  /* Recherche : champ local réactif → URL debouncée */
  const [queryLocale, setQueryLocale] = useState(valeurs.query)
  useEffect(() => { setQueryLocale(valeurs.query) }, [valeurs.query])
  useEffect(() => {
    if (queryLocale === valeurs.query) return
    const t = setTimeout(() => setScalar("query", queryLocale), 350)
    return () => clearTimeout(t)
  }, [queryLocale, valeurs.query, setScalar])

  const [saved, setSaved] = useState(new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [openPop, setOpenPop] = useState(null)
  const [showTop, setShowTop] = useState(false)
  const sortRef = useRef(null)
  useClickOutside(sortRef, () => setOpenPop((p) => (p === "sort" ? null : p)))

  /* ═══ Données backend ═══ */
  const referentials = useOfferReferentials()
  const { counts } = useOfferCounts()
  const overview = useOffersOverview()
  const refs = referentials.data

  /* Paramètres API — sérialisables, mémoïsés : une seule requête par changement */
  const apiParams = useMemo(() => {
    const q = valeurs.query.trim()
    return {
      sort,
      filieres: [...filters.filieres],
      sources: [...filters.sources],
      contrats: [...filters.contrats],
      experiences: [...filters.experiences],
      niveaux: [...filters.niveaux],
      location_id: locationId || undefined,
      q: q.length >= 2 ? q : undefined,
      published_since: toIsoStart(filters.period.start),
      published_until: toIsoEnd(filters.period.end),
    }
  }, [sort, filters, locationId, valeurs.query])

  const feed = useOffersFeed({ params: apiParams, pageSize: PAGE_SIZE })
  const { offers, isLoading, isLoadingMore, error, hasMore, loadMore, reload } = feed

  /* Bouton retour en haut */
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 700)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  /* Feed groupé jour par jour (tri « récentes » uniquement) */
  const feedItems = useMemo(() => {
    if (sort !== "recent") return offers.map((o) => ({ type: "offre", o }))
    const items = []
    let last = null
    offers.forEach((o) => {
      if (o.jours !== last) {
        items.push({ type: "header", jours: o.jours, count: offers.filter((x) => x.jours === o.jours).length })
        last = o.jours
      }
      items.push({ type: "offre", o })
    })
    return items
  }, [offers, sort])

  const toggleSave = (uid) =>
    setSaved((prev) => {
      const next = new Set(prev)
      next.has(uid) ? next.delete(uid) : next.add(uid)
      return next
    })

  const labelOf = useCallback((list, code) =>
    list.find((x) => x.code === code)?.label || code, [])

  /* Chips de filtres actifs */
  const activeChips = useMemo(() => {
    const chips = []
    filters.filieres.forEach((c) => chips.push({ key: `f-${c}`, label: labelOf(refs.filieres, c), rm: () => toggle("filieres", c) }))
    filters.sources.forEach((s) => chips.push({ key: `s-${s}`, label: labelOf(refs.sources, s), rm: () => toggle("sources", s) }))
    filters.contrats.forEach((c) => chips.push({ key: `c-${c}`, label: labelOf(refs.contrats, c), rm: () => toggle("contrats", c) }))
    filters.experiences.forEach((x) => chips.push({ key: `e-${x}`, label: labelOf(refs.experiences, x), rm: () => toggle("experiences", x) }))
    filters.niveaux.forEach((n) => chips.push({ key: `n-${n}`, label: labelOf(refs.niveaux, n), rm: () => toggle("niveaux", n) }))
    if (locationId) {
      const loc = refs.locations.find((l) => l.id === locationId)
      chips.push({ key: "loc", label: loc?.label || loc?.city || "Localisation", rm: () => setLocation(null) })
    }
    const { start, end } = filters.period
    if (start && end) {
      chips.push({
        key: "p",
        label: sameDay(start, end) ? fmtDay(start) : `${fmtDay(start)} → ${fmtDay(end)}`,
        rm: () => setPeriod({ start: null, end: null }),
      })
    } else if (start) {
      chips.push({ key: "p", label: `Depuis le ${fmtDay(start)}`, rm: () => setPeriod({ start: null, end: null }) })
    }
    return chips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, locationId, refs, labelOf])

  const activeCount =
    filters.filieres.size + filters.sources.size + filters.contrats.size +
    filters.experiences.size + filters.niveaux.size +
    (locationId ? 1 : 0) +
    (filters.period.start || filters.period.end ? 1 : 0)

  const resetTout = useCallback(() => { reset(); setQueryLocale("") }, [reset])

  const pop = (k) => ({
    open: openPop === k,
    onToggle: () => setOpenPop((p) => (p === k ? null : k)),
    onClose: () => setOpenPop((p) => (p === k ? null : p)),
  })

  const periodLabel =
    filters.period.start && filters.period.end
      ? sameDay(filters.period.start, filters.period.end)
        ? fmtDay(filters.period.start)
        : `${fmtDay(filters.period.start)} → ${fmtDay(filters.period.end)}`
      : filters.period.start
        ? `Depuis le ${fmtDay(filters.period.start)}`
        : "Période"

  const locationLabel = locationId
    ? (refs.locations.find((l) => l.id === locationId)?.label || "Localisation")
    : "Localisation"

  const isDone = !isLoading && !isLoadingMore && !hasMore && offers.length > 0
  const refsLoading = referentials.isLoading

  return (
    <>
      <Seo {...offresSeo({ total: overview.total, nouveaux: overview.nouveaux, parSource: overview.parSource, offers })} />
      <main>
        {offers.length > 0 && (
          <Ticker
            variant="dark"
            duration={250}
            items={offers.slice(0, 24).map((o) => ({
              key: o.uid,
              dot: (HUES[refs.filieres.find((f) => f.code === o.filiere)?.hue] ?? BRAND_HUE).dot,
              titre: o.titre,
              entreprise: o.entreprise,
            }))}
          />
        )}

        <HeroOffres
          total={overview.total}
          nouveaux={overview.nouveaux}
          parSource={overview.parSource}
          isLoading={overview.isLoading}
        />

        {/* ═══════════ Barre de filtres sticky ═══════════ */}
        <div className="sticky top-1/10 z-40 border-b border-outline-variant/40 bg-background/85 backdrop-blur-md">
          <div className="mx-auto max-w-7xl px-6 py-3 md:px-12">
            {/* Desktop */}
            <div className="hidden flex-wrap items-center gap-2 lg:flex">
              <div className="relative w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={queryLocale}
                  onChange={(e) => setQueryLocale(e.target.value)}
                  placeholder="Rechercher un poste, une entreprise…"
                  aria-label="Rechercher"
                  className="h-9 w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest pl-9 pr-8 text-[13px] outline-none transition-all placeholder:text-muted-foreground/70 focus:border-brand-navy/50 focus:ring-2 focus:ring-brand-navy/10"
                />
                {queryLocale && (
                  <button
                    onClick={() => setQueryLocale("")}
                    aria-label="Effacer la recherche"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-brand-navy"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              <FilterPopover label="Filière" icon={Sparkles} count={filters.filieres.size} {...pop("filiere")} panelClassName="w-64">
                <div className="max-h-72 overflow-y-auto pr-1">
                  {refsLoading && refs.filieres.length === 0
                    ? [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="mb-1.5 h-8 w-full rounded-md" />)
                    : refs.filieres.map((f) => (
                      <CheckRow
                        key={f.code}
                        checked={filters.filieres.has(f.code)}
                        onToggle={() => toggle("filieres", f.code)}
                        label={f.label}
                        count={counts.filieres[f.code] ?? 0}
                        lead={<span className={cn("size-2 shrink-0 rounded-full", (HUES[f.hue] ?? BRAND_HUE).dot)} />}
                      />
                    ))}
                </div>
              </FilterPopover>

              <FilterPopover
                label={locationLabel}
                icon={MapPin}
                count={locationId ? 1 : 0}
                panelClassName="w-72 p-3"
                {...pop("location")}
              >
                <LocationPicker
                  locations={refs.locations}
                  value={locationId}
                  onChange={(id) => { setLocation(id); setOpenPop(null) }}
                  isLoading={refsLoading && refs.locations.length === 0}
                />
              </FilterPopover>

              <FilterPopover label="Sources" icon={Layers} count={filters.sources.size} {...pop("source")}>
                {refsLoading && refs.sources.length === 0
                  ? [0, 1, 2].map((i) => <Skeleton key={i} className="mb-1.5 h-8 w-full rounded-md" />)
                  : refs.sources.map((s) => (
                    <CheckRow
                      key={s.code}
                      checked={filters.sources.has(s.code)}
                      onToggle={() => toggle("sources", s.code)}
                      label={s.label}
                      count={counts.sources[s.code] ?? 0}
                      lead={<SourceLogo code={s.code} className="size-5 rounded text-[8px]" />}
                    />
                  ))}
              </FilterPopover>

              <FilterPopover label="Contrat" icon={Briefcase} count={filters.contrats.size} {...pop("contrat")}>
                {refs.contrats.map((c) => (
                  <CheckRow
                    key={c.code}
                    checked={filters.contrats.has(c.code)}
                    onToggle={() => toggle("contrats", c.code)}
                    label={c.label}
                    count={counts.contrats[c.code] ?? 0}
                  />
                ))}
              </FilterPopover>

              <FilterPopover label="Expérience" icon={Zap} count={filters.experiences.size} {...pop("exp")}>
                {refs.experiences.map((x) => (
                  <CheckRow
                    key={x.code}
                    checked={filters.experiences.has(x.code)}
                    onToggle={() => toggle("experiences", x.code)}
                    label={x.label}
                  />
                ))}
              </FilterPopover>

              <FilterPopover label="Niveau" icon={GraduationCap} count={filters.niveaux.size} {...pop("niveau")}>
                {refs.niveaux.map((n) => (
                  <CheckRow
                    key={n.code}
                    checked={filters.niveaux.has(n.code)}
                    onToggle={() => toggle("niveaux", n.code)}
                    label={n.label}
                  />
                ))}
              </FilterPopover>

              <FilterPopover
                label={periodLabel}
                icon={CalendarDays}
                count={filters.period.start || filters.period.end ? 1 : 0}
                align="right"
                panelClassName="w-[19.5rem] p-3"
                {...pop("period")}
              >
                <MiniCalendar range={filters.period} onChange={setPeriod} hue={BRAND_HUE} />
              </FilterPopover>

              <div className="ml-auto flex items-center gap-2.5">
                <span className="hidden text-xs text-muted-foreground xl:inline">
                  {isLoading ? (
                    <Skeleton className="inline-block h-4 w-20 align-middle" />
                  ) : (
                    <>
                      <strong className="font-heading text-sm font-bold text-brand-navy">{offers.length}{hasMore ? "+" : ""}</strong>
                      {" "}offre{offers.length > 1 ? "s" : ""}
                    </>
                  )}
                </span>
                {/* Tri */}
                <div ref={sortRef} className="relative">
                  <button
                    onClick={() => setOpenPop((p) => (p === "sort" ? null : "sort"))}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-all duration-200",
                      openPop === "sort"
                        ? "border-brand-navy bg-brand-navy text-white"
                        : "border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant hover:border-brand-navy/40 hover:text-brand-navy"
                    )}
                  >
                    <ArrowUpDown className="size-3.5" />
                    {SORTS.find((s) => s.k === sort)?.l ?? "Trier"}
                    <ChevronDown className={cn("size-3.5 transition-transform duration-200", openPop === "sort" && "rotate-180")} />
                  </button>
                  <AnimatePresence>
                    {openPop === "sort" && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.98 }}
                        transition={{ duration: 0.18 }}
                        className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-1.5 shadow-hover"
                      >
                        {SORTS.map((s) => (
                          <button
                            key={s.k}
                            onClick={() => { setSort(s.k); setOpenPop(null) }}
                            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors hover:bg-surface-container-low"
                          >
                            {s.l}
                            {sort === s.k && <Check className="size-3.5 text-brand-orange" strokeWidth={3} />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <ViewToggle view={view} onChange={setView} />
              </div>
            </div>

            {/* Mobile */}
            <div className="flex items-center gap-2 lg:hidden">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={queryLocale}
                  onChange={(e) => setQueryLocale(e.target.value)}
                  placeholder="Rechercher…"
                  aria-label="Rechercher"
                  className="h-10 w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest pl-9 pr-3 text-sm outline-none transition-all placeholder:text-muted-foreground/70 focus:border-brand-navy/50 focus:ring-2 focus:ring-brand-navy/10"
                />
                {queryLocale && (
                  <button
                    onClick={() => setQueryLocale("")}
                    aria-label="Effacer la recherche"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-brand-navy"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              <button
                onClick={() => setDrawerOpen(true)}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-lg border px-3.5 text-sm font-bold transition-all",
                  activeCount > 0
                    ? "border-brand-navy bg-brand-navy text-white shadow-soft"
                    : "border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant"
                )}
              >
                <SlidersHorizontal className="size-4" />
                Filtres
                {activeCount > 0 && (
                  <span className="grid size-4.5 place-items-center rounded-full bg-brand-orange text-[10px] font-black text-white">
                    {activeCount}
                  </span>
                )}
              </button>
              <ViewToggle view={view} onChange={setView} />
            </div>
          </div>
        </div>

        {/* ═══════════ Drawer mobile ═══════════ */}
        <FiltersDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          resultCount={offers.length}
          sort={sort}
          onSort={setSort}
          onReset={resetTout}
        >
          <OffresFilterGroups
            referentials={refs}
            counts={counts}
            filters={filters}
            toggle={toggle}
            period={filters.period}
            onPeriod={setPeriod}
            locationId={locationId}
            onLocation={setLocation}
            isLoading={refsLoading}
          />
        </FiltersDrawer>

        {/* ═══════════ Le flux ═══════════ */}
        <section className="border-b border-outline-variant/30 bg-background py-12 md:py-16">
          <div className="mx-auto max-w-7xl px-6 md:px-12">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-orange">
                  <span className="h-px w-6 bg-brand-orange" aria-hidden />
                  Le flux
                </p>
                <h2 className="mt-3 font-heading text-3xl font-extrabold tracking-tight text-brand-navy sm:text-4xl">
                  Les offres <span className="text-brand-orange">du moment</span>
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {isLoading ? "Chargement du flux…" : (
                    <>
                      <strong className="font-heading font-bold text-brand-navy">{offers.length}{hasMore ? "+" : ""}</strong> offre{offers.length > 1 ? "s" : ""}
                      {activeCount > 0 ? ` · ${activeCount} filtre${activeCount > 1 ? "s" : ""} actif${activeCount > 1 ? "s" : ""}` : ""}
                      {" "} triées par « {(SORTS.find((s) => s.k === sort)?.l ?? "").toLowerCase()} »
                    </>
                  )}
                </p>
              </motion.div>
            </div>

            {/* Référentiels en repli : filtres réduits, on prévient sans bloquer */}
            {referentials.isFallback && !referentials.isLoading && (
              <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-semibold text-amber-800">
                <AlertTriangle className="size-4" />
                Les listes de filtres n'ont pas pu être chargées — options par défaut affichées.
                <button onClick={referentials.reload} className="inline-flex items-center gap-1 font-bold underline">
                  <RefreshCw className="size-3" /> Réessayer
                </button>
              </div>
            )}

            {/* Chips de filtres actifs */}
            <AnimatePresence>
              {activeChips.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {activeChips.map((c) => (
                      <button
                        key={c.key}
                        onClick={c.rm}
                        className="group inline-flex items-center gap-1.5 rounded-full border border-brand-navy/20 bg-brand-navy/5 px-3 py-1.5 text-xs font-semibold text-brand-navy transition-all hover:border-brand-orange/50 hover:bg-brand-orange/10"
                      >
                        {c.label}
                        <X className="size-3 text-muted-foreground transition-colors group-hover:text-brand-orange" />
                      </button>
                    ))}
                    <button
                      onClick={resetTout}
                      className="text-xs font-bold text-brand-orange transition-colors hover:underline"
                    >
                      Tout effacer
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── États : chargement / erreur / vide / contenu ── */}
            {isLoading ? (
              <OffersSkeletonList view={view === "grid" || isMobile ? "grid" : "list"} count={PAGE_SIZE / 2} className="mt-8" />
            ) : error && offers.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-10 rounded-xl border border-destructive/30 bg-destructive/5 p-12 text-center"
              >
                <AlertTriangle className="mx-auto size-10 text-destructive/70" />
                <h3 className="mt-4 font-heading text-lg font-bold text-brand-navy">Le flux n'a pas pu être chargé</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{error}</p>
                <button
                  onClick={reload}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg border border-brand-navy/20 px-5 py-2.5 text-sm font-bold text-brand-navy transition-all hover:border-brand-navy hover:bg-brand-navy hover:text-white"
                >
                  <RefreshCw className="size-4" /> Réessayer
                </button>
              </motion.div>
            ) : offers.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-10 rounded-xl border border-dashed border-outline-variant/60 bg-white p-12 text-center"
              >
                <SearchX className="mx-auto size-10 text-muted-foreground/50" />
                <h3 className="mt-4 font-heading text-lg font-bold text-brand-navy">Aucune offre trouvée</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeCount > 0 || valeurs.query
                    ? "Élargissez vos filtres — ou attendez la collecte de demain 6h02."
                    : "Le flux est vide pour le moment — la prochaine collecte est prévue à 6h02."}
                </p>
                {(activeCount > 0 || valeurs.query) && (
                  <button
                    onClick={resetTout}
                    className="mt-5 inline-flex items-center gap-2 rounded-lg border border-brand-navy/20 px-5 py-2.5 text-sm font-bold text-brand-navy transition-all hover:border-brand-navy hover:bg-brand-navy hover:text-white"
                  >
                    Réinitialiser les filtres
                  </button>
                )}
              </motion.div>
            ) : (view === "list" && !isMobile) ? (
              <div className="mt-8 flex flex-col gap-3">
                <AnimatePresence mode="popLayout">
                  {feedItems.map((item, i) =>
                    item.type === "header" ? (
                      <motion.div
                        key={`h-${item.jours}`}
                        layout
                        initial={{ opacity: 0, x: -14 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 pt-5 first:pt-0"
                      >
                        <span className="relative flex size-2">
                          {jourLabel(item.jours).ping && (
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-orange opacity-70" />
                          )}
                          <span className={cn(
                            "relative inline-flex size-2 rounded-full",
                            jourLabel(item.jours).ping ? "bg-brand-orange" : "bg-outline-variant"
                          )} />
                        </span>
                        <h3 className="font-heading text-sm font-extrabold uppercase tracking-[0.14em] text-brand-navy">
                          {jourLabel(item.jours).label}
                        </h3>
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {item.count} offre{item.count > 1 ? "s" : ""}
                          {jourLabel(item.jours).sub && ` · ${jourLabel(item.jours).sub}`}
                        </span>
                        <span className="h-px flex-1 bg-outline-variant/50" aria-hidden />
                      </motion.div>
                    ) : (
                      <OfferCard
                        key={item.o.uid}
                        offre={item.o}
                        index={i}
                        view="list"
                        saved={saved.has(item.o.uid)}
                        onToggleSave={toggleSave}
                        entrepriseTotal={offers.filter((x) => x.entreprise === item.o.entreprise).length}
                      />
                    )
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {feedItems.filter((x) => x.type === "offre").map((item, i) => (
                    <OfferCard
                      key={item.o.uid}
                      offre={item.o}
                      index={i}
                      view="grid"
                      saved={saved.has(item.o.uid)}
                      onToggleSave={toggleSave}
                      entrepriseTotal={offers.filter((x) => x.entreprise === item.o.entreprise).length}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Squelettes pendant « charger plus » */}
            {isLoadingMore && (
              <OffersSkeletonList
                view={view === "grid" || isMobile ? "grid" : "list"}
                count={3}
                className="mt-3"
              />
            )}

            {/* Erreur non bloquante sur une page suivante */}
            {error && offers.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs font-semibold text-destructive">
                <AlertTriangle className="size-4" />
                {error}
                <button onClick={loadMore} className="inline-flex items-center gap-1 font-bold underline">
                  <RefreshCw className="size-3" /> Réessayer
                </button>
              </div>
            )}

            {/* Charger plus — par lots de 12 */}
            {hasMore && !isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45 }}
                className="mt-10 flex flex-col items-center gap-3.5"
              >
                <div className="w-full max-w-xs">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                    <span>{offers.length} affichée{offers.length > 1 ? "s" : ""}</span>
                    {overview.total > 0 && <span>{overview.total} au total</span>}
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-container-high">
                    <motion.div
                      className="h-full rounded-full bg-brand-navy"
                      animate={{ width: `${Math.min(100, overview.total ? (offers.length / overview.total) * 100 : 0)}%` }}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>
                <button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="group inline-flex h-12 items-center gap-2.5 rounded-lg border border-brand-navy/25 bg-white px-7 text-sm font-bold text-brand-navy shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-navy hover:bg-brand-navy hover:text-white hover:shadow-hover active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Chargement des offres…
                    </>
                  ) : (
                    <>
                      <ChevronDown className="size-4 transition-transform duration-300 group-hover:translate-y-0.5" />
                      Charger {PAGE_SIZE} offres de plus ?
                    </>
                  )}
                </button>
                <p className="text-[11px] text-muted-foreground">
                  Par lots de {PAGE_SIZE} · groupées jour par jour
                </p>
              </motion.div>
            )}

            {/* Fin du flux */}
            <AnimatePresence>
              {isDone && (
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-10 overflow-hidden rounded-xl border border-outline-variant/40 bg-white text-center shadow-soft"
                >
                  <div className="mx-auto h-1 w-24 rounded-b-full bg-emerald-500" aria-hidden />
                  <div className="px-6 py-10">
                    <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-500/10">
                      <CheckCircle2 className="size-7 text-emerald-600" />
                    </span>
                    <h3 className="mt-4 font-heading text-xl font-extrabold text-brand-navy">Vous êtes à jour.</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                      C'est tout pour aujourd'hui — demain à 6h02, on remet ça. Ou mieux :
                      recevez le flux directement à 8h00, sans avoir à revenir.
                    </p>
                    <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                      <Link
                        to="/inscription"
                        className="group inline-flex items-center gap-2 rounded-lg bg-brand-orange px-6 py-3 text-sm font-bold text-white shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110"
                      >
                        <Bell className="size-4 transition-transform duration-300 group-hover:rotate-12" />
                        Créer mon alerte 8h00
                      </Link>
                      <button
                        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                        className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/60 px-6 py-3 text-sm font-bold text-on-surface-variant transition-all hover:border-brand-navy/40 hover:text-brand-navy"
                      >
                        Retour en haut
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-brand-orange" />
              Mises à jour chaque matin à 6h02 · lien direct vers l'annonce d'origine
            </p>
          </div>
        </section>

        {/* Bouton retour en haut flottant */}
        <AnimatePresence>
          {showTop && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 12 }}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              aria-label="Retour en haut"
              className="fixed bottom-6 right-6 z-40 grid size-11 place-items-center rounded-full bg-brand-navy text-white shadow-hover transition-colors duration-300 hover:bg-brand-orange"
            >
              <ArrowUp className="size-5" />
            </motion.button>
          )}
        </AnimatePresence>
      </main>
    </>
  )
}

export default Offres

