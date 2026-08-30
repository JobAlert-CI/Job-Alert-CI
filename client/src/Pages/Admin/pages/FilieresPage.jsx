import { Fragment, useEffect, useState } from "react"
import { ChevronDown, ChevronUp, GripVertical, Loader2, Pencil, Plus, Save, Tag, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "../components/PageHeader"
import { ConfirmDialog } from "../components/ConfirmDialog"
import { StatusBadge } from "../components/StatusBadge"
import { RowActionsMenu } from "../components/DataTable"
import { extractErrorMessage } from "@/api/admin/adminAxios"
import { useAdminMutations, useFilieresSafe } from "./adminHooks"

const EMPTY_FILIERE = {
  code: "",
  label: "",
  slug: "",
  description: "",
  sort_order: 100,
  is_active: true,
}

/**
 * Page 5 — /admin/filieres (super_admin).
 * Liste triable par sort_order · PUT /{id}/keywords (remplacement complet,
 * poids 1–100) · GET/POST /{id}/specialites · PUT/DELETE /specialites/{id}.
 */
export const FilieresPage = () => {
  const filieresQuery = useFilieresSafe()
  const m = useAdminMutations()
  const filieres = [...(filieresQuery.data || [])].sort((a, b) => a.sort_order - b.sort_order)

  /* Édition inline de la filière sélectionnée */
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState(null)

  /* Éditeur de mots-clés */
  const [keywords, setKeywords] = useState([])
  const [newKeyword, setNewKeyword] = useState({ keyword: "", weight: 80 })

  /* Création / suppression */
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FILIERE)
  const [deleteTarget, setDeleteTarget] = useState(null)

  /* Menu contextuel de ligne */
  const [menuFor, setMenuFor] = useState(null)

  /* Spécialités */
  const selected = filieres.find((f) => f.id === selectedId) || null

  useEffect(() => {
    if (!selected) return
    /* Synchronisation des données serveur vers le brouillon d'édition */
    // eslint-disable-next-line react-hooks/set-state-in-effect -- données serveur → brouillon
    setDraft({
      label: selected.label ?? "",
      slug: selected.slug ?? "",
      description: selected.description ?? "",
      sort_order: selected.sort_order ?? 100,
      is_active: selected.is_active ?? true,
    })
    // Les mots-clés ne sont pas dans FiliereRead : on démarre vide si absents
    // eslint-disable-next-line react-hooks/set-state-in-effect -- données serveur → brouillon
    setKeywords(Array.isArray(selected.keywords) ? selected.keywords : [])
  }, [selectedId])

  const selectFiliere = (filiere) => {
    setSelectedId(filiere.id === selectedId ? null : filiere.id)
  }

  /* ─── Mutations ─── */
  const handleCreate = async (event) => {
    event.preventDefault()
    try {
      const payload = {
        ...createForm,
        slug: createForm.slug || createForm.code.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      }
      await m.createFiliereMutation.mutateAsync(payload)
      toast.success("Filière créée", payload.label)
      setCreateOpen(false)
      setCreateForm(EMPTY_FILIERE)
    } catch (error) {
      toast.error("Création impossible", extractErrorMessage(error))
    }
  }

  const handleSaveMeta = async () => {
    try {
      await m.updateFiliereMutation.mutateAsync({ id: selectedId, data: draft })
      toast.success("Filière mise à jour", draft.label)
    } catch (error) {
      toast.error("Mise à jour impossible", extractErrorMessage(error))
    }
  }

  /** Remplacement complet des mots-clés. */
  const handleSaveKeywords = async () => {
    try {
      await m.updateKeywordsMutation.mutateAsync({
        id: selectedId,
        keywords: keywords.map((k) => ({ keyword: k.keyword.trim(), weight: Math.min(100, Math.max(1, Number(k.weight) || 1)) })),
      })
      toast.success("Mots-clés enregistrés", `${keywords.length} mot(s)-clé(s), remplacement complet effectué.`)
    } catch (error) {
      toast.error("Enregistrement impossible", extractErrorMessage(error))
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await m.deleteFiliereMutation.mutateAsync(deleteTarget.id)
      toast.success("Filière supprimée", deleteTarget.label)
      if (selectedId === deleteTarget.id) setSelectedId(null)
    } catch (error) {
      toast.error("Suppression impossible", extractErrorMessage(error))
    } finally {
      setDeleteTarget(null)
    }
  }

  /* ─── Mots-clés (local) ─── */
  const addKeyword = () => {
    const kw = newKeyword.keyword.trim()
    if (!kw) return
    if (keywords.some((k) => k.keyword.toLowerCase() === kw.toLowerCase())) {
      toast.warning("Mot-clé déjà présent", kw)
      return
    }
    setKeywords([...keywords, { keyword: kw, weight: Math.min(100, Math.max(1, Number(newKeyword.weight) || 80)) }])
    setNewKeyword({ keyword: "", weight: 80 })
  }

  /* ─── Déplacement dans l'ordre (sort_order local, sauvegarde à la demande) ─── */
  const moveFiliere = async (filiere, direction) => {
    const index = filieres.findIndex((f) => f.id === filiere.id)
    const neighbor = filieres[index + direction]
    if (!neighbor) return
    try {
      await Promise.all([
        m.updateFiliereMutation.mutateAsync({ id: filiere.id, data: { sort_order: neighbor.sort_order } }),
        m.updateFiliereMutation.mutateAsync({ id: neighbor.id, data: { sort_order: filiere.sort_order } }),
      ])
      toast.success("Ordre mis à jour")
    } catch (error) {
      toast.error("Réorganisation impossible", extractErrorMessage(error))
    }
  }

  /* Menu contextuel de ligne — toutes les actions filière */
  const rowActions = (filiere, index) => [
    { key: "edit", label: "Détails & mots-clés", icon: Pencil, onClick: () => selectFiliere(filiere) },
    {
      key: "up",
      label: "Monter dans l'ordre",
      icon: ChevronUp,
      disabled: index === 0,
      onClick: () => moveFiliere(filiere, -1),
    },
    {
      key: "down",
      label: "Descendre dans l'ordre",
      icon: ChevronDown,
      disabled: index === filieres.length - 1,
      onClick: () => moveFiliere(filiere, 1),
    },
    { key: "delete", label: "Supprimer", icon: Trash2, danger: true, onClick: () => setDeleteTarget(filiere) },
  ]

  return (
    <>
      <PageHeader
        title="Filières métiers"
        description="Catégorisation des offres et mots-clés de matching automatique."
        crumbs={[{ label: "Accueil", to: "/admin" }, { label: "Filières" }]}
        actions={
          <button type="button" className="adm-btn-primary" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Nouvelle filière
          </button>
        }
      />

      {/* Liste triable */}
      <div className="adm-card overflow-hidden">
        <table className="adm-table adm-table--compact">
          <thead>
            <tr>
              <th className="w-10">Ordre</th>
              <th>Filière</th>
              <th className="hidden sm:table-cell">Code</th>
              <th>Statut</th>
              <th className="w-40 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filieresQuery.isLoading && (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}><td colSpan={5}><div className="adm-skeleton-line h-4 w-full" /></td></tr>
              ))
            )}
            {!filieresQuery.isLoading &&
              filieres.map((filiere, index) => (
                <Fragment key={filiere.id}>
                  <tr
                    onClick={() => selectFiliere(filiere)}
                    className={`cursor-pointer ${selectedId === filiere.id ? "bg-primary/5" : ""}`}
                  >
                    <td>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <GripVertical className="size-3.5 opacity-50" />
                        {filiere.sort_order}
                      </span>
                    </td>
                    <td>
                      <p className="text-sm font-semibold">{filiere.label}</p>
                      {filiere.tagline && <p className="truncate text-xs text-muted-foreground">{filiere.tagline}</p>}
                    </td>
                    <td className="hidden sm:table-cell">
                      <code className="rounded bg-surface-container px-1.5 py-0.5 text-[11px]">{filiere.code}</code>
                    </td>
                    <td>
                      <StatusBadge status={filiere.is_active ? "active" : "inactive"} label={filiere.is_active ? "Active" : "Inactive"} />
                    </td>
                    <td className="text-right">
                      <RowActionsMenu
                        open={menuFor === filiere.id}
                        onChange={(v) => setMenuFor(v ? filiere.id : null)}
                        actions={rowActions(filiere, index)}
                      />
                    </td>
                  </tr>

                  {/* Panneau d'édition dépliable */}
                  {selectedId === filiere.id && draft && (
                    <tr key={`${filiere.id}-editor`}>
                      <td colSpan={5} className="bg-surface-container-low p-0">
                        <div className="grid gap-5 p-4 lg:grid-cols-2">
                          {/* Colonne gauche : méta */}
                          <div>
                            <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                              Informations
                            </h4>
                            <div className="grid gap-3">
                              <div>
                                <label className="adm-label">Libellé</label>
                                <input className="adm-input" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="adm-label">Slug</label>
                                  <input className="adm-input font-mono text-xs" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
                                </div>
                                <div>
                                  <label className="adm-label">Ordre</label>
                                  <input type="number" min={0} className="adm-input" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} />
                                </div>
                              </div>
                              <div>
                                <label className="adm-label">Description</label>
                                <textarea rows={2} className="adm-input" value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                              </div>
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={draft.is_active}
                                  onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                                  className="size-4 accent-[var(--primary)]"
                                />
                                Filière active (visible publiquement)
                              </label>
                              <button
                                type="button"
                                className="adm-btn-primary adm-btn-sm self-start"
                                onClick={handleSaveMeta}
                                disabled={m.updateFiliereMutation.isPending}
                              >
                                {m.updateFiliereMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                                Enregistrer les informations
                              </button>
                            </div>
                          </div>

                          {/* Colonne droite : mots-clés */}
                          <div>
                            <h4 className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                              <Tag className="size-3.5" /> Mots-clés de matching
                            </h4>
                            <p className="mb-3 text-[11px] text-muted-foreground">
                              Poids de 1 à 100 — l'enregistrement remplace la liste complète.
                            </p>

                            <ul className="mb-2 max-h-44 space-y-1 overflow-y-auto pr-1">
                              {keywords.length === 0 && (
                                <li className="rounded-md bg-surface-container px-2.5 py-2 text-xs text-muted-foreground">
                                  Aucun mot-clé — les offres ne seront pas rattachées automatiquement à cette filière.
                                </li>
                              )}
                              {keywords.map((kw, index) => (
                                <li key={`${kw.keyword}-${index}`} className="flex items-center gap-2">
                                  <input
                                    className="adm-input h-8 flex-1 text-xs"
                                    value={kw.keyword}
                                    onChange={(e) =>
                                      setKeywords(keywords.map((k, i) => (i === index ? { ...k, keyword: e.target.value } : k)))
                                    }
                                  />
                                  <input
                                    type="number" min={1} max={100}
                                    className="adm-input h-8 w-16 text-xs tabular-nums"
                                    value={kw.weight}
                                    onChange={(e) =>
                                      setKeywords(keywords.map((k, i) => (i === index ? { ...k, weight: Number(e.target.value) } : k)))
                                    }
                                  />
                                  <button
                                    type="button"
                                    className="adm-btn-ghost !h-7 !px-1.5"
                                    onClick={() => setKeywords(keywords.filter((_, i) => i !== index))}
                                    aria-label={`Retirer ${kw.keyword}`}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </li>
                              ))}
                            </ul>

                            <div className="flex items-center gap-2">
                              <input
                                className="adm-input h-8 flex-1 text-xs"
                                placeholder="Nouveau mot-clé…"
                                value={newKeyword.keyword}
                                onChange={(e) => setNewKeyword({ ...newKeyword, keyword: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault()
                                    addKeyword()
                                  }
                                }}
                              />
                              <input
                                type="number" min={1} max={100}
                                className="adm-input h-8 w-16 text-xs"
                                title="Poids (1–100)"
                                value={newKeyword.weight}
                                onChange={(e) => setNewKeyword({ ...newKeyword, weight: e.target.value })}
                              />
                              <button type="button" className="adm-btn-outline !h-8 px-2" onClick={addKeyword} aria-label="Ajouter le mot-clé">
                                <Plus className="size-3.5" />
                              </button>
                            </div>

                            <button
                              type="button"
                              className="adm-btn-primary adm-btn-sm mt-3 w-full"
                              onClick={handleSaveKeywords}
                              disabled={m.updateKeywordsMutation.isPending}
                            >
                              {m.updateKeywordsMutation.isPending ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Save className="size-3.5" />
                              )}
                              Enregistrer les mots-clés ({keywords.length})
                            </button>

                            {/* Sous-table spécialités */}
                            <h4 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                              Spécialités ({selected?.specialties?.length ?? 0})
                            </h4>
                            {(selected?.specialties?.length ?? 0) === 0 ? (
                              <p className="text-[11px] text-muted-foreground">Aucune spécialité rattachée.</p>
                            ) : (
                              <ul className="divide-y divide-border/70 rounded-lg border border-border bg-surface-container-lowest">
                                {selected.specialties.map((sp) => (
                                  <li key={sp.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                                    <span className="min-w-0 truncate font-medium">{sp.label}</span>
                                    <code className="shrink-0 text-[10px] text-muted-foreground">{sp.code}</code>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
          </tbody>
        </table>
      </div>

      {/* Formulaire création filière */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" onClick={() => setCreateOpen(false)}>
          <form className="adm-card w-full max-w-md p-6 shadow-hover" onSubmit={handleCreate} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading text-base font-bold">Nouvelle filière</h3>
            <div className="mt-4 grid gap-3">
              <div>
                <label htmlFor="fil-label" className="adm-label">Libellé *</label>
                <input id="fil-label" required minLength={2} className="adm-input" value={createForm.label} onChange={(e) => setCreateForm({ ...createForm, label: e.target.value })} placeholder="Ex : Santé & Médical" />
              </div>
              <div>
                <label htmlFor="fil-code" className="adm-label">Code * <span className="font-normal normal-case">(utilisé par l'API)</span></label>
                <input id="fil-code" required minLength={2} className="adm-input font-mono text-xs" value={createForm.code} onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })} placeholder="sante-medical" />
              </div>
              <div>
                <label htmlFor="fil-desc" className="adm-label">Description</label>
                <textarea id="fil-desc" rows={2} className="adm-input" value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="adm-btn-outline" onClick={() => setCreateOpen(false)}>Annuler</button>
              <button type="submit" className="adm-btn-primary" disabled={m.createFiliereMutation.isPending}>
                {m.createFiliereMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Créer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmation suppression */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={m.deleteFiliereMutation.isPending}
        tone="danger"
        title={`Supprimer la filière « ${deleteTarget?.label ?? ""} » ?`}
        message="Suppression physique du référentiel. Les offres déjà catégorisées pourraient perdre leur rattachement."
        confirmText="Supprimer définitivement"
      />
    </>
  )
}




