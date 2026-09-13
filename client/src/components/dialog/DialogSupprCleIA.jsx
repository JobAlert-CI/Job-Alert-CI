import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

const DialogSupprCleIA = ({ confirmation, setConfirmation, supprimerCle, supprimer }) => {
  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && setConfirmation(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Supprimer la clé « {confirmation.name} » ?</DialogTitle>
          <DialogDescription>
            La clé sera retirée du pipeline (suppression douce). Les offres déjà normalisées ne sont pas affectées.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmation(null)}>Annuler</Button>
          <Button variant="destructive" disabled={supprimer.isPending} onClick={() => supprimerCle(confirmation)}>
            Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DialogSupprCleIA