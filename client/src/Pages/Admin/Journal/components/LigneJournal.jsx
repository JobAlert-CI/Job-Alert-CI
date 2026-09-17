import { memo } from "react"
import { Eye } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { TableRow, TableCell } from "@/components/ui/table"
import CelluleAuteur from "./CelluleAuteur"
import { LIBELLE_COURT_ACTION, VARIANTE_ACTION } from "./CONSTANTES"
import BtnAction from "@/components/admin/BtnAction"
import { dateHeure } from "@/lib/dates"

/* ─── Ligne mémoïsée (desktop) ─── */
export const LigneJournal = memo(function LigneJournal({ entree, auteurResolu, onDetail }) {
  return (
    <TableRow className="transition-colors hover:bg-muted/50">
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
        {dateHeure(entree.created_at)}
      </TableCell>
      <TableCell>
        <CelluleAuteur entree={entree} auteurResolu={auteurResolu} />
      </TableCell>
      <TableCell>
        <Badge variant={VARIANTE_ACTION[entree.action] ?? "outline"}>
          {LIBELLE_COURT_ACTION[entree.action] ?? entree.action}
        </Badge>
      </TableCell>
      <TableCell className="font-mono text-[10px] text-muted-foreground">
        {entree.target_table}
      </TableCell>
      <TableCell
        className="hidden max-w-44 truncate font-mono text-[10px] text-muted-foreground lg:table-cell"
        title={entree.target_id ?? ""}
      >
        {entree.target_id ?? "—"}
      </TableCell>
      <TableCell>
        <div className="flex justify-end">
          <BtnAction
            variant="ghost"
            size="xs"
            onClick={() => onDetail(entree)}
            aria-label={`Détails de l'action ${entree.action}`}
            disabled={!entree.details && !entree.target_id}
          >
            <Eye className="size-3.5" aria-hidden />
          </BtnAction>
        </div>
      </TableCell>
    </TableRow>
  )
})


/* ─── Skeleton fidèle : mêmes colonnes que la table réelle (zéro
   layout shift à l'arrivée des données) ─── */
export const LigneSkeleton = () => (
  <TableRow className="hover:bg-transparent">
    <TableCell><Skeleton className="h-3.5 w-28" /></TableCell>
    <TableCell>
      <div className="flex flex-col gap-1.5 py-0.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-2.5 w-44" />
      </div>
    </TableCell>
    <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
    <TableCell><Skeleton className="h-3 w-24" /></TableCell>
    <TableCell className="hidden lg:table-cell"><Skeleton className="h-3 w-40" /></TableCell>
    <TableCell>
      <div className="flex justify-end"><Skeleton className="size-7 rounded-md" /></div>
    </TableCell>
  </TableRow>
)