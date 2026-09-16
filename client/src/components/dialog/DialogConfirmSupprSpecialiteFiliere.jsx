import { useNotify } from "@/contexts/Notify.context"
import { messageErreurReferentiel } from "@/features/admin-filieres.tools"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

const DialogConfirmSupprSpecialiteFiliere = ({ suppression, setSuppression, supprimerMutation }) => {
  const notify = useNotify()

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && setSuppression(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Supprimer « {suppression.label} » ?</DialogTitle>
          <DialogDescription>La spécialité sera détachée de la filière. Action irréversible.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSuppression(null)}>Annuler</Button>
          <Button
            variant="destructive"
            disabled={supprimerMutation.isPending}
            onClick={() =>
              supprimerMutation.mutate(suppression.id, {
                onSuccess: () => {
                  notify(`Spécialité « ${suppression.label} » supprimée`, "success")
                  setSuppression(null)
                },
                onError: (err) => notify(messageErreurReferentiel(err), "error"),
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

export default DialogConfirmSupprSpecialiteFiliere