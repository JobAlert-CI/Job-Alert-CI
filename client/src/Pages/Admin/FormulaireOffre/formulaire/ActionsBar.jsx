import { Save } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

/* ─────────────────────────────────────────────────────────────────────
   Barre d'actions « sticky » : reste visible en bas de l'écran pendant
   le scroll, pour ne plus avoir à descendre tout en bas afin de
   sauvegarder une modification faite en haut du formulaire.
   - En édition, le bouton est désactivé tant qu'aucune modification
     n'a été apportée (isDirty) — évite les soumissions inutiles.
   - La validation n'est PAS bloquante ici : le bouton reste cliquable,
     les erreurs s'affichent sous les champs et le scroll amène à la
     première erreur (géré par le parent).
───────────────────────────────────────────────────────────────────── */
const ActionsBar = ({ edition, isDirty, enCours, onRetour }) => {
  const rienAModifier = edition && !isDirty
  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/90 px-4 py-3 shadow-hover backdrop-blur">
      <div className="min-h-5 text-xs">
        {rienAModifier ? (
          <span className="text-muted-foreground">Aucune modification</span>
        ) : isDirty ? (
          <Badge variant="secondary" className="gap-1">
            <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
            Modifications non enregistrées
          </Badge>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onRetour} disabled={enCours}>
          Annuler
        </Button>
        <Button type="submit" size="sm" disabled={enCours || rienAModifier}>
          {enCours ? <Spinner /> : <Save aria-hidden />}
          {enCours ? "Enregistrement…" : edition ? "Enregistrer" : "Créer l'offre"}
        </Button>
      </div>
    </div>
  )
}

export default ActionsBar