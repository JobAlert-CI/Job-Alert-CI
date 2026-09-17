import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useNotify } from "@/contexts/Notify.context";
import { Button } from "../ui/button";
import { messageErreurContenu } from "@/features/admin-contenu.tools";

const DialogSupprCategorie = ({ suppression, setSuppression, supprimerMutation }) => {
  const notify = useNotify()

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && setSuppression(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Supprimer « {suppression.label} » ?</DialogTitle>
          <DialogDescription>
            Les articles rattachés perdront leur catégorie. Action irréversible.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSuppression(null)}>Annuler</Button>
          <Button
            variant="destructive"
            disabled={supprimerMutation.isPending}
            onClick={() =>
              supprimerMutation.mutate(suppression.id, {
                onSuccess: () => { notify("Catégorie supprimée", "success"); setSuppression(null) },
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

export default DialogSupprCategorie