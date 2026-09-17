import { useState } from "react"
import { useNotify } from "@/contexts/Notify.context"
import {messageErreurContenu,} from "@/features/admin-contenu.tools"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]

const DialogConseil = ({ conseil, parCreneau, creer, modifier, onFermer }) => {
  const notify = useNotify()
  const edit = !!conseil
  const [valeurs, setValeurs] = useState(() => ({
    text: conseil?.text ?? "",
    rotation_order: String(conseil?.rotation_order ?? ""),
    is_active: conseil?.is_active ?? true,
  }))
  const set = (c, v) => setValeurs((p) => ({ ...p, [c]: v }))
  const nbSurCreneau = valeurs.rotation_order !== "" ? (parCreneau.get(Number(valeurs.rotation_order)) ?? 0) : 0

  const enregistrer = () => {
    const data = {
      text: valeurs.text.trim(),
      rotation_order: Number(valeurs.rotation_order),
      is_active: valeurs.is_active,
    }
    const appel = edit
      ? modifier.mutateAsync({ id: conseil.id, data })
      : creer.mutateAsync(data)
    appel
      .then(() => { notify(edit ? "Conseil mis à jour" : "Conseil créé", "success"); onFermer() })
      .catch((err) => notify(messageErreurContenu(err), "error"))
  }

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{edit ? `Modifier le conseil ${JOURS[conseil.rotation_order] ?? ""}` : "Nouveau conseil du jour"}</DialogTitle>
          <DialogDescription>
            Plusieurs conseils par jour autorisés — ils tournent automatiquement sur le site public.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tip-texte">Texte du conseil</Label>
            <Textarea id="tip-texte" value={valeurs.text} onChange={(e) => set("text", e.target.value)} rows={3} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tip-creneau">Jour</Label>
            <Select value={valeurs.rotation_order} onValueChange={(v) => set("rotation_order", v)}>
              <SelectTrigger id="tip-creneau" className="w-full">
                <SelectValue placeholder="Choisir un jour…" />
              </SelectTrigger>
              <SelectContent>
                {JOURS.map((jour, i) => {
                  const nb = parCreneau.get(i) ?? 0
                  return (
                    <SelectItem key={i} value={String(i)}>
                      {jour}{nb > 0 ? ` (${nb} conseil${nb > 1 ? "s" : ""})` : ""}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {!edit && nbSurCreneau > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {nbSurCreneau} conseil{nbSurCreneau > 1 ? "s" : ""} occupe{nbSurCreneau > 1 ? "nt" : ""} déjà ce jour —
                ils tourneront automatiquement.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tip-actif">Actif</Label>
            <Select value={valeurs.is_active ? "1" : "0"} onValueChange={(v) => set("is_active", v === "1")}>
              <SelectTrigger id="tip-actif" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Oui — affiché</SelectItem>
                <SelectItem value="0">Non — masqué</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button onClick={enregistrer} disabled={creer.isPending || modifier.isPending || !valeurs.text.trim() || valeurs.rotation_order === ""}>
            {creer.isPending || modifier.isPending ? "Enregistrement…" : edit ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DialogConseil