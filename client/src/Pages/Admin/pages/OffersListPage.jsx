import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Archive, Eye, EyeOff, Layers, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "../components/PageHeader"
import { DataTable } from "../components/DataTable"
import { ConfirmDialog } from "../components/ConfirmDialog"
import { GenericStatusBadge } from "../components/StatusBadge"
import { OFFER_STATUSES, OFFER_STATUS_LABELS } from "@/api/admin/types"
import { extractErrorMessage } from "@/api/admin/adminAxios"
import { useAdminMutations, useFilieresSafe, useOffersSafe, useSourcesSafe } from "./adminHooks"

/**
 * Page 8 — /admin/offres (super_admin + gestionnaire_offres).
 * GET /offers : filtres q · filiere_id · source_id · status · visible_site · origin.
 * Toggle visible_site (PATCH /visibility) · PATCH /status · DELETE soft (modale)
 * · sélection multiple → POST /bulk-status.
 */
export const OffersListPage = () => {
  const [q, setQ] = useState("")
  const [filiereId, setFiliereId] = useState("")
  const [sourceId, setSourceId] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [visibleFilter, setVisibleFilter] = useState("")
  const [originFilter, setOriginFilter] = useState("")
  const [offset, setOffset] = useState(0)
  const LIMIT = 20

  const params = useMemo(
    () => ({
      q: q || undefined,
      filiere_id: filiereId || undefined,
      source_id: sourceId || undefined,
      status: statusFilter || undefined,
      visible_site: visibleFilter === "" ? undefined : visibleFilter === "true",
      origin: originFilter || undefined,
      limit: LIMIT,
      offset,
    }),
    [q, filiereId, sourceId, statusFilter, visibleFilter, originFilter, offset]
  )

  const offersQuery = useOffersSafe(params)
  const filieresQuery = useFilieresSafe()
  const sourcesQuery = useSourcesSafe()
  const m = useAdminMutations()

  const rows = offersQuery.data || []
  const filieres = filieresQuery.data || []
  const sources = sourcesQuery.data || []

  /* Sélection multiple */
  const [selectedIds, setSelectedIds] = useState([])
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.includes(r.id))
  const toggleAll = () =>
    setSelectedIds(allSelected ? [] : [...new Set([...selectedIds, ...rows.map((r) => r.id)])])
  const toggleOne = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  /* Confirmations */
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false)
  const [bulkStatusValue, setBulkStatusValue] = useState("archived")

  const handleVisibility = async (offer, visible) => {
    try {
      await m.updateOfferVisibilityMutation.mutateAsync({ id: offer.id, visible })
      toast.success(visible ? "Offre publiée" : "Offre masquée", offer.title)
    } catch (error) {
      toast.error("Visibilité non modifiée", extractErrorMessage(error))
    }
  }

  const handleStatusChange = async (offer, status) => {
    if (status === offer.status) return
    try {
      await m.updateOfferStatusMutation.mutateAsync({ id: offer.id, status })
      toast.success("Statut mis à jour", `${offer.title} → ${OFFER_STATUS_LABELS[status]}`)
    } catch (error) {
      toast.error("Statut non modifié", extractErrorMessage(error))
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await m.deleteOfferMutation.mutateAsync(deleteTarget.id)
      toast.success("Offre supprimée", "Suppression logique — l'historique est conservé.")
    } catch (error) {
      toast.error("Suppression impossible", extractErrorMessage(error))
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleBulkStatus = async () => {
    try {
      const res = await m.bulkStatusMutation.mutateAsync({ offerIds: selectedIds, status: bulkStatusValue })
      toast.success("Mise à jour groupée", res?.message ?? `${selectedIds.length} offres → ${OFFER_STATUS_LABELS[bulkStatusValue]}`)
      setSelectedIds([])
      setBulkStatusOpen(false)
    } catch (error) {
      toast.error("Action groupée impossible", extractErrorMessage(error))
    }
  }

  const columns = [
    {
      key: "_select",
      header: (
        <input
          type="checkbox"
          aria-label="Tout sélectionner"
          checked={allSelected}
          onChange={toggleAll}
          className="size-4 accent-[var(--primary)]"
        />
      ),
      className: "w-10",
      render: (offer) => (
        <input
          type="checkbox"
          aria-label={`Sélectionner ${offer.title}`}
          checked={selectedIds.includes(offer.id)}
          onChange={() => toggleOne(offer.id)}
          onClick={(e) => e.stopPropagation()}
          className="size-4 accent-[var(--primary)]"
        />
      ),
    },
    {
      key: "title",
      header: "Offre",
      render: (offer) => (
        <div className="min-w-0 max-w-md">
          <p className="truncate text-sm font-semibold">{offer.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {offer.company?.name ?? "—"}
            {offer.location?.label ? ` · ${offer.location.label}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "source",
      header: "Source",
      className: "hidden lg:table-cell",
      render: (offer) => offer.source?.name ?? "—",
    },
    {
      key: "filiere",
      header: "Filière",
      className: "hidden xl:table-cell",
      render: (offer) => offer.primary_filiere?.label ?? "—",
    },
    {
      key: "status",
      header: "Statut",
      render: (offer) => (
        <select
          value={String(offer.status ?? "").toLowerCase()}
          onChange={(e) => handleStatusChange(offer, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="adm-input h-7 w-auto max-w-28 text-[11px]"
          aria-label={`Statut de ${offer.title}`}
        >
          {OFFER_STATUSES.map((s) => (
            <option key={s} value={s}>{OFFER_STATUS_LABELS[s]}</option>
          ))}
        </select>
      ),
    },
    {
      key: "visible_site",
      header: "Visible",
      className: "text-center",
      render: (offer) => (
        <button
          type="button"
          role="switch"
          aria-checked={offer.visible_site}
          disabled={m.updateOfferVisibilityMutation.isPending}
          onClick={() => handleVisibility(offer, !offer.visible_site)}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
            offer.visible_site ? "bg-success bg-emerald-600" : "bg-surface-container-highest"
          }`}
        >
          <span
            className={`inline-block size-3.5 transform rounded-full bg-white shadow transition-transform ${
              offer.visible_site ? "translate-x-4.5" : "translate-x-1"
            }`}
          />
        </button>
      ),
    },
    {
      key: "origin",
      header: "Origine",
      className: "hidden md:table-cell",
      render: (offer) => (
        <span className="rounded bg-surface-container px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {offer.origin}
        </span>
      ),
    },
    {
      key: "collected_at",
      header: "Collectée le",
      className: "hidden md:table-cell whitespace-nowrap",
      render: (offer) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {new Date(offer.collected_at || offer.published_at).toLocaleDateString("fr-FR")}
        </span>
      ),
    },
  ]

  /* Menu contextuel de ligne — mobile & desktop (colonne « ⋯ » ajoutée par DataTable) */
  const rowActions = (offer) => [
    { key: "edit", label: "Éditer l'offre", icon: Pencil, to: `/admin/offres/${offer.id}` },
    {
      key: "visibility",
      label: offer.visible_site ? "Masquer du site public" : "Publier sur le site public",
      icon: offer.visible_site ? EyeOff : Eye,
      onClick: () => handleVisibility(offer, !offer.visible_site),
    },
    { key: "delete", label: "Supprimer (logique)", icon: Trash2, danger: true, onClick: () => setDeleteTarget(offer) },
  ]

  return (
    <>
      <PageHeader
        title="Offres d'emploi"
        description="Toutes les offres collectées ou créées manuellement, y compris masquées et archivées."
        crumbs={[{ label: "Accueil", to: "/admin" }, { label: "Offres" }]}
        actions={
          <Link to="/admin/offres/nouvelle" className="adm-btn-primary">
            <Plus className="size-4" /> Nouvelle offre
          </Link>
        }
      />

      {/* Barre de filtres moderne */}
      <section className="adm-card mb-6 p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setOffset(0) }}
              placeholder="Rechercher par titre, entreprise…"
              className="adm-input !pl-10"
            />
          </div>
          <select value={filiereId} onChange={(e) => { setFiliereId(e.target.value); setOffset(0) }} className="adm-input">
            <option value="">Toutes les filières</option>
            {filieres.map((f) => (
              <option key={f.id} value={f.code}>{f.label}</option>
            ))}
          </select>
          <select value={sourceId} onChange={(e) => { setSourceId(e.target.value); setOffset(0) }} className="adm-input">
            <option value="">Toutes les sources</option>
            {sources.map((s) => (
              <option key={s.id} value={s.code}>{s.name}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setOffset(0) }} className="adm-input">
            <option value="">Tous les statuts</option>
            {OFFER_STATUSES.map((s) => (
              <option key={s} value={s}>{OFFER_STATUS_LABELS[s]}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select value={visibleFilter} onChange={(e) => { setVisibleFilter(e.target.value); setOffset(0) }} className="adm-input">
              <option value="">Visibilité</option>
              <option value="true">Visible</option>
              <option value="false">Masquée</option>
            </select>
            <select value={originFilter} onChange={(e) => { setOriginFilter(e.target.value); setOffset(0) }} className="adm-input">
              <option value="">Origine</option>
              <option value="scraping">Scraping</option>
              <option value="manual">Manuel</option>
              <option value="import">Import</option>
            </select>
          </div>
        </div>
      </section>

      {/* Barre d'action groupée si sélection */}
      {selectedIds.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-50/80 dark:bg-amber-950/30 px-5 py-3 shadow-xs">
          <Layers className="size-4.5 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-bold text-amber-900 dark:text-amber-200">{selectedIds.length} offre(s) sélectionnée(s)</span>
          <div className="ml-auto flex items-center gap-2">
            <select value={bulkStatusValue} onChange={(e) => setBulkStatusValue(e.target.value)} className="adm-input h-8 w-auto text-xs bg-white">
              <option value="archived">Archiver</option>
              <option value="expired">Expirer</option>
              <option value="filled">Pourvoir</option>
              <option value="active">Réactiver (Active)</option>
            </select>
            <button type="button" className="adm-btn-primary adm-btn-sm" onClick={() => setBulkStatusOpen(true)}>
              Appliquer le statut
            </button>
            <button type="button" className="adm-btn-ghost adm-btn-sm" onClick={() => setSelectedIds([])}>
              Désélectionner
            </button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        rowActions={rowActions}
        loading={offersQuery.isLoading}
        error={offersQuery.error}
        onRetry={() => offersQuery.refetch()}
        emptyLabel="Aucune offre"
        emptyHint="Modifiez les filtres ou lancez une collecte."
        limit={LIMIT}
        offset={offset}
        onOffsetChange={(newOffset) => {
          setOffset(newOffset)
          setSelectedIds([])
        }}
      />

      {/* Modale suppression logique */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={m.deleteOfferMutation.isPending}
        tone="danger"
        title="Supprimer cette offre ?"
        message={`« ${deleteTarget?.title ?? ""} » sera masquée de l'administration. Il s'agit d'une suppression logique : l'historique reste conservé en base.`}
        confirmText="Supprimer l'offre"
      />

      {/* Confirmation bulk status */}
      <ConfirmDialog
        open={bulkStatusOpen}
        onClose={() => setBulkStatusOpen(false)}
        onConfirm={handleBulkStatus}
        loading={m.bulkStatusMutation.isPending}
        title={`Changer le statut de ${selectedIds.length} offre(s) ?`}
        message={`Toutes les offres sélectionnées passeront en « ${OFFER_STATUS_LABELS[bulkStatusValue]} ». Action journalisée.`}
        confirmText="Appliquer"
      />
    </>
  )
}


