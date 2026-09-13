import { cn } from "@/lib/utils"
import { TableHead } from "../ui/table"
import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react"


const EnteteTriable = ({ colonne, tri, onTri, aligneDroite = false, className }) => {
  const actif = tri?.cle === colonne.cle
  const direction = actif ? tri.direction : null

  return (
    <TableHead
      aria-sort={actif ? (direction === "asc" ? "ascending" : "descending") : undefined}
      className={cn("whitespace-nowrap", aligneDroite && "text-right", colonne.className, className)}
    >
      <button
        type="button"
        onClick={() => onTri(colonne)}
        title={`Trier par ${colonne.libelle}`}
        className={cn(
          "group inline-flex select-none items-center gap-1 rounded-sm font-medium transition-colors",
          "hover:text-foreground focus-visible:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "motion-reduce:transition-none",
          aligneDroite && "flex-row-reverse",
          actif ? "text-foreground" : "text-muted-foreground/90"
        )}
      >
        <span>{colonne.libelle}</span>
        {/* Annonce du sens aux lecteurs d'écran (aria-sort couvre le
            <th>, mais la restitution sur le bouton n'est pas garantie). */}
        {actif && (
          <span className="sr-only">
            {direction === "asc" ? " (trié par ordre croissant)" : " (trié par ordre décroissant)"}
          </span>
        )}
        {actif ? (
          direction === "asc" ? (
            <ChevronUp className="size-3.5 shrink-0 text-[#B45309]" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-3.5 shrink-0 text-[#B45309]" aria-hidden="true" />
          )
        ) : (
          <ChevronsUpDown
            className="size-3.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-75 group-focus-visible:opacity-75 motion-reduce:transition-none"
            aria-hidden="true"
          />
        )}
      </button>
    </TableHead>
  )
}

export default EnteteTriable