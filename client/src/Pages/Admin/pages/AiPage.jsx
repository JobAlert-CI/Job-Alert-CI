import { useState } from "react"
import { CheckCircle2, Cpu, Loader2, Play, Plus, ShieldQuestion, Trash2, Zap } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "../components/PageHeader"
import { ConfirmDialog } from "../components/ConfirmDialog"
import { StatusBadge } from "../components/StatusBadge"
import { extractErrorMessage } from "@/api/admin/adminAxios"
import {
  useAdminMutations,
  useAiAlertsSafe,
  useAiJobsSafe,
  useAiKeysSafe,
} from "./adminHooks"

/**
 * Page 18 — /admin/ia (super_admin) — ⚠ décision produit préalable.
 * GET/POST/PATCH/DELETE /ai/keys · POST /keys/{id}/test · GET /ai/jobs ·
 * GET /ai/alerts (avec accusé de réception) · POST /ai/run.
 * Le backend n'expose pas encore ces routes : mode démo + bandeau d'avertissement.
 */
export const AiPage = () => {
  const keysQuery = useAiKeysSafe()
  const jobsQuery = useAiJobsSafe({ limit: 15 })
  const alertsQuery = useAiAlertsSafe()
  const m = useAdminMutations()

  const keys = keysQuery.data || []
  const jobs = jobsQuery.data || []
  const alerts = (alertsQuery.data || []).filter((a) => !a.acknowledged)

  const [createOpen, setCreateOpen] = useState(false)
  const [newKey, setNewKey] = useState({ provider: "openai", label: "", priority: 1 })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [testingId, setTestingId] = useState(null)
  const [runOpen, setRunOpen] = useState(false)

  const handleCreate = async (event) => {
    event.preventDefault()
    try {
      await m.aiKeyMutations.create.mutateAsync(newKey)
      toast.success("Clé ajoutée", newKey.label || newKey.provider)
      setCreateOpen(false)
    } catch (error) {
      toast.error("Création impossible", extractErrorMessage(error))
    }
  }

  const handleTest = async (key) => {
    setTestingId(key.id)
    try {
      const result = await m.aiKeyMutations.test.mutateAsync(key.id)
      toast.success(
        "Connexion réussie",
        `${key.provider} — latence ${result.latency_ms ?? "?"} ms${result.model ? ` · modèle ${result.model}` : ""}`
      )
    } catch (error) {
      toast.error("Test échoué", extractErrorMessage(error))
    } finally {
      setTestingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await m.aiKeyMutations.remove.mutateAsync(deleteTarget.id)
      toast.success("Clé supprimée", deleteTarget.label ?? deleteTarget.provider)
    } catch (error) {
      toast.error("Suppression impossible", extractErrorMessage(error))
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleRun = async () => {
    try {
      await m.runAiJobMutation.mutateAsync({ job_type: "normalize_offers" })
      toast.success("Job lancé", "La normalisation IA est en file de traitement.")
    } catch (error) {
      toast.error("Lancement impossible", extractErrorMessage(error))
    }
  }

  const handleAck = async (alert) => {
    try {
      await m.ackAiAlertMutation.mutateAsync(alert.id)
      toast.success("Alerte acquittée")
    } catch (error) {
      toast.error("Acquittement impossible", extractErrorMessage(error))
    }
  }

  return (
    <>
      <PageHeader
        title="Normalisation IA"
        description="Clés fournisseurs, jobs de normalisation des offres et alertes de quota."
        crumbs={[{ label: "Accueil", to: "/admin" }, { label: "Normalisation IA" }]}
        actions={
          <>
            <button type="button" className="adm-btn-outline" onClick={() => setRunOpen(true)}>
              <Play className="size-4" /> Lancer un job
            </button>
            <button type="button" className="adm-btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Ajouter une clé
            </button>
          </>
        }
      />

      {/* Bandeau décision produit */}
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-dashed border-[var(--adm-st-pending)] bg-[var(--adm-st-pending-bg)] px-4 py-3">
        <ShieldQuestion className="mt-0.5 size-5 shrink-0 text-[var(--adm-st-pending)]" />
        <p className="text-xs leading-relaxed text-on-surface">
          <strong>Page à valider par le Product Owner.</strong> Les routes <code>/ai/*</code> ne sont pas encore exposées
          par le backend : les données affichées proviennent du mode démonstration — n'insérez pas de clé réelle.
        </p>
      </div>

      {/* Alertes non acquittées */}
      {alerts.length > 0 && (
        <section aria-label="Alertes IA" className="mb-5 flex flex-col gap-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm ${
                alert.severity === "error" ? "border-destructive/40 bg-error-container/60" : "border-border bg-surface-container-low"
              }`}
            >
              <Zap className={`size-4 shrink-0 ${alert.severity === "error" ? "text-destructive" : "text-[var(--adm-st-warning)]"}`} />
              <span className="min-w-0 flex-1 truncate">{alert.message}</span>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                {new Date(alert.created_at).toLocaleDateString("fr-FR")}
              </span>
              <button type="button" className="adm-btn-outline adm-btn-sm shrink-0" onClick={() => handleAck(alert)}>
                <CheckCircle2 className="size-3.5" /> Accuser réception
              </button>
            </div>
          ))}
        </section>
      )}

      {/* Clés API */}
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <section className="adm-card overflow-hidden">
          <header className="border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-1.5 text-sm font-bold">
              <Cpu className="size-4" /> Clés API ({keys.length})
            </h2>
          </header>
          {keysQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="adm-skeleton-line h-10 w-full" />
              ))}
            </div>
          ) : keys.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">Aucune clé configurée.</p>
          ) : (
            <ul className="divide-y divide-border/70">
              {keys.map((key) => (
                <li key={key.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{key.label ?? key.provider}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {key.api_key_masked} · priorité {key.priority}
                    </p>
                  </div>
                  <StatusBadge status={key.is_active ? "active" : "inactive"} label={key.is_active ? "Active" : "Inactive"} />
                  <div className="flex items-center gap-1.5">
                    <button type="button" className="adm-btn-outline adm-btn-sm" onClick={() => handleTest(key)} disabled={testingId === key.id}>
                      {testingId === key.id ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                      Tester
                    </button>
                    <button type="button" className="adm-btn-danger !h-8 px-2" onClick={() => setDeleteTarget(key)} aria-label={`Supprimer ${key.label ?? key.provider}`}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Historique des jobs */}
        <section className="adm-card overflow-hidden">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-bold">Historique des jobs</h2>
          </header>
          {jobsQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="adm-skeleton-line h-8 w-full" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">Aucun job enregistré.</p>
          ) : (
            <ul className="divide-y divide-border/70">
              {jobs.map((job) => (
                <li key={job.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs font-semibold">{job.job_type}</code>
                    <StatusBadge status={job.status === "success" ? "success" : job.status === "failed" ? "error" : "pending"} />
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {new Date(job.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    {" · "}
                    {job.items_processed} offres
                    {job.tokens_used ? ` · ${job.tokens_used.toLocaleString("fr-FR")} tokens` : ""}
                  </p>
                  {job.error_message && (
                    <p className="mt-1 rounded bg-error-container px-2 py-1 text-[11px] leading-snug text-on-error-container">
                      {job.error_message}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Formulaire ajout clé */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" onClick={() => setCreateOpen(false)}>
          <form className="adm-card w-full max-w-md p-6 shadow-hover" onSubmit={handleCreate} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading text-base font-bold">Nouvelle clé API</h3>
            <div className="mt-4 grid gap-3">
              <div>
                <label htmlFor="ai-provider" className="adm-label">Fournisseur *</label>
                <select id="ai-provider" className="adm-input" value={newKey.provider} onChange={(e) => setNewKey({ ...newKey, provider: e.target.value })}>
                  <option value="openai">OpenAI</option>
                  <option value="mistral">Mistral</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="groq">Groq</option>
                </select>
              </div>
              <div>
                <label htmlFor="ai-label" className="adm-label">Libellé</label>
                <input id="ai-label" className="adm-input" value={newKey.label} onChange={(e) => setNewKey({ ...newKey, label: e.target.value })} placeholder="Ex : OpenAI — production" />
              </div>
              <div>
                <label htmlFor="ai-priority" className="adm-label">Priorité (fallback)</label>
                <input id="ai-priority" type="number" min={1} className="adm-input" value={newKey.priority} onChange={(e) => setNewKey({ ...newKey, priority: Number(e.target.value) })} />
              </div>
              <div>
                <label htmlFor="ai-secret" className="adm-label">Clé secrète *</label>
                <input id="ai-secret" required type="password" minLength={8} className="adm-input font-mono text-xs" placeholder="sk-…" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="adm-btn-outline" onClick={() => setCreateOpen(false)}>Annuler</button>
              <button type="submit" className="adm-btn-primary" disabled={m.aiKeyMutations.create.isPending}>Ajouter</button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmations */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={m.aiKeyMutations.remove.isPending}
        tone="danger"
        title={`Supprimer la clé « ${deleteTarget?.label ?? deleteTarget?.provider ?? ""} » ?`}
        message="Les jobs en cours basculeront automatiquement sur la clé de priorité suivante."
        confirmText="Supprimer"
      />
      <ConfirmDialog
        open={runOpen}
        onClose={() => setRunOpen(false)}
        onConfirm={handleRun}
        loading={m.runAiJobMutation.isPending}
        title="Lancer un job de normalisation IA ?"
        message="Les offres récemment collectées sans normalisation complète seront retraitées. L'opération consomme des tokens sur la clé active."
        confirmText="Lancer le job"
      />
    </>
  )
}

