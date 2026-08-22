import { useState, useMemo } from "react"
import { Plus, Edit, Trash2, Eye, EyeOff, ExternalLink, RefreshCw } from "lucide-react"
import { AdminTable } from "../components/AdminTable"
import { AdminModal } from "../components/AdminModal"
import { AdminConfirmDialog } from "../components/AdminConfirmDialog"
import { StatusBadge } from "../components/AdminBadgeRole"
import { useToast } from "../components/AdminToast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import {
  useAdminOffers,
  useAdminFilieres,
  useAdminSources,
  useAdminMutations,
} from "@/tools/admin.tools"

export const OffersSection = () => {
  const { hasPermission } = useAdminAuth()
  const toast = useToast()
  const {
    createOfferMutation,
    updateOfferMutation,
    updateOfferStatusMutation,
    updateOfferVisibilityMutation,
    deleteOfferMutation,
  } = useAdminMutations()

  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedFiliere, setSelectedFiliere] = useState("all")
  const [selectedSource, setSelectedSource] = useState("all")

  // Modal form states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingOffer, setEditingOffer] = useState(null)
  const [offerToDelete, setOfferToDelete] = useState(null)

  // Form fields
  const [title, setTitle] = useState("")
  const [company, setCompany] = useState("")
  const [location, setLocation] = useState("Abidjan")
  const [filiere, setFiliere] = useState("Tech & Dev")
  const [source, setSource] = useState("Manuel")
  const [contractType, setContractType] = useState("CDI")
  const [salaryRaw, setSalaryRaw] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [status, setStatus] = useState("active")
  const [visibleSite, setVisibleSite] = useState(true)

  const { data: offers = [], isLoading: loadingOffers, refetch } = useAdminOffers()
  const { data: filieres = [] } = useAdminFilieres()
  const { data: sources = [] } = useAdminSources()

  const handleOpenAdd = () => {
    setEditingOffer(null)
    setTitle("")
    setCompany("")
    setLocation("Abidjan, Cocody")
    setFiliere(filieres[0]?.label || "Tech & Dev")
    setSource("Manuel (Admin)")
    setContractType("CDI")
    setSalaryRaw("")
    setSourceUrl("")
    setStatus("active")
    setVisibleSite(true)
    setIsFormModalOpen(true)
  }

  const handleOpenEdit = (offer) => {
    setEditingOffer(offer)
    setTitle(offer.title || "")
    setCompany(offer.company || "")
    setLocation(offer.location || "Abidjan")
    setFiliere(offer.filiere || "Tech & Dev")
    setSource(offer.source || "Manuel")
    setContractType(offer.contract_type || "CDI")
    setSalaryRaw(offer.salary_raw || "")
    setSourceUrl(offer.source_url || "")
    setStatus(offer.status || "active")
    setVisibleSite(offer.visible_site ?? true)
    setIsFormModalOpen(true)
  }

  const handleSaveOffer = async (e) => {
    e.preventDefault()
    if (!hasPermission("manage_offers")) {
      toast.error("Action non autorisée", "Vous n'avez pas la permission de modifier les offres.")
      return
    }

    const payload = {
      title,
      company,
      location,
      filiere,
      source,
      contract_type: contractType,
      salary_raw: salaryRaw,
      source_url: sourceUrl,
      status,
      visible_site: visibleSite,
    }

    try {
      if (editingOffer) {
        await updateOfferMutation.mutateAsync({ id: editingOffer.id, data: payload })
        toast.success("Offre modifiée", `L'offre "${title}" a été mise à jour.`)
      } else {
        await createOfferMutation.mutateAsync(payload)
        toast.success("Offre créée", `L'offre "${title}" a été publiée avec succès.`)
      }
      setIsFormModalOpen(false)
    } catch {
      toast.error("Erreur", "L'enregistrement de l'offre a échoué.")
    }
  }

  const handleToggleVisibility = async (offer) => {
    if (!hasPermission("manage_offers")) return
    const nextVis = !offer.visible_site
    try {
      await updateOfferVisibilityMutation.mutateAsync({ id: offer.id, visible: nextVis })
      toast.info(
        "Visibilité mise à jour",
        `L'offre est désormais ${nextVis ? "visible en ligne" : "masquée du public"}.`
      )
    } catch {
      toast.error("Erreur", "Impossible de modifier la visibilité.")
    }
  }

  const handleDeleteOffer = async () => {
    if (!offerToDelete) return
    try {
      await deleteOfferMutation.mutateAsync(offerToDelete.id)
      toast.success("Offre supprimée", "L'annonce a été retirée définitivement.")
    } catch {
      toast.error("Erreur", "La suppression a échoué.")
    } finally {
      setOfferToDelete(null)
    }
  }

  // Filtrage local
  const filteredOffers = useMemo(() => {
    return offers.filter((o) => {
      const matchSearch =
        !searchTerm ||
        o.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.location?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchStatus = selectedStatus === "all" || o.status === selectedStatus
      const matchFiliere = selectedFiliere === "all" || o.filiere === selectedFiliere
      const matchSource = selectedSource === "all" || o.source?.toLowerCase().includes(selectedSource.toLowerCase())

      return matchSearch && matchStatus && matchFiliere && matchSource
    })
  }, [offers, searchTerm, selectedStatus, selectedFiliere, selectedSource])

  const columns = [
    {
      header: "Intitulé du Poste & Entreprise",
      key: "title",
      render: (item) => (
        <div>
          <span className="font-semibold text-on-surface dark:text-zinc-100 block text-xs truncate max-w-xs" title={item.title}>
            {item.title}
          </span>
          <span className="text-[11px] text-on-surface-variant dark:text-zinc-400 block truncate">
            {item.company} • {item.location}
          </span>
        </div>
      ),
    },
    {
      header: "Filière",
      key: "filiere",
      width: "140px",
      render: (item) => (
        <span className="rounded-full bg-brand-navy/10 text-brand-navy dark:text-sky-300 px-2 py-0.5 text-[10px] font-semibold">
          {item.filiere}
        </span>
      ),
    },
    {
      header: "Source & Contrat",
      key: "source",
      width: "130px",
      render: (item) => (
        <div>
          <span className="text-xs text-on-surface font-medium block">{item.source}</span>
          <span className="text-[10px] text-on-surface-variant/80 block">{item.contract_type || "CDI"}</span>
        </div>
      ),
    },
    {
      header: "Statut",
      key: "status",
      width: "100px",
      render: (item) => <StatusBadge status={item.status} label={item.status?.toUpperCase()} />,
    },
    {
      header: "Visibilité",
      key: "visible_site",
      width: "90px",
      render: (item) => (
        <button
          type="button"
          onClick={() => handleToggleVisibility(item)}
          disabled={!hasPermission("manage_offers")}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors ${
            item.visible_site
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
              : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-500/20"
          }`}
          title="Cliquer pour basculer la visibilité publique"
        >
          {item.visible_site ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
          {item.visible_site ? "Publique" : "Masquée"}
        </button>
      ),
    },
    {
      header: "Actions",
      key: "actions",
      width: "110px",
      className: "text-right",
      render: (item) => (
        <div className="flex items-center justify-end gap-1">
          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noreferrer"
              className="rounded p-1 text-on-surface-variant hover:text-brand-navy dark:hover:text-sky-400"
              title="Voir l'annonce source"
            >
              <ExternalLink className="size-3.5" />
            </a>
          )}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => handleOpenEdit(item)}
            disabled={!hasPermission("manage_offers")}
            className="p-1 text-on-surface-variant hover:bg-surface-container"
          >
            <Edit className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setOfferToDelete(item)}
            disabled={!hasPermission("manage_offers")}
            className="p-1 text-rose-600 hover:bg-rose-500/10"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-on-surface dark:text-zinc-100">
            Gestion & Modération des Offres d'Emploi
          </h2>
          <p className="text-xs text-on-surface-variant dark:text-zinc-400">
            Supervision du catalogue, correction des fiches, contrôle de visibilité et publication manuelle.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission("manage_offers") && (
            <Button
              type="button"
              onClick={handleOpenAdd}
              className="bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold text-xs shadow-xs"
            >
              <Plus className="size-3.5 mr-1" />
              Ajouter une offre
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Table with multiple filters */}
      <AdminTable
        columns={columns}
        data={filteredOffers}
        loading={loadingOffers}
        searchPlaceholder="Rechercher par titre, entreprise, lieu..."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        pageSize={10}
        filterComponent={
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-8 rounded-md border border-outline-variant/30 bg-surface-container-lowest dark:bg-zinc-900 px-2.5 text-xs text-on-surface outline-none"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Active</option>
              <option value="expired">Expirée</option>
              <option value="filled">Pourvue</option>
              <option value="archived">Archivée</option>
            </select>

            {/* Filiere Filter */}
            <select
              value={selectedFiliere}
              onChange={(e) => setSelectedFiliere(e.target.value)}
              className="h-8 rounded-md border border-outline-variant/30 bg-surface-container-lowest dark:bg-zinc-900 px-2.5 text-xs text-on-surface outline-none max-w-[150px]"
            >
              <option value="all">Toutes les filières</option>
              {filieres.map((f) => (
                <option key={f.id} value={f.label}>
                  {f.label}
                </option>
              ))}
            </select>

            {/* Source Filter */}
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="h-8 rounded-md border border-outline-variant/30 bg-surface-container-lowest dark:bg-zinc-900 px-2.5 text-xs text-on-surface outline-none"
            >
              <option value="all">Toutes les sources</option>
              <option value="novojob">Novojob</option>
              <option value="linkedin">LinkedIn</option>
              <option value="emploidakar">EmploiDakar</option>
              <option value="goafrica">Go Africa</option>
              <option value="manuel">Manuel</option>
            </select>
          </div>
        }
      />

      {/* Offer Form Modal (Create / Edit) */}
      <AdminModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingOffer ? `Modifier l'offre : ${editingOffer.title}` : "Publier une nouvelle offre d'emploi"}
        subtitle="Renseignez les détails du poste pour alimenter le flux et le digest matinal"
        size="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsFormModalOpen(false)}>
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleSaveOffer}
              disabled={createOfferMutation.isPending || updateOfferMutation.isPending}
              className="bg-brand-navy text-white font-semibold"
            >
              {editingOffer ? "Enregistrer les modifications" : "Publier l'offre"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveOffer} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-on-surface mb-1">Intitulé du poste *</label>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Développeur Fullstack React"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-on-surface mb-1">Entreprise *</label>
              <Input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Ex: Orange CI, Wave, MTN..."
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-on-surface mb-1">Lieu *</label>
              <Input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Abidjan, Cocody"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-on-surface mb-1">Filière Métier *</label>
              <select
                value={filiere}
                onChange={(e) => setFiliere(e.target.value)}
                className="h-8 w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-2 text-xs"
              >
                {filieres.map((f) => (
                  <option key={f.id} value={f.label}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-on-surface mb-1">Type de Contrat</label>
              <select
                value={contractType}
                onChange={(e) => setContractType(e.target.value)}
                className="h-8 w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-2 text-xs"
              >
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
                <option value="Stage">Stage</option>
                <option value="Freelance">Freelance</option>
                <option value="Alternance">Alternance</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-on-surface mb-1">Rémunération indicative</label>
              <Input
                type="text"
                value={salaryRaw}
                onChange={(e) => setSalaryRaw(e.target.value)}
                placeholder="Ex: 800 000 - 1 200 000 FCFA"
              />
            </div>
            <div>
              <label className="block font-semibold text-on-surface mb-1">Lien de l'annonce source</label>
              <Input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block font-semibold text-on-surface mb-1">Statut</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-8 w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-2 text-xs"
              >
                <option value="active">Active (En cours)</option>
                <option value="expired">Expirée</option>
                <option value="filled">Pourvue</option>
                <option value="archived">Archivée</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="visible_site_check"
                checked={visibleSite}
                onChange={(e) => setVisibleSite(e.target.checked)}
                className="size-4 rounded border-outline-variant text-brand-navy"
              />
              <label htmlFor="visible_site_check" className="font-semibold text-on-surface cursor-pointer">
                Rendre cette offre visible sur le site public
              </label>
            </div>
          </div>
        </form>
      </AdminModal>

      {/* Delete Confirmation */}
      <AdminConfirmDialog
        isOpen={Boolean(offerToDelete)}
        onClose={() => setOfferToDelete(null)}
        onConfirm={handleDeleteOffer}
        title="Supprimer définitivement cette offre ?"
        message={`Êtes-vous certain de vouloir supprimer "${offerToDelete?.title}" ? Cette action est irréversible.`}
        confirmText="Supprimer l'offre"
        variant="danger"
        loading={deleteOfferMutation.isPending}
      />
    </div>
  )
}
