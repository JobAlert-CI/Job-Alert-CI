import { memo } from "react"
import {
  Check, Loader2, X,
} from "lucide-react"
import { cn } from "cn"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {typeCle} from "@/features/admin-parametres.tools"
import { BlocSkel, EditeurValeur, useSauvegardeLigne } from "./utils"
import { dateHeure } from "@/lib/dates"

const LIBELLE_TYPE = { booleen: "bool", nombre: "num", texte: "texte" }


/* ─── Carte mobile (miroir de la ligne desktop) ─────────────────────
   Même contrat que LigneParametre : uniquement SON brouillon et SON
   erreur. L'édition inline, la validation et la sauvegarde unitaire
   restent pleinement fonctionnelles en mobile. */
export const CarteParametreMobile = memo(function CarteParametreMobile({
  parametre, valeurBrouillon, erreur, setBrouillon,
}) {
  const { modifie, enCours, confirmer } = useSauvegardeLigne({ parametre, valeurBrouillon, erreur, setBrouillon })
  const type = typeCle(parametre.key)

  return (
    <article
      aria-label={`Paramètre ${parametre.key}`}
      className={cn("flex flex-col gap-2.5 p-4", modifie && "bg-amber-500/5")}
    >
      {/* En-tête : clé + type / état « À jour » */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] font-medium">{parametre.key}</span>
            <Badge variant="outline" className="text-[9px] font-normal">
              {LIBELLE_TYPE[type] ?? type}
            </Badge>
          </span>
          {parametre.description && (
            <span className="mt-0.5 block text-[10px] text-muted-foreground">{parametre.description}</span>
          )}
        </div>
        {!modifie && <Badge variant="outline" className="shrink-0">À jour</Badge>}
      </div>

      {/* Éditeur de valeur (pleine largeur hors booléen) */}
      <EditeurValeur
        parametre={parametre}
        valeur={valeurBrouillon}
        enCours={enCours}
        erreur={erreur}
        onChange={(v) => setBrouillon(parametre.key, v)}
        etendu={type !== "booleen"}
      />

      {/* Pied : mise à jour + actions de sauvegarde */}
      <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
        <span className="text-[10px] text-muted-foreground">
          {dateHeure(parametre.updated_at)} · {parametre.updated_by_admin_id ? "admin" : "seed"}
        </span>
        {modifie && (
          <div className="flex items-center gap-1">
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
          </div>
        )}
      </div>
    </article>
  )
})

/* Carte mobile : miroir de CarteParametreMobile. */
export const SkeletonCarteParametre = ({ delay = 0 }) => (
  <div className="flex flex-col gap-2.5 p-4" aria-hidden="true">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <BlocSkel className="h-3 w-40" delay={delay} />
          <BlocSkel className="h-4 w-8 rounded-full" delay={delay} />
        </div>
        <BlocSkel className="h-2.5 w-56" delay={delay} />
      </div>
      <BlocSkel className="h-5 w-12 shrink-0 rounded-full" delay={delay} />
    </div>
    <BlocSkel className="h-8 w-full" delay={delay} />
    <div className="flex items-center justify-between border-t border-border pt-2">
      <BlocSkel className="h-2.5 w-28" delay={delay} />
    </div>
  </div>
)