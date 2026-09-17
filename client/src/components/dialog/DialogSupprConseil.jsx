import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useNotify } from "@/contexts/Notify.context";
import { Button } from "../ui/button";
import { messageErreurContenu } from "@/features/admin-contenu.tools";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]

const DialogSupprConseil = ({ suppression, parCreneau, supprimerMutation, setSuppression }) => {
  const notify = useNotify()
  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && setSuppression(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Supprimer ce conseil {JOURS[suppression.rotation_order] ?? ""} ?
          </DialogTitle>
          <DialogDescription>
            {(parCreneau.get(suppression.rotation_order) ?? 0) > 1
              ? "D'autres conseils restent sur ce créneau — la rotation continue."
              : "Le créneau redeviendra vide."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSuppression(null)}>Annuler</Button>
          <Button
            variant="destructive"
            disabled={supprimerMutation.isPending}
            onClick={() =>
              supprimerMutation.mutate(suppression.id, {
                onSuccess: () => { notify("Conseil supprimé", "success"); setSuppression(null) },
                onError: (err) => notify(messageErreurContenu(err), "error"),
              })
            }
          >
            Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DialogSupprConseil