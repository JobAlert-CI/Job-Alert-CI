import { useMemo, useState } from "react"
import { Eye, Search } from "lucide-react"
import { PageHeader } from "../components/PageHeader"
import { DataTable } from "../components/DataTable"
import { GenericStatusBadge } from "../components/StatusBadge"
import { SUBSCRIBER_STATUSES, SUBSCRIBER_STATUS_LABELS } from "@/api/admin/types"
import { useFilieresSafe, useSubscribersSafe } from "./adminHooks"

/**
 * Page 10 — /admin/utilisateurs (super_admin + gestionnaire_utilisateurs).
 * GET /subscribers : filtres q · status · filiere_id.
 * Statuts API : active, unsubscribed, bouncing (alias), paused, pending, deleted.
 */
export const UsersListPage = () => {
  const [q, setQ] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [filiereId, setFiliereId] = useState("")
  const [offset, setOffset] = useState(0)
  const LIMIT = 20

  const params = useMemo(
    () => ({
      q: q || undefined,
      status: statusFilter || undefined,
      filiere_id: filiereId || undefined,
      limit: LIMIT,
      offset,
    }),
    [q, statusFilter, filiereId, offset]
  )

  const subscribersQuery = useSubscribersSafe(params)
  const filieresQuery = useFilieresSafe()
  const rows = subscribersQuery.data || []
  const filieres = filieresQuery.data || []

  /* Libellé de filière depuis l'ID stocké dans filiere_links */
  const filiereLabel = (filiereIdOrCode) =>
    filieres.find((f) => f.id === filiereIdOrCode || f.code === filiereIdOrCode)?.label ?? filiereIdOrCode

  const columns = [
    {
      key: "email",
      header: "Abonné",
      render: (sub) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{sub.full_name ?? "—"}</p>
          <p className="truncate text-xs text-muted-foreground">{sub.email}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Statut",
      render: (sub) => <GenericStatusBadge status={sub.status} labels={SUBSCRIBER_STATUS_LABELS} />,
    },
    {
      key: "filieres",
      header: "Filières",
      className: "hidden lg:table-cell",
      render: (sub) => (
        <span className="flex flex-wrap gap-1">
          {(sub.filiere_links ?? []).slice(0, 3).map((link) => (
            <span key={link.id} className="rounded bg-surface-container px-1.5 py-0.5 text-[11px] font-medium">
              {filiereLabel(link.filiere_id)}
            </span>
          ))}
          {(sub.filiere_links?.length ?? 0) === 0 && <span className="text-xs text-muted-foreground">—</span>}
        </span>
      ),
    },
    {
      key: "wants_career_tips",
      header: "Conseils",
      className: "hidden md:table-cell",
      render: (sub) => (
        <span className={`text-xs font-semibold ${sub.wants_career_tips ? "text-emerald-600" : "text-muted-foreground"}`}>
          {sub.wants_career_tips ? "Oui" : "Non"}
        </span>
      ),
    },
    {
      key: "subscribed_at",
      header: "Inscrit le",
      className: "hidden md:table-cell whitespace-nowrap",
      render: (sub) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {new Date(sub.subscribed_at).toLocaleDateString("fr-FR")}
        </span>
      ),
    },
  ]

  /* Menu contextuel de ligne — la fiche détaillée est accessible par la ligne ou le « ⋯ » */
  const rowActions = (sub) => [
    { key: "view", label: "Voir la fiche détaillée", icon: Eye, to: `/admin/utilisateurs/${sub.id}` },
  ]

  return (
    <>
      <PageHeader
        title="Utilisateurs"
        description="Abonnés aux alertes email : statuts, filières et historique d'envoi."
        crumbs={[{ label: "Accueil", to: "/admin" }, { label: "Utilisateurs" }]}
      />

      {/* Filtres */}
      <section className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setOffset(0) }}
            placeholder="Rechercher un email ou un nom…"
            className="adm-input pl-9"
          />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setOffset(0) }} className="adm-input w-auto">
          <option value="">Tous les statuts</option>
          {SUBSCRIBER_STATUSES.map((s) => (
            <option key={s} value={s}>{SUBSCRIBER_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select value={filiereId} onChange={(e) => { setFiliereId(e.target.value); setOffset(0) }} className="adm-input w-auto max-w-48">
          <option value="">Toutes les filières</option>
          {filieres.map((f) => (
            <option key={f.id} value={f.code}>{f.label}</option>
          ))}
        </select>
      </section>

      <DataTable
        columns={columns}
        rows={rows}
        rowActions={rowActions}
        loading={subscribersQuery.isLoading}
        error={subscribersQuery.error}
        onRetry={() => subscribersQuery.refetch()}
        emptyLabel="Aucun abonné trouvé"
        emptyHint="Ajustez les filtres de recherche."
        limit={LIMIT}
        offset={offset}
        onOffsetChange={setOffset}
      />

      <p className="mt-4 text-xs text-muted-foreground">
        ℹ️ Le statut « Rebond » correspond à l'alias API <code>bouncing</code> (stocké « bounced » côté base).
        La suppression d'un abonné déclenche une anonymisation RGPD depuis sa fiche détaillée.
      </p>
    </>
  )
}
