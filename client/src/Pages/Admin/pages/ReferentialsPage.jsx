import { useState } from "react"
import { Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "../components/PageHeader"
import { Tabs } from "../components/Tabs"
import { ConfirmDialog } from "../components/ConfirmDialog"
import { StatusBadge } from "../components/StatusBadge"
import { EmptyState } from "../components/EmptyState"
import { RowActionsMenu } from "../components/DataTable"
import { extractErrorMessage } from "@/api/admin/adminAxios"
import { useAdminMutations, useReferentialSafe } from "./adminHooks"

/* Champs affichés/éditables par onglet (le CRUD reste générique) */
const TAB_FIELDS = {
  "contract-types": [{ name: "label", label: "Libellé", required: true }],
  "experience-levels": [
    { name: "label", label: "Libellé", required: true },
    { name: "min_years", label: "Années min", type: "number" },
    { name: "max_years", label: "Années max", type: "number" },
  ],
  "education-levels": [
    { name: "label", label: "Libellé", required: true },
    { name: "rank", label: "Rang", type: "number" },
  ],
  locations: [
    { name: "city", label: "Ville", required: true },
    { name: "district", label: "Commune / quartier" },
    { name: "is_remote", label: "Télétravail", type: "checkbox" },
  ],
}

/**
 * Composant CRUD générique réutilisé pour les 4 onglets (S6 — FormCrud).
 */
const ReferentialCrud = ({ resource }) => {
  const query = useReferentialSafe(resource)
  const m = useAdminMutations()
  const mutations = m.referentialMutations[resource]
  const items = query.data || []

  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState({})
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ code: "" })
  const [deleteTarget, setDeleteTarget] = useState(null)

  /* Menu contextuel de ligne */
  const [menuFor, setMenuFor] = useState(null)

  const fields = TAB_FIELDS[resource] || []

  const startEdit = (item) => {
    setEditingId(item.id)
    const initial = {}
    fields.forEach((f) => {
      initial[f.name] = item[f.name] ?? (f.type === "checkbox" ? false : f.type === "number" ? null : "")
    })
    setDraft(initial)
  }

  const saveEdit = async () => {
    try {
      await mutations.update.mutateAsync({ id: editingId, data: draft })
      toast.success("Élément mis à jour")
      setEditingId(null)
    } catch (error) {
      toast.error("Mise à jour impossible", extractErrorMessage(error))
    }
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    try {
      await mutations.create.mutateAsync({
        code: createForm.code,
        ...Object.fromEntries(fields.map((f) => [f.name, createForm[f.name]])),
      })
      toast.success("Élément créé")
      setCreateOpen(false)
      setCreateForm({ code: "" })
    } catch (error) {
      toast.error("Création impossible", extractErrorMessage(error))
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await mutations.remove.mutateAsync(deleteTarget.id)
      toast.success("Élément supprimé")
    } catch (error) {
      toast.error("Suppression impossible", extractErrorMessage(error))
    } finally {
      setDeleteTarget(null)
    }
  }

  /* Menu contextuel de ligne — Éditer / Enregistrer / Supprimer */
  const rowActions = (item) => {
    if (editingId === item.id) {
      return [
        { key: "save", label: "Enregistrer", icon: Save, onClick: saveEdit },
        { key: "cancel", label: "Annuler", icon: X, onClick: () => setEditingId(null) },
      ]
    }
    return [
      { key: "edit", label: "Éditer", icon: Pencil, onClick: () => startEdit(item) },
      { key: "delete", label: "Supprimer", icon: Trash2, danger: true, onClick: () => setDeleteTarget(item) },
    ]
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{items.length} élément(s) — triés par ordre d'affichage.</p>
        <button type="button" className="adm-btn-primary adm-btn-sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-3.5" /> Ajouter
        </button>
      </div>

      {query.isLoading ? (
        <div className="adm-card space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="adm-skeleton-line h-8 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="adm-card">
          <EmptyState title="Liste vide" description="Ajoutez le premier élément de ce référentiel." />
        </div>
      ) : (
        <div className="adm-card overflow-hidden">
          <table className="adm-table adm-table--compact">
            <thead>
              <tr>
                <th>Code</th>
                {fields.map((f) => (
                  <th key={f.name}>{f.label}</th>
                ))}
                <th>Statut</th>
                <th className="w-28 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  onClick={(e) => {
                    if (e.target.closest("input, select, textarea, a, button, label, [role='menuitem']")) return
                    setMenuFor(menuFor === item.id ? null : item.id)
                  }}
                  className="cursor-pointer"
                >
                  <td>
                    <code className="rounded bg-surface-container px-1.5 py-0.5 text-[11px]">{item.code}</code>
                  </td>
                  {fields.map((f) => (
                    <td key={f.name}>
                      {editingId === item.id ? (
                        f.type === "checkbox" ? (
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--primary)]"
                            checked={Boolean(draft[f.name])}
                            onChange={(e) => setDraft({ ...draft, [f.name]: e.target.checked })}
                          />
                        ) : (
                          <input
                            type={f.type === "number" ? "number" : "text"}
                            className="adm-input h-7 w-full max-w-40 text-xs"
                            value={draft[f.name] ?? ""}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                [f.name]: f.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value,
                              })
                            }
                          />
                        )
                      ) : f.type === "checkbox" ? (
                        item[f.name] ? "Oui" : "Non"
                      ) : (
                        item[f.name] ?? "—"
                      )}
                    </td>
                  ))}
                  <td>
                    <StatusBadge status={item.is_active ? "active" : "inactive"} label={item.is_active ? "Actif" : "Inactif"} />
                  </td>
                  <td>
                    <RowActionsMenu
                      open={menuFor === item.id}
                      onChange={(v) => setMenuFor(v ? item.id : null)}
                      actions={rowActions(item)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Création */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" onClick={() => setCreateOpen(false)}>
          <form className="adm-card w-full max-w-sm p-6 shadow-hover" onSubmit={handleCreate} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading text-base font-bold">Nouvel élément</h3>
            <div className="mt-4 grid gap-3">
              <div>
                <label htmlFor={`${resource}-code`} className="adm-label">Code *</label>
                <input id={`${resource}-code`} required minLength={2} className="adm-input font-mono text-xs" value={createForm.code} onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })} placeholder="ex : cdi, master…" />
              </div>
              {fields.map((f) => (
                <div key={f.name}>
                  <label htmlFor={`${resource}-${f.name}`} className="adm-label">{f.label}{f.required ? " *" : ""}</label>
                  {f.type === "checkbox" ? (
                    <input
                      id={`${resource}-${f.name}`}
                      type="checkbox"
                      className="size-4 accent-[var(--primary)]"
                      checked={Boolean(createForm[f.name])}
                      onChange={(e) => setCreateForm({ ...createForm, [f.name]: e.target.checked })}
                    />
                  ) : (
                    <input
                      id={`${resource}-${f.name}`}
                      required={f.required}
                      type={f.type === "number" ? "number" : "text"}
                      className="adm-input"
                      value={createForm[f.name] ?? ""}
                      onChange={(e) => setCreateForm({ ...createForm, [f.name]: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="adm-btn-outline" onClick={() => setCreateOpen(false)}>Annuler</button>
              <button type="submit" className="adm-btn-primary" disabled={mutations.create.isPending}>
                {mutations.create.isPending && <Loader2 className="size-4 animate-spin" />}
                Créer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Suppression */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={mutations.remove.isPending}
        tone="danger"
        title={`Supprimer « ${deleteTarget?.code ?? ""} » ?`}
        message="Suppression physique du référentiel. Les offres qui l'utilisent pourraient perdre ce rattachement."
        confirmText="Supprimer"
      />
    </div>
  )
}

/**
 * Page 7 — /admin/referentiels (super_admin).
 * Onglets génériques : contract-types · experience-levels · education-levels · locations.
 */
export const ReferentialsPage = () => {
  const [tab, setTab] = useState("contract-types")

  return (
    <>
      <PageHeader
        title="Référentiels secondaires"
        description="Vocabulaires partagés par la normalisation des offres et les filtres du site public."
        crumbs={[{ label: "Accueil", to: "/admin" }, { label: "Référentiels" }]}
      />

      <Tabs
        tabs={[
          { key: "contract-types", label: "Types de contrat" },
          { key: "experience-levels", label: "Niveaux d'expérience" },
          { key: "education-levels", label: "Niveaux d'études" },
          { key: "locations", label: "Localisations" },
        ]}
        activeKey={tab}
        onChange={setTab}
      />

      <ReferentialCrud key={tab} resource={tab} />
    </>
  )
}


