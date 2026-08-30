import { useState } from "react"
import { Link } from "react-router-dom"
import { Activity, Bot, Clock3, Eye, Play, RefreshCw, Timer } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "../components/PageHeader"
import { DataTable } from "../components/DataTable"
import { ConfirmDialog } from "../components/ConfirmDialog"
import { GenericStatusBadge } from "../components/StatusBadge"
import { extractErrorMessage } from "@/api/admin/adminAxios"
import { useAdminMutations, useScrapeRunsSafe, useScrapingStatusSafe } from "./adminHooks"

const formatDuration = (ms) => {
  if (ms === null || ms === undefined) return "—"
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

/**
 * Page 12 — /admin/scraping (super_admin).
 * GET /scraping/status (cartes par source : dernier passage, durée, erreur) ·
 * POST /scraping/trigger (toutes / une source — run pending → « en cours » + polling)
 * · GET /scraping/runs.
 */
export const ScrapingPage = () => {
  const statusQuery = useScrapingStatusSafe(10000)
  const [runsParams, setRunsParams] = useState({ limit: 20, offset: 0 })
  const runsQuery = useScrapeRunsSafe({ ...runsParams, poll: true })
  const m = useAdminMutations()

  const statuses = statusQuery.data || []
  const runs = runsQuery.data || []

  const [confirmSource, setConfirmSource] = useState(undefined) // null = tout, string = une source

  const handleTrigger = async () => {
    try {
      await m.triggerScrapeMutation.mutateAsync({
        source_code: confirmSource,
        notes: confirmSource ? `Collecte manuelle de ${confirmSource}` : "Collecte manuelle toutes sources",
      })
      toast.success(
        "Collecte déclenchée",
        confirmSource ? `Run créé pour ${confirmSource} — exécution asynchrone.` : "Run créé pour toutes les sources actives."
      )
    } catch (error) {
      toast.error("Déclenchement impossible", extractErrorMessage(error))
    } finally {
      setConfirmSource(undefined)
    }
  }

  const columns = [
    {
      key: "run_date",
      header: "Date du run",
      render: (run) => (
        <Link to={`/admin/scraping/runs/${run.id}`} className="text-sm font-semibold text-primary hover:underline">
          {run.run_date}
        </Link>
      ),
    },
    { key: "status", header: "Statut", render: (run) => <GenericStatusBadge status={run.status} /> },
    {
      key: "started_at",
      header: "Démarré à",
      className: "hidden md:table-cell whitespace-nowrap",
      render: (run) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {run.started_at ? new Date(run.started_at).toLocaleTimeString("fr-FR") : "—"}
        </span>
      ),
    },
    { key: "total_raw", header: "Brutes", className: "text-right tabular-nums" },
    { key: "total_inserted", header: "Insérées", className: "text-right tabular-nums font-semibold text-emerald-600" },
    { key: "total_updated", header: "MàJ", className: "hidden sm:table-cell text-right tabular-nums" },
    { key: "total_duplicates", header: "Doublons", className: "hidden sm:table-cell text-right tabular-nums text-muted-foreground" },
    { key: "total_errors", header: "Erreurs", className: "text-right tabular-nums text-destructive" },
    {
      key: "triggered_by",
      header: "Déclenché par",
      className: "hidden lg:table-cell",
      render: (run) => <code className="text-[11px] text-muted-foreground">{run.triggered_by}</code>,
    },
  ]

  /* Menu contextuel de ligne — détail du run & relance (mobile & desktop) */
  const rowActions = (run) => [
    { key: "detail", label: "Voir le détail du run", icon: Eye, to: `/admin/scraping/runs/${run.id}` },
    { key: "sep-1", separator: true },
    {
      key: "rerun",
      label: "Relancer une collecte",
      icon: RefreshCw,
      disabled: m.triggerScrapeMutation.isPending,
      onClick: () => setConfirmSource(null),
    },
  ]

  return (
    <>
      <PageHeader
        title="Pilotage du scraping"
        description="État des collectes par source et historique complet des runs."
        crumbs={[{ label: "Accueil", to: "/admin" }, { label: "Scraping" }]}
        actions={
          <button type="button" className="adm-btn-primary" onClick={() => setConfirmSource(null)}>
            <Play className="size-4" /> Lancer toutes les sources
          </button>
        }
      />

      {/* Cartes par source */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statusQuery.isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="adm-card p-4">
              <div className="adm-skeleton-line h-5 w-1/2" />
              <div className="adm-skeleton-line mt-3 h-10 w-full" />
            </div>
          ))}

        {!statusQuery.isLoading && statuses.length === 0 && (
          <p className="adm-card col-span-full p-6 text-center text-sm text-muted-foreground">
            Aucune source configurée — ajoutez-en dans la page Sources.
          </p>
        )}

        {statuses.map((source) => {
          const isRunning = ["pending", "running"].includes(source.last_status)
          return (
            <article key={source.source_code} className="adm-card flex flex-col p-4">
              <header className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold">{source.source_name}</h3>
                  <code className="text-[11px] text-muted-foreground">{source.source_code}</code>
                </div>
                {source.last_status && <GenericStatusBadge status={source.last_status} />}
              </header>

              <dl className="mt-3 flex flex-1 flex-col gap-1.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <Clock3 className="size-3.5 shrink-0 text-muted-foreground" />
                  <dt className="text-muted-foreground">Dernier passage :</dt>
                  <dd className="ml-auto font-medium">
                    {source.last_run_at
                      ? new Date(source.last_run_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
                      : "—"}
                  </dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <Timer className="size-3.5 shrink-0 text-muted-foreground" />
                  <dt className="text-muted-foreground">Durée :</dt>
                  <dd className="ml-auto font-medium tabular-nums">{formatDuration(source.last_duration_ms)}</dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <Activity className="size-3.5 shrink-0 text-muted-foreground" />
                  <dt className="text-muted-foreground">Total runs :</dt>
                  <dd className="ml-auto font-medium tabular-nums">{source.total_runs.toLocaleString("fr-FR")}</dd>
                </div>
                {source.last_error && (
                  <p className="mt-1 rounded-md bg-error-container px-2 py-1.5 text-[11px] leading-snug text-on-error-container">
                    {source.last_error}
                  </p>
                )}
              </dl>

              <button
                type="button"
                className="adm-btn-outline adm-btn-sm mt-3 w-full"
                onClick={() => setConfirmSource(source.source_code)}
                disabled={isRunning}
              >
                {isRunning ? <RefreshCw className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                {isRunning ? "En cours…" : "Lancer cette source"}
              </button>
            </article>
          )
        })}
      </section>

      {/* Table des runs */}
      <h2 className="mb-3 mt-8 flex items-center gap-2 text-base font-bold">
        <Bot className="size-4" /> Historique des runs
      </h2>
      <DataTable
        columns={columns}
        rows={runs}
        loading={runsQuery.isLoading}
        error={runsQuery.error}
        onRetry={() => runsQuery.refetch()}
        emptyLabel="Aucun run enregistré"
        emptyHint="Lancez une première collecte pour alimenter l'historique."
        limit={runsParams.limit}
        offset={runsParams.offset}
        onOffsetChange={(offset) => setRunsParams((p) => ({ ...p, offset }))}
        rowActions={rowActions}
      />

      {/* Confirmation déclenchement */}
      <ConfirmDialog
        open={confirmSource !== undefined}
        onClose={() => setConfirmSource(undefined)}
        onConfirm={handleTrigger}
        loading={m.triggerScrapeMutation.isPending}
        title={confirmSource ? `Lancer une collecte de « ${confirmSource} » ?` : "Lancer une collecte toutes sources ?"}
        message="Un run est créé en file d'attente (statut pending) puis traité de façon asynchrone par les robots. L'historique se met à jour automatiquement (polling)."
        confirmText="Démarrer"
      />
    </>
  )
}


