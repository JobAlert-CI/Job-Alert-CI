import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useNotify } from "@/contexts/Notify.context"
import { messageErreurContenu } from "@/features/admin-contenu.tools"

const DialogSupprSerie = ({ suppression, setSuppression, supprimerMutation }) => {
  const notify = useNotify()

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && setSuppression(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Supprimer « {suppression.title} » ?</DialogTitle>
          <DialogDescription>
            La composition sera supprimée ; les articles eux-mêmes restent intacts.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSuppression(null)}>Annuler</Button>
          <Button
            variant="destructive"
            disabled={supprimerMutation.isPending}
            onClick={() =>
              supprimerMutation.mutate(suppression.id, {
                onSuccess: () => { notify("Série supprimée", "success"); setSuppression(null) },
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

export default DialogSupprSerie