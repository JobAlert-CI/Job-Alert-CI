import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react"
import { PageHeader } from "../components/PageHeader"
import { GenericStatusBadge } from "../components/StatusBadge"
import { EmptyState } from "../components/EmptyState"
import { LOG_LEVELS } from "@/api/admin/types"
import { useRunDetailSafe, useRunLogsSafe } from "./adminHooks"

const LEVEL_STYLES = {
  info: "bg-[var(--adm-st-info-bg)] text-[var(--adm-st-info)]",
  warning: "bg-[var(--adm-st-warning-bg)] text-[var(--adm-st-warning)]",
  error: "bg-[var(--adm-st-error-bg)] text-[var(--adm-st-error)]",
}

/**
 * Page 13 — /admin/scraping/runs/:id (super_admin).
 * Stats (total_raw, inserted, updated, duplicates, errors) + table par source
 * + logs filtrables (info / warning / error).
 */
export const RunDetailPage = () => {
  const { id } = useParams()
  const runQuery = useRunDetailSafe(id)
  const logsQuery = useRunLogsSafe(id)
  const [levelFilter, setLevelFilter] = useState("")

  const run = runQuery.data
  const allLogs = useMemo(() => logsQuery.data || [], [logsQuery.data])
  const logs = levelFilter ? allLogs.filter((log) => log.niveau === levelFilter) : allLogs

  if (runQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" /> Chargement du run…
      </div>
    )
  }

  if (!run) {
    return (
      <div className="adm-card p-10 text-center">
        <p className="text-sm font-semibold">Run introuvable.</p>
        <Link to="/admin/scraping" className="adm-btn-outline adm-btn-sm mt-4 inline-flex">← Retour au scraping</Link>
      </div>
    )
  }

  const stats = [
    { label: "Offres brutes", value: run.total_raw },
    { label: "Insérées", value: run.total_inserted, tone: "text-emerald-600" },
    { label: "Mises à jour", value: run.total_updated },
    { label: "Doublons", value: run.total_duplicates },
    { label: "Erreurs", value: run.total_errors, tone: "text-destructive" },
  ]

  return (
    <>
      <PageHeader
        title={`Run du ${run.run_date}`}
        description={`Déclenché par ${run.triggered_by}${run.notes ? ` · « ${run.notes} »` : ""}`}
        crumbs={[
          { label: "Accueil", to: "/admin" },
          { label: "Scraping", to: "/admin/scraping" },
          { label: run.id.slice(0, 14) + "…" },
        ]}
        actions={
          <Link to="/admin/scraping" className="adm-btn-outline">
            <ArrowLeft className="size-4" /> Retour
          </Link>
        }
      />

      {/* Bandeau statut + timing */}
      <div className="adm-card mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
        <GenericStatusBadge status={run.status} />
        <span className="text-xs text-muted-foreground">
          Démarré : <strong className="text-foreground">{run.started_at ? new Date(run.started_at).toLocaleString("fr-FR") : "—"}</strong>
        </span>
        <span className="text-xs text-muted-foreground">
          Terminé : <strong className="text-foreground">{run.finished_at ? new Date(run.finished_at).toLocaleString("fr-FR") : "en cours…"}</strong>
        </span>
      </div>

      {/* Stats agrégées */}
      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="adm-card p-4 text-center">
            <p className={`font-heading text-2xl font-extrabold tabular-nums ${stat.tone ?? ""}`}>
              {stat.value.toLocaleString("fr-FR")}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Table par source */}
        <section className="adm-card overflow-hidden">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-bold">Résultats par source ({run.source_runs?.length ?? 0})</h2>
          </header>
          {(run.source_runs?.length ?? 0) === 0 ? (
            <EmptyState title="Aucune source rattachée à ce run" />
          ) : (
            <div className="overflow-x-auto">
              <table className="adm-table adm-table--compact">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Statut</th>
                    <th className="text-right">Brutes</th>
                    <th className="text-right">Insérées</th>
                    <th className="hidden sm:table-cell text-right">Doublons</th>
                    <th className="text-right">Erreurs</th>
                  </tr>
                </thead>
                <tbody>
                  {run.source_runs.map((sourceRun) => (
                    <tr key={sourceRun.id}>
                      <td className="max-w-28 truncate font-medium">{sourceRun.source_id}</td>
                      <td><GenericStatusBadge status={sourceRun.status} /></td>
                      <td className="text-right tabular-nums">{sourceRun.raw_count}</td>
                      <td className="text-right tabular-nums font-semibold">{sourceRun.inserted_count}</td>
                      <td className="hidden sm:table-cell text-right tabular-nums text-muted-foreground">{sourceRun.duplicate_count}</td>
                      <td className="text-right tabular-nums text-destructive">{sourceRun.error_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Logs filtrables */}
        <section className="adm-card flex flex-col overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-1.5 text-sm font-bold">
              <AlertTriangle className="size-3.5" /> Logs d'ingestion ({logs.length})
            </h2>
            <div className="flex gap-1" role="group" aria-label="Filtrer les logs par niveau">
              {LOG_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  data-active={levelFilter === level}
                  className="adm-tab !px-2.5 !py-1 text-xs capitalize"
                  onClick={() => setLevelFilter(level === levelFilter ? "" : level)}
                >
                  {level}
                </button>
              ))}
              <button type="button" data-active={!levelFilter} className="adm-tab !px-2.5 !py-1 text-xs" onClick={() => setLevelFilter("")}>
                Tous
              </button>
            </div>
          </header>

          {logs.length === 0 ? (
            <EmptyState title="Aucun log pour ce filtre" description="Les événements apparaissent pendant l'ingestion des offres." />
          ) : (
            <ul className="max-h-[480px] divide-y divide-border/70 overflow-y-auto">
              {logs.map((log) => (
                <li key={log.id} className="flex items-start gap-3 px-4 py-2.5">
                  <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${LEVEL_STYLES[log.niveau] || LEVEL_STYLES.info}`}>
                    {log.niveau}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-xs leading-relaxed">{log.message ?? "(sans message)"}</p>
                    {log.raw_url && (
                      <a href={log.raw_url} target="_blank" rel="noreferrer" className="block truncate text-[11px] text-primary hover:underline">
                        {log.raw_url}
                      </a>
                    )}
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      action : {log.action} · {new Date(log.created_at).toLocaleTimeString("fr-FR")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}


