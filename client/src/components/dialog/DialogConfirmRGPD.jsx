import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const DialogConfirmRGPD = ({ anonymCible, setAnonymCible, anonymiser, anonymiserMutation }) => {
  return (
    <Dialog open={!!anonymCible} onOpenChange={(o) => !o && setAnonymCible(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Anonymiser cet abonné ?</DialogTitle>
          <DialogDescription>
            Conformément au RGPD, l'abonné « {anonymCible?.email} » sera <strong>anonymisé</strong> :
            email remplacé par une valeur technique, nom, ville et notes internes effacés, statut
            « Supprimé ». Son historique d'envois est conservé pour la cohérence des statistiques.
            Cette action est définitive.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setAnonymCible(null)}>Annuler</Button>
          <Button variant="destructive" size="sm" onClick={anonymiser} disabled={anonymiserMutation.isPending}>
            {anonymiserMutation.isPending ? "Anonymisation…" : "Anonymiser définitivement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DialogConfirmRGPD