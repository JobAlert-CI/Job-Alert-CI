import { useState } from "react"
import { ExternalLink, Loader2, Pencil, Plus, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "../components/PageHeader"
import { ConfirmDialog } from "../components/ConfirmDialog"
import { SourceStatusBadge } from "../components/StatusBadge"
import { SOURCE_STATUSES, SOURCE_STATUS_LABELS } from "@/api/admin/types"
import { extractErrorMessage } from "@/api/admin/adminAxios"
import { useAdminMutations, useSourcesSafe } from "./adminHooks"

const EMPTY_SOURCE = {
  code: "",
  name: "",
  slug: "",
  base_url: "",
  jobs_url: "",
  color_hex: "#0f2d4d",
  short_code: "",
  priority: 100,
  supports_scraping: true,
  anti_scraping_level: 0,
  description: "",
  notes: "",
  is_primary: false,
}

/**
 * Page 6 — /admin/sources (super_admin).
 * GET/POST /referentials/sources · PUT /{id} · PATCH /{id}/status · DELETE /{id}.
 * Badge statut : active / paused / error / disabled · URL · anti-scraping 0–5 · priorité.
 */
export const SourcesPage = () => {
  const sourcesQuery = useSourcesSafe()
  const m = useAdminMutations()
  const sources = [...(sourcesQuery.data || [])].sort((a, b) => a.priority - b.priority)

  const [editing, setEditing] = useState(null) // source en cours d'édition
  const [draft, setDraft] = useState(EMPTY_SOURCE)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_SOURCE)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const openEdit = (source) => {
    setEditing(source.id)
    setDraft({
      code: source.code ?? "",
      name: source.name ?? "",
      slug: source.slug ?? "",
      base_url: source.base_url ?? "",
      jobs_url: source.jobs_url ?? "",
      color_hex: source.color_hex ?? "#0f2d4d",
      short_code: source.short_code ?? "",
      priority: source.priority ?? 100,
      supports_scraping: source.supports_scraping ?? true,
      anti_scraping_level: source.anti_scraping_level ?? 0,
      description: source.description ?? "",
      notes: source.notes ?? "",
      is_primary: source.is_primary ?? false,
    })
  }

  const handleSave = async () => {
    try {
      await m.updateSourceMutation.mutateAsync({ id: editing, data: draft })
      toast.success("Source mise à jour", draft.name)
      setEditing(null)
    } catch (error) {
      toast.error("Mise à jour impossible", extractErrorMessage(error))
    }
  }

  const handleStatus = async (source, status) => {
    if (status === source.status) return
    try {
      await m.updateSourceStatusMutation.mutateAsync({ id: source.id, status })
      toast.success("Statut modifié", `${source.name} → ${SOURCE_STATUS_LABELS[status]}`)
    } catch (error) {
      toast.error("Changement impossible", extractErrorMessage(error))
    }
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    try {
      const payload = {
        ...createForm,
        slug: createForm.slug || createForm.code.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      }
      await m.createSourceMutation.mutateAsync(payload)
      toast.success("Source créée", payload.name)
      setCreateOpen(false)
      setCreateForm(EMPTY_SOURCE)
    } catch (error) {
      toast.error("Création impossible", extractErrorMessage(error))
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await m.deleteSourceMutation.mutateAsync(deleteTarget.id)
      toast.success("Source supprimée", deleteTarget.name)
    } catch (error) {
      toast.error("Suppression impossible", extractErrorMessage(error))
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Sources de scraping"
        description="Sites collectés par les robots : URL, priorité, niveau anti-scraping et activation."
        crumbs={[{ label: "Accueil", to: "/admin" }, { label: "Sources" }]}
        actions={
          <button type="button" className="adm-btn-primary" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Nouvelle source
          </button>
        }
      />

      <div className="grid gap-3 md:grid-cols-2">
        {sourcesQuery.isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="adm-card p-4">
              <div className="adm-skeleton-line h-5 w-1/2" />
              <div className="adm-skeleton-line mt-3 h-4 w-3/4" />
            </div>
          ))}

        {!sourcesQuery.isLoading && sources.length === 0 && (
          <p className="adm-card col-span-full p-8 text-center text-sm text-muted-foreground">
            Aucune source configurée — ajoutez-en une pour démarrer la collecte.
          </p>
        )}

        {sources.map((source) => (
          <article key={source.id} className="adm-card p-4">
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-bold">{source.name}</h3>
                  <SourceStatusBadge status={source.status} />
                </div>
                <code className="mt-0.5 block text-[11px] text-muted-foreground">{source.code}</code>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <select
                  value={source.status}
                  onChange={(e) => handleStatus(source, e.target.value)}
                  className="adm-input h-8 w-auto max-w-32 text-xs"
                  aria-label={`Statut de ${source.name}`}
                >
                  {SOURCE_STATUSES.map((status) => (
                    <option key={status} value={status}>{SOURCE_STATUS_LABELS[status]}</option>
                  ))}
                </select>
                <button type="button" className="adm-btn-outline !h-8 px-2" onClick={() => (editing === source.id ? setEditing(null) : openEdit(source))} aria-label="Modifier">
                  <Pencil className="size-3.5" />
                </button>
              </div>
            </header>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
              <div className="col-span-2 flex min-w-0 items-center gap-1.5 sm:col-span-3">
                <dt className="shrink-0 font-semibold uppercase tracking-wide text-muted-foreground">URL</dt>
                <dd className="truncate">
                  <a href={source.base_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    {source.base_url}
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 sm:block">
                <dt className="font-semibold uppercase tracking-wide text-muted-foreground">Priorité</dt>
                <dd className="tabular-nums">{source.priority}</dd>
              </div>
              <div className="flex items-center justify-between gap-2 sm:block">
                <dt className="font-semibold uppercase tracking-wide text-muted-foreground">Scan</dt>
                <dd>{source.default_scan_time ?? "—"}</dd>
              </div>
            </dl>

            {/* Niveau anti-scraping (points visuels) */}
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              <span className="font-semibold uppercase tracking-wide text-muted-foreground">Anti-scraping</span>
              <span className="inline-flex items-center gap-0.5" title={`Niveau ${source.anti_scraping_level}/5`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className={`size-2 rounded-full ${i < (source.anti_scraping_level || 0) ? "bg-error" : "bg-surface-container-high"}`}
                  />
                ))}
              </span>
              <span className="tabular-nums text-muted-foreground">{source.anti_scraping_level}/5</span>
            </div>

            {/* Formulaire d'édition inline */}
            {editing === source.id && (
              <div className="mt-4 grid gap-3 border-t border-border pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="adm-label">Nom</label>
                    <input className="adm-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="adm-label">Priorité</label>
                    <input type="number" min={0} className="adm-input" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="adm-label">URL de base</label>
                    <input type="url" className="adm-input" value={draft.base_url} onChange={(e) => setDraft({ ...draft, base_url: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="adm-label">URL des offres (jobs)</label>
                    <input type="url" className="adm-input" value={draft.jobs_url ?? ""} onChange={(e) => setDraft({ ...draft, jobs_url: e.target.value })} />
                  </div>
                  <div>
                    <label className="adm-label">Anti-scraping (0–5)</label>
                    <input
                      type="number" min={0} max={5}
                      className="adm-input"
                      value={draft.anti_scraping_level}
                      onChange={(e) => setDraft({ ...draft, anti_scraping_level: Math.min(5, Math.max(0, Number(e.target.value))) })}
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.supports_scraping}
                        onChange={(e) => setDraft({ ...draft, supports_scraping: e.target.checked })}
                        className="size-4 accent-[var(--primary)]"
                      />
                      Scraping supporté
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" className="adm-btn-outline adm-btn-sm" onClick={() => setEditing(null)}>Annuler</button>
                  <button type="button" className="adm-btn-primary adm-btn-sm" onClick={handleSave} disabled={m.updateSourceMutation.isPending}>
                    {m.updateSourceMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
                    Enregistrer
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>

      {/* Formulaire création source */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" onClick={() => setCreateOpen(false)}>
          <form className="adm-card w-full max-w-md p-6 shadow-hover" onSubmit={handleCreate} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading text-base font-bold">Nouvelle source de scraping</h3>
            <div className="mt-4 grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="src-name" className="adm-label">Nom *</label>
                  <input id="src-name" required minLength={2} className="adm-input" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="Ex : Emploi CI Pro" />
                </div>
                <div>
                  <label htmlFor="src-code" className="adm-label">Code *</label>
                  <input id="src-code" required minLength={2} className="adm-input font-mono text-xs" value={createForm.code} onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })} placeholder="emploici-pro" />
                </div>
              </div>
              <div>
                <label htmlFor="src-url" className="adm-label">URL de base *</label>
                <input id="src-url" required type="url" minLength={5} className="adm-input" value={createForm.base_url} onChange={(e) => setCreateForm({ ...createForm, base_url: e.target.value })} placeholder="https://…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="src-priority" className="adm-label">Priorité</label>
                  <input id="src-priority" type="number" min={0} className="adm-input" value={createForm.priority} onChange={(e) => setCreateForm({ ...createForm, priority: Number(e.target.value) })} />
                </div>
                <div>
                  <label htmlFor="src-anti" className="adm-label">Anti-scraping (0–5)</label>
                  <input id="src-anti" type="number" min={0} max={5} className="adm-input" value={createForm.anti_scraping_level} onChange={(e) => setCreateForm({ ...createForm, anti_scraping_level: Number(e.target.value) })} />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="adm-btn-outline" onClick={() => setCreateOpen(false)}>Annuler</button>
              <button type="submit" className="adm-btn-primary" disabled={m.createSourceMutation.isPending}>
                {m.createSourceMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Créer la source
              </button>
            </div>
          </form>
        </div>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldAlert className="size-3.5" />
        Le niveau anti-scraping module le rythme de collecte (délais, rotation d'entêtes). 5 = site très protégé.
      </p>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={m.deleteSourceMutation.isPending}
        tone="danger"
        title={`Supprimer « ${deleteTarget?.name ?? ""} » ?`}
        message="Suppression physique du référentiel. Les offres déjà collectées depuis cette source sont conservées."
        confirmText="Supprimer"
      />
    </>
  )
}




