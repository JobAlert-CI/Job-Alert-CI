
export const TooltipChart = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null

  const hasLabel = label != null && label !== ""

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-popover p-3.5 text-sm shadow-lg min-w-55">
      {/* En-tête conditionnel et séparé proprement */}
      {hasLabel && (
        <div className="font-semibold text-foreground border-b border-border/40 pb-2">
          {label}
        </div>
      )}

      {/* Grille de données : Alignement parfait gauche (Libellé) / droite (Valeur) */}
      <div className="flex flex-col gap-2.5">
        {payload.map((p, i) => (
          <div 
            key={`${p.dataKey ?? p.name}-${i}`} 
            className="flex items-center justify-between gap-6"
          >
            {/* Colonne de gauche : Pastille + Nom de la série */}
            <div className="flex items-center gap-2.5">
              <span
                className="h-2 w-2 shrink-0 rounded-sm shadow-sm"
                style={{ backgroundColor: p.fill || p.color || p.stroke || "currentColor" }}
                aria-hidden="true"
              />
              <span className="text-muted-foreground truncate max-w-35" title={p.name}>
                {p.name}
              </span>
            </div>

            {/* Colonne de droite : Valeur formatée sécurisée (fallback à 0) */}
            <span className="font-medium text-foreground tabular-nums">
              {(p.value ?? 0).toLocaleString("fr-FR")}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TooltipChart