import { useNotify } from "@/contexts/Notify.context"
import { messageErreurAbonne, useModifierAbonne } from "@/features/admin-abonnes.tools"
import { useState } from "react"
import { Spinner } from "../ui/spinner"
import { Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"


const DialogEditionAbonne = ({ abonne, onFermer }) => {
  const notify = useNotify()
  const modifierMutation = useModifierAbonne()
  const [valeurs, setValeurs] = useState(() => ({
    full_name: abonne.full_name ?? "",
    city: abonne.city ?? "",
    admin_notes: abonne.admin_notes ?? "",
    wants_career_tips: abonne.wants_career_tips,
  }))
  const set = (champ) => (v) => setValeurs((prev) => ({ ...prev, [champ]: v }))

  const soumettre = async (e) => {
    e.preventDefault()
    try {
      await modifierMutation.mutateAsync({
        subscriberId: abonne.id,
        data: {
          full_name: valeurs.full_name.trim() || null,
          city: valeurs.city.trim() || null,
          admin_notes: valeurs.admin_notes.trim() || null,
          wants_career_tips: valeurs.wants_career_tips,
        },
      })
      notify("Fiche mise à jour", "success")
      onFermer()
    } catch (err) {
      notify(messageErreurAbonne(err) || "Enregistrement impossible", "error")
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onFermer()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier la fiche administrative</DialogTitle>
          <DialogDescription>
            {abonne.email} — les filières et contrats restent sous le contrôle du candidat.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={soumettre} className="flex flex-col gap-3" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="abo-nom">Nom complet</Label>
            <Input id="abo-nom" value={valeurs.full_name} onChange={(e) => set("full_name")(e.target.value)} maxLength={180} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="abo-ville">Ville</Label>
            <Input id="abo-ville" value={valeurs.city} onChange={(e) => set("city")(e.target.value)} maxLength={120} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="abo-notes">Notes internes</Label>
            <Textarea
              id="abo-notes"
              rows={3}
              value={valeurs.admin_notes}
              onChange={(e) => set("admin_notes")(e.target.value)}
              placeholder="Contexte de support, échanges…"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex flex-col">
              <Label htmlFor="abo-conseils" className="text-xs">Conseils carrière</Label>
              <span className="text-[10px] text-muted-foreground">Inclut les conseils dans le digest.</span>
            </div>
            <Switch id="abo-conseils" checked={valeurs.wants_career_tips} onCheckedChange={set("wants_career_tips")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={onFermer}>Annuler</Button>
            <Button type="submit" size="sm" disabled={modifierMutation.isPending}>
              {modifierMutation.isPending ? <Spinner /> : <Save aria-hidden />}
              {modifierMutation.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default DialogEditionAbonne