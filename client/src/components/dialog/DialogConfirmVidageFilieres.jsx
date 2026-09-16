import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "../ui/button"

const DialogConfirmVidageFilieres = ({ confirmation, setConfirmation, mutation, lignesValides, nbInitial, sauvegarder }) => {
  return (
    <Dialog open={confirmation} onOpenChange={setConfirmation}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmer le remplacement de la liste</DialogTitle>
          <DialogDescription>
            {nbInitial > 0
              ? `La liste passerait de ${nbInitial} à ${lignesValides().length} mot(s)-clé(s) valide(s). La sauvegarde REMPLACE l'intégralité de la liste actuelle.`
              : "Vous êtes sur le point de vider tous les mots-clés de cette filière."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmation(false)}>Annuler</Button>
          <Button onClick={sauvegarder} disabled={mutation.isPending}>
            {mutation.isPending ? "Enregistrement…" : "Confirmer et enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DialogConfirmVidageFilieres