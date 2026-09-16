import { useState } from "react"
import { useNotify } from "@/contexts/Notify.context"
import { messageErreurReferentiel } from "@/features/admin-filieres.tools"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

const DialogSpecialiteFiliere = ({ specialite, creer, modifier, onFermer }) => {
  const notify = useNotify()
  const edit = !!specialite
  const [valeurs, setValeurs] = useState(() => ({
    code: specialite?.code ?? "",
    label: specialite?.label ?? "",
    sort_order: specialite?.sort_order ?? 100,
    is_active: specialite?.is_active ?? true,
  }))

  const enregistrer = () => {
    const data = {
      code: valeurs.code.trim(),
      label: valeurs.label.trim(),
      sort_order: Number(valeurs.sort_order) || 0,
      is_active: valeurs.is_active,
    }
    const appel = edit
      ? modifier.mutateAsync({ id: specialite.id, data: { label: data.label, sort_order: data.sort_order, is_active: data.is_active } })
      : creer.mutateAsync(data)
    appel
      .then(() => { notify(edit ? "Spécialité mise à jour" : "Spécialité créée", "success"); onFermer() })
      .catch((err) => notify(messageErreurReferentiel(err), "error"))
  }

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{edit ? `Modifier « ${specialite.label} »` : "Nouvelle spécialité"}</DialogTitle>
          <DialogDescription>Les spécialités affinent le choix du candidat à l'inscription.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="spec-code">Code</Label>
            <Input
              id="spec-code"
              value={valeurs.code}
              onChange={(e) => setValeurs((v) => ({ ...v, code: e.target.value }))}
              disabled={edit}
              className="font-mono"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="spec-label">Libellé</Label>
            <Input
              id="spec-label"
              value={valeurs.label}
              onChange={(e) => setValeurs((v) => ({ ...v, label: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="spec-ordre">Ordre d'affichage</Label>
            <Input
              id="spec-ordre"
              type="number"
              min={0}
              value={valeurs.sort_order}
              onChange={(e) => setValeurs((v) => ({ ...v, sort_order: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button onClick={enregistrer} disabled={creer.isPending || modifier.isPending}>
            {creer.isPending || modifier.isPending ? "Enregistrement…" : edit ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DialogSpecialiteFiliere