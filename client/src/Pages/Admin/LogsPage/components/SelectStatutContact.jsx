import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CONTACT_INTERNE_VERS_API, STATUTS_CONTACT } from "@/features/admin-logs.tools"
import { cn } from "cn"
import { Loader2 } from "lucide-react"
import { memo } from "react"


const statutApi = (statut) => CONTACT_INTERNE_VERS_API[statut] ?? statut

/* ── Select de changement de statut — partagé desktop + mobile ──────
   Extrait pour zéro duplication : spinner + opacité pendant la mutation. */
const SelectStatutContact = memo(function SelectStatutContact({ message, enCours, onChanger }) {
  const cleApi = statutApi(message.status)
  return (
    <div className="relative inline-flex items-center">
      <Select value={cleApi} onValueChange={(v) => onChanger(message, v)} disabled={enCours}>
        <SelectTrigger
          className={cn("h-8 w-full text-xs sm:w-36", enCours && "opacity-60")}
          aria-label={`Changer le statut du message de ${message.full_name}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUTS_CONTACT.map((s) => (
            <SelectItem key={s.valeur} value={s.valeur}>{s.libelle}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {enCours && (
        <Loader2
          className="pointer-events-none absolute right-8 size-3.5 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      )}
    </div>
  )
})

export default SelectStatutContact