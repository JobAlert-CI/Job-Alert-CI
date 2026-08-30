import { useState } from "react"
import { ChevronDown, ChevronUp, FileJson } from "lucide-react"

/**
 * JsonPanel (S6) — affiche un objet `details` (journal d'audit, run…) en arbre repliable.
 */
export const JsonPanel = ({ data, label = "Détails", initialOpen = true }) => {
  const [open, setOpen] = useState(initialOpen)

  if (data === null || data === undefined) return null

  const pretty = typeof data === "string" ? data : JSON.stringify(data, null, 2)

  return (
    <div className="rounded-lg border border-border bg-surface-container-lowest">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <FileJson className="size-3.5" />
        {label}
        {open ? <ChevronUp className="ml-auto size-3.5" /> : <ChevronDown className="ml-auto size-3.5" />}
      </button>
      {open && (
        <pre className="max-h-64 overflow-auto border-t border-border bg-surface-container-low px-3 py-2.5 text-[11px] leading-relaxed text-on-surface">
          {pretty}
        </pre>
      )}
    </div>
  )
}
