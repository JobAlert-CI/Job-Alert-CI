import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useNotify } from "@/contexts/Notify.context"
import { messageErreurContenu } from "@/features/admin-contenu.tools"
import { Button } from "../ui/button"

const DialogSupprArticle = ({ suppression, supprimerMutation, setSuppression }) => {
  const notify = useNotify()
  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && setSuppression(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Supprimer « {suppression.title ?? suppression.slug} » ?</DialogTitle>
          <DialogDescription>
            Sections, blocs, points clés et chiffres seront supprimés en cascade. Action irréversible.
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
                  notify("Article supprimé", "success")
                  setSuppression(null)
                },
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

export default DialogSupprArticle