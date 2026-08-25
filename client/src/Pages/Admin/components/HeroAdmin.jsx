import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ChevronRight, ShieldCheck, Play, Bot, RefreshCw, LogOut } from "lucide-react"
import { CountUp } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import { AdminBadgeRole } from "./AdminBadgeRole"
import {
  useAdminOffers,
  useAdminScrapers,
  useAdminSubscribers,
  useAdminLogs,
  useAdminMutations,
} from "@/tools/admin.tools"

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
}

export const HeroAdmin = ({ onTriggerScrapeClick }) => {
  const { user, role, logout, hasPermission } = useAdminAuth()

  const { data: offers = [] } = useAdminOffers()
  const { data: subscribers = [] } = useAdminSubscribers()
  const { data: scrapers = [] } = useAdminScrapers()
  const { data: logs = [] } = useAdminLogs()

  const activeScrapers = scrapers.filter((s) => s.status === "active").length

  const COMPTEURS = [
    { valeur: offers.length, label: "offres en base", dot: "bg-brand-orange" },
    { valeur: subscribers.length, label: "abonnés actifs", dot: "bg-emerald-500" },
    { valeur: scrapers.length, label: "sources scannées", dot: "bg-brand-navy" },
    { valeur: logs.length, label: "événements loggés", dot: "bg-amber-500" },
  ]

  return (
    <section className="relative overflow-hidden hero-gradient border-b border-outline-variant/20">
      <div className="absolute inset-0 bg-pattern opacity-40 pointer-events-none" aria-hidden />
      <div
        className="absolute -top-32 right-[-10%] size-140 rounded-full bg-brand-orange/8 blur-3xl pointer-events-none"
        aria-hidden
      />
      <div
        className="absolute -bottom-40 -left-40 size-120 rounded-full bg-brand-navy/5 blur-3xl pointer-events-none"
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-10 lg:px-12 py-10 sm:py-14">
        {/* Fil d'Ariane & User Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <motion.nav
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
            aria-label="Fil d'Ariane"
          >
            <Link to="/" className="transition-colors hover:text-brand-navy">
              Accueil
            </Link>
            <ChevronRight className="size-3" aria-hidden />
            <span className="font-semibold text-brand-navy" aria-current="page">
              Espace Administration
            </span>
          </motion.nav>

          {/* User profile & quick logout */}
          {user && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2.5 rounded-full border border-outline-variant/30 bg-surface-container-lowest/80 dark:bg-zinc-900/80 px-3 py-1.5 backdrop-blur-md shadow-xs"
            >
              <div className="grid size-6 place-items-center rounded-full bg-brand-navy text-white text-[11px] font-bold">
                {user.full_name?.charAt(0)?.toUpperCase() || "A"}
              </div>
              <span className="text-xs font-semibold text-on-surface dark:text-zinc-200">
                {user.full_name}
              </span>
              <AdminBadgeRole role={role} />
              <button
                type="button"
                onClick={logout}
                className="ml-1 text-on-surface-variant hover:text-rose-600 transition-colors p-1"
                title="Se déconnecter"
              >
                <LogOut className="size-3.5" />
              </button>
            </motion.div>
          )}
        </div>

        {/* 2 Colonnes Hero */}
        <div className="mt-8 grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          {/* Gauche : Textes & CTA */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-start gap-4"
          >
            <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-1.5 text-[11px] font-bold text-emerald-700">
                <span className="relative flex size-1.5" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-70" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                </span>
                Système opérationnel · {activeScrapers}/{scrapers.length || 4} scrapers actifs
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-brand-navy leading-tight"
            >
              Console de pilotage & modération.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="text-sm sm:text-base leading-relaxed text-on-surface-variant max-w-xl"
            >
              Gérez en toute sécurité les robots de scraping matinal, modérez les offres d'emploi,
              supervisez les abonnements quotidiens et configurez les droits d'accès de votre équipe.
            </motion.p>

            {/* Quick Action Button */}
            {hasPermission("trigger_scrape") && (
              <motion.div variants={fadeUp} className="pt-2 flex items-center gap-3">
                <Button
                  type="button"
                  onClick={onTriggerScrapeClick}
                  className="bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs gap-2"
                >
                  <Play className="size-3.5 fill-current" />
                  Déclencher un scraping manuel
                </Button>
              </motion.div>
            )}
          </motion.div>

          {/* Droite : Cartes Métriques Héro */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="grid grid-cols-2 gap-3.5 p-4 rounded-3xl border border-outline-variant/30 bg-surface-container-lowest/80 dark:bg-zinc-900/80 backdrop-blur-md shadow-xl"
          >
            {COMPTEURS.map((item, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between p-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low/50 dark:bg-zinc-800/40 hover:bg-surface-container-low transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${item.dot}`} />
                  <span className="text-[11px] font-medium text-on-surface-variant capitalize">
                    {item.label}
                  </span>
                </div>
                <div className="mt-3 text-2xl sm:text-3xl font-extrabold font-heading text-brand-navy dark:text-zinc-100">
                  <CountUp value={item.valeur} />
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
