import { formatNombre } from "@/lib/utils"

const TooltipChart = ({ active, payload, label, suffixe = "", formateurLabel }) => {
  if (!active || !payload?.length) return null

  const hasLabel = label != null && label !== ""
  // On calcule le label une seule fois proprement
  const labelAffiche = hasLabel 
    ? (formateurLabel ? formateurLabel(label) : label) 
    : null

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-popover p-3.5 text-sm shadow-lg min-w-55">
      {/* En-tête : Conditionnel et formaté dynamiquement */}
      {hasLabel && (
        <div className="font-semibold text-foreground border-b border-border/40 pb-2">
          {labelAffiche}
        </div>
      )}

      {/* Grille de données */}
      <div className="flex flex-col gap-2.5">
        {payload.map((p, i) => (
          <div 
            key={`${p.dataKey ?? p.name}-${i}`} 
            className="flex items-center justify-between gap-6"
          >
            {/* Gauche : Pastille dynamique + Nom de la série */}
            <div className="flex items-center gap-2.5">
              <span
                className="h-2 w-2 shrink-0 rounded-sm shadow-sm"
                style={{ backgroundColor: p.color || p.fill || p.stroke || "currentColor" }}
                aria-hidden="true"
              />
              <span className="text-muted-foreground truncate max-w-35" title={p.name}>
                {p.name}
              </span>
            </div>

            {/* Droite : Valeur alignée + Suffixe visuellement séparé */}
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

export default TooltipChart