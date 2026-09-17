import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { useNotify } from "@/contexts/Notify.context"
import { useState } from "react"
import { messageErreurContenu } from "@/features/admin-contenu.tools"

const TYPES_PAGE = [
  { valeur: "legal_page", libelle: "Page légale (mentions, confidentialité…)" },
  { valeur: "static_page", libelle: "Page statique" },
]

const DialogPageStatique = ({ page, creer, modifier, onFermer }) => {
  const notify = useNotify()
  const edit = !!page
  const [valeurs, setValeurs] = useState(() => ({
    content_type: page?.content_type === "legal_page" ? "legal_page" : "static_page",
    slug: page?.slug ?? "",
    title: page?.title ?? "",
    excerpt: page?.excerpt ?? "",
    bodyJson: page?.body ? JSON.stringify(page.body, null, 2) : "",
    seo_title: page?.seo_title ?? "",
    seo_description: page?.seo_description ?? "",
  }))
  const set = (c, v) => setValeurs((p) => ({ ...p, [c]: v }))

  const enregistrer = () => {
    let body = null
    if (valeurs.bodyJson.trim()) {
      try {
        body = JSON.parse(valeurs.bodyJson)
      } catch {
        notify("Le corps n'est pas un JSON valide — corrigez la syntaxe.", "error")
        return
      }
    }
    const data = {
      title: valeurs.title.trim(),
      excerpt: valeurs.excerpt.trim() || null,
      body,
      seo_title: valeurs.seo_title.trim() || null,
      seo_description: valeurs.seo_description.trim() || null,
    }
    const appel = edit
      ? modifier.mutateAsync({ id: page.id, data })
      : creer.mutateAsync({
        ...data,
        content_type: valeurs.content_type,
        slug: valeurs.slug.trim(),
      })
    appel
      .then(() => { notify(edit ? "Page mise à jour" : "Page créée en brouillon", "success"); onFermer() })
      .catch((err) => notify(messageErreurContenu(err), "error"))
  }

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onFermer()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{edit ? `Modifier « ${page.title} »` : "Nouvelle page statique"}</DialogTitle>
          <DialogDescription>
            {edit
              ? "Slug et type immuables. Publication via le bouton de la liste."
              : "Créée en brouillon — publiez-la ensuite depuis la liste."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {!edit && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="page-type">Type de page</Label>
                <Select value={valeurs.content_type} onValueChange={(v) => set("content_type", v)}>
                  <SelectTrigger id="page-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES_PAGE.map((t) => (
                      <SelectItem key={t.valeur} value={t.valeur}>{t.libelle}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="page-slug">Slug</Label>
                <Input id="page-slug" value={valeurs.slug} onChange={(e) => set("slug", e.target.value)} className="font-mono" placeholder="mentions-legales" />
              </div>
            </>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="page-titre">Titre</Label>
            <Input id="page-titre" value={valeurs.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="page-extrait">Extrait</Label>
            <Input id="page-extrait" value={valeurs.excerpt} onChange={(e) => set("excerpt", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="page-body">Corps (JSON structuré)</Label>
            <Textarea
              id="page-body"
              value={valeurs.bodyJson}
              onChange={(e) => set("bodyJson", e.target.value)}
              rows={8}
              className="font-mono text-[11px]"
              placeholder={'{\n  "paragraphs": ["Premier paragraphe…"]\n}'}
              aria-describedby="page-body-aide"
            />
            <p id="page-body-aide" className="text-[10px] text-muted-foreground">
              JSON libre (paragraphes, sections… selon le rendu attendu par le site public).
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="page-seo-titre">Titre SEO</Label>
              <Input id="page-seo-titre" value={valeurs.seo_title} onChange={(e) => set("seo_title", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="page-seo-desc">Description SEO</Label>
              <Input id="page-seo-desc" value={valeurs.seo_description} onChange={(e) => set("seo_description", e.target.value)} />
            </div>
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

export default DialogPageStatique