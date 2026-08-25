import { useState } from "react"
import { Play, ArrowRight, CheckCircle2, Clock, AlertTriangle, ShieldAlert } from "lucide-react"
import SectionHeading from "@/components/shared/SectionHeading"
import { AdminStatsGrid } from "../components/AdminStatsGrid"
import { StatusBadge } from "../components/AdminBadgeRole"
import { AdminConfirmDialog } from "../components/AdminConfirmDialog"
import { useToast } from "../components/AdminToast"
import { Button } from "@/components/ui/button"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import {
  useAdminLogs,
  useAdminOffers,
  useAdminScrapers,
  useAdminSubscribers,
  useAdminMutations,
} from "@/tools/admin.tools"

export const DashboardSection = ({ onNavigateSection }) => {
  const { hasPermission } = useAdminAuth()
  const toast = useToast()
  const { triggerScrapeMutation } = useAdminMutations()

  const [confirmScrapeOpen, setConfirmScrapeOpen] = useState(false)

  const { data: offers = [] } = useAdminOffers()
  const { data: subscribers = [] } = useAdminSubscribers()
  const { data: scrapers = [] } = useAdminScrapers()
  const { data: logs = [] } = useAdminLogs({ limit: 5 })

  const errorsCount = logs.filter((l) => l.niveau === "error").length
  const activeScrapersCount = `${scrapers.filter((s) => s.status === "active").length}/${scrapers.length || 4}`

  const handleLaunchScrape = async () => {
    try {
      await triggerScrapeMutation.mutateAsync({ notes: "Déclenchement rapide depuis le tableau de bord" })
      toast.success("Scraping déclenché", "La collecte manuelle de toutes les sources a été initiée.")
    } catch {
      toast.error("Erreur", "Impossible de déclencher le scraping.")
    } finally {
      setConfirmScrapeOpen(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <SectionHeading
          eyebrow="Supervision Globale"
          title="Tableau de bord de contrôle."
          sub="Suivi en temps réel des offres collectées, des scrapers de données et des flux d'abonnés."
        />

        {hasPermission("trigger_scrape") && (
          <Button
            type="button"
            onClick={() => setConfirmScrapeOpen(true)}
            disabled={triggerScrapeMutation.isPending}
            className="bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs shrink-0 self-start sm:self-auto"
          >
            <Play className="size-3.5 mr-1.5 fill-current" />
            {triggerScrapeMutation.isPending ? "Collecte en cours..." : "Lancer le scraping"}
          </Button>
        )}
      </div>

      {/* KPI Stats Grid */}
      <AdminStatsGrid
        offersCount={offers.length}
        subscribersCount={subscribers.length}
        scrapersActive={activeScrapersCount}
        errorsCount={errorsCount}
        onNavigateSection={onNavigateSection}
      />

      {/* Grid: Scrapers snapshot & Recent Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Scrapers Status */}
        <div className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest dark:bg-zinc-900 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/15">
              <div>
                <h3 className="text-base font-bold font-heading text-brand-navy dark:text-zinc-100">
                  État des 4 sources de scraping
                </h3>
                <p className="text-xs text-on-surface-variant dark:text-zinc-400">
                  Planification quotidienne & derniers passages
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateSection("scrapers")}
                className="text-xs font-semibold text-brand-navy dark:text-sky-400 hover:underline flex items-center gap-1"
              >
                Gérer <ArrowRight className="size-3" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {scrapers.slice(0, 4).map((src) => (
                <div
                  key={src.code || src.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-outline-variant/15 bg-surface-container-low/40 dark:bg-zinc-800/30 hover:bg-surface-container-low transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="size-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                    <div>
                      <h4 className="text-xs font-bold text-on-surface dark:text-zinc-200">
                        {src.name}
                      </h4>
                      <p className="text-[11px] text-on-surface-variant/80 dark:text-zinc-400">
                        {src.schedule_label || "Chaque matin"} • {src.offers_found_last || 0} offres trouvées
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={src.last_status || "success"} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Recent activity / Audit Logs */}
        <div className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest dark:bg-zinc-900 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/15">
              <div>
                <h3 className="text-base font-bold font-heading text-brand-navy dark:text-zinc-100">
                  Dernières activités système & audit
                </h3>
                <p className="text-xs text-on-surface-variant dark:text-zinc-400">
                  Actions récentes des administrateurs et des robots
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateSection("logs")}
                className="text-xs font-semibold text-brand-navy dark:text-sky-400 hover:underline flex items-center gap-1"
              >
                Tous les logs <ArrowRight className="size-3" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {logs.slice(0, 4).map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3.5 rounded-2xl border border-outline-variant/15 bg-surface-container-low/40 dark:bg-zinc-800/30"
                >
                  <div className="mt-0.5 shrink-0">
                    {log.niveau === "error" ? (
                      <AlertTriangle className="size-4 text-rose-500" />
                    ) : log.niveau === "warning" ? (
                      <Clock className="size-4 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-on-surface dark:text-zinc-200 truncate">
                        {log.admin_name || log.module}
                      </span>
                      <span className="text-[10px] text-on-surface-variant/70 shrink-0 font-mono">
                        {new Date(log.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant dark:text-zinc-400 mt-0.5 line-clamp-2">
                      {log.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation modal before running manual scrape */}
      <AdminConfirmDialog
        isOpen={confirmScrapeOpen}
        onClose={() => setConfirmScrapeOpen(false)}
        onConfirm={handleLaunchScrape}
        title="Lancer une collecte manuelle ?"
        message="Cette action va interroger en parallèle Novojob, LinkedIn, EmploiDakar et GoAfrica, normaliser les données et filtrer les doublons."
        confirmText="Démarrer la collecte"
        variant="primary"
        loading={triggerScrapeMutation.isPending}
      />
    </div>
  )
}
