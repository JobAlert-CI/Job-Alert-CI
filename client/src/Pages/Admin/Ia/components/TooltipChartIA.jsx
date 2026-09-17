import { formatNombre } from "@/lib/utils"

/* Label d'axe ISO → date courte fr-FR. */
const formaterLabel = (label) => {
  if (typeof label !== "string") return label
  if (/^\d{4}-\d{2}-\d{2}/.test(label)) {
    const d = new Date(label)
    if (!Number.isNaN(d.getTime()))
      return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
  }
  return label
}

/* Tooltip unique et stylé pour les 5 charts. */
const TooltipChartIA = ({ active, payload, label, suffixe = "" }) => {
  if (!active || !payload?.length) return null

  const hasLabel = label != null && label !== ""

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-popover p-3.5 text-sm shadow-lg min-w-55">
      {/* En-tête conditionnel avec séparateur */}
      {hasLabel && (
        <div className="font-semibold text-foreground border-b border-border/40 pb-2">
          {formaterLabel(label)}
        </div>
      )}

      {/* Liste des métriques IA */}
      <div className="flex flex-col gap-1">
        {payload.map((p) => (
          <div
            key={p.dataKey ?? p.name}
            className="flex items-center justify-between gap-6"
          >
            {/* Gauche : Pastille dynamique + Nom */}
            <div className="flex items-center gap-2.5">
              <div
                className="h-2 w-2 shrink-0 rounded-full shadow-sm"
                style={{ backgroundColor: p.color || p.fill || p.stroke || "currentColor" }}
                aria-hidden="true"
              />
              <span className="text-muted-foreground truncate max-w-35" title={p.name}>
                {p.name}
              </span>
            </div>

            {/* Droite : Valeur alignée + Suffixe */}
            <div className="font-medium text-foreground tabular-nums whitespace-nowrap">
              {formatNombre(p.value)}
              {suffixe && (
                <span className="text-muted-foreground ml-0.5">{suffixe}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TooltipChartIA