import { useState } from "react"
import { Archive, Ban, CheckCheck, ExternalLink, Inbox, MailOpen, Reply } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "../components/PageHeader"
import { Tabs } from "../components/Tabs"
import { DataTable } from "../components/DataTable"
import { GenericStatusBadge, StatusBadge } from "../components/StatusBadge"
import { CONTACT_STATUSES, CONTACT_STATUS_LABELS } from "@/api/admin/types"
import { extractErrorMessage } from "@/api/admin/adminAxios"
import { useAdminMutations, useContactsSafe, useEventLogsSafe, useSourcesSafe } from "./adminHooks"

const LEVEL_BADGE = {
  info: { tone: "info", label: "Info" },
  warning: { tone: "warning", label: "Avertissement" },
  error: { tone: "error", label: "Erreur" },
}

/**
 * Page 15 — /admin/logs (super_admin).
 * Onglet 1 : GET /logs/events (module = scraping uniquement ; filtres level,
 * source_id). Onglet 2 : GET /logs/contacts + PATCH /contacts/{id}/status.
 */
export const ErrorLogsPage = () => {
  const [tab, setTab] = useState("events")

  return (
    <>
      <PageHeader
        title="Journal des erreurs & contacts"
        description="Événements techniques d'ingestion et messages reçus via le formulaire de contact."
        crumbs={[{ label: "Accueil", to: "/admin" }, { label: "Journal des erreurs" }]}
      />
      <Tabs
        tabs={[
          { key: "events", label: "Événements scraping" },
          { key: "contacts", label: "Messages de contact" },
        ]}
        activeKey={tab}
        onChange={setTab}
      />
      {tab === "events" ? <EventsTab /> : <ContactsTab />}
    </>
  )
}

/* ─── Onglet 1 : événements techniques ─── */
const EventsTab = () => {
  const [levelFilter, setLevelFilter] = useState("")
  const [sourceIdFilter, setSourceIdFilter] = useState("")
  const [offset, setOffset] = useState(0)
  const LIMIT = 30

  const eventsQuery = useEventLogsSafe({ level: levelFilter || undefined, source_id: sourceIdFilter || undefined, limit: LIMIT, offset })
  const sourcesQuery = useSourcesSafe()
  const rows = eventsQuery.data || []
  const sources = sourcesQuery.data || []

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
      key: "niveau",
      header: "Niveau",
      render: (log) => {
        const badge = LEVEL_BADGE[log.niveau] || LEVEL_BADGE.info
        return <StatusBadge status={log.niveau} tone={badge.tone} label={badge.label} />
      },
    },
    { key: "action", header: "Action", render: (log) => <code className="text-xs">{log.action}</code> },
    {
      key: "message",
      header: "Message",
      className: "max-w-md",
      render: (log) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{log.message ?? "(sans message)"}</p>
          {log.raw_url && (
            <a href={log.raw_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 truncate text-[11px] text-primary hover:underline">
              <ExternalLink className="size-3 shrink-0" /> {log.raw_url}
            </a>
          )}
        </div>
      ),
    },
    {
      key: "offer_id",
      header: "Offre",
      className: "hidden lg:table-cell",
      render: (log) => (log.offer_id ? <code className="font-mono text-[11px]">{log.offer_id.slice(0, 12)}…</code> : "—"),
    },
  ]

  /* Menu contextuel de ligne — navigation offre liée / URL brute (mobile friendly) */
  const rowActions = (log) => [
    ...(log.offer_id
      ? [{ key: "offer", label: "Voir l'offre liée", icon: Inbox, to: `/admin/offres/${log.offer_id}` }]
      : []),
    ...(log.raw_url
      ? [{
          key: "raw",
          label: "Ouvrir l'URL source",
          icon: ExternalLink,
          onClick: () => window.open(log.raw_url, "_blank", "noopener,noreferrer"),
        }]
      : []),
  ]

  return (
    <>
      {/* Filtres — module figé sur scraping (seule source d'événements du backend) */}
      <section className="mb-4 flex flex-wrap items-center gap-2">
        <select value={levelFilter} onChange={(e) => { setLevelFilter(e.target.value); setOffset(0) }} className="adm-input w-auto">
          <option value="">Tous les niveaux</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
        </select>
        <select value={sourceIdFilter} onChange={(e) => { setSourceIdFilter(e.target.value); setOffset(0) }} className="adm-input w-auto max-w-52">
          <option value="">Toutes les sources</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <span className="rounded bg-surface-container px-2 py-1 text-[11px] font-medium text-muted-foreground">module : scraping (seul module exposé)</span>
      </section>

      <DataTable
        columns={columns}
        rows={rows}
        loading={eventsQuery.isLoading}
        error={eventsQuery.error}
        onRetry={() => eventsQuery.refetch()}
        emptyLabel="Aucun événement technique"
        limit={LIMIT}
        offset={offset}
        onOffsetChange={setOffset}
        rowActions={rowActions}
        compact
      />
    </>
  )
}

/* ─── Onglet 2 : messages de contact ─── */
const ContactsTab = () => {
  const [statusFilter, setStatusFilter] = useState("")
  const [offset, setOffset] = useState(0)
  const LIMIT = 20

  const contactsQuery = useContactsSafe({ status: statusFilter || undefined, limit: LIMIT, offset })
  const m = useAdminMutations()
  const rows = contactsQuery.data || []

  const handleStatus = async (contact, status) => {
    if (status === contact.status) return
    try {
      await m.updateContactStatusMutation.mutateAsync({ id: contact.id, status })
      toast.success("Statut du message mis à jour", `${contact.email} → ${CONTACT_STATUS_LABELS[status]}`)
    } catch (error) {
      toast.error("Mise à jour impossible", extractErrorMessage(error))
    }
  }

  /* Menu contextuel de ligne — traitement rapide du message (mobile friendly) */
  const rowActions = (contact) => [
    {
      key: "mark-read",
      label: "Marquer comme lu",
      icon: MailOpen,
      disabled: contact.status === "read",
      onClick: () => handleStatus(contact, "read"),
    },
    {
      key: "reply",
      label: "Marquer comme répondu",
      icon: Reply,
      disabled: contact.status === "replied",
      onClick: () => handleStatus(contact, "replied"),
    },
    { key: "sep-1", separator: true },
    {
      key: "archive",
      label: "Archiver",
      icon: Archive,
      disabled: contact.status === "archived",
      onClick: () => handleStatus(contact, "archived"),
    },
    {
      key: "spam",
      label: "Signaler comme spam",
      icon: Ban,
      danger: true,
      disabled: contact.status === "spam",
      onClick: () => handleStatus(contact, "spam"),
    },
  ]

  const columns = [
    {
      key: "full_name",
      header: "Expéditeur",
      render: (contact) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{contact.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
        </div>
      ),
    },
    {
      key: "subject_label",
      header: "Sujet",
      className: "hidden md:table-cell",
      render: (contact) => (
        <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-secondary-foreground">
          {contact.subject_label}
        </span>
      ),
    },
    {
      key: "message",
      header: "Message",
      className: "max-w-lg",
      render: (contact) => (
        <p className="line-clamp-2 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{contact.message}</p>
      ),
    },
    { key: "status", header: "Statut", render: (contact) => <GenericStatusBadge status={contact.status} labels={CONTACT_STATUS_LABELS} /> },
    {
      key: "created_at",
      header: "Reçu le",
      className: "hidden lg:table-cell whitespace-nowrap",
      render: (contact) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {new Date(contact.created_at).toLocaleDateString("fr-FR")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (contact) => (
        <select
          value={contact.status}
          onChange={(e) => handleStatus(contact, e.target.value)}
          className="adm-input h-7 w-auto max-w-28 text-[11px]"
          aria-label={`Statut du message de ${contact.email}`}
        >
          {CONTACT_STATUSES.map((s) => (
            <option key={s} value={s}>{CONTACT_STATUS_LABELS[s]}</option>
          ))}
        </select>
      ),
    },
  ]

  return (
    <>
      <section className="mb-4 flex flex-wrap items-center gap-2">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setOffset(0) }} className="adm-input w-auto">
          <option value="">Tous les statuts</option>
          {CONTACT_STATUSES.map((s) => (
            <option key={s} value={s}>{CONTACT_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CheckCheck className="size-3.5" /> Changez le statut directement dans la ligne pour traiter un message.
        </p>
      </section>

      <DataTable
        columns={columns}
        rows={rows}
        loading={contactsQuery.isLoading}
        error={contactsQuery.error}
        onRetry={() => contactsQuery.refetch()}
        emptyLabel="Aucun message de contact"
        emptyHint="Les messages du formulaire public apparaîtront ici."
        limit={LIMIT}
        offset={offset}
        onOffsetChange={setOffset}
        rowActions={rowActions}
      />
    </>
  )
}


