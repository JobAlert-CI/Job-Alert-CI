
import { useState } from "react"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import FilterPopover from "./filters/FilterPopover"

/** Chip unitaire — état actif navy, badge compteur orange. */
export const ChipFiltre = ({ code, label, icon: Icon, count, actif, onSelect, className }) => {
  const active = actif === code
  return (
    <button
      onClick={() => onSelect?.(code)}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold transition-all duration-200",
        active
          ? "border-brand-navy bg-brand-navy text-white shadow-soft"
          : "border-outline-variant/60 bg-card text-on-surface-variant hover:-translate-y-0.5 hover:border-brand-navy/40 hover:text-brand-navy",
        className
      )}
    >
      {Icon && <Icon className="size-3.5" />}
      {label}
      {count != null && (
        <span className={cn(
          "grid size-4.5 place-items-center rounded-full text-[10px] font-black",
          active ? "bg-brand-orange text-on-primary" : "bg-surface-container text-muted-foreground"
        )}>
          {count}
        </span>
      )}
    </button>
  )
}

/**
 * Rangée de chips avec dépassement : si chips.length > max + 1 (défaut 7),
 * seules les `max` premières (défaut 6) restent visibles, les autres
 * passent dans un popover « +N autres ».
 */
const ChipsFiltres = ({ chips, actif, onSelect, max = 6, className }) => {
  const [ouvert, setOuvert] = useState(false)
  const deborde = chips.length > max + 1
  const visibles = deborde ? chips.slice(0, max) : chips
  const cachees = deborde ? chips.slice(max) : []
  const nbActivesCachees = cachees.filter((c) => c.code === actif).length

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {visibles.map((c) => (
        <ChipFiltre key={c.code} {...c} actif={actif} onSelect={onSelect} />
      ))}
      {cachees.length > 0 && (
        <FilterPopover
          label={`+${cachees.length} autres`}
          icon={Plus}
          count={nbActivesCachees}
          open={ouvert}
          onToggle={() => setOuvert((o) => !o)}
          onClose={() => setOuvert(false)}
          panelClassName="w-72 p-3.5"
        >
          <p className="mb-2.5 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Tous les thèmes
          </p>
          <div className="flex flex-wrap gap-2">
            {cachees.map((c) => (
              <ChipFiltre
                key={c.code}
                {...c}
                actif={actif}
                onSelect={(code) => { onSelect?.(code); setOuvert(false) }}
              />
            ))}
          </div>
        </FilterPopover>
      )}
    </div>
  )
}
export default ChipsFiltres