import { useState } from "react"
import { Pencil, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import CompteurCaracteres from "@/components/shared/CompteurCaracteres"
import { useNotify } from "@/contexts/Notify.context"

const DialogNotesRun = ({ ouvert, onFermer, run, mutation }) => {
  const notify = useNotify()
  const [notes, setNotes] = useState(run?.notes ?? "")
  const [ouvertePrecedente, setOuvertePrecedente] = useState(ouvert)
  if (ouvert !== ouvertePrecedente) {
    setOuvertePrecedente(ouvert)
    setNotes(run?.notes ?? "")
  }

  const enregistrer = () => {
    mutation.mutate(
      { runId: run.id, notes: notes.trim() || null },
      {
        onSuccess: () => {
          notify("Annotation enregistrée", "success")
          onFermer()
        },
        // eslint-disable-next-line no-undef
        onError: (err) => notify(messageErreurScraping(err) || "Annotation impossible", "error"),
      }
    )
  }

  return (
    <Dialog open={ouvert} onOpenChange={(o) => !o && onFermer()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4 text-primary" aria-hidden="true" />
            Annoter ce run
          </DialogTitle>
          <DialogDescription>
            Annotation libre (usage forensique — ex. « source down, on relancera demain »).
            Journalisée dans le journal d'activité. Laisser vide pour effacer.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="run-notes">Notes</Label>
          <Textarea
            id="run-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Ex. échec HTTP 503 sur GoAfrica, relance prévue demain…"
            aria-describedby="run-notes-compteur"
          />
          <CompteurCaracteres id="run-notes-compteur" valeur={notes.length} max={1000} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button onClick={enregistrer} disabled={mutation.isPending}>
            <Save aria-hidden="true" className={mutation.isPending ? "animate-pulse" : undefined} />
            {mutation.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


export default DialogNotesRun