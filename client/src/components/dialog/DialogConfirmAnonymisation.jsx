import { useNotify } from "@/contexts/Notify.context"
import { messageErreurAbonne, useAnonymiserAbonne } from "@/features/admin-abonnes.tools"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

const DialogConfirmAnonymisation = ({ open, setOpen, abonne }) => {
  const notify = useNotify()
  const navigate = useNavigate()
  const anonymiserMutation = useAnonymiserAbonne()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Anonymiser cet abonné ?</DialogTitle>
          <DialogDescription>
            Conformément au RGPD, « {abonne.email} » sera <strong>anonymisé</strong> :
            email remplacé par une valeur technique, nom, ville et notes internes effacés,
            statut « Supprimé ». L'historique d'envois reste conservé pour la cohérence des
            statistiques. Cette action est définitive.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              anonymiserMutation.mutate(abonne.id, {
                onSuccess: () => {
                  notify("Abonné anonymisé — historique conservé", "success")
                  setOpen(false)
                  navigate("/admin/utilisateurs")
                },
                onError: (err) => notify(messageErreurAbonne(err) || "Anonymisation impossible", "error"),
              })
            }}
            disabled={anonymiserMutation.isPending}
          >
            {anonymiserMutation.isPending ? "Anonymisation…" : "Anonymiser définitivement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DialogConfirmAnonymisation