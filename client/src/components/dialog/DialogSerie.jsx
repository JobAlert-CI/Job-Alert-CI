import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useNotify } from "@/contexts/Notify.context"
import { useState } from "react"
import { messageErreurContenu } from "@/features/admin-contenu.tools"

const DialogSerie = ({ serie, creer, modifier, onFermer }) => {
  const notify = useNotify()
  const edit = !!serie
  const [valeurs, setValeurs] = useState(() => ({
    title: serie?.title ?? "",
    slug: serie?.slug ?? "",
    description: serie?.description ?? "",
    sort_order: serie?.sort_order ?? 100,
    is_active: serie?.is_active ?? true,
  }))
  const set = (c, v) => setValeurs((p) => ({ ...p, [c]: v }))
  const enregistrer = () => {
    const data = {
      title: valeurs.title.trim(),
      description: valeurs.description.trim() || null,
      sort_order: Number(valeurs.sort_order) || 0,
      is_active: valeurs.is_active,
    }
    const appel = edit
      ? modifier.mutateAsync({ id: serie.id, data })
      : creer.mutateAsync({ ...data, slug: valeurs.slug.trim() })
    appel
      .then(() => { notify(edit ? "Série mise à jour" : "Série créée", "success"); onFermer() })
      .catch((err) => notify(messageErreurContenu(err), "error"))
  }
  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{edit ? `Modifier « ${serie.title} »` : "Nouvelle série"}</DialogTitle>
          <DialogDescription>Collection d'articles affichée publiquement.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="serie-titre">Titre</Label>
            <Input id="serie-titre" value={valeurs.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="serie-slug">Slug</Label>
            <Input id="serie-slug" value={valeurs.slug} onChange={(e) => set("slug", e.target.value)} disabled={edit} className="font-mono" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="serie-desc">Description</Label>
            <Textarea id="serie-desc" value={valeurs.description} onChange={(e) => set("description", e.target.value)} rows={2} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="serie-ordre">Ordre d'affichage</Label>
            <Input id="serie-ordre" type="number" min={0} value={valeurs.sort_order} onChange={(e) => set("sort_order", e.target.value)} />
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

export default DialogSerie