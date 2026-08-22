import { useState } from "react"
import { Plus, Edit, Trash2, Power, Globe, ExternalLink } from "lucide-react"
import { AdminTable } from "../components/AdminTable"
import { AdminModal } from "../components/AdminModal"
import { AdminConfirmDialog } from "../components/AdminConfirmDialog"
import { StatusBadge } from "../components/AdminBadgeRole"
import { useToast } from "../components/AdminToast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import { useAdminSources, useAdminMutations } from "@/tools/admin.tools"

export const SourcesSection = () => {
  const { hasPermission } = useAdminAuth()
  const toast = useToast()
  const {
    createSourceMutation,
    updateSourceMutation,
    updateSourceStatusMutation,
    deleteSourceMutation,
  } = useAdminMutations()

  const [searchTerm, setSearchTerm] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSource, setEditingSource] = useState(null)
  const [sourceToDelete, setSourceToDelete] = useState(null)

  // Form states
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [priority, setPriority] = useState(1)
  const [scheduleTime, setScheduleTime] = useState("06:00")

  const { data: sources = [], isLoading: loadingSources } = useAdminSources()

  const handleOpenAdd = () => {
    setEditingSource(null)
    setName("")
    setCode("")
    setBaseUrl("https://")
    setPriority(sources.length + 1)
    setScheduleTime("06:00")
    setIsModalOpen(true)
  }

  const handleOpenEdit = (source) => {
    setEditingSource(source)
    setName(source.name || "")
    setCode(source.code || "")
    setBaseUrl(source.base_url || "")
    setPriority(source.priority || 1)
    setScheduleTime(source.schedule_time || "06:00")
    setIsModalOpen(true)
  }

  const handleSaveSource = async (e) => {
    e.preventDefault()
    if (!hasPermission("manage_sources")) {
      toast.error("Action non autorisée", "Vous n'avez pas la permission de gérer les sources.")
      return
    }

    const payload = {
      name,
      code: code.toLowerCase().replace(/\s+/g, "_"),
      base_url: baseUrl,
      priority: Number(priority),
      schedule_time: scheduleTime,
    }

    try {
      if (editingSource) {
        await updateSourceMutation.mutateAsync({ id: editingSource.id, data: payload })
        toast.success("Source mise à jour", `La source ${name} a été modifiée.`)
      } else {
        await createSourceMutation.mutateAsync(payload)
        toast.success("Source ajoutée", `La source ${name} a été créée avec succès.`)
      }
      setIsModalOpen(false)
    } catch {
      toast.error("Erreur", "L'enregistrement de la source a échoué.")
    }
  }

  const handleToggleStatus = async (source) => {
    if (!hasPermission("manage_sources")) return
    const nextStatus = source.status === "active" ? "paused" : "active"
    try {
      await updateSourceStatusMutation.mutateAsync({ id: source.id, status: nextStatus })
      toast.info(
        "Statut modifié",
        `La source ${source.name} est maintenant ${nextStatus === "active" ? "activée" : "en pause"}.`
      )
    } catch {
      toast.error("Erreur", "Impossible de modifier le statut.")
    }
  }

  const handleDeleteSource = async () => {
    if (!sourceToDelete) return
    try {
      await deleteSourceMutation.mutateAsync(sourceToDelete.id)
      toast.success("Source supprimée", `La source ${sourceToDelete.name} a été retirée.`)
    } catch {
      toast.error("Erreur", "La suppression de la source a échoué.")
    } finally {
      setSourceToDelete(null)
    }
  }

  const columns = [
    {
      header: "Source de Scraping",
      key: "name",
      render: (item) => (
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-xl bg-surface-container border border-outline-variant/20 shrink-0">
            <Globe className="size-4 text-brand-navy dark:text-sky-400" />
          </div>
          <div>
            <span className="font-semibold text-on-surface dark:text-zinc-100 block text-xs">
              {item.name}
            </span>
            <span className="text-[11px] text-on-surface-variant font-mono block">
              code: {item.code} • priorité {item.priority}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: "Statut",
      key: "status",
      width: "120px",
      render: (item) => <StatusBadge status={item.status} label={item.status?.toUpperCase()} />,
    },
    {
      header: "URL Cible & Scraping",
      key: "base_url",
      render: (item) => (
        <a
          href={item.base_url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-brand-navy dark:text-sky-400 hover:underline flex items-center gap-1 max-w-sm truncate"
          title={item.base_url}
        >
          <span className="truncate">{item.base_url}</span>
          <ExternalLink className="size-3 shrink-0" />
        </a>
      ),
    },
    {
      header: "Heure Matinale",
      key: "schedule_time",
      width: "120px",
      render: (item) => (
        <span className="text-xs font-mono text-on-surface dark:text-zinc-200">
          {item.schedule_time || "06:00"}
        </span>
      ),
    },
    {
      header: "Actions",
      key: "actions",
      width: "130px",
      className: "text-right",
      render: (item) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => handleToggleStatus(item)}
            disabled={!hasPermission("manage_sources")}
            className={`p-1 ${item.status === "active" ? "text-emerald-600 hover:bg-emerald-500/10" : "text-zinc-400 hover:bg-zinc-500/10"}`}
            title={item.status === "active" ? "Mettre en pause" : "Activer la source"}
          >
            <Power className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => handleOpenEdit(item)}
            disabled={!hasPermission("manage_sources")}
            className="p-1 text-on-surface-variant hover:bg-surface-container"
          >
            <Edit className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setSourceToDelete(item)}
            disabled={!hasPermission("manage_sources")}
            className="p-1 text-rose-600 hover:bg-rose-500/10"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  const filteredSources = sources.filter(
    (s) =>
      !searchTerm ||
      s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-on-surface dark:text-zinc-100">
            Gestion des Sources de Données
          </h2>
          <p className="text-xs text-on-surface-variant dark:text-zinc-400">
            Configuration des plateformes d'emploi scannées chaque matin par les robots de collecte.
          </p>
        </div>

        {hasPermission("manage_sources") && (
          <Button
            type="button"
            onClick={handleOpenAdd}
            className="bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold text-xs shadow-xs"
          >
            <Plus className="size-3.5 mr-1" />
            Ajouter une source
          </Button>
        )}
      </div>

      {/* Table */}
      <AdminTable
        columns={columns}
        data={filteredSources}
        loading={loadingSources}
        searchPlaceholder="Rechercher une source..."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        pageSize={10}
      />

      {/* Source Form Modal */}
      <AdminModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSource ? `Modifier la source : ${editingSource.name}` : "Ajouter une nouvelle source de scraping"}
        subtitle="Renseignez l'URL cible et les paramètres du collecteur"
        size="md"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleSaveSource}
              disabled={createSourceMutation.isPending || updateSourceMutation.isPending}
              className="bg-brand-navy text-white font-semibold"
            >
              {editingSource ? "Enregistrer" : "Créer la source"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveSource} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-on-surface mb-1">Nom de la plateforme *</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Novojob CI"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-on-surface mb-1">Code identifiant unique *</label>
              <Input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="novojob_ci"
                required
                disabled={Boolean(editingSource)}
              />
            </div>
            <div>
              <label className="block font-semibold text-on-surface mb-1">Ordre de priorité</label>
              <Input
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                min="1"
                max="99"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-on-surface mb-1">URL de scraping cible *</label>
            <Input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://example.com/offres"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-on-surface mb-1">Heure de collecte quotidienne</label>
            <Input
              type="text"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              placeholder="06:00"
            />
          </div>
        </form>
      </AdminModal>

      {/* Delete Confirmation */}
      <AdminConfirmDialog
        isOpen={Boolean(sourceToDelete)}
        onClose={() => setSourceToDelete(null)}
        onConfirm={handleDeleteSource}
        title="Supprimer cette source ?"
        message={`Êtes-vous sûr de vouloir supprimer la source "${sourceToDelete?.name}" ? Les offres associées ne seront plus synchronisées.`}
        confirmText="Supprimer définitivement"
        variant="danger"
        loading={deleteSourceMutation.isPending}
      />
    </div>
  )
}
