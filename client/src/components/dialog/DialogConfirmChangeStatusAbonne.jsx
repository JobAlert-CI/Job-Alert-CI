import { useNotify } from "@/contexts/Notify.context"
import { messageErreurAbonne, useChangerStatutAbonne } from "@/features/admin-abonnes.tools"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { LIBELLE_STATUT_RUN } from "@/Pages/Admin/Scraping/components/statuts-scraping"

const DialogConfirmChangeStatusAbonne = ({ open, setOpen, abonne, nouveauStatut, motif, setMotif }) => {
  const notify = useNotify()
  const statutMutation = useChangerStatutAbonne()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {nouveauStatut === "unsubscribed" ? "Marquer désinscrit" : "Confirmer le changement de statut"}
          </DialogTitle>
          <DialogDescription>
            {LIBELLE_STATUT_RUN[nouveauStatut]} pour « {abonne.email} ».
            {nouveauStatut === "unsubscribed" && " Un motif peut être enregistré (recommandé pour le support)."}
          </DialogDescription>
        </DialogHeader>
        {nouveauStatut === "unsubscribed" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="motif-desinscription">Motif (optionnel, 500 max)</Label>
            <Textarea
              id="motif-desinscription"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Ex. demande par email du 05/09…"
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
          <Button
            size="sm"
            onClick={() => {
              statutMutation.mutate(
                { subscriberId: abonne.id, status: nouveauStatut, raison: motif.trim() || undefined },
                {
                  onSuccess: () => {
                    notify("Statut mis à jour", "success")
                    setOpen(false)
                  },
                  onError: (err) => notify(messageErreurAbonne(err) || "Action impossible", "error"),
                }
              )
            }}
            disabled={statutMutation.isPending}
          >
            {statutMutation.isPending ? "…" : "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DialogConfirmChangeStatusAbonne