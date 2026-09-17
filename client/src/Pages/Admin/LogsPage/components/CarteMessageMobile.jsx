import { memo } from "react"
import { Eye } from "lucide-react"
import { dateHeure } from "@/lib/dates"
import {CONTACT_INTERNE_VERS_API, STATUTS_CONTACT, VARIANTE_CONTACT,} from "@/features/admin-logs.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import SelectStatutContact from "./SelectStatutContact"

const statutApi = (statut) => CONTACT_INTERNE_VERS_API[statut] ?? statut

/* ── Carte mobile (miroir de la ligne desktop) ─────────────────────
   Toutes les actions restent accessibles : badge de statut, changement
   de statut inline (Select + spinner), bouton détail (Dialog). */
const CarteMessageMobile = memo(function CarteMessageMobile({ message, enCours, onChanger, onDetail }) {
  const cleApi = statutApi(message.status)
  return (
    <article
      aria-label={`Message de ${message.full_name}`}
      className="rounded-xl border border-border bg-card p-4 shadow-soft"
    >
      {/* En-tête : date / identité + badge statut + détail */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] tabular-nums text-muted-foreground">
            Reçu le {dateHeure(message.created_at)}
          </p>
          <p className="mt-0.5 truncate text-sm font-medium" title={message.full_name}>
            {message.full_name}
          </p>
          <p className="truncate text-[10px] text-muted-foreground" title={message.email}>
            {message.email}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant={VARIANTE_CONTACT[cleApi] ?? "outline"}>
            {STATUTS_CONTACT.find((s) => s.valeur === cleApi)?.libelle ?? cleApi}
          </Badge>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDetail(message)}
            aria-label={`Détails du message de ${message.full_name}`}
          >
            <Eye className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>

      {/* Sujet (tronqué sur 2 lignes, title complet) */}
      <p className="mt-2 line-clamp-2 text-xs" title={message.subject_label}>
        {message.subject_label}
      </p>
      {message.replied_at && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          répondu le {dateHeure(message.replied_at)}
        </p>
      )}

      {/* Pied : changement de statut */}
      <div className="mt-3 border-t border-border pt-2">
        <SelectStatutContact message={message} enCours={enCours} onChanger={onChanger} />
      </div>
    </article>
  )
})

export default CarteMessageMobile