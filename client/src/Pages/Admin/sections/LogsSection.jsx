import { useState, useMemo } from "react"
import { Eye, Filter, RefreshCw, AlertCircle, Info, AlertTriangle } from "lucide-react"
import { AdminTable } from "../components/AdminTable"
import { AdminModal } from "../components/AdminModal"
import { StatusBadge } from "../components/AdminBadgeRole"
import { Button } from "@/components/ui/button"
import { useAdminLogs } from "@/tools/admin.tools"

export const LogsSection = () => {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedLevel, setSelectedLevel] = useState("all")
  const [selectedModule, setSelectedModule] = useState("all")
  const [selectedLog, setSelectedLog] = useState(null)

  const { data: logs = [], isLoading, refetch } = useAdminLogs()

  // Filtrage local
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchSearch =
        !searchTerm ||
        log.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.admin_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.target_table?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchLevel = selectedLevel === "all" || log.niveau === selectedLevel
      const matchModule = selectedModule === "all" || log.module === selectedModule

      return matchSearch && matchLevel && matchModule
    })
  }, [logs, searchTerm, selectedLevel, selectedModule])

  const columns = [
    {
      header: "Horodatage",
      key: "created_at",
      width: "160px",
      render: (item) => (
        <span className="text-on-surface-variant/90 dark:text-zinc-400 font-mono text-[11px]">
          {new Date(item.created_at).toLocaleString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      ),
    },
    {
      header: "Niveau",
      key: "niveau",
      width: "100px",
      render: (item) => <StatusBadge status={item.niveau} label={item.niveau?.toUpperCase()} />,
    },
    {
      header: "Module / Source",
      key: "module",
      width: "140px",
      render: (item) => (
        <span className="rounded-md bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-on-surface dark:bg-zinc-800">
          {item.module || "Système"}
        </span>
      ),
    },
    {
      header: "Auteur / Origine",
      key: "admin_name",
      width: "160px",
      render: (item) => (
        <span className="text-xs font-medium text-on-surface dark:text-zinc-300">
          {item.admin_name || "Automate Système"}
        </span>
      ),
    },
    {
      header: "Description de l'événement",
      key: "message",
      render: (item) => (
        <div className="max-w-md truncate text-xs text-on-surface dark:text-zinc-200" title={item.message}>
          {item.message}
        </div>
      ),
    },
    {
      header: "Détails",
      key: "actions",
      width: "80px",
      className: "text-right",
      render: (item) => (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => setSelectedLog(item)}
          className="hover:bg-surface-container-high"
        >
          <Eye className="size-3.5 mr-1" />
          Voir
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-on-surface dark:text-zinc-100">
            Journaux techniques & Audit de sécurité
          </h2>
          <p className="text-xs text-on-surface-variant dark:text-zinc-400">
            Historique complet des collectes, actions des administrateurs et anomalies d'ingestion.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="self-start sm:self-auto gap-1.5"
        >
          <RefreshCw className="size-3.5" />
          Actualiser
        </Button>
      </div>

      {/* Filter toolbar & Table */}
      <AdminTable
        columns={columns}
        data={filteredLogs}
        loading={isLoading}
        searchPlaceholder="Rechercher dans les messages, auteurs, tables..."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        pageSize={12}
        filterComponent={
          <div className="flex items-center gap-2">
            {/* Level filter */}
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="h-8 rounded-md border border-outline-variant/30 bg-surface-container-lowest dark:bg-zinc-900 px-2.5 text-xs text-on-surface dark:text-zinc-200 outline-none"
            >
              <option value="all">Tous les niveaux</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>

            {/* Module filter */}
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="h-8 rounded-md border border-outline-variant/30 bg-surface-container-lowest dark:bg-zinc-900 px-2.5 text-xs text-on-surface dark:text-zinc-200 outline-none"
            >
              <option value="all">Tous les modules</option>
              <option value="scraping">Scraping</option>
              <option value="envoi">Envois d'alertes</option>
              <option value="admin">Admin / Rôles</option>
              <option value="offres">Offres</option>
              <option value="sources">Sources</option>
              <option value="filieres">Filières</option>
            </select>
          </div>
        }
      />

      {/* Log Detail Inspector Modal */}
      <AdminModal
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title="Détail du journal d'audit"
        subtitle={`Événement ID: ${selectedLog?.id || ""}`}
        size="lg"
        footer={
          <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
            Fermer
          </Button>
        }
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl border border-outline-variant/20 bg-surface-container-low/50 dark:bg-zinc-800/40 text-xs">
              <div>
                <span className="text-on-surface-variant/80 block text-[10px] uppercase font-bold">Niveau</span>
                <div className="mt-1"><StatusBadge status={selectedLog.niveau} label={selectedLog.niveau?.toUpperCase()} /></div>
              </div>
              <div>
                <span className="text-on-surface-variant/80 block text-[10px] uppercase font-bold">Module</span>
                <span className="font-semibold text-on-surface dark:text-zinc-200 mt-1 block">{selectedLog.module}</span>
              </div>
              <div>
                <span className="text-on-surface-variant/80 block text-[10px] uppercase font-bold">Auteur</span>
                <span className="font-semibold text-on-surface dark:text-zinc-200 mt-1 block">{selectedLog.admin_name || "Automate"}</span>
              </div>
              <div>
                <span className="text-on-surface-variant/80 block text-[10px] uppercase font-bold">Date & Heure</span>
                <span className="font-mono text-[11px] text-on-surface dark:text-zinc-200 mt-1 block">
                  {new Date(selectedLog.created_at).toLocaleString("fr-FR")}
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-on-surface dark:text-zinc-200 mb-1">Message :</h4>
              <p className="p-3 rounded-xl border border-outline-variant/20 bg-surface-container-lowest dark:bg-zinc-900 text-xs text-on-surface leading-relaxed">
                {selectedLog.message}
              </p>
            </div>

            {selectedLog.details && (
              <div>
                <h4 className="text-xs font-bold text-on-surface dark:text-zinc-200 mb-1">
                  Données techniques (Payload JSON) :
                </h4>
                <pre className="p-3.5 rounded-xl border border-outline-variant/20 bg-zinc-950 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-56">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </AdminModal>
    </div>
  )
}
