import { memo } from "react"
import { Eye} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import CelluleAuteur from "./CelluleAuteur"
import { LIBELLE_COURT_ACTION, VARIANTE_ACTION } from "./CONSTANTES"
import BtnAction from "@/components/admin/BtnAction"
import { dateHeure } from "@/lib/dates"

/* ─── Carte mobile : lecture verticale, sans défilement horizontal ─── */
export const CarteJournalMobile = memo(function CarteJournalMobile({ entree, auteurResolu, onDetail }) {
  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {dateHeure(entree.created_at)}
        </span>
        <Badge variant={VARIANTE_ACTION[entree.action] ?? "outline"}>
          {LIBELLE_COURT_ACTION[entree.action] ?? entree.action}
        </Badge>
      </div>
      <CelluleAuteur entree={entree} auteurResolu={auteurResolu} />
      <p className="truncate font-mono text-[10px] text-muted-foreground" title={entree.target_id ?? ""}>
        {entree.target_table}{entree.target_id ? ` · ${entree.target_id}` : ""}
      </p>
      <div className="flex justify-end">
        <BtnAction
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => onDetail(entree)}
          disabled={!entree.details && !entree.target_id}
        >
          <Eye className="size-3.5" aria-hidden /> Détails
        </BtnAction>
      </div>
    </div>
  )
})


export const CarteSkeletonMobile = () => (
  <div className="flex flex-col gap-2.5 p-4">
    <div className="flex items-center justify-between gap-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-5 w-20 rounded-full" />
    </div>
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-3.5 w-32" />
      <Skeleton className="h-2.5 w-44" />
    </div>
    <Skeleton className="h-2.5 w-52" />
  </div>
)