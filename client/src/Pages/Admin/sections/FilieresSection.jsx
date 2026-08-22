import { useState } from "react"
import { Plus, Edit, Trash2, Tag, Layers, Sparkles, X } from "lucide-react"
import { AdminTable } from "../components/AdminTable"
import { AdminModal } from "../components/AdminModal"
import { AdminConfirmDialog } from "../components/AdminConfirmDialog"
import { useToast } from "../components/AdminToast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import { useAdminFilieres, useAdminMutations } from "@/tools/admin.tools"

export const FilieresSection = () => {
  const { hasPermission } = useAdminAuth()
  const toast = useToast()
  const {
    createFiliereMutation,
    updateFiliereMutation,
    updateKeywordsMutation,
    deleteFiliereMutation,
  } = useAdminMutations()

  const [searchTerm, setSearchTerm] = useState("")

  // Modals state
  const [isFiliereModalOpen, setIsFiliereModalOpen] = useState(false)
  const [isKeywordsModalOpen, setIsKeywordsModalOpen] = useState(false)
  const [editingFiliere, setEditingFiliere] = useState(null)
  const [filiereForKeywords, setFiliereForKeywords] = useState(null)
  const [filiereToDelete, setFiliereToDelete] = useState(null)

  // Filière Form fields
  const [label, setLabel] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [sortOrder, setSortOrder] = useState(1)

  // Keywords management state
  const [keywordsList, setKeywordsList] = useState([])
  const [newKeyword, setNewKeyword] = useState("")
  const [newWeight, setNewWeight] = useState(90)

  const { data: filieres = [], isLoading: loadingFilieres } = useAdminFilieres()

  const handleOpenAdd = () => {
    setEditingFiliere(null)
    setLabel("")
    setSlug("")
    setDescription("")
    setSortOrder(filieres.length + 1)
    setIsFiliereModalOpen(true)
  }

  const handleOpenEdit = (fil) => {
    setEditingFiliere(fil)
    setLabel(fil.label || "")
    setSlug(fil.slug || "")
    setDescription(fil.description || "")
    setSortOrder(fil.sort_order || 1)
    setIsFiliereModalOpen(true)
  }

  const handleOpenKeywords = (fil) => {
    setFiliereForKeywords(fil)
    setKeywordsList(fil.keywords ? [...fil.keywords] : [])
    setNewKeyword("")
    setNewWeight(90)
    setIsKeywordsModalOpen(true)
  }

  const handleSaveFiliere = async (e) => {
    e.preventDefault()
    if (!hasPermission("manage_filieres")) {
      toast.error("Action non autorisée", "Vous n'avez pas la permission de modifier les filières.")
      return
    }

    const payload = {
      label,
      slug: slug || label.toLowerCase().replace(/\s+/g, "-"),
      description,
      sort_order: Number(sortOrder),
    }

    try {
      if (editingFiliere) {
        await updateFiliereMutation.mutateAsync({ id: editingFiliere.id, data: payload })
        toast.success("Filière modifiée", `La filière "${label}" a été mise à jour.`)
      } else {
        await createFiliereMutation.mutateAsync(payload)
        toast.success("Filière créée", `La filière "${label}" a été ajoutée avec succès.`)
      }
      setIsFiliereModalOpen(false)
    } catch {
      toast.error("Erreur", "L'enregistrement de la filière a échoué.")
    }
  }

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return
    setKeywordsList((prev) => [
      ...prev,
      { keyword: newKeyword.trim(), weight: Number(newWeight) || 90 },
    ])
    setNewKeyword("")
    setNewWeight(90)
  }

  const handleRemoveKeyword = (idx) => {
    setKeywordsList((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSaveKeywords = async () => {
    if (!filiereForKeywords) return
    try {
      await updateKeywordsMutation.mutateAsync({
        id: filiereForKeywords.id,
        keywords: keywordsList,
      })
      toast.success("Mots-clés synchronisés", `${keywordsList.length} mots-clés configurés pour ${filiereForKeywords.label}.`)
      setIsKeywordsModalOpen(false)
    } catch {
      toast.error("Erreur", "Impossible de mettre à jour les mots-clés.")
    }
  }

  const handleDeleteFiliere = async () => {
    if (!filiereToDelete) return
    try {
      await deleteFiliereMutation.mutateAsync(filiereToDelete.id)
      toast.success("Filière supprimée", `La filière "${filiereToDelete.label}" a été supprimée.`)
    } catch {
      toast.error("Erreur", "La suppression a échoué.")
    } finally {
      setFiliereToDelete(null)
    }
  }

  const columns = [
    {
      header: "Filière Métier",
      key: "label",
      render: (item) => (
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-xl bg-brand-navy/10 text-brand-navy dark:text-sky-300 font-bold text-xs shrink-0">
            {item.sort_order || "#"}
          </div>
          <div>
            <span className="font-semibold text-on-surface dark:text-zinc-100 block text-xs">
              {item.label}
            </span>
            <span className="text-[11px] text-on-surface-variant font-mono block">
              slug: {item.slug}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: "Description",
      key: "description",
      render: (item) => (
        <span className="text-xs text-on-surface-variant dark:text-zinc-400 block max-w-sm truncate" title={item.description}>
          {item.description || "-"}
        </span>
      ),
    },
    {
      header: "Mots-clés de Matching",
      key: "keywords",
      render: (item) => {
        const count = item.keywords?.length || 0
        return (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => handleOpenKeywords(item)}
            className="gap-1 text-xs"
          >
            <Tag className="size-3 text-brand-orange" />
            {count} mot{count > 1 ? "s" : ""}-clé{count > 1 ? "s" : ""}
          </Button>
        )
      },
    },
    {
      header: "Spécialités",
      key: "specialties",
      render: (item) => (
        <span className="text-xs text-on-surface-variant">
          {item.specialties?.length || 0} spécialité(s)
        </span>
      ),
    },
    {
      header: "Actions",
      key: "actions",
      width: "110px",
      className: "text-right",
      render: (item) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => handleOpenEdit(item)}
            disabled={!hasPermission("manage_filieres")}
            className="p-1 text-on-surface-variant hover:bg-surface-container"
          >
            <Edit className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setFiliereToDelete(item)}
            disabled={!hasPermission("manage_filieres")}
            className="p-1 text-rose-600 hover:bg-rose-500/10"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  const filteredFilieres = filieres.filter(
    (f) =>
      !searchTerm ||
      f.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.slug?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-on-surface dark:text-zinc-100">
            Gestion des Filières Métiers & Mots-Clés
          </h2>
          <p className="text-xs text-on-surface-variant dark:text-zinc-400">
            Définition des catégories d'emploi et des règles de classification automatique des annonces.
          </p>
        </div>

        {hasPermission("manage_filieres") && (
          <Button
            type="button"
            onClick={handleOpenAdd}
            className="bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold text-xs shadow-xs"
          >
            <Plus className="size-3.5 mr-1" />
            Ajouter une filière
          </Button>
        )}
      </div>

      {/* Table */}
      <AdminTable
        columns={columns}
        data={filteredFilieres}
        loading={loadingFilieres}
        searchPlaceholder="Rechercher une filière..."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        pageSize={10}
      />

      {/* Filiere Form Modal */}
      <AdminModal
        isOpen={isFiliereModalOpen}
        onClose={() => setIsFiliereModalOpen(false)}
        title={editingFiliere ? `Modifier la filière : ${editingFiliere.label}` : "Créer une nouvelle filière métier"}
        subtitle="Renseignez le nom, le slug d'URL et la description"
        size="md"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsFiliereModalOpen(false)}>
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleSaveFiliere}
              disabled={createFiliereMutation.isPending || updateFiliereMutation.isPending}
              className="bg-brand-navy text-white font-semibold"
            >
              {editingFiliere ? "Enregistrer" : "Créer la filière"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveFiliere} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-on-surface mb-1">Nom de la filière *</label>
            <Input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Tech & Dev"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-on-surface mb-1">Slug (URL) *</label>
              <Input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="tech-dev"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-on-surface mb-1">Ordre de tri</label>
              <Input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                min="1"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-on-surface mb-1">Description courte</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description des postes regroupés sous cette filière..."
              rows={3}
              className="w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest p-2 text-xs outline-none focus:ring-1 focus:ring-brand-navy"
            />
          </div>
        </form>
      </AdminModal>

      {/* Keywords Management Modal */}
      <AdminModal
        isOpen={isKeywordsModalOpen}
        onClose={() => setIsKeywordsModalOpen(false)}
        title={`Mots-clés de matching : ${filiereForKeywords?.label}`}
        subtitle="Ces termes permettent d'associer automatiquement les offres brutes à cette filière"
        size="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsKeywordsModalOpen(false)}>
              Fermer
            </Button>
            <Button
              size="sm"
              onClick={handleSaveKeywords}
              disabled={updateKeywordsMutation.isPending}
              className="bg-brand-navy text-white font-semibold"
            >
              Enregistrer les mots-clés ({keywordsList.length})
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Add keyword form */}
          <div className="flex items-end gap-2 p-3 rounded-xl bg-surface-container-low border border-outline-variant/20">
            <div className="flex-1">
              <label className="block font-semibold text-on-surface mb-1">Nouveau mot-clé :</label>
              <Input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="Ex: react, comptabilité, infirmier..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAddKeyword()
                  }
                }}
              />
            </div>
            <div className="w-24">
              <label className="block font-semibold text-on-surface mb-1">Poids (1-100) :</label>
              <Input
                type="number"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                min="1"
                max="100"
              />
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleAddKeyword}
              className="bg-brand-navy text-white"
            >
              Ajouter
            </Button>
          </div>

          {/* Keywords List */}
          <div>
            <h4 className="font-semibold text-on-surface mb-2">
              Mots-clés actifs pour cette filière ({keywordsList.length}) :
            </h4>
            <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-2 rounded-xl border border-outline-variant/20 bg-surface-container-lowest">
              {keywordsList.length === 0 ? (
                <span className="text-xs text-on-surface-variant italic p-2">
                  Aucun mot-clé défini. Ajoutez-en un ci-dessus.
                </span>
              ) : (
                keywordsList.map((k, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 bg-surface-container-low px-2.5 py-1 text-xs font-medium text-on-surface"
                  >
                    <span className="font-semibold">{k.keyword}</span>
                    <span className="text-[10px] text-brand-navy font-bold">({k.weight}%)</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(idx)}
                      className="text-on-surface-variant hover:text-rose-600 transition-colors ml-0.5"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </AdminModal>

      {/* Delete Confirmation */}
      <AdminConfirmDialog
        isOpen={Boolean(filiereToDelete)}
        onClose={() => setFiliereToDelete(null)}
        onConfirm={handleDeleteFiliere}
        title="Supprimer cette filière ?"
        message={`Êtes-vous sûr de vouloir supprimer "${filiereToDelete?.label}" ? Les offres associées devront être réassignées.`}
        confirmText="Supprimer définitivement"
        variant="danger"
        loading={deleteFiliereMutation.isPending}
      />
    </div>
  )
}
