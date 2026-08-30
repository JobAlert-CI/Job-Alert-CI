import { SOURCE_STATUS_LABELS } from "@/api/admin/types"

/**
 * Badge de statut générique (S6).
 * `tone` : active | success | pending | warning | error | info | neutral
 * `label` : texte affiché (sinon le statut brut).
 */
const TONES = {
  active: { color: "var(--adm-st-active)", bg: "var(--adm-st-active-bg)" },
  success: { color: "var(--adm-st-active)", bg: "var(--adm-st-active-bg)" },
  inactive: { color: "var(--adm-st-inactive)", bg: "var(--adm-st-inactive-bg)" },
  neutral: { color: "var(--adm-st-neutral)", bg: "var(--adm-st-neutral-bg)" },
  pending: { color: "var(--adm-st-pending)", bg: "var(--adm-st-pending-bg)" },
  warning: { color: "var(--adm-st-warning)", bg: "var(--adm-st-warning-bg)" },
  error: { color: "var(--adm-st-error)", bg: "var(--adm-st-error-bg)" },
  danger: { color: "var(--adm-st-error)", bg: "var(--adm-st-error-bg)" },
  info: { color: "var(--adm-st-info)", bg: "var(--adm-st-info-bg)" },
}

export const StatusBadge = ({ status, label, tone, plain = false }) => {
  const t = TONES[tone] || TONES.neutral
  return (
    <span
      className={`adm-badge ${plain ? "adm-badge--plain" : ""}`}
      style={{ color: t.color, backgroundColor: t.bg }}
    >
      {label ?? status}
    </span>
  )
}

/* ─── Mapping statut → ton par domaine ─── */

const STATUS_TONES = {
  // offres / contenus
  active: "active",
  published: "active",
  sent: "active",
  success: "success",
  expired: "warning",
  filled: "info",
  archived: "inactive",
  duplicate: "warning",
  hidden: "inactive",
  draft: "pending",
  queued: "pending",
  sending: "pending",
  // scraping runs
  pending: "pending",
  running: "info",
  partial_failure: "warning",
  failed: "error",
  cancelled: "neutral",
  skipped_empty: "neutral",
  // sources / abonnés / admins
  paused: "warning",
  error: "error",
  disabled: "inactive",
  unsubscribed: "inactive",
  bouncing: "error",
  deleted: "inactive",
  anonymized: "inactive",
  // contacts
  new: "info",
  read: "pending",
  replied: "success",
  spam: "error",
  // niveaux de log
  info: "info",
  warning: "warning",
}

export const GenericStatusBadge = ({ status, labels = {} }) => {
  /* Normalisation de casse — l'API peut renvoyer "Active" comme "active" */
  const key = String(status ?? "").toLowerCase()
  return (
    <StatusBadge
      status={key}
      tone={STATUS_TONES[key] || "neutral"}
      label={labels[key] ?? labels[status] ?? status ?? "—"}
    />
  )
}

/** Badge spécifique aux statuts de source (active/paused/error/disabled). */
export const SourceStatusBadge = ({ status }) => {
  const key = String(status ?? "").toLowerCase()
  return (
    <StatusBadge
      status={key}
      tone={STATUS_TONES[key] || "neutral"}
      label={SOURCE_STATUS_LABELS[key] ?? status ?? "—"}
    />
  )
}
