import {Loader2, PauseCircle, Pencil, PlayCircle, Trash2} from "lucide-react"
import BtnAction from "@/components/admin/BtnAction"



/* ─── Actions par source (table + cartes mobiles) ───
   stopPropagation : la ligne/carte entière ouvre l'édition. */
const ActionsSource = ({ source, statutEnCours, onBasculer, onEditer, onSupprimer }) => {
  const enPause = source.status === "paused" || source.status === "disabled"
  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {/* Bascule rapide pause/réactivation — désactivée pour `disabled`
          (réactivation via le formulaire complet). */}
      <BtnAction
        variant="ghost"
        size="xs"
        onClick={() => onBasculer(source)}
        disabled={statutEnCours || source.status === "disabled"}
        aria-busy={statutEnCours || undefined}
        aria-label={enPause ? `Réactiver ${source.name}` : `Mettre en pause ${source.name}`}
        title={source.status === "disabled" ? "Source désactivée — réactivation via le formulaire" : enPause ? "Réactiver" : "Mettre en pause"}
      >
        {statutEnCours ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : enPause ? (
          <PlayCircle aria-hidden className="group-hover:text-green-500" />
        ) : (
          <PauseCircle aria-hidden className="group-hover:text-destructive" />
        )}
      </BtnAction>
      <BtnAction variant="ghost" size="xs" onClick={() => onEditer(source)} aria-label={`Modifier ${source.name}`}>
        <Pencil aria-hidden />
      </BtnAction>
      <BtnAction
        variant="ghost"
        size="xs"
        onClick={() => onSupprimer(source)}
        aria-label={`Supprimer ${source.name}`}
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 aria-hidden />
      </BtnAction>
    </div>
  )
}

export default ActionsSource