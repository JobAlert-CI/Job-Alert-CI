import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

/* ─────────────────────────────────────────────────────────────────────
   Select de référentiel avec bouton d'effacement intégré.
   Remplace l'option « — Aucun — » (SELECT_VIDE) : dès qu'une valeur
   est sélectionnée, une croix apparaît dans le déclencheur pour la
   réinitialiser, sans encombrer la liste d'options.
   Composant contrôlé : `value` / `onChange` (branché sur field.*).
───────────────────────────────────────────────────────────────────── */
const SelectReferentiel = ({
  value,
  onChange,
  options,
  placeholder,
  getValue,
  getLabel,
  className,
}) => {
  const aUneValeur = !!value
  return (
    <div className={cn("relative", className)}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={cn("w-full", aUneValeur && "pr-9")}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={getValue(o)} value={getValue(o)}>
              {getLabel(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {aUneValeur && (
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onChange("")
          }}
          className="absolute right-8 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Effacer la sélection"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export default SelectReferentiel