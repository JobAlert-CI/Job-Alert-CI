import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "../ui/button";
import { useNotify } from "@/contexts/Notify.context";
import { messageErreurContenu } from "@/features/admin-contenu.tools";

const DialogSupprPageStatic = ({ suppression, supprimerMutation, setSuppression }) => {
  const notify = useNotify()

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && setSuppression(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Supprimer « {suppression.title} » ?</DialogTitle>
          <DialogDescription>
            Une page légale supprimée rend son URL publique morte (404). Action irréversible.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSuppression(null)}>Annuler</Button>
          <Button
            variant="destructive"
            disabled={supprimerMutation.isPending}
            onClick={() =>
              supprimerMutation.mutate(suppression.id, {
                onSuccess: () => { notify("Page supprimée", "success"); setSuppression(null) },
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

export default DialogSupprPageStatic