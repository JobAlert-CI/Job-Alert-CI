import { useState } from "react"
import { Plus, Pencil, Trash2, FileText } from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import {
  useAdminPagesQuery, useCreatePage, useUpdatePage,
  useChangerStatutPage, useDeletePage, messageErreurContenu,
} from "@/features/admin-contenu.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { SectionErreur, SectionVide } from "./components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Onglet 14.4 — Pages statiques : CRUD (mentions légales, etc.).

   Routes créées/typées ce cycle (ContentPageCreate/Update + PATCH
   status, 8 tests pytest) : création en draft, publication avec
   published_at FIGÉ à la première (même règle que les articles),
   slug/type immuables après création.
   ───────────────────────────────────────────────────────────────────── */

const VARIANTE_STATUT = { draft: "outline", published: "secondary", archived: "outline" }
const LIBELLE_STATUT = { draft: "Brouillon", published: "Publiée", archived: "Archivée" }

const TYPES_PAGE = [
  { valeur: "legal_page", libelle: "Page légale (mentions, confidentialité…)" },
  { valeur: "static_page", libelle: "Page statique" },
]

const OngletPages = () => {
  const notify = useNotify()
  const { data: pages, isLoading, isError, refetch } = useAdminPagesQuery()

  const [edition, setEdition] = useState(null)
  const [suppression, setSuppression] = useState(null)

  const creerMutation = useCreatePage()
  const modifierMutation = useUpdatePage()
  const statutMutation = useChangerStatutPage()
  const supprimerMutation = useDeletePage()

  // Compteurs (cycle 14, sélection utilisateur) — liste complète par nature.
  const nbPubliees = (pages ?? []).filter((p) => p.status === "published").length
  const nbBrouillons = (pages ?? []).filter((p) => p.status === "draft").length

  const changerStatut = (page, status) =>
    statutMutation.mutate(
      { id: page.id, status },
      {
        onSuccess: () => notify(`Page ${status === "published" ? "publiée" : status === "draft" ? "dépubliée" : "archivée"}`, "success"),
        onError: (err) => notify(messageErreurContenu(err), "error"),
      }
    )

  return (
    <div className="flex flex-col gap-3">
      {/* Compteurs (cycle 14, sélection utilisateur) */}
      <div className="grid grid-cols-3 gap-3">
        <CarteCompteur label="Pages" valeur={pages?.length ?? 0} chargement={isLoading} />
        <CarteCompteur label="Publiées" valeur={nbPubliees} chargement={isLoading} />
        <CarteCompteur label="Brouillons" valeur={nbBrouillons} chargement={isLoading} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Mentions légales, politique de confidentialité et pages institutionnelles.
        </p>
        <Button size="sm" onClick={() => setEdition({})}>
          <Plus aria-hidden /> Nouvelle page
        </Button>
      </div>

      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les pages." />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
      ) : !pages?.length ? (
        <SectionVide message="Aucune page statique — créez les mentions légales et la politique de confidentialité." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((page) => (
                <TableRow key={page.id}>
                  <TableCell>
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="size-3.5 text-muted-foreground" aria-hidden />
                      {page.title}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-muted-foreground">/{page.slug}</span>
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                    {page.content_type === "legal_page" ? "Légale" : "Statique"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={VARIANTE_STATUT[page.status] ?? "outline"}>
                      {LIBELLE_STATUT[page.status] ?? page.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => changerStatut(page, page.status === "published" ? "draft" : "published")}
                        disabled={statutMutation.isPending}
                        aria-label={page.status === "published" ? "Dépublier" : "Publier"}
                      >
                        {page.status === "published" ? "Dépublier" : "Publier"}
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setEdition(page)} aria-label={`Modifier ${page.title}`}>
                        <Pencil aria-hidden />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setSuppression(page)} aria-label={`Supprimer ${page.title}`}>
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog création / édition */}
      {edition && (
        <DialogPage
          page={edition.id ? edition : null}
          creer={creerMutation}
          modifier={modifierMutation}
          onFermer={() => setEdition(null)}
        />
      )}

      {/* Confirmation suppression */}
      {suppression && (
        <Dialog open onOpenChange={(ouvert) => !ouvert && setSuppression(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Supprimer « {suppression.title} » ?</DialogTitle>
              <DialogDescription>
                Une page légale supprimée rend son URL publique morte (404). Action irréversible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSuppression(null)}>Annuler</Button>
              <Button
                variant="destructive"
                disabled={supprimerMutation.isPending}
                onClick={() =>
                  supprimerMutation.mutate(suppression.id, {
                    onSuccess: () => { notify("Page supprimée", "success"); setSuppression(null) },
                    onError: (err) => notify(messageErreurContenu(err), "error"),
                  })
                }
              >
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

/* ─── Dialog page (body = JSON structuré — le site public le rend tel quel) ─── */

const DialogPage = ({ page, creer, modifier, onFermer }) => {
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
            <Input id="page-extrait" value={valeurs.extrait ?? valeurs.excerpt} onChange={(e) => set("excerpt", e.target.value)} />
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

export default OngletPages
