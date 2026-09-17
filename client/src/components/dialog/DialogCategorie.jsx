import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useNotify } from "@/contexts/Notify.context"
import { messageErreurContenu } from "@/features/admin-contenu.tools"
import { useState } from "react"
import { Label } from "../ui/label"
import { Input } from "../ui/input"
import { Button } from "../ui/button"

const DialogCategorie = ({ categorie, creer, modifier, onFermer }) => {
  const notify = useNotify()
  const edit = !!categorie
  const [valeurs, setValeurs] = useState(() => ({
    code: categorie?.code ?? "",
    label: categorie?.label ?? "",
    sort_order: categorie?.sort_order ?? 100,
    is_active: categorie?.is_active ?? true,
  }))
  const set = (c, v) => setValeurs((p) => ({ ...p, [c]: v }))
  const enregistrer = () => {
    const data = { label: valeurs.label.trim(), sort_order: Number(valeurs.sort_order) || 0, is_active: valeurs.is_active }
    const appel = edit
      ? modifier.mutateAsync({ id: categorie.id, data })
      : creer.mutateAsync({ ...data, code: valeurs.code.trim(), slug: valeurs.code.trim() })
    appel
      .then(() => { notify(edit ? "Catégorie mise à jour" : "Catégorie créée", "success"); onFermer() })
      .catch((err) => notify(messageErreurContenu(err), "error"))
  }
  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{edit ? `Modifier « ${categorie.label} »` : "Nouvelle catégorie"}</DialogTitle>
          <DialogDescription>Catégorie d'article (filtres publics).</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cat-code">Code</Label>
            <Input id="cat-code" value={valeurs.code} onChange={(e) => set("code", e.target.value)} disabled={edit} className="font-mono" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cat-label">Libellé</Label>
            <Input id="cat-label" value={valeurs.label} onChange={(e) => set("label", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cat-ordre">Ordre d'affichage</Label>
            <Input id="cat-ordre" type="number" min={0} value={valeurs.sort_order} onChange={(e) => set("sort_order", e.target.value)} />
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

export default DialogCategorie