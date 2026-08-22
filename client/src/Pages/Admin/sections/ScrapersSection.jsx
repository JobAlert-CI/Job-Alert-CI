import { useState } from "react"
import { Play, Settings, RefreshCw, Clock, CheckCircle2, AlertTriangle, Layers, Calendar } from "lucide-react"
import { AdminTable } from "../components/AdminTable"
import { AdminModal } from "../components/AdminModal"
import { AdminConfirmDialog } from "../components/AdminConfirmDialog"
import { StatusBadge } from "../components/AdminBadgeRole"
import { useToast } from "../components/AdminToast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import { useAdminScrapers, useAdminScrapeRuns, useAdminMutations } from "@/tools/admin.tools"

export const ScrapersSection = () => {
  const { hasPermission } = useAdminAuth()
  const toast = useToast()
  const { triggerScrapeMutation, updateScheduleMutation } = useAdminMutations()

  const { data: scrapers = [], isLoading: loadingScrapers, refetch: refetchScrapers } = useAdminScrapers()
  const { data: runs = [], isLoading: loadingRuns, refetch: refetchRuns } = useAdminScrapeRuns()

  const [activeTab, setActiveTab] = useState("sources") // 'sources' | 'runs'
  const [selectedSourceForScrape, setSelectedSourceForScrape] = useState(null)
  const [selectedSourceForConfig, setSelectedSourceForConfig] = useState(null)

  // Configuration form state
  const [cronValue, setCronValue] = useState("")
  const [cronLabel, setCronLabel] = useState("")

  const handleOpenConfig = (source) => {
    setSelectedSourceForConfig(source)
    setCronValue(source.schedule_cron || "0 6 * * *")
    setCronLabel(source.schedule_label || "Chaque matin à 06:00")
  }

  const handleSaveConfig = async (e) => {
    e.preventDefault()
    if (!selectedSourceForConfig) return
    try {
      await updateScheduleMutation.mutateAsync({
        sourceCode: selectedSourceForConfig.code,
        data: {
          cron: cronValue,
          label: cronLabel,
        },
      })
      toast.success("Fréquence mise à jour", `La planification de ${selectedSourceForConfig.name} a été enregistrée.`)
      setSelectedSourceForConfig(null)
    } catch {
      toast.error("Erreur", "Impossible de modifier la planification.")
    }
  }

  const handleTriggerScrape = async () => {
    const isSingle = selectedSourceForScrape && selectedSourceForScrape !== "ALL"
    const sourceCode = isSingle ? selectedSourceForScrape.code : null
    const sourceName = isSingle ? selectedSourceForScrape.name : "toutes les sources"

    try {
      await triggerScrapeMutation.mutateAsync({
        source_code: sourceCode,
        notes: `Déclenchement manuel (${sourceName})`,
      })
      toast.success(
        "Scraping initié",
        `Le collecteur pour ${sourceName} est en cours d'exécution.`
      )
    } catch {
      toast.error("Erreur", "Le lancement du scrape a échoué.")
    } finally {
      setSelectedSourceForScrape(null)
    }
  }

  // Scrape Runs Columns
  const runColumns = [
    {
      header: "Date de Collecte",
      key: "run_date",
      width: "120px",
      render: (item) => (
        <span className="font-semibold text-on-surface dark:text-zinc-200">
          {item.run_date}
        </span>
      ),
    },
    {
      header: "Statut",
      key: "status",
      width: "110px",
      render: (item) => <StatusBadge status={item.status} label={item.status?.toUpperCase()} />,
    },
    {
      header: "Déclenché par",
      key: "triggered_by",
      width: "140px",
      render: (item) => (
        <span className="text-xs text-on-surface-variant dark:text-zinc-400">
          {item.triggered_by}
        </span>
      ),
    },
    {
      header: "Durée",
      key: "duration_ms",
      width: "100px",
      render: (item) => (
        <span className="text-xs font-mono text-on-surface-variant">
          {item.duration_ms ? `${(item.duration_ms / 1000).toFixed(1)}s` : "En cours..."}
        </span>
      ),
    },
    {
      header: "Offres Scrappées / Insérées",
      key: "total_offers_scraped",
      render: (item) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-on-surface dark:text-zinc-200">
            {item.total_offers_scraped || 0} trouvées
          </span>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            (+{item.new_offers_inserted || 0} nouvelles)
          </span>
          {item.duplicates_filtered > 0 && (
            <span className="text-[11px] text-on-surface-variant/70">
              ({item.duplicates_filtered} doublons)
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Notes",
      key: "notes",
      render: (item) => (
        <span className="text-xs text-on-surface-variant truncate block max-w-xs" title={item.notes}>
          {item.notes || "-"}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-on-surface dark:text-zinc-100">
            Gestion & Pilotage des Scripts de Scraping
          </h2>
          <p className="text-xs text-on-surface-variant dark:text-zinc-400">
            Surveillance en temps réel des connecteurs, lancement manuel et programmation des intervalles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission("trigger_scrape") && (
            <Button
              type="button"
              onClick={() => setSelectedSourceForScrape("ALL")}
              disabled={triggerScrapeMutation.isPending}
              className="bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold shadow-xs text-xs"
            >
              <Play className="size-3.5 mr-1.5 fill-current" />
              Lancer toutes les sources
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchScrapers()
              refetchRuns()
            }}
            className="gap-1.5"
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-outline-variant/20">
        <button
          type="button"
          onClick={() => setActiveTab("sources")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "sources"
              ? "border-brand-navy dark:border-sky-400 text-brand-navy dark:text-sky-400"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <Layers className="size-4" />
          Connecteurs & Fréquences ({scrapers.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("runs")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "runs"
              ? "border-brand-navy dark:border-sky-400 text-brand-navy dark:text-sky-400"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <Calendar className="size-4" />
          Historique des Exécutions
        </button>
      </div>

      {/* Tab 1: Connectors Grid */}
      {activeTab === "sources" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scrapers.map((source) => (
            <div
              key={source.code || source.id}
              className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest dark:bg-zinc-900 p-5 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-on-surface dark:text-zinc-100 flex items-center gap-2">
                      {source.name}
                      <StatusBadge status={source.last_status || "success"} />
                    </h3>
                    <p className="mt-1 text-xs text-on-surface-variant dark:text-zinc-400">
                      Code connecteur : <code className="font-mono text-[11px] bg-surface-container px-1.5 py-0.5 rounded">{source.code}</code>
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2.5 text-xs text-on-surface-variant dark:text-zinc-300">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low/50 dark:bg-zinc-800/40 border border-outline-variant/15">
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5 text-on-surface-variant" />
                      Planification :
                    </span>
                    <span className="font-semibold text-on-surface dark:text-zinc-200">
                      {source.schedule_label || "Chaque matin"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-1">
                    <span>Dernier passage :</span>
                    <span className="font-mono text-[11px] text-on-surface dark:text-zinc-300">
                      {source.last_run_at ? new Date(source.last_run_at).toLocaleString("fr-FR") : "Jamais"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-1">
                    <span>Dernière durée :</span>
                    <span className="font-mono text-[11px] text-on-surface dark:text-zinc-300">
                      {source.last_duration_ms ? `${(source.last_duration_ms / 1000).toFixed(1)}s` : "-"}
                    </span>
                  </div>

                  {source.last_error && (
                    <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-[11px]">
                      {source.last_error}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions toolbar */}
              <div className="mt-5 pt-3.5 border-t border-outline-variant/15 flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => handleOpenConfig(source)}
                  disabled={!hasPermission("trigger_scrape")}
                  className="gap-1 text-xs"
                >
                  <Settings className="size-3" />
                  Régler fréquence
                </Button>

                <Button
                  type="button"
                  size="xs"
                  onClick={() => setSelectedSourceForScrape(source)}
                  disabled={!hasPermission("trigger_scrape") || triggerScrapeMutation.isPending}
                  className="bg-brand-navy hover:bg-brand-navy/90 text-white gap-1 text-xs font-semibold"
                >
                  <Play className="size-3 fill-current" />
                  Lancer maintenant
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Runs History Table */}
      {activeTab === "runs" && (
        <AdminTable
          columns={runColumns}
          data={runs}
          loading={loadingRuns}
          searchPlaceholder="Rechercher une exécution..."
          pageSize={10}
        />
      )}

      {/* Modal: Schedule & Frequency configuration */}
      <AdminModal
        isOpen={Boolean(selectedSourceForConfig)}
        onClose={() => setSelectedSourceForConfig(null)}
        title={`Paramétrer la fréquence de scrape : ${selectedSourceForConfig?.name}`}
        subtitle="Ajustez l'heure ou la périodicité de collecte automatique"
        size="md"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setSelectedSourceForConfig(null)}>
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleSaveConfig}
              disabled={updateScheduleMutation.isPending}
              className="bg-brand-navy text-white font-semibold"
            >
              Enregistrer la planification
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-on-surface dark:text-zinc-200 mb-1">
              Libellé d'affichage :
            </label>
            <Input
              type="text"
              value={cronLabel}
              onChange={(e) => setCronLabel(e.target.value)}
              placeholder="Ex: Tous les matins à 06:15"
              className="h-8 text-xs"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-on-surface dark:text-zinc-200 mb-1">
              Expression Cron (Standard 5 champs) :
            </label>
            <Input
              type="text"
              value={cronValue}
              onChange={(e) => setCronValue(e.target.value)}
              placeholder="0 6 * * *"
              className="h-8 text-xs font-mono"
              required
            />
            <p className="mt-1 text-[11px] text-on-surface-variant/80">
              Format: minute heure jour_du_mois mois jour_semaine (Ex: <code>15 6 * * *</code> = 6h15 chaque jour).
            </p>
          </div>

          <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20">
            <h4 className="font-bold text-on-surface mb-1.5">Préréglages rapides :</h4>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "06:00 Matin", cron: "0 6 * * *", desc: "Chaque matin à 06:00" },
                { label: "06:15 Matin", cron: "15 6 * * *", desc: "Chaque matin à 06:15" },
                { label: "06:30 Matin", cron: "30 6 * * *", desc: "Chaque matin à 06:30" },
                { label: "Toutes les 6h", cron: "0 */6 * * *", desc: "Toutes les 6 heures" },
                { label: "Midi & Soir", cron: "0 12,18 * * *", desc: "À 12h00 et 18h00" },
              ].map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setCronValue(preset.cron)
                    setCronLabel(preset.desc)
                  }}
                  className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-2.5 py-1 text-[11px] hover:border-brand-navy transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </form>
      </AdminModal>

      {/* Confirmation Dialog before manual scrape */}
      <AdminConfirmDialog
        isOpen={Boolean(selectedSourceForScrape)}
        onClose={() => setSelectedSourceForScrape(null)}
        onConfirm={handleTriggerScrape}
        title={
          selectedSourceForScrape === "ALL"
            ? "Lancer la collecte de toutes les sources ?"
            : `Lancer le scrape de ${selectedSourceForScrape?.name} ?`
        }
        message="Le collecteur va extraire immédiatement les nouvelles annonces et les intégrer à la base."
        confirmText="Confirmer le lancement"
        variant="primary"
        loading={triggerScrapeMutation.isPending}
      />
    </div>
  )
}
