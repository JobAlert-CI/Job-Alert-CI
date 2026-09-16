import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "../ui/button"
import { messageErreurReferentiel } from "@/features/admin-filieres.tools"
import { useNotify } from "@/contexts/Notify.context"

const DialogSupprFiliere = ({ suppression, setSuppression, etendue, setEtendue, supprimerMutation }) => {
  const notify = useNotify()
  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && setSuppression(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Supprimer la filière « {suppression.label} » ?</DialogTitle>
          <DialogDescription>
            Les abonnés rattachés perdront cette filière de matching et les offres
            ne seront plus taguées avec. Action irréversible.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSuppression(null)}>Annuler</Button>
          <Button
            variant="destructive"
            disabled={supprimerMutation.isPending}
            onClick={() =>
              supprimerMutation.mutate(suppression.id, {
                onSuccess: () => {
                  notify(`Filière « ${suppression.label} » supprimée`, "success")
                  setSuppression(null)
                  if (etendue === suppression.id) setEtendue(null)
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

export default DialogSupprFiliere