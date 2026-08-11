import {
  ArrowRight, ArrowUpRight, BadgeCheck, Bell, BookOpen,
  ChevronDown, Clock, LayoutGrid, Menu, Radar, Sparkles,
  Zap, X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@/lib/utils"
import Logo from "@/components/ui/logo"
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion"
import { HUES } from "@/lib/hues"
import { fmtVus } from "@/lib/query-helpers"
import { useNavigationData } from "@/lib/navigation-data"

/* ------------------------------------------------------------------ /
/  Navigation — liens simples (pas de données dynamiques)            /
/ ------------------------------------------------------------------ */
const NAV_LINKS = [
  { label: "Accueil", to: "/" },
  { label: "Comment ça marche", to: "/comment-ca-marche" },
]
const NAV_LINKS_AFTER = [{ label: "Sources", to: "/sources" }]

/* ------------------------------------------------------------------ */
/*  Animations                                                         */
/* ------------------------------------------------------------------ */

const panelVariants = {
  hidden: { opacity: 0, y: -12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.16 } },
}

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.025, delayChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
}

/* ------------------------------------------------------------------ */
/*  Sous-composants partagés                                           */
/* ------------------------------------------------------------------ */

const NavItem = ({ to, label }) => {
  const { pathname } = useLocation()
  const active = pathname === to
  return (
    <Link
      to={to}
      className={cn(
        "rounded-md px-3 py-2 text-sm font-semibold transition-colors duration-200",
        active
          ? "bg-surface-container text-brand-navy"
          : "text-on-surface-variant hover:bg-surface-container-low hover:text-brand-navy"
      )}
    >
      {label}
    </Link>
  )
}

/* Coquille commune aux deux mega-menus desktop */
const MegaPanel = ({ children, onEnter, onLeave }) => (
  <motion.div
    variants={panelVariants}
    initial="hidden"
    animate="visible"
    exit="exit"
    onMouseEnter={onEnter}
    onMouseLeave={onLeave}
    className="absolute inset-x-0 top-full border-b border-outline-variant/40 bg-white shadow-[0_28px_48px_-16px_rgba(15,45,77,0.22)]"
  >
    {children}
  </motion.div>
)

/* Tuile catégorie (filière ou conseil) */
const MenuTile = ({ item }) => {
  const hue = HUES[item.hue] ?? HUES.sky
  const Icon = item.icon
  return (
    <motion.div variants={itemVariants}>
      <Link
        to={item.to}
        className={cn(
          "group flex items-center gap-3 rounded-lg border border-transparent p-2.5 transition-all duration-200 hover:-translate-y-0.5",
          `hover:bg-${item.hue}-50 hover:border-${item.hue}-200`
        )}
      >
        <span className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-md transition-colors duration-200",
          hue.tile,
          `group-hover:${hue.solid} group-hover:text-white`
        )}>
          <Icon className="size-5" strokeWidth={2} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold leading-tight text-on-surface">
            {item.label}
          </span>
          <span className="block text-[11px] font-medium text-muted-foreground">
            {item.count} offre{item.count > 1 ? "s" : ""}
            {item.nouveaux > 0 && (
              <span className="ml-1 font-semibold text-orange-600">
                · +{item.nouveaux}
              </span>
            )}
          </span>
        </span>
      </Link>
    </motion.div>
  )
}

/* Tuile "Tout voir" en pointillés */
const AllTile = ({ to, icon: Icon, label, count, unit }) => (
  <motion.div variants={itemVariants}>
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-lg border border-dashed border-outline-variant/70 p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-orange hover:bg-orange-50/70"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-orange/10 text-brand-orange transition-colors duration-200 group-hover:bg-brand-orange group-hover:text-white">
        <Icon className="size-5" strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold leading-tight text-on-surface">{label}</span>
        <span className="block text-[11px] font-medium text-muted-foreground">
          {count} {unit}
        </span>
      </span>
      <ArrowUpRight className="ml-auto size-3.5 shrink-0 -translate-x-1 text-brand-orange opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
    </Link>
  </motion.div>
)

/* Tuile conseil — article du top 8, avec badge de rang */
const ConseilTile = ({ a, rank }) => {
  const hue = HUES[a.catHue] ?? HUES.sky
  const Icon = BookOpen // ICON_MAP[a.cat] : Ecrire une fonction
  return (
    <motion.div variants={itemVariants}>
      <Link
        to={`/conseils/${a.slug}`}
        className="group flex items-start gap-3 rounded-lg border border-transparent p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-outline-variant/50 hover:bg-surface-container-low/60 hover:shadow-soft"
      >
        <span className={cn(
          "relative flex size-10 shrink-0 items-center justify-center rounded-md transition-colors duration-200",
          hue.tile,
          `group-hover:${hue.solid} group-hover:text-white`
        )}>
          <Icon className="size-5" strokeWidth={2} />
          <span className="absolute -left-1.5 -top-1.5 grid size-4.5 place-items-center rounded-full bg-brand-navy font-heading text-[9px] font-black text-white ring-2 ring-white">
            {rank}
          </span>
        </span>
        <span className="min-w-0">
          <span className="block truncate-2 text-[13px] font-semibold leading-tight text-on-surface transition-colors duration-200 group-hover:text-brand-orange">
            {a.titre}
          </span>
          <span className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <span className={cn("size-1.5 shrink-0 rounded-full", hue.dot)} />
            <span className="truncate">{a.catLabel}</span>
            <span aria-hidden>·</span>
            <Clock className="size-3 shrink-0" />
            {a.lecture} min
          </span>
        </span>
      </Link>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Header                                                             */
/* ------------------------------------------------------------------ */

const Header = () => {
  const [openMenu, setOpenMenu] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const closeTimer = useRef(null)
  const headerRef = useRef(null)
  const location = useLocation()

  /* ═══ Données réelles depuis le backend (cache TanStack partagé) ═══ */
  const {
    filieres,
    topArticles,
    sourcesList,
    totalActives,
    nouveauxCeMatin,
  } = useNavigationData()

  const topConseil = topArticles[0]
  const totalArticles = topArticles.length
  const hasFreshData = totalActives > 0

  const openMega = (name) => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    setOpenMenu(name)
  }

  const scheduleClose = () => {
    closeTimer.current = window.setTimeout(() => setOpenMenu(null), 150)
  }

  /* Scroll : compacte le header + replie le bandeau d'état */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  /* Ferme tout au changement de route */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenMenu(null)
    setMobileOpen(false)
  }, [location.pathname])

  /* Clic hors du header → ferme le menu mobile (le header reste exclu,
   seul le bouton X le referme de l'intérieur) */
  useEffect(() => {
    if (!mobileOpen) return
    const handler = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target)) setMobileOpen(false)
    }
    document.addEventListener("mousedown", handler)
    document.addEventListener("touchstart", handler)
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("touchstart", handler)
    }
  }, [mobileOpen])

  /* Touche Échap */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpenMenu(null)
        setMobileOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      if (closeTimer.current) window.clearTimeout(closeTimer.current)
    }
  }, [])

  const dateFr = useMemo(() => {
    const d = new Date().toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long",
    })
    return d.charAt(0).toUpperCase() + d.slice(1)
  }, [])

  /* Déclencheur de mega-menu desktop (Offres, Conseils) */
  const renderMegaTrigger = (name, to, label) => (
    <Link
      key={name}
      to={to}
      onMouseEnter={() => openMega(name)}
      onMouseLeave={scheduleClose}
      aria-expanded={openMenu === name}
      className={cn(
        "flex items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors duration-200",
        openMenu === name
          ? "bg-surface-container text-brand-navy"
          : "text-on-surface-variant hover:bg-surface-container-low hover:text-brand-navy"
      )}
    >
      {label}
      <ChevronDown
        className={cn(
          "size-3.5 transition-transform duration-300",
          openMenu === name ? "rotate-180 text-brand-orange" : "text-muted-foreground"
        )}
      />
    </Link>
  )

  return (
    <header ref={headerRef} className="sticky top-0 z-50 w-full">
      {/* ── Bandeau d'état — données RÉELLES ─────────────────────── */}
      <AnimatePresence initial={false}>
        {!scrolled && (
          <motion.div
            key="status-bar"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden bg-brand-navy text-white"
          >
            <div className="flex items-center justify-between gap-4 px-4 py-1.5 text-[11px] font-medium md:px-8 lg:px-12">
              <p className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                </span>
                <span className="text-white/90">
                  {hasFreshData ? (
                    <>
                      Collecte terminée —{" "}
                      <strong className="font-semibold text-white">
                        {nouveauxCeMatin} nouvelle{nouveauxCeMatin > 1 ? "s" : ""} offre{nouveauxCeMatin > 1 ? "s" : ""}
                      </strong>{" "}
                      à 6h02
                    </>
                  ) : (
                    <>Collecte du jour en cours…</>
                  )}
                </span>
              </p>
              <p className="hidden items-center gap-2 text-white/60 md:flex">
                {dateFr}
                <span className="text-white/30">·</span>
                <Clock className="size-3" />
                Prochain envoi à 8h00
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Barre principale ───────────────────────────────────────── */}
      <div
        className={cn(
          "relative border-b border-outline-variant/30 bg-white/85 backdrop-blur-md transition-shadow duration-300",
          scrolled && "shadow-[0_8px_24px_-8px_rgba(15,45,77,0.12)]"
        )}
      >
        {/* Voile qui assombrit la page quand un mega-menu est ouvert */}
        <AnimatePresence>
          {openMenu && (
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-brand-navy/25 backdrop-blur-[2px]"
              onClick={() => setOpenMenu(null)}
            />
          )}
        </AnimatePresence>

        <div className="relative z-50">
          <div
            className={cn(
              "flex items-center justify-between gap-4 px-4 transition-all duration-300 md:px-8 lg:px-12",
              scrolled ? "py-3" : "py-4"
            )}
          >
            <Logo />

            {/* Navigation desktop */}
            <nav className="hidden items-center gap-1 lg:flex">
              {NAV_LINKS.map((l) => (
                <NavItem key={l.to} {...l} />
              ))}

              {renderMegaTrigger("offres", "/offres", "Offres")}
              {renderMegaTrigger("conseils", "/conseils", "Conseils")}

              {NAV_LINKS_AFTER.map((l) => (
                <NavItem key={l.to} {...l} />
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Link
                to="/inscription"
                className="group inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:brightness-110 hover:shadow-md active:scale-[0.98]"
              >
                <Bell className="size-4 transition-transform duration-300 group-hover:rotate-12" />
                <span className="hidden sm:inline">Créer une alerte</span>
                <span className="sm:hidden">Alerte</span>
              </Link>
              <button
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Ouvrir le menu"
                className="inline-flex size-10 items-center justify-center rounded-md text-brand-navy transition-colors hover:bg-surface-container lg:hidden"
              >
                {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            </div>
          </div>

          {/* ── Mega-menus desktop — pleine largeur ──────────────────── */}
          <AnimatePresence>
            {openMenu === "offres" && (
              <MegaPanel key="mega-offres" onEnter={() => openMega("offres")} onLeave={scheduleClose}>
                <div className="grid gap-8 px-5 py-7 md:px-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-12">
                  <div>
                    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-heading text-sm font-bold uppercase tracking-wider text-brand-navy">
                        Explorer par filière métier
                      </p>
                      <p className="text-xs font-medium text-muted-foreground">
                        {totalActives} offre{totalActives > 1 ? "s" : ""} active{totalActives > 1 ? "s" : ""} · mises à jour chaque matin à 6h00
                      </p>
                    </div>
                    <motion.div
                      variants={listVariants}
                      initial="hidden"
                      animate="visible"
                      className="grid grid-cols-2 gap-1.5 md:grid-cols-3 xl:grid-cols-4"
                    >
                      {filieres.map((f) => <MenuTile key={f.code} item={f} />)}
                      <AllTile
                        to="/offres"
                        icon={LayoutGrid}
                        label="Toutes les offres"
                        count={totalActives}
                        unit="offres"
                      />
                    </motion.div>
                  </div>
                  {/* Carte "collecte du jour" — données réelles */}
                  <aside className="relative hidden flex-col overflow-hidden rounded-xl bg-brand-navy p-6 text-white lg:flex">
                    <div className="pointer-events-none absolute inset-0 bg-pattern opacity-30" aria-hidden />
                    <div className="relative flex flex-1 flex-col">
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/90">
                        <Zap className="size-3 text-brand-orange" />
                        Collecte du jour
                      </span>
                      <p className="mt-5 font-heading text-5xl font-extrabold leading-none">
                        {nouveauxCeMatin}
                      </p>
                      <p className="mt-1.5 text-sm text-white/70">
                        nouvelle{nouveauxCeMatin > 1 ? "s" : ""} offre{nouveauxCeMatin > 1 ? "s" : ""}
                        collectée{nouveauxCeMatin > 1 ? "s" : ""} ce matin sur{" "}
                        {sourcesList.length > 0
                          ? `${sourcesList.length} source${sourcesList.length > 1 ? "s" : ""}`
                          : "nos sources"}
                      </p>
                      <ul className="mb-6 mt-5 space-y-2.5 text-[13px] text-white/80">
                        <li className="flex items-start gap-2.5">
                          <Radar className="mt-0.5 size-4 shrink-0 text-brand-orange" />
                          {sourcesList.length > 0 ? (
                            <span>
                              {sourcesList.map((s) => s.name).join(", ")} scannées
                            </span>
                          ) : (
                            <span>Nos sources partenaires scannées</span>
                          )}
                        </li>
                        <li className="flex items-start gap-2.5">
                          <Clock className="mt-0.5 size-4 shrink-0 text-brand-orange" />
                          Récapitulatif envoyé chaque matin à 8h00
                        </li>
                        <li className="flex items-start gap-2.5">
                          <BadgeCheck className="mt-0.5 size-4 shrink-0 text-brand-orange" />
                          Dédoublonnage automatique : zéro doublon envoyé
                        </li>
                      </ul>
                      <Link
                        to="/offres"
                        className="group mt-auto inline-flex w-fit items-center gap-2 rounded-md bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:brightness-110"
                      >
                        Voir toutes les offres
                        <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                      </Link>
                    </div>
                  </aside>
                </div>
                {/* Bandeau bas — inchangé */}
                {/* ... */}
              </MegaPanel>
            )}

            {/* ── MEGA-MENU CONSEILS — alimenté par l'API ─────────── */}
            {openMenu === "conseils" && (
              <MegaPanel key="mega-conseils" onEnter={() => openMega("conseils")} onLeave={scheduleClose}>
                <div className="grid gap-8 px-5 py-7 md:px-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-12">
                  <div>
                    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-heading text-sm font-bold uppercase tracking-wider text-brand-navy">
                        Les conseils les plus lus
                      </p>
                      <p className="text-xs font-medium text-muted-foreground">
                        Top {topArticles.length} · classés par nombre de lectures
                      </p>
                    </div>
                    <motion.div
                      variants={listVariants}
                      initial="hidden"
                      animate="visible"
                      className="grid grid-cols-2 gap-1.5 md:grid-cols-2"
                    >
                      {topArticles.map((a, i) => (
                        <ConseilTile key={a.slug} a={a} rank={i + 1} />
                      ))}
                      <AllTile
                        to="/conseils"
                        icon={BookOpen}
                        label="Tous les conseils"
                        count={totalArticles}
                        unit="articles"
                      />
                    </motion.div>
                  </div>
                  {/* Carte "conseil n°1" — issue de l'API */}
                  <aside className="relative hidden flex-col overflow-hidden rounded-xl bg-brand-navy p-6 text-white lg:flex">
                    <div className="pointer-events-none absolute inset-0 bg-pattern opacity-30" aria-hidden />
                    <div className="relative flex flex-1 flex-col">
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/90">
                        <Sparkles className="size-3 text-brand-orange" />
                        Conseil n°1 cette semaine
                      </span>
                      {topConseil ? (
                        <>
                          <p className="mt-5 font-heading text-[21px] font-bold leading-snug">
                            {topConseil.titre}
                          </p>
                          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-white/70">
                            {topConseil.extrait}
                          </p>
                          <p className="mt-4 flex items-center gap-2 text-xs font-medium text-white/60">
                            <Clock className="size-3.5 shrink-0 text-brand-orange" />
                            {topConseil.lecture} min de lecture · {topConseil.catLabel}
                          </p>
                          <div className="mt-5 flex items-center gap-5 border-t border-white/10 pt-4 text-[11px] text-white/60">
                            <span>
                              <strong className="font-heading text-sm font-bold text-white">
                                {totalArticles}
                              </strong>{" "}
                              conseils publiés
                            </span>
                            <span>
                              <strong className="font-heading text-sm font-bold text-white">
                                {fmtVus(topConseil.vus)}
                              </strong>{" "}
                              lectures
                            </span>
                          </div>
                          <Link
                            to={`/conseils/${topConseil.slug}`}
                            className="group mt-auto inline-flex w-fit items-center gap-2 rounded-md bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:brightness-110"
                          >
                            Lire l'article
                            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                          </Link>
                        </>
                      ) : (
                        <p className="mt-5 text-sm text-white/60">
                          Les conseils les plus lus sont en cours de chargement.
                        </p>
                      )}
                    </div>
                  </aside>
                </div>
                {/* Bandeau bas */}
                <div className="flex flex-col items-start justify-between gap-3 border-t border-outline-variant/40 bg-surface-container-low/60 px-5 py-4 sm:flex-row sm:items-center md:px-8 lg:px-12">
                  <p className="flex items-center gap-2 text-[13px] text-on-surface-variant">
                    <BookOpen className="size-4 shrink-0 text-brand-orange" />
                    Un conseil pratique glissé dans chaque récapitulatif quotidien, envoyé à 8h00.
                  </p>
                  <Link
                    to="/inscription"
                    className="group inline-flex items-center gap-1.5 text-[13px] font-bold text-brand-navy transition-colors hover:text-brand-orange"
                  >
                    Créer mon alerte gratuite
                    <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </div>
              </MegaPanel>
            )}
          </AnimatePresence>
        </div>

        {/* ── Menu mobile (mega-menus en accordéons) ─────────────────── */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              key="mobile-menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-b border-outline-variant/30 bg-white lg:hidden"
            >
              <div className="max-h-[calc(100vh-4.5rem)] overflow-y-auto px-4 py-5 md:px-8">
                {/* Liens principaux */}
                <nav className="flex flex-col gap-1">
                  {NAV_LINKS.map((l) => (
                    <Link
                      key={l.to}
                      to={l.to}
                      className="rounded-md px-3 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-brand-navy"
                    >
                      {l.label}
                    </Link>
                  ))}
                </nav>

                {/* Offres & Conseils en accordéons */}
                <div className="mt-3">
                  <Accordion type="single" collapsible className="w-full border-none">
                    {/* ---- Accordéon Offres ---- */}
                    <AccordionItem value="offres" className="border-none mb-1">
                      <AccordionTrigger className="rounded-md px-3 py-2.5 data-[state=open]:bg-surface-container-low/80 hover:bg-surface-container-low/80 hover:no-underline">
                        <span className="text-sm font-semibold text-on-surface-variant">Offres d'emploi</span>
                      </AccordionTrigger>

                      <AccordionContent className="px-2 pb-3 pt-1 [&_a]:no-underline">
                        <Link
                          to="/offres"
                          className="mb-2 flex items-center justify-between rounded-md bg-brand-navy px-3 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-orange hover:text-white!"
                        >
                          Voir toutes les offres
                          <ArrowRight className="size-4" />
                        </Link>
                        <p className="mb-1.5 mt-2 px-1 font-heading text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Filières métiers
                        </p>
                        {/* APRÈS — données réelles, même source que le mega-menu desktop */}
                        <motion.div
                          variants={listVariants}
                          initial="hidden"
                          animate="visible"
                          className="grid grid-cols-2 gap-1.5"
                        >
                          {filieres.length > 0 ? (
                            <>
                              {filieres.map((f) => <MenuTile key={f.code} item={f} />)}
                            </>
                          ) : (
                            <p className="col-span-2 px-3 py-4 text-xs text-muted-foreground">
                              Chargement des filières…
                            </p>
                          )}
                        </motion.div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>

                {/* Liens secondaires */}
                <nav className="mt-3 flex flex-col gap-1">
                  <Link
                    to="/conseils"
                    className="rounded-md px-3 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-brand-navy"
                  >
                    Conseils & Analyses
                  </Link>

                  {NAV_LINKS_AFTER.map((l) => (
                    <Link
                      key={l.to}
                      to={l.to}
                      className="rounded-md px-3 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-brand-navy"
                    >
                      {l.label}
                    </Link>
                  ))}
                </nav>

                {/* Actions */}
                <div className="mt-4 flex flex-col md:flex-row gap-2 border-t border-outline-variant/30 pt-4">
                  <Link
                    to="/inscription"
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-orange px-4 py-2.5 text-sm font-semibold  w-full text-white transition-all hover:brightness-110"
                  >
                    <Bell className="size-4" />
                    Créer une alerte
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}

export default Header