import { useMemo, useState } from "react"
import { ChevronRight, FileJson } from "lucide-react"
import { PageHeader } from "../components/PageHeader"
import { DataTable } from "../components/DataTable"
import { StatusBadge } from "../components/StatusBadge"
import { JsonPanel } from "../components/JsonPanel"
import { ADMIN_ACTION_LABELS, ADMIN_ACTIONS } from "@/api/admin/types"
import { useAdminsSafe, useAuditLogsSafe } from "./adminHooks"

const ACTION_TONES = {
  creation: "active",
  modification: "info",
  suppression: "error",
  envoi: "success",
  connexion: "neutral",
  scraping: "pending",
}

/**
 * Page 4 — /admin/journal (super_admin).
 * GET /logs/audit — filtres admin_id / action / target_table, ordre chronologique,
 * panneau JSON `details`. Filtre action limité aux 6 valeurs du vocabulaire.
 */
export const AuditLogPage = () => {
  const [actionFilter, setActionFilter] = useState("")
  const [adminFilter, setAdminFilter] = useState("")
  const [tableFilter, setTableFilter] = useState("")
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState(null)
  const LIMIT = 25

  const params = useMemo(
    () => ({
      action: actionFilter || undefined,
      admin_id: adminFilter || undefined,
      target_table: tableFilter || undefined,
      limit: LIMIT,
      offset,
    }),
    [actionFilter, adminFilter, tableFilter, offset]
  )

  const logsQuery = useAuditLogsSafe(params)
  const adminsQuery = useAdminsSafe({ limit: 200 })
  const admins = adminsQuery.data || []
  const rows = logsQuery.data || []
  const adminName = (id) => admins.find((a) => a.id === id)?.full_name ?? id

  const columns = [
    {
      key: "created_at",
      header: "Horodatage",
      className: "whitespace-nowrap",
      render: (log) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {new Date(log.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" })}
        </span>
      ),
    },
    {
      key: "admin_id",
      header: "Administrateur",
      className: "hidden md:table-cell",
      render: (log) => <span className="text-sm font-medium">{adminName(log.admin_id)}</span>,
    },
    {
      key: "action",
      header: "Action",
      render: (log) => (
        <StatusBadge
          status={log.action}
          tone={ACTION_TONES[log.action] || "neutral"}
          label={ADMIN_ACTION_LABELS[log.action] ?? log.action}
        />
      ),
    },
    {
      key: "target_table",
      header: "Cible",
      render: (log) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{log.target_table}</p>
          {log.target_id && <p className="truncate font-mono text-[11px] text-muted-foreground">{log.target_id}</p>}
        </div>
      ),
    },
    {
      key: "details",
      header: "",
      className: "w-8 text-right",
      render: (log) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setSelected(log.id === selected ? null : log.id)
          }}
          aria-label="Afficher le détail JSON"
          className={`rounded p-1 transition-transform ${
            selected === log.id ? "rotate-90 text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ChevronRight className="size-4" />
        </button>
      ),
    },
  ]

  /* Menu contextuel de ligne — accès au détail JSON sur toute la ligne (mobile friendly) */
  const rowActions = (log) => [
    {
      key: "details",
      label: "Voir le détail JSON",
      icon: FileJson,
      onClick: () => setSelected(log.id === selected ? null : log.id),
    },
  ]

  const selectedEntry = rows.find((r) => r.id === selected)

  return (
    <>
      <PageHeader
        title="Journal d'activité"
        description="Historique chronologique de toutes les actions administrateur (audit)."
        crumbs={[{ label: "Accueil", to: "/admin" }, { label: "Journal d'activité" }]}
      />

      {/* Filtres */}
      <section className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setOffset(0) }}
          className="adm-input w-auto"
          aria-label="Filtrer par action"
        >
          <option value="">Toutes les actions</option>
          {ADMIN_ACTIONS.map((action) => (
            <option key={action} value={action}>{ADMIN_ACTION_LABELS[action]}</option>
          ))}
        </select>

        <select
          value={adminFilter}
          onChange={(e) => { setAdminFilter(e.target.value); setOffset(0) }}
          className="adm-input w-auto max-w-56"
          aria-label="Filtrer par administrateur"
        >
          <option value="">Tous les administrateurs</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>{a.full_name}</option>
          ))}
        </select>

        <select
          value={tableFilter}
          onChange={(e) => { setTableFilter(e.target.value); setOffset(0) }}
          className="adm-input w-auto"
          aria-label="Filtrer par table cible"
        >
          <option value="">Toutes les tables</option>
          {[...new Set(rows.map((r) => r.target_table))].filter(Boolean).map((table) => (
            <option key={table} value={table}>{table}</option>
          ))}
        </select>
      </section>

      {/* Panneau détail de l'entrée sélectionnée */}
      {selectedEntry && (
        <div className="adm-card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge
                status={selectedEntry.action}
                tone={ACTION_TONES[selectedEntry.action] || "neutral"}
                label={ADMIN_ACTION_LABELS[selectedEntry.action] ?? selectedEntry.action}
              />
              <span className="font-semibold">{adminName(selectedEntry.admin_id)}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(selectedEntry.created_at).toLocaleString("fr-FR")}
              </span>
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
              <div className="flex justify-between gap-2 sm:block">
                <dt className="font-semibold uppercase tracking-wide text-muted-foreground">Table</dt>
                <dd className="font-mono">{selectedEntry.target_table}</dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="font-semibold uppercase tracking-wide text-muted-foreground">Cible</dt>
                <dd className="font-mono">{selectedEntry.target_id ?? "—"}</dd>
              </div>
            </dl>
          </div>
          <JsonPanel data={selectedEntry.details} label="Contenu details (JSON)" />
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        loading={logsQuery.isLoading}
        error={logsQuery.error}
        onRetry={() => logsQuery.refetch()}
        emptyLabel="Aucune entrée d'audit"
        emptyHint="Les actions des administrateurs apparaîtront ici."
        limit={LIMIT}
        offset={offset}
        onOffsetChange={setOffset}
        rowActions={rowActions}
        compact
      />
    </>
  )
}

