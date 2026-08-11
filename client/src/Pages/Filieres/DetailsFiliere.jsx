import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  AlertTriangle, ArrowRight, ArrowUp, ArrowUpDown, Bell,
  Briefcase, CalendarDays, Check, ChevronDown,
  ChevronRight, Clock, Filter as FilterIcon,
  GraduationCap, LayoutGrid, Layers, Loader2, Mail,
  MapPin, Radar, RefreshCw, Search, SearchX, Send, ShieldCheck, SlidersHorizontal,
  Sparkles, X, Zap, ArrowUpRight, CheckCircle2
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import Seo from "@/components/seo/Seo"
import { filiereSeo } from "@/lib/seo"
import {
  CountUp, OfferCard, ChipSource, SourceLogo,
  CheckRow, FilterPopover, MiniCalendar, ViewToggle, FiltersDrawer,
  CtaLink,
} from "@/components/shared"
import { HUES, BRAND_HUE } from "@/lib/hues"
import { SORTS } from "@/lib/referentiels"
import { startOfDay, addDays, sameDay, fmtDay, jourLabel } from "@/lib/dates"
import useClickOutside from "@/hooks/use-click-outside"
import { useUrlFilters } from "@/hooks/use-url-filters"
import { useIsMobile } from "@/hooks/use-mobile"
import { useFetchData } from "@/hooks/use-fetch-data"
import { useOfferReferentials } from "@/hooks/use-offers-data"
import { adaptOffers, mergeOffers, toIsoStart, toIsoEnd } from "@/lib/offers-adapter"
import { isCanceledError, formatApiError } from "@/api/errors"
import { getFilieresBySlug, getFiliereOffers, getFilieres } from "@/api/public/filieres"
import getFiliereTheme from "@/lib/filiere-theme"

/* ════════════════════════════════════════════════════════════════════
ADAPTATEUR API → UI (Filière)
════════════════════════════════════════════════════════════════════ */
const adaptFiliere = (raw) => {
  if (!raw || typeof raw !== "object") return null
  const theme = getFiliereTheme(raw.code)
  const stats = raw.stats || {}
  const activeSpecialties = (raw.specialties || []).filter(s => s.is_active !== false)

  return {
    id: raw.id,
    code: raw.code,
    slug: raw.slug || raw.code,
    label: raw.label || raw.code,
    tagline: raw.tagline || "",
    desc: raw.description || "",
    icon: theme.icon,
    hue: raw.hue || theme.hue,
    actives: Number(stats.active_offers ?? 0),
    nouvelles: Number(stats.new_offers ?? 0),
    abonnes: Number(stats.subscribers ?? 0),
    keywords: activeSpecialties.map(s => (s.label || "").toLowerCase()).filter(Boolean),
    specialites: activeSpecialties.map(s => ({ id: s.id, code: s.code, label: s.label })),
  }
}

/* ════════════════════════════════════════════════════════════════════
HOOK — Feed paginé d'offres pour une filière
════════════════════════════════════════════════════════════════════ */
const useFiliereOffersFeed = ({ slug, params, pageSize = 12 }) => {
  const paramsKey = useMemo(() => JSON.stringify({ slug, ...params }), [slug, params])
  const requestId = useRef(0)
  const controllers = useRef(new Set())
  const [state, setState] = useState({
    offers: [],
    isLoading: true,
    isLoadingMore: false,
    error: null,
    hasMore: false,
    loadedPages: 0,
  })

  const fetchPage = useCallback(async ({ page, append }) => {
    const id = ++requestId.current
    const controller = new AbortController()
    controllers.current.add(controller)
    setState(s => ({
      ...s,
      error: null,
      isLoading: append ? s.isLoading : true,
      isLoadingMore: append,
    }))
    try {
      const parsed = JSON.parse(paramsKey)
      const data = await getFiliereOffers(
        parsed.slug,
        { ...parsed, limit: pageSize, offset: page * pageSize },
      )
      if (id !== requestId.current) return
      const batch = adaptOffers(Array.isArray(data) ? data : [])
      setState(s => ({
        offers: append ? mergeOffers(s.offers, batch) : batch,
        isLoading: false,
        isLoadingMore: false,
        error: null,
        hasMore: batch.length === pageSize,
        loadedPages: page + 1,
      }))
    } catch (err) {
      if (isCanceledError(err) || id !== requestId.current) return
      setState(s => ({
        ...s,
        offers: append ? s.offers : [],
        isLoading: false,
        isLoadingMore: false,
        error: formatApiError(err),
      }))
    } finally {
      controllers.current.delete(controller)
    }
  }, [paramsKey, pageSize])

  useEffect(() => {
    if (!slug) return
    fetchPage({ page: 0, append: false })
    return () => {
      controllers.current.forEach(c => c.abort())
      controllers.current.clear()
    }
  }, [fetchPage, slug])

  const loadMore = useCallback(() => {
    setState(s => {
      if (s.isLoading || s.isLoadingMore || !s.hasMore) return s
      fetchPage({ page: s.loadedPages, append: true })
      return s
    })
  }, [fetchPage])

  const reload = useCallback(() => fetchPage({ page: 0, append: false }), [fetchPage])

  return { ...state, loadMore, reload, pageSize }
}

/* ════════════════════════════════════════════════════════════════════
HERO — identité de la filière + récap du jour
════════════════════════════════════════════════════════════════════ */
const AVATARS = [
  { init: "AK", cls: "bg-sky-600" },
  { init: "MC", cls: "bg-emerald-600" },
  { init: "SD", cls: "bg-fuchsia-600" },
  { init: "YK", cls: "bg-amber-600" },
]

const RecapCard = ({ meta, hue, offres, isLoading }) => {
  const preview = [...offres].sort((a, b) => a.jours - b.jours).slice(0, 3)
  const nouveaux = offres.filter(o => o.jours === 0).length
  const restants = Math.max(meta.actives - preview.length, 0)
  const pipeline = [
    { icon: Radar, t: "06h02", l: "Collecte" },
    { icon: FilterIcon, t: "07h15", l: "Filtrage" },
    { icon: Send, t: "08h00", l: "Envoi" },
  ]
  return (
    <motion.div
      initial={{ opacity: 0, y: 36, rotate: 1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-full max-w-md min-w-0 md:max-w-none"
    >
      <div className={cn("absolute -inset-8 rounded-full blur-3xl", hue.glow)} aria-hidden />
      <div className="absolute inset-0 translate-x-4 translate-y-5 rotate-2 overflow-hidden rounded-2xl bg-brand-navy" aria-hidden>
        <div className="absolute inset-0 bg-pattern opacity-20" />
      </div>
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1, y: [0, -7, 0] }}
        transition={{ delay: 0.9, opacity: { duration: 0.4 }, scale: { duration: 0.4 }, y: { duration: 4.6, repeat: Infinity, ease: "easeInOut" } }}
        className={cn("absolute -top-4 left-5 z-20 inline-flex -rotate-3 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold text-white shadow-lg sm:-left-4", hue.solid)}
      >
        <Zap className="size-3" />
        +{meta.nouvelles} offres cette semaine
      </motion.span>
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.05, duration: 0.4 }}
        className="absolute -top-3 right-6 z-20 inline-flex rotate-2 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-600 shadow-soft"
      >
        <ShieldCheck className="size-3" />
        0 doublon
      </motion.span>
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
        transition={{ delay: 1.2, opacity: { duration: 0.4 }, scale: { duration: 0.4 }, y: { duration: 5.2, repeat: Infinity, ease: "easeInOut", delay: 0.6 } }}
        className="absolute -bottom-4 right-8 z-20 inline-flex rotate-2 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-white px-3.5 py-1.5 text-[11px] font-bold text-on-surface shadow-hover"
      >
        <Mail className="size-3 text-brand-orange" />
        Envoyé à {meta.abonnes.toLocaleString("fr-FR")} abonnés
      </motion.span>
      <div className="relative overflow-hidden rounded-2xl border border-outline-variant/40 bg-white shadow-[0_24px_48px_-16px_rgba(15,45,77,0.22)]">
        <div className="flex items-center gap-3 border-b border-outline-variant/40 bg-surface-container-low/60 px-5 py-4">
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", hue.tile)}>
            <meta.icon className="size-4.5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-sm font-bold text-brand-navy">Récap du jour · {meta.label}</p>
            <p className="text-[11px] text-muted-foreground">Filtré, dédoublonné, prêt à postuler</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <Clock className="size-3" />
            08:00
          </span>
        </div>
        <div className="border-b border-outline-variant/40 bg-surface-container-low/40 px-5 py-3">
          <div className="flex items-center">
            {pipeline.map((s, i) => (
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
                <span className="flex items-center gap-2">
                  <span className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full border bg-white",
                    i === 2 ? "border-brand-orange/50 text-brand-orange" : "border-outline-variant/60 text-muted-foreground"
                  )}>
                    <s.icon className="size-3.5" />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[10px] font-black text-brand-navy">{s.t}</span>
                    <span className="block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{s.l}</span>
                  </span>
                </span>
              </Fragment>
            ))}
          </div>
        </div>
        <ul className="divide-y divide-outline-variant/30 px-3">
          {isLoading && preview.length === 0
            ? [0, 1, 2].map(i => (
                <li key={i} className="flex items-center gap-3 px-2 py-3.5">
                  <Skeleton className="size-2 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-2.5 w-1/2" />
                  </div>
                </li>
              ))
            : preview.map((o, i) => (
                <motion.li
                  key={o.uid}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.7 + i * 0.14, ease: "easeOut" }}
                  className="group flex items-center gap-3 rounded-lg px-2 py-3.5 transition-colors hover:bg-surface-container-low/60"
                >
                  <span className={cn("size-2 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-150", hue.dot)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-on-surface">{o.titre}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{o.entreprise} · {o.ville}</p>
                  </div>
                  {o.jours === 0 && (
                    <span className="hidden shrink-0 rounded-full bg-brand-orange/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#B45309] sm:inline">
                      Nouveau
                    </span>
                  )}
                  <ChipSource source={o.source} />
                </motion.li>
              ))}
        </ul>
        <div className="flex items-center justify-between gap-3 border-t border-outline-variant/40 bg-surface-container-low/40 px-5 py-3.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            + {restants} autres offres dans l'email
          </span>
          <span className="shrink-0 rounded-md bg-brand-navy px-3 py-1.5 text-[11px] font-bold text-white">
            Ouvrir le récap'
          </span>
        </div>
        <div className="flex items-center gap-3 border-t border-outline-variant/40 px-5 py-3">
          <div className="flex -space-x-2">
            {AVATARS.map(a => (
              <span key={a.init} className={cn("grid size-6 place-items-center rounded-full border-2 border-white text-[9px] font-bold text-white", a.cls)}>
                {a.init}
              </span>
            ))}
          </div>
          <p className="text-[11px] font-medium text-muted-foreground">
            <strong className="font-bold text-brand-navy">{meta.abonnes.toLocaleString("fr-FR")} abonnés</strong> reçoivent ce récap chaque matin
          </p>
        </div>
      </div>
    </motion.div>
  )
}

const HeroFiliere = ({ meta, hue, offres, isLoading }) => {
  const nouvelles = offres.filter(o => o.jours === 0).length
  return (
    <section className="relative overflow-hidden hero-gradient">
      <div className="absolute inset-0 bg-pattern opacity-50" aria-hidden />
      <div className={cn("absolute -top-32 right-[-10%] size-140 rounded-full blur-3xl", hue.glow)} aria-hidden />
      <div className="absolute -bottom-40 -left-40 size-120 rounded-full bg-brand-navy/4 blur-3xl" aria-hidden />
      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-8 md:px-12 md:pb-20 lg:pt-10">
        <motion.nav
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          aria-label="Fil d'Ariane"
        >
          <Link to="/" className="transition-colors hover:text-brand-navy">Accueil</Link>
          <ChevronRight className="size-3" />
          <Link to="/filieres" className="transition-colors hover:text-brand-navy">Filières</Link>
          <ChevronRight className="size-3" />
          <span className="font-semibold text-brand-navy">{meta.label}</span>
        </motion.nav>
        <div className="mt-8 grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } } }}
            className="flex flex-col items-start gap-5"
          >
            <motion.div
              variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}
              className="flex items-center gap-3.5"
            >
              <span className={cn("flex size-16 items-center justify-center rounded-xl shadow-soft", hue.tile)}>
                <meta.icon className="size-8" strokeWidth={1.8} />
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-outline-variant/50 bg-white/80 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant backdrop-blur-sm">
                <span className={cn("size-1.5 rounded-full", hue.dot)} />
                Filière métier
              </span>
            </motion.div>
            <motion.h1
              variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}
              className="font-heading text-4xl font-black leading-[1.05] tracking-tight text-brand-navy sm:text-5xl xl:text-6xl"
            >
              {meta.label}
              <span className="mt-2 block text-xl font-bold leading-snug text-on-surface-variant sm:text-2xl">
                en Côte d'Ivoire.
              </span>
            </motion.h1>
            <motion.div
              variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}
            >
              <p className={cn("font-heading text-base font-bold sm:text-lg", hue.accent)}>{meta.tagline}</p>
              <p className="mt-2 max-w-xl md:text-lg leading-relaxed text-on-surface-variant">
                {meta.desc} Recevez les nouveautés de la filière chaque matin à 8h00 directement dans votre boîte mail, sans recherche, sans doublon.
              </p>
            </motion.div>
            <motion.div
              variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}
            >
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                <Sparkles className="size-3.5 text-brand-orange" />
                Mots-clés de matching automatique
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {meta.keywords.map(kw => (
                  <Tooltip key={kw}>
                    <TooltipTrigger asChild>
                      <span className="cursor-help rounded-full border border-outline-variant/60 bg-white/80 px-3 py-1 text-xs font-medium text-on-surface-variant backdrop-blur-sm transition-colors hover:border-brand-navy/40 hover:text-brand-navy">
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
            <motion.div
              variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}
              className="mt-1 flex flex-col gap-3 sm:flex-row"
            >
              <Link
                to={`/inscription?filieres=${meta.code}`}
                className={cn(
                  "group inline-flex items-center justify-center gap-2.5 rounded-lg px-7 py-3.5 text-base font-bold text-white shadow-[0_12px_28px_-8px_rgba(15,45,77,0.4)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98]",
                  hue.solid
                )}
              >
                <Bell className="size-5 transition-transform duration-300 group-hover:rotate-12" />
                Créer une alerte {meta.label}
              </Link>
              <CtaLink to="/filieres" variant="secondary" icon={LayoutGrid}>
                Toutes les filières
              </CtaLink>
            </motion.div>
            <motion.dl
              variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}
              className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-4"
            >
              {[
                { valeur: meta.actives, label: "offres actives" },
                { valeur: nouvelles, label: "nouvelles cette semaine" },
                { valeur: meta.abonnes, label: "abonnés à l'alerte" },
              ].map(s => (
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
          <RecapCard meta={meta} hue={hue} offres={offres} isLoading={isLoading} />
        </div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════
BANDEAU ALERTE + AUTRES FILIÈRES
════════════════════════════════════════════════════════════════════ */
const BandeauAlerte = ({ meta, hue }) => {
  const [email, setEmail] = useState("")
  const navigate = useNavigate()
  const handleSubmit = e => {
    e.preventDefault()
    if (!email.trim()) return
    navigate(`/inscription?filieres=${meta.code}&email=${encodeURIComponent(email.trim())}`)
  }
  return (
    <section className="bg-surface-container-lowest py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-xl bg-brand-navy"
        >
          <div className="pointer-events-none absolute inset-0 bg-pattern opacity-20" aria-hidden />
          <div className={cn("pointer-events-none absolute -right-24 -top-24 size-105 rounded-full blur-3xl", hue.glow)} aria-hidden />
          <meta.icon className="pointer-events-none absolute -bottom-10 -right-6 size-56 rotate-12 text-white/5" strokeWidth={1} aria-hidden />
          <div className="relative grid items-center gap-10 px-6 py-12 sm:px-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-14 lg:py-14">
            <div>
              <span className={cn("inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white", hue.solid)}>
                <Bell className="size-3" />
                Alerte {meta.label}
              </span>
              <h2 className="mt-4 font-heading text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">
                Soyez le premier à postuler.
              </h2>
              <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-white/70">
                Les offres {meta.label.toLowerCase()} partent vite : les abonnés les reçoivent à 8h00, avant
                qu'elles n'apparaissent partout ailleurs. Votre premier récapitulatif arrive demain matin.
              </p>
            </div>
            <div>
              <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 sm:flex-row">
                <div className="relative flex-1">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/40" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    aria-label="Votre adresse email"
                    className="h-12 w-full rounded-md border border-white/15 bg-white/10 pl-10 pr-4 text-sm text-white outline-none transition-all duration-300 placeholder:text-white/40 focus:border-brand-orange focus:bg-white/[0.14] focus:ring-2 focus:ring-brand-orange/30"
                  />
                </div>
                <button
                  type="submit"
                  className={cn(
                    "group inline-flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md px-5 text-sm font-bold text-white transition-all duration-300 hover:brightness-110 active:scale-[0.98]",
                    hue.solid
                  )}
                >
                  <Bell className="size-4 transition-transform duration-300 group-hover:rotate-12" />
                  Créer l'alerte
                </button>
              </form>
              <p className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/50">
                {["Gratuit pour toujours", "1 email par jour à 8h00", "Désinscription en 1 clic"].map(t => (
                  <span key={t} className="inline-flex items-center gap-1.5">
                    <Check className="size-3.5 text-emerald-400" />
                    {t}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

const AutresFilieres = ({ codeActuel }) => {
  const { data: rawFilieres } = useFetchData(getFilieres)
  const autres = useMemo(
    () => (Array.isArray(rawFilieres) ? rawFilieres : [])
      .map(adaptFiliere)
      .filter(f => f && f.code !== codeActuel && f.is_active !== false),
    [rawFilieres, codeActuel]
  )
  return (
    <section className="bg-surface-container-lowest pb-20">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-between gap-4 border-t border-outline-variant/40 pt-10"
        >
          <h2 className="font-heading text-lg font-bold text-brand-navy sm:text-xl">Explorer les autres filières</h2>
          <Link to="/filieres" className="group inline-flex items-center gap-1 text-sm font-bold text-brand-navy transition-colors hover:text-brand-orange">
            Tout voir
            <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </motion.div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {autres.slice(0, 8).map((f, i) => {
            const h = HUES[f.hue] || BRAND_HUE
            return (
              <motion.div
                key={f.code}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: (i % 8) * 0.05, ease: [0.22, 1, 0.36, 1] }}
              >
                <Link
                  to={`/filieres/${f.code}`}
                  className="group flex items-center gap-3.5 rounded-xl border border-outline-variant/50 bg-white p-4 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-brand-navy/25 hover:shadow-hover"
                >
                  <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-105", h.tile)}>
                    <f.icon className="size-5" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-heading text-sm font-bold text-brand-navy">{f.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {f.actives} offres actives · {f.abonnes.toLocaleString("fr-FR")} abonnés
                    </p>
                  </div>
                  <ArrowUpRight className="size-4 shrink-0 text-outline-variant transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-orange" />
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════
FILIÈRE INTROUVABLE
════════════════════════════════════════════════════════════════════ */
const FiliereIntrouvable = ({ code, error, onReload }) => (
  <section className="hero-gradient flex min-h-[60vh] items-center justify-center px-6 py-20">
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-md text-center"
    >
      <span className="mx-auto flex size-16 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange">
        {error ? <AlertTriangle className="size-8" strokeWidth={1.8} /> : <SearchX className="size-8" strokeWidth={1.8} />}
      </span>
      <h1 className="mt-5 font-heading text-3xl font-black tracking-tight text-brand-navy">
        {error ? "Impossible de charger la filière" : `Filière « ${code} » introuvable`}
      </h1>
      <p className="mt-3 text-on-surface-variant">
        {error?.message || "Cette filière n'existe pas ou a été renommée. Découvrez les filières couvertes par JobAlert CI."}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {error && onReload && (
          <button
            onClick={onReload}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-navy/20 px-5 py-2.5 text-sm font-bold text-brand-navy transition-all hover:border-brand-navy hover:bg-brand-navy hover:text-white"
          >
            <RefreshCw className="size-4" /> Réessayer
          </button>
        )}
        <Link
          to="/filieres"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-orange px-6 py-3 text-sm font-bold text-white transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110"
        >
          <LayoutGrid className="size-4" />
          Voir toutes les filières
        </Link>
      </div>
    </motion.div>
  </section>
)

/* ════════════════════════════════════════════════════════════════════
SÉLECTEUR DE LOCALISATION (identique à FiltresOffres.jsx)
════════════════════════════════════════════════════════════════════ */
const LocationPicker = ({
  locations = [],
  value = null,
  onChange,
  isLoading = false,
  className,
}) => {
  const [q, setQ] = useState("")
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = needle
      ? locations.filter(l => `${l.label} ${l.city}`.toLowerCase().includes(needle))
      : locations
    return list.slice(0, 60)
  }, [locations, q])

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Ville, région, télétravail…"
          aria-label="Rechercher une localisation"
          className="h-9 w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest pl-8 pr-7 text-[13px] outline-none transition-all placeholder:text-muted-foreground/70 focus:border-brand-navy/50 focus:ring-2 focus:ring-brand-navy/10"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            aria-label="Effacer"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-brand-navy"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {value && (
        <button
          onClick={() => onChange?.(null)}
          className="self-start text-[11px] font-bold text-brand-orange transition-colors hover:underline"
        >
          Effacer la localisation
        </button>
      )}
      <div className="max-h-64 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="space-y-1.5 py-1">
            {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-full rounded-md" />)}
          </div>
        ) : results.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            {locations.length === 0
              ? "Localisations indisponibles pour le moment."
              : "Aucune localisation ne correspond."}
          </p>
        ) : (
          results.map(l => (
            <CheckRow
              key={l.id}
              checked={value === l.id}
              onToggle={() => onChange?.(value === l.id ? null : l.id)}
              label={l.label || l.city || "—"}
              lead={<MapPin className={cn("size-3.5 shrink-0", value === l.id ? "text-brand-orange" : "text-muted-foreground")} />}
            />
          ))
        )}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
GROUPES DE FILTRES — drawer mobile (Spécialité remplace Filière)
════════════════════════════════════════════════════════════════════ */
const FilterGroup = ({ icon: Icon, title, children }) => (
  <div className="border-b border-outline-variant/40 py-4 first:pt-0 last:border-0">
    <p className="mb-2 flex items-center gap-2 font-heading text-[13px] font-extrabold text-brand-navy">
      <Icon className="size-3.5 text-brand-orange" />
      {title}
    </p>
    {children}
  </div>
)

const OptionsSkeleton = ({ rows = 4 }) => (
  <div className="space-y-1.5">
    {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-8 w-full rounded-md" />)}
  </div>
)

const FiliereFilterGroups = ({
  meta,
  referentials,
  counts = {},
  filters,
  toggle,
  period,
  onPeriod,
  locationId = null,
  onLocation,
  isLoading = false,
  hue,
}) => {
  const {
    sources = [], contrats = [],
    experiences = [], niveaux = [], locations = [],
  } = referentials ?? {}

  return (
    <div className="flex flex-col">
      {/* Localisation */}
      <FilterGroup icon={MapPin} title="Localisation">
        <LocationPicker
          locations={locations}
          value={locationId}
          onChange={onLocation}
          isLoading={isLoading && locations.length === 0}
        />
      </FilterGroup>

      {/* Sources */}
      <FilterGroup icon={Layers} title="Sources">
        {isLoading && sources.length === 0 ? <OptionsSkeleton /> : sources.map(s => (
          <CheckRow
            key={s.code}
            checked={filters.sources.has(s.code)}
            onToggle={() => toggle("sources", s.code)}
            label={s.label}
            count={counts.sources?.[s.code] ?? 0}
            lead={<SourceLogo code={s.code} className="size-5 rounded text-[8px]" />}
          />
        ))}
      </FilterGroup>

      {/* Contrat */}
      <FilterGroup icon={Briefcase} title="Contrat">
        {isLoading && contrats.length === 0 ? <OptionsSkeleton /> : contrats.map(c => (
          <CheckRow
            key={c.code}
            checked={filters.contrats.has(c.code)}
            onToggle={() => toggle("contrats", c.code)}
            label={c.label}
            count={counts.contrats?.[c.code] ?? 0}
          />
        ))}
      </FilterGroup>

      {/* Expérience */}
      <FilterGroup icon={Zap} title="Expérience">
        {isLoading && experiences.length === 0 ? <OptionsSkeleton rows={3} /> : experiences.map(x => (
          <CheckRow
            key={x.code}
            checked={filters.experiences.has(x.code)}
            onToggle={() => toggle("experiences", x.code)}
            label={x.label}
          />
        ))}
      </FilterGroup>

      {/* Niveau */}
      <FilterGroup icon={GraduationCap} title="Niveau d'études">
        {isLoading && niveaux.length === 0 ? <OptionsSkeleton rows={3} /> : niveaux.map(n => (
          <CheckRow
            key={n.code}
            checked={filters.niveaux.has(n.code)}
            onToggle={() => toggle("niveaux", n.code)}
            label={n.label}
          />
        ))}
      </FilterGroup>

      {/* Période */}
      <FilterGroup icon={CalendarDays} title="Période de publication">
        <MiniCalendar range={period ?? filters.period} onChange={onPeriod} hue={BRAND_HUE} />
      </FilterGroup>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
SKELETONS
════════════════════════════════════════════════════════════════════ */
const OfferSkeleton = ({ view }) => (
  <div className={cn(
    "rounded-xl border border-outline-variant/40 bg-white p-5 shadow-soft",
    view === "grid" ? "h-64" : "h-24"
  )}>
    <div className="space-y-3">
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
      {view === "grid" && <Skeleton className="mt-6 h-8 w-24" />}
    </div>
  </div>
)

const OffersSkeletonList = ({ view, count = 6, className }) => (
  <div className={cn(
    view === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-3",
    className
  )}>
    {Array.from({ length: count }, (_, i) => <OfferSkeleton key={i} view={view} />)}
  </div>
)

/* ════════════════════════════════════════════════════════════════════
CONFIGURATION DES FILTRES URL
(identique à Offres, avec specialites à la place de filieres)
════════════════════════════════════════════════════════════════════ */
const PAGE_SIZE = 12
const CONFIG_FILTRES = {
  sets: [
    { key: "sources", param: "src" },
    { key: "contrats", param: "ct" },
    { key: "experiences", param: "exp" },
    { key: "niveaux", param: "niv" },
    { key: "specialites", param: "spec" },
  ],
  scalars: [
    { key: "sort", param: "tri", defaut: "recent" },
    { key: "view", param: "vue", defaut: "list" },
    { key: "query", param: "q", defaut: "" },
    { key: "location", param: "loc", defaut: "" },
  ],
  period: { debut: "du", fin: "au" },
}

/* ════════════════════════════════════════════════════════════════════
PAGE
════════════════════════════════════════════════════════════════════ */
const DetailsFiliere = () => {
  const { filiere: slug } = useParams()
  const isMobile = useIsMobile()

  /* ═══ Chargement de la filière ═══ */
  const fetchFiliere = useCallback(() => getFilieresBySlug(slug), [slug])
  const {
    data: rawFiliere,
    isLoading: loadingFiliere,
    error: errorFiliere,
    reload: reloadFiliere,
  } = useFetchData(fetchFiliere, !!slug)

  const meta = useMemo(() => adaptFiliere(rawFiliere), [rawFiliere])
  const hue = meta ? (HUES[meta.hue] || BRAND_HUE) : BRAND_HUE

  /* ═══ Référentiels API (sources, contrats, expériences, niveaux, locations) ═══ */
  const referentials = useOfferReferentials()
  const refs = referentials.data
  const refsLoading = referentials.isLoading

  /* ═══ Filtres URL ═══ */
  const { filters, valeurs, toggle, setScalar, setPeriod, reset } = useUrlFilters(CONFIG_FILTRES)
  const sort = SORTS.some(s => s.k === valeurs.sort) ? valeurs.sort : "recent"
  const view = valeurs.view === "grid" ? "grid" : "list"
  const locationId = valeurs.location || null
  const setSort = k => setScalar("sort", k)
  const setView = v => setScalar("view", v)
  const setLocation = useCallback(id => setScalar("location", id ?? ""), [setScalar])

  /* ═══ Recherche debounce ═══ */
  const [queryLocale, setQueryLocale] = useState(valeurs.query)
  useEffect(() => { setQueryLocale(valeurs.query) }, [valeurs.query])
  useEffect(() => {
    if (queryLocale === valeurs.query) return
    const t = setTimeout(() => setScalar("query", queryLocale), 350)
    return () => clearTimeout(t)
  }, [queryLocale, valeurs.query, setScalar])

  /* ═══ Paramètres API ═══
     Le backend FiliereOffers accepte des IDs uniques.
     On passe le premier sélectionné de chaque set, le filtrage fin côté client. */
  const apiParams = useMemo(() => {
    if (!meta) return {}
    const q = valeurs.query.trim()
    const firstOf = set => (set.size > 0 ? [...set][0] : undefined)

    const specialiteId = meta.specialites.find(s => filters.specialites.has(s.code))?.id
      || firstOf(filters.specialites)

    const sourceId = refs.sources?.find(s => filters.sources.has(s.code))?.id
    const contractId = refs.contrats?.find(c => filters.contrats.has(c.code))?.id
    const experienceId = refs.experiences?.find(x => filters.experiences.has(x.code))?.id
    const educationId = refs.niveaux?.find(n => filters.niveaux.has(n.code))?.id

    return {
      sort,
      specialite_id: specialiteId,
      source_id: sourceId,
      contract_type_id: contractId,
      experience_level_id: experienceId,
      education_level_id: educationId,
      location_id: locationId || undefined,
      q: q.length >= 2 ? q : undefined,
      published_since: toIsoStart(filters.period.start),
      published_until: toIsoEnd(filters.period.end),
    }
  }, [meta, sort, filters, locationId, valeurs.query, refs])

  /* ═══ Feed paginé ═══ */
  const feed = useFiliereOffersFeed({ slug, params: apiParams, pageSize: PAGE_SIZE })
  const { offers, isLoading, isLoadingMore, error: feedError, hasMore, loadMore, reload } = feed

  /* ═══ Filtrage fin côté client (multi-sélection) ═══ */
  const filtered = useMemo(() => {
    if (!offers.length) return []
    const q = queryLocale.trim().toLowerCase()
    return offers.filter(o => {
      if (q && !(o.titre.toLowerCase().includes(q) || o.entreprise.toLowerCase().includes(q))) return false
      if (filters.sources.size && !filters.sources.has(o.source)) return false
      if (filters.contrats.size && !filters.contrats.has(o.contratCode)) return false
      if (filters.experiences.size && !filters.experiences.has(o.experienceCode)) return false
      if (filters.niveaux.size && !filters.niveaux.has(o.niveauCode)) return false
      if (filters.specialites.size && !filters.specialites.has(o.specialite)) return false
      if (locationId && o.locationId !== locationId) return false
      return true
    })
  }, [offers, queryLocale, filters, locationId])

  /* ═══ Compteurs locaux (dans la filière) ═══ */
  const counts = useMemo(() => {
    const c = { sources: {}, contrats: {}, experiences: {}, niveaux: {}, specialites: {} }
    offers.forEach(o => {
      if (o.source) c.sources[o.source] = (c.sources[o.source] || 0) + 1
      if (o.contratCode) c.contrats[o.contratCode] = (c.contrats[o.contratCode] || 0) + 1
      if (o.experienceCode) c.experiences[o.experienceCode] = (c.experiences[o.experienceCode] || 0) + 1
      if (o.niveauCode) c.niveaux[o.niveauCode] = (c.niveaux[o.niveauCode] || 0) + 1
      if (o.specialite) c.specialites[o.specialite] = (c.specialites[o.specialite] || 0) + 1
    })
    return c
  }, [offers])

  /* ═══ Feed groupé jour par jour ═══ */
  const feedItems = useMemo(() => {
    if (sort !== "recent") return filtered.map(o => ({ type: "offre", o }))
    const items = []
    let last = null
    filtered.forEach(o => {
      if (o.jours !== last) {
        items.push({ type: "header", jours: o.jours, count: filtered.filter(x => x.jours === o.jours).length })
        last = o.jours
      }
      items.push({ type: "offre", o })
    })
    return items
  }, [filtered, sort])

  /* ═══ États UI ═══ */
  const [saved, setSaved] = useState(new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [openPop, setOpenPop] = useState(null)
  const [showTop, setShowTop] = useState(false)
  const sortRef = useRef(null)
  useClickOutside(sortRef, () => setOpenPop(p => (p === "sort" ? null : p)))

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 700)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const toggleSave = uid =>
    setSaved(prev => {
      const next = new Set(prev)
      next.has(uid) ? next.delete(uid) : next.add(uid)
      return next
    })

  const labelOf = useCallback((list, code) =>
    list.find(x => x.code === code)?.label || code, [])

  /* ═══ Chips actifs ═══ */
  const activeChips = useMemo(() => {
    const chips = []
    filters.sources.forEach(s => chips.push({ key: `s-${s}`, label: labelOf(refs.sources, s), rm: () => toggle("sources", s) }))
    filters.specialites.forEach(sp => {
      const spMeta = meta.specialites.find(s => s.code === sp)
      chips.push({ key: `sp-${sp}`, label: spMeta?.label || sp, rm: () => toggle("specialites", sp) })
    })
    filters.contrats.forEach(c => chips.push({ key: `c-${c}`, label: labelOf(refs.contrats, c), rm: () => toggle("contrats", c) }))
    filters.experiences.forEach(x => chips.push({ key: `e-${x}`, label: labelOf(refs.experiences, x), rm: () => toggle("experiences", x) }))
    filters.niveaux.forEach(n => chips.push({ key: `n-${n}`, label: labelOf(refs.niveaux, n), rm: () => toggle("niveaux", n) }))
    if (locationId) {
      const loc = refs.locations.find(l => l.id === locationId)
      chips.push({ key: "loc", label: loc?.label || loc?.city || "Localisation", rm: () => setLocation(null) })
    }
    const { start, end } = filters.period
    if (start && end) {
      chips.push({ key: "p", label: sameDay(start, end) ? fmtDay(start) : `${fmtDay(start)} → ${fmtDay(end)}`, rm: () => setPeriod({ start: null, end: null }) })
    } else if (start) {
      chips.push({ key: "p", label: `Depuis le ${fmtDay(start)}`, rm: () => setPeriod({ start: null, end: null }) })
    }
    return chips
  }, [filters, locationId, refs, meta, labelOf, toggle, setPeriod, setLocation])

  const activeCount =
    filters.sources.size + filters.contrats.size + filters.experiences.size +
    filters.niveaux.size + filters.specialites.size +
    (locationId ? 1 : 0) +
    (filters.period.start || filters.period.end ? 1 : 0)

  const resetTout = useCallback(() => { reset(); setQueryLocale("") }, [reset])
  const pop = k => ({
    open: openPop === k,
    onToggle: () => setOpenPop(p => (p === k ? null : k)),
    onClose: () => setOpenPop(p => (p === k ? null : p)),
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
    ? (refs.locations.find(l => l.id === locationId)?.label || "Localisation")
    : "Localisation"

  const isDone = !isLoading && !isLoadingMore && !hasMore && filtered.length > 0

  /* ═══ Rendu ═══ */
  if (!slug) {
    return <FiliereIntrouvable code="?" />
  }

  if (loadingFiliere) {
    return (
      <>
        <Seo title="Chargement… | JobAlert CI" description="" />
        <main className="flex min-h-[60vh] items-center justify-center bg-background">
          <Loader2 className="size-8 animate-spin text-brand-orange" />
        </main>
      </>
    )
  }

  if (errorFiliere || !meta) {
    return (
      <>
        <Seo title={`Filière introuvable | JobAlert CI`} description="" noindex />
        <FiliereIntrouvable code={slug} error={errorFiliere} onReload={reloadFiliere} />
      </>
    )
  }

  return (
    <>
      <Seo {...filiereSeo({ meta, filiere: slug, offres: filtered })} />
      <main>
        <HeroFiliere meta={meta} hue={hue} offres={offers} isLoading={isLoading} />

        {/* ═══════════ Barre de filtres sticky (même structure que Offres) ═══════════ */}
        <div className="sticky top-1/10 z-40 border-b border-outline-variant/40 bg-background/85 backdrop-blur-md">
          <div className="mx-auto max-w-7xl px-6 py-3 md:px-12">
            {/* Desktop */}
            <div className="hidden flex-wrap items-center gap-2 lg:flex">
              <div className="relative w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={queryLocale}
                  onChange={e => setQueryLocale(e.target.value)}
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

              {/* Localisation (ajout depuis Offres) */}
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

              {/* Sources */}
              <FilterPopover label="Sources" icon={Layers} count={filters.sources.size} {...pop("sources")}>
                {refsLoading && refs.sources.length === 0
                  ? [0, 1, 2].map(i => <Skeleton key={i} className="mb-1.5 h-8 w-full rounded-md" />)
                  : refs.sources.map(s => (
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

              {/* Contrat */}
              <FilterPopover label="Contrat" icon={Briefcase} count={filters.contrats.size} {...pop("contrat")}>
                {refs.contrats.map(c => (
                  <CheckRow
                    key={c.code}
                    checked={filters.contrats.has(c.code)}
                    onToggle={() => toggle("contrats", c.code)}
                    label={c.label}
                    count={counts.contrats[c.code] ?? 0}
                  />
                ))}
              </FilterPopover>

              {/* Expérience */}
              <FilterPopover label="Expérience" icon={Zap} count={filters.experiences.size} {...pop("exp")}>
                {refs.experiences.map(x => (
                  <CheckRow
                    key={x.code}
                    checked={filters.experiences.has(x.code)}
                    onToggle={() => toggle("experiences", x.code)}
                    label={x.label}
                  />
                ))}
              </FilterPopover>

              {/* Niveau */}
              <FilterPopover label="Niveau" icon={GraduationCap} count={filters.niveaux.size} {...pop("niveau")}>
                {refs.niveaux.map(n => (
                  <CheckRow
                    key={n.code}
                    checked={filters.niveaux.has(n.code)}
                    onToggle={() => toggle("niveaux", n.code)}
                    label={n.label}
                  />
                ))}
              </FilterPopover>

              {/* Période */}
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
                      <strong className="font-heading text-sm font-bold text-brand-navy">{filtered.length}{hasMore ? "+" : ""}</strong>
                      {" "}offre{filtered.length > 1 ? "s" : ""}
                    </>
                  )}
                </span>
                {/* Tri */}
                <div ref={sortRef} className="relative">
                  <button
                    onClick={() => setOpenPop(p => (p === "sort" ? null : "sort"))}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-all duration-200",
                      openPop === "sort"
                        ? "border-brand-navy bg-brand-navy text-white"
                        : "border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant hover:border-brand-navy/40 hover:text-brand-navy"
                    )}
                  >
                    <ArrowUpDown className="size-3.5" />
                    {SORTS.find(s => s.k === sort)?.l ?? "Trier"}
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
                        {SORTS.map(s => (
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
                  onChange={e => setQueryLocale(e.target.value)}
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

        {/* ═══════════ Drawer mobile (mêmes groupes que Offres, avec Spécialité) ═══════════ */}
        <FiltersDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          title={`Filtres · ${meta.label}`}
          resultCount={filtered.length}
          sort={sort}
          onSort={setSort}
          onReset={resetTout}
          ctaClassName={hue.solid}
        >
          <FiliereFilterGroups
            meta={meta}
            referentials={refs}
            counts={counts}
            filters={filters}
            toggle={toggle}
            period={filters.period}
            onPeriod={setPeriod}
            locationId={locationId}
            onLocation={setLocation}
            isLoading={refsLoading}
            hue={hue}
          />
        </FiltersDrawer>

        {/* ═══════════ Le flux ═══════════ */}
        <section className="border-b border-outline-variant/30 bg-background py-12 md:py-16">
          <div className="mx-auto max-w-7xl px-6 md:px-12">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-orange">
                <span className="h-px w-6 bg-brand-orange" aria-hidden />
                Collecte du jour
              </p>
              <h2 className="mt-3 font-heading text-3xl font-extrabold tracking-tight text-brand-navy sm:text-4xl">
                Les offres <span className="text-brand-orange">{meta.label}</span> du moment
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {isLoading ? "Chargement des offres…" : (
                  <>
                    <strong className="font-heading font-bold text-brand-navy">{filtered.length}{hasMore ? "+" : ""}</strong>
                    {" "}offre{filtered.length > 1 ? "s" : ""}
                    {activeCount > 0 ? ` · ${activeCount} filtre${activeCount > 1 ? "s" : ""} actif${activeCount > 1 ? "s" : ""}` : ""}
                    {" "}triées par « {(SORTS.find(s => s.k === sort)?.l ?? "").toLowerCase()} »
                  </>
                )}
              </p>
            </motion.div>

            {/* Référentiels en repli */}
            {referentials.isFallback && !referentials.isLoading && (
              <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-semibold text-amber-800">
                <AlertTriangle className="size-4" />
                Les listes de filtres n'ont pas pu être chargées — options par défaut affichées.
                <button onClick={referentials.reload} className="inline-flex items-center gap-1 font-bold underline">
                  <RefreshCw className="size-3" /> Réessayer
                </button>
              </div>
            )}

            {/* Chips actifs */}
            <AnimatePresence>
              {activeChips.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {activeChips.map(c => (
                      <button
                        key={c.key}
                        onClick={c.rm}
                        className="group inline-flex items-center gap-1.5 rounded-full border border-brand-navy/20 bg-brand-navy/5 px-3 py-1.5 text-xs font-semibold text-brand-navy transition-all hover:border-brand-orange/50 hover:bg-brand-orange/10"
                      >
                        {c.label}
                        <X className="size-3 text-muted-foreground transition-colors group-hover:text-brand-orange" />
                      </button>
                    ))}
                    <button onClick={resetTout} className="text-xs font-bold text-brand-orange transition-colors hover:underline">
                      Tout effacer
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── États ── */}
            {isLoading ? (
              <OffersSkeletonList view={view === "grid" || isMobile ? "grid" : "list"} count={PAGE_SIZE / 2} className="mt-8" />
            ) : feedError && filtered.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-10 rounded-xl border border-destructive/30 bg-destructive/5 p-12 text-center"
              >
                <AlertTriangle className="mx-auto size-10 text-destructive/70" />
                <h3 className="mt-4 font-heading text-lg font-bold text-brand-navy">Le flux n'a pas pu être chargé</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{feedError?.message || feedError}</p>
                <button
                  onClick={reload}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg border border-brand-navy/20 px-5 py-2.5 text-sm font-bold text-brand-navy transition-all hover:border-brand-navy hover:bg-brand-navy hover:text-white"
                >
                  <RefreshCw className="size-4" /> Réessayer
                </button>
              </motion.div>
            ) : filtered.length === 0 ? (
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
                        hue={hue}
                        showFiliereChip={false}
                        showSpecialite
                        saved={saved.has(item.o.uid)}
                        onToggleSave={toggleSave}
                        getDetailLink={of => `/offres/${of.id}`}
                        entrepriseTotal={offers.filter(x => x.entreprise === item.o.entreprise).length}
                      />
                    )
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {feedItems.filter(x => x.type === "offre").map((item, i) => (
                    <OfferCard
                      key={item.o.uid}
                      offre={item.o}
                      index={i}
                      view="grid"
                      hue={hue}
                      showFiliereChip={false}
                      showSpecialite
                      saved={saved.has(item.o.uid)}
                      onToggleSave={toggleSave}
                      getDetailLink={of => `/offres/${of.id}`}
                      entrepriseTotal={offers.filter(x => x.entreprise === item.o.entreprise).length}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Skeletons "charger plus" */}
            {isLoadingMore && (
              <OffersSkeletonList
                view={view === "grid" || isMobile ? "grid" : "list"}
                count={3}
                className="mt-3"
              />
            )}

            {/* Erreur non bloquante */}
            {feedError && filtered.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs font-semibold text-destructive">
                <AlertTriangle className="size-4" />
                {feedError?.message || feedError}
                <button onClick={loadMore} className="inline-flex items-center gap-1 font-bold underline">
                  <RefreshCw className="size-3" /> Réessayer
                </button>
              </div>
            )}

            {/* Charger plus */}
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
                    <span>{filtered.length} affichée{filtered.length > 1 ? "s" : ""}</span>
                    {meta.actives > 0 && <span>{meta.actives} au total</span>}
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-container-high">
                    <motion.div
                      className="h-full rounded-full bg-brand-navy"
                      animate={{ width: `${Math.min(100, meta.actives ? (filtered.length / meta.actives) * 100 : 0)}%` }}
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
                        to={`/inscription?filieres=${meta.code}`}
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
              <span className={cn("size-1.5 rounded-full", hue.dot)} />
              Mises à jour chaque matin à 6h02 · lien direct vers l'annonce d'origine
            </p>
          </div>
        </section>

        <BandeauAlerte meta={meta} hue={hue} />
        <AutresFilieres codeActuel={meta.code} />

        {/* Bouton retour en haut */}
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

export default DetailsFiliere