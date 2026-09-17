import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useState } from "react"
import { messageErreurContenu, useAdminArticlesQuery, useUpdateSeriesArticles } from "@/features/admin-contenu.tools"
import { useNotify } from "@/contexts/Notify.context"
import { Badge } from "../ui/badge"
import { Trash2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"

const DialogComposition = ({ serie, onFermer }) => {
  const notify = useNotify()
  const { data: articles } = useAdminArticlesQuery({ limit: 100 })
  const [selection, setSelection] = useState(() => new Set())
  const [confirmee, setConfirmee] = useState(false)
  const mutation = useUpdateSeriesArticles()

  const basculer = (id) =>
    setSelection((prec) => {
      const suivant = new Set(prec)
      suivant.has(id) ? suivant.delete(id) : suivant.add(id)
      return suivant
    })

  const monter = (id) =>
    setSelection((prec) => {
      const ordre = [...prec]
      const i = ordre.indexOf(id)
      if (i > 0) { [ordre[i - 1], ordre[i]] = [ordre[i], ordre[i - 1]] }
      return new Set(ordre)
    })

  const descendre = (id) =>
    setSelection((prec) => {
      const ordre = [...prec]
      const i = ordre.indexOf(id)
      if (i < ordre.length - 1 && i >= 0) { [ordre[i + 1], ordre[i]] = [ordre[i], ordre[i + 1]] }
      return new Set(ordre)
    })

  const enregistrer = () => {
    mutation.mutate(
      { id: serie.id, articleIds: [...selection] },
      {
        onSuccess: () => {
          notify("Composition enregistrée (remplacée intégralement)", "success")
          onFermer()
        },
        onError: (err) => notify(messageErreurContenu(err), "error"),
      }
    )
  }

  const articlesSelectionnes = [...selection]
    .map((id) => (articles ?? []).find((a) => a.id === id))
    .filter(Boolean)

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Composer « {serie.title} »</DialogTitle>
          <DialogDescription>
            ⚠️ La sauvegarde REMPLACE intégralement la composition de la série
            (l'API ne renvoie pas la composition actuelle — la sélection repart de zéro).
          </DialogDescription>
        </DialogHeader>
        {/* Sélection actuelle, ordonnée */}
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <p className="text-xs font-semibold">Composition ({selection.size})</p>
          {!articlesSelectionnes.length && (
            <p className="text-[10px] text-muted-foreground">Aucun article sélectionné — la série sera vidée.</p>
          )}
          {articlesSelectionnes.map((a, i) => (
            <div key={a.id} className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="font-mono">{i + 1}</Badge>
              <span className="min-w-0 flex-1 truncate">{a.title ?? a.slug}</span>
              <Button variant="ghost" size="icon-sm" onClick={() => monter(a.id)} disabled={i === 0} aria-label="Monter">
                ↑
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => descendre(a.id)} disabled={i === articlesSelectionnes.length - 1} aria-label="Descendre">
                ↓
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => basculer(a.id)} aria-label="Retirer">
                <Trash2 className="size-3.5" aria-hidden />
              </Button>
            </div>
          ))}
        </div>
        {/* Choix des articles (tous statuts) */}
        <div className="flex flex-col gap-1.5">
          <Label>Ajouter un article</Label>
          <Select value="" onValueChange={(id) => !selection.has(id) && basculer(id)}>
            <SelectTrigger className="w-full" aria-label="Ajouter un article à la série">
              <SelectValue placeholder="Choisir un article…" />
            </SelectTrigger>
            <SelectContent>
              {(articles ?? [])
                .filter((a) => !selection.has(a.id))
                .map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.title ?? a.slug}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          {!confirmee ? (
            <Button onClick={() => setConfirmee(true)}>Enregistrer la composition</Button>
          ) : (
            <Button variant="destructive" onClick={enregistrer} disabled={mutation.isPending}>
              {mutation.isPending ? "Enregistrement…" : `Confirmer le remplacement (${selection.size})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DialogComposition