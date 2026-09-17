import {Send,} from "lucide-react"
import {useEnvoyerSelection,  } from "@/features/admin-abonnes.tools"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import BtnAction from "../admin/BtnAction"

const DialogConfirmSelection = ({ confirmationOuverte, setConfirmationOuverte, abonne, sujet, selection, titresOffres, envoyer }) => {
  const envoyerMutation = useEnvoyerSelection()
  return (
    <Dialog
      open={confirmationOuverte}
      onOpenChange={(ouvert) => {
        if (!envoyerMutation.isPending) setConfirmationOuverte(ouvert)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mettre en file d'attente ?</DialogTitle>

          <DialogDescription>
            {selection.length} offre(s) seront mises en file pour{" "}
            <strong className="text-foreground">{abonne.email}</strong> avec
            l'objet «{" "}
            {sujet.trim() || "Sélection personnalisée JobAlert CI"} ».
            L'envoi effectif est traité par le worker — vous serez informé du
            résultat dans l'historique d'envois de l'abonné.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-32 overflow-y-auto rounded-lg border border-border p-2 text-xs text-muted-foreground scrollbar-thin">
          {selection.map((offreId, index) => (
            <li key={offreId} className="flex gap-1.5">
              <span className="font-semibold text-foreground">
                {index + 1}.
              </span>

              <span className="min-w-0 truncate">
                {titresOffres[offreId] ?? `${offreId.slice(0, 8)}…`}
              </span>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <BtnAction
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirmationOuverte(false)}
            disabled={envoyerMutation.isPending}
          >
            Annuler
          </BtnAction>

          <BtnAction
            type="button"
            size="sm"
            onClick={envoyer}
            disabled={envoyerMutation.isPending || !selection.length}
          >
            {envoyerMutation.isPending ? (
              <Spinner />
            ) : (
              <Send aria-hidden="true" />
            )}

            {envoyerMutation.isPending
              ? "Mise en file…"
              : "Mettre en file d'attente"}
          </BtnAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DialogConfirmSelection