import { memo} from "react"
import {
  Check, Loader2, X,
} from "lucide-react"
import { cn } from "cn"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TableRow, TableCell } from "@/components/ui/table"
import {typeCle} from "@/features/admin-parametres.tools"
import { BlocSkel, EditeurValeur, useSauvegardeLigne } from "./utils"
import { dateHeure } from "@/lib/dates"

const LIBELLE_TYPE = { booleen: "bool", nombre: "num", texte: "texte" }


/* ─── Ligne desktop mémoïsée : ne reçoit QUE sa valeur de brouillon
      et son erreur → la frappe dans une ligne épargne les autres. ─── */
export const LigneParametre = memo(function LigneParametre({
  parametre, valeurBrouillon, erreur, setBrouillon,
}) {
  const { modifie, enCours, confirmer } = useSauvegardeLigne({ parametre, valeurBrouillon, erreur, setBrouillon })
  const type = typeCle(parametre.key)

  return (
    <TableRow className={cn("transition-colors hover:bg-muted/50", modifie && "bg-amber-500/5")}>
      <TableCell>
        <span className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] font-medium">{parametre.key}</span>
          <Badge variant="outline" className="text-[9px] font-normal">
            {LIBELLE_TYPE[type] ?? type}
          </Badge>
        </span>
        {parametre.description && (
          <span className="block max-w-72 text-[10px] text-muted-foreground">{parametre.description}</span>
        )}
      </TableCell>
      <TableCell>
        <EditeurValeur
          parametre={parametre}
          valeur={valeurBrouillon}
          enCours={enCours}
          erreur={erreur}
          onChange={(v) => setBrouillon(parametre.key, v)}
        />
      </TableCell>
      <TableCell className="whitespace-nowrap text-[10px] text-muted-foreground">
        {dateHeure(parametre.updated_at)}
        <span className="block">{parametre.updated_by_admin_id ? "admin" : "seed"}</span>
      </TableCell>
      <TableCell className="w-24">
        <div className="flex items-center gap-1">
          {modifie ? (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={confirmer}
                disabled={!!erreur || enCours}
                aria-label={`Enregistrer ${parametre.key}`}
              >
                {enCours ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Check className="size-3.5 text-emerald-600" aria-hidden />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setBrouillon(parametre.key, undefined)}
                disabled={enCours}
                aria-label={`Annuler la modification de ${parametre.key}`}
              >
                <X className="size-3.5" aria-hidden />
              </Button>
            </>
          ) : (
            <Badge variant="outline">À jour</Badge>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
})


/* Ligne desktop : miroir de LigneParametre (4 colonnes). */
export const SkeletonLigneParametre = ({ delay = 0 }) => (
  <TableRow className="hover:bg-transparent">
    <TableCell>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <BlocSkel className="h-3 w-40" delay={delay} />
          <BlocSkel className="h-4 w-8 rounded-full" delay={delay} />
        </div>
        <BlocSkel className="h-2.5 w-56" delay={delay} />
      </div>
    </TableCell>
    <TableCell><BlocSkel className="h-8 w-full max-w-64" delay={delay} /></TableCell>
    <TableCell><BlocSkel className="h-3 w-24" delay={delay} /></TableCell>
    <TableCell className="w-24"><BlocSkel className="h-5 w-16 rounded-full" delay={delay} /></TableCell>
  </TableRow>
)