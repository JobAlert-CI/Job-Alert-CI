import { useState } from "react"
import { useNotify } from "@/contexts/Notify.context"
import { messageErreurSource } from "@/features/admin-sources.tools"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"

/* ─────────────────────────────────────────────────────────────────────
   Dialog création / édition d'une source (doc v3 §13 : CRUD complet —
   nom, URL de base, URL des offres, niveau anti-scraping 0-5, priorité).

   Champs = SourceCreate/SourceUpdate vérifiés serveur (le code est
   non modifiable après création ; le statut passe par l'action rapide
   PATCH /status, pas par ce formulaire).

   Édition : seuls les champs fournis sont mis à jour (exclude_unset
   serveur) — on envoie toujours l'objet complet pour éviter les
   surprises, sauf description/notes vidés explicitement (null).
   ───────────────────────────────────────────────────────────────────── */

const DialogSource = ({ source, mutation, onFermer }) => {
  const notify = useNotify()
  const edit = !!source

  // Initialisation UNE fois (le parent ne monte ce dialog que ouvert).
  const [valeurs, setValeurs] = useState(() => ({
    code: source?.code ?? "",
    name: source?.name ?? "",
    slug: source?.slug ?? "",
    base_url: source?.base_url ?? "",
    jobs_url: source?.jobs_url ?? "",
    color_hex: source?.color_hex ?? "",
    short_code: source?.short_code ?? "",
    priority: source?.priority ?? 100,
    anti_scraping_level: source?.anti_scraping_level ?? 0,
    supports_scraping: source?.supports_scraping ?? true,
    is_primary: source?.is_primary ?? false,
    description: source?.description ?? "",
    notes: source?.notes ?? "",
  }))

  const set = (champ, valeur) => setValeurs((v) => ({ ...v, [champ]: valeur }))

  const enregistrer = () => {
    const commun = {
      name: valeurs.name.trim(),
      base_url: valeurs.base_url.trim(),
      jobs_url: valeurs.jobs_url.trim() || null,
      color_hex: valeurs.color_hex.trim() || null,
      short_code: valeurs.short_code.trim() || null,
      priority: Number(valeurs.priority) || 0,
      anti_scraping_level: Number(valeurs.anti_scraping_level) || 0,
      supports_scraping: valeurs.supports_scraping,
      is_primary: valeurs.is_primary,
      description: valeurs.description.trim() || null,
      notes: valeurs.notes.trim() || null,
    }
    const appel = edit
      ? mutation.mutateAsync({ id: source.id, data: commun })
      : mutation.mutateAsync({
          ...commun,
          code: valeurs.code.trim(),
          slug: valeurs.slug.trim() || valeurs.code.trim(),
        })
    appel
      .then(() => {
        notify(edit ? "Source mise à jour" : "Source créée", "success")
        onFermer()
      })
      .catch((err) => notify(messageErreurSource(err), "error"))
  }

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{edit ? `Modifier « ${source.name} »` : "Nouvelle source"}</DialogTitle>
          <DialogDescription>
            {edit
              ? "Le code identifie la source dans la planification — il n'est pas modifiable."
              : "⚠️ Ajouter une source ne l'intègre pas à la planification Celery (codes en dur) — intervention code requise."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="source-code">Code</Label>
              <Input
                id="source-code"
                value={valeurs.code}
                onChange={(e) => set("code", e.target.value)}
                disabled={edit}
                className="font-mono"
                placeholder="ex. goafrica"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="source-slug">Slug</Label>
              <Input
                id="source-slug"
                value={valeurs.slug}
                onChange={(e) => set("slug", e.target.value)}
                disabled={edit}
                placeholder="ex. goafrica (défaut : code)"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="source-name">Nom</Label>
            <Input id="source-name" value={valeurs.name} onChange={(e) => set("name", e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="source-base-url">URL de base</Label>
            <Input
              id="source-base-url"
              type="url"
              value={valeurs.base_url}
              onChange={(e) => set("base_url", e.target.value)}
              placeholder="https://…"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="source-jobs-url">URL des offres (optionnel)</Label>
            <Input
              id="source-jobs-url"
              type="url"
              value={valeurs.jobs_url}
              onChange={(e) => set("jobs_url", e.target.value)}
              placeholder="https://…/offres"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="source-priority">Priorité</Label>
              <Input
                id="source-priority"
                type="number"
                min={0}
                value={valeurs.priority}
                onChange={(e) => set("priority", e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">Ordre de passage (plus petit = plus tôt).</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="source-anti">Niveau anti-scraping (0-5)</Label>
              <Select value={String(valeurs.anti_scraping_level)} onValueChange={(v) => set("anti_scraping_level", Number(v))}>
                <SelectTrigger id="source-anti" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="source-color">Couleur (optionnel)</Label>
              <Input
                id="source-color"
                value={valeurs.color_hex}
                onChange={(e) => set("color_hex", e.target.value)}
                placeholder="#0F2D4D"
                className="font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="source-short">Code court (optionnel)</Label>
              <Input
                id="source-short"
                value={valeurs.short_code}
                onChange={(e) => set("short_code", e.target.value)}
                maxLength={8}
                className="font-mono"
                placeholder="ex. GA"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs" htmlFor="source-scraping">
              <Checkbox
                id="source-scraping"
                checked={valeurs.supports_scraping}
                onCheckedChange={(v) => set("supports_scraping", !!v)}
              />
              Source scrapable (collecte automatique supportée)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs" htmlFor="source-primary">
              <Checkbox
                id="source-primary"
                checked={valeurs.is_primary}
                onCheckedChange={(v) => set("is_primary", !!v)}
              />
              Source principale
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="source-description">Description (optionnel)</Label>
            <Textarea
              id="source-description"
              value={valeurs.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="source-notes">Notes internes (optionnel)</Label>
            <Textarea
              id="source-notes"
              value={valeurs.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              placeholder="Ex. structure HTML à surveiller…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFermer}>Annuler</Button>
          <Button onClick={enregistrer} disabled={mutation.isPending}>
            {mutation.isPending ? "Enregistrement…" : edit ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DialogSource
