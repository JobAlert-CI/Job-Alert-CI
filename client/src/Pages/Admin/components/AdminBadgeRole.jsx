import { Shield, ShieldAlert, ShieldCheck, UserCheck, AlertCircle, Clock, CheckCircle2 } from "lucide-react"

export const AdminBadgeRole = ({ role }) => {
  switch (role) {
    case "super_admin":
    case "admin":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-navy/10 dark:bg-brand-navy/30 text-brand-navy dark:text-sky-300 border border-brand-navy/20 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide">
          <ShieldAlert className="size-3 text-brand-orange shrink-0" />
          Super Admin
        </span>
      )
    case "superviseur":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 px-2.5 py-0.5 text-[11px] font-medium tracking-wide">
          <ShieldCheck className="size-3 text-amber-600 dark:text-amber-400 shrink-0" />
          Superviseur
        </span>
      )
    case "moderateur":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 px-2.5 py-0.5 text-[11px] font-medium tracking-wide">
          <Shield className="size-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
          Modérateur
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border border-zinc-500/20 px-2.5 py-0.5 text-[11px] font-medium tracking-wide">
          <UserCheck className="size-3 text-zinc-500 shrink-0" />
          {role || "Utilisateur"}
        </span>
      )
  }
}

export const StatusBadge = ({ status, label }) => {
  const s = status?.toLowerCase()
  if (s === "active" || s === "success" || s === "sent") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-medium">
        <CheckCircle2 className="size-3 shrink-0" />
        {label || "Actif"}
      </span>
    )
  }
  if (s === "running" || s === "in_progress" || s === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20 px-2 py-0.5 text-[11px] font-medium animate-pulse">
        <Clock className="size-3 shrink-0 animate-spin" />
        {label || "En cours"}
      </span>
    )
  }
  if (s === "warning" || s === "partial_failure" || s === "paused") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 text-[11px] font-medium">
        <AlertCircle className="size-3 shrink-0" />
        {label || "En pause"}
      </span>
    )
  }
  if (s === "error" || s === "failed" || s === "bounced" || s === "disabled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 px-2 py-0.5 text-[11px] font-medium">
        <AlertCircle className="size-3 shrink-0" />
        {label || "Erreur / Inactif"}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20 px-2 py-0.5 text-[11px] font-medium">
      {label || status || "Inconnu"}
    </span>
  )
}
