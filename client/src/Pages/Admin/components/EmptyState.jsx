import { AlertTriangle } from "lucide-react"

/**
 * EmptyState (S6) — état vide générique.
 */
export const EmptyState = ({ icon: Icon = AlertTriangle, title = "Aucune donnée", description }) => (
  <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
    <div className="flex size-11 items-center justify-center rounded-full bg-surface-container-high">
      <Icon className="size-5 text-muted-foreground" />
    </div>
    <p className="text-sm font-semibold text-foreground">{title}</p>
    {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
  </div>
)
