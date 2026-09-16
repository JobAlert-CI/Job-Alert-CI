
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Trash2, TriangleAlert } from "lucide-react"
import { Button } from "../ui/button"
import { Spinner } from "../ui/spinner"

const DialogSupprEntreprise = ({ ouvert, onOpenChange, entreprise, entrepriseMut, confirmerSuppression }) => {
  return (
    <Dialog open={ouvert} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Désactiver « {entreprise.name} » ?</DialogTitle>
          <DialogDescription>
            Suppression logique : l'entreprise est masquée mais conserve son historique —
            l'action est réversible en base et journalisée dans l'audit.
          </DialogDescription>
        </DialogHeader>

        {/* Avertissement critique isolé (offres actives rattachées). */}
        {(entreprise.active_offers_count ?? 0) > 0 && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              <strong className="tabular-nums">{entreprise.active_offers_count}</strong> offre
              {entreprise.active_offers_count > 1 ? "s" : ""} active
              {entreprise.active_offers_count > 1 ? "s" : ""} y sont rattachées — elles
              disparaîtront du site public. Préférez une <strong>fusion</strong> si elles
              doivent rester visibles.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={confirmerSuppression}
            disabled={entrepriseMut.isPending}
          >
            {entrepriseMut.isPending ? <Spinner className="size-3.5" /> : <Trash2 aria-hidden className="size-3.5" />}
            {entrepriseMut.isPending ? "Désactivation…" : "Désactiver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DialogSupprEntreprise