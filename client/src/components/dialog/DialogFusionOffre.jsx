import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

const DialogFusionOffre = ({ open, setOpen, paire, marquerMutation, motif, setMotif, fusionner }) => {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marquer comme doublon ?</DialogTitle>
          <DialogDescription>
            « {paire.offer_b_title} » sera marquée comme doublon de « {paire.offer_a_title} ».
            L'offre B reste en base mais n'apparaîtra plus dans les scans de doublons.
            Vous pourrez toujours la retrouver dans la liste des offres.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Input
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Motif (optionnel) — ex. même poste reposté"
            maxLength={255}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
          <Button variant="destructive" size="sm" onClick={fusionner} disabled={marquerMutation.isPending}>
            {marquerMutation.isPending ? "Marquage…" : "Marquer comme doublon"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DialogFusionOffre