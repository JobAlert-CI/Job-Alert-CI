import { useState } from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import {
  useAdminCategoriesQuery, useAdminArticlesQuery, useCreateCategory, useUpdateCategory,
  useDeleteCategory, messageErreurContenu,
} from "@/features/admin-contenu.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { SectionErreur, SectionVide } from "./components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Onglet 14.2a — Catégories d'articles : CRUD simple.
   ───────────────────────────────────────────────────────────────────── */

const OngletCategories = () => {
  const notify = useNotify()
  const { data: categories, isLoading, isError, refetch } = useAdminCategoriesQuery()
  const { data: articles } = useAdminArticlesQuery({ limit: 100 })

  const [edition, setEdition] = useState(null)  // null fermé ; {} création ; catégorie = édition
  const [suppression, setSuppression] = useState(null)

  const creerMutation = useCreateCategory()
  const modifierMutation = useUpdateCategory()
  const supprimerMutation = useDeleteCategory()

  // Compteurs : vides = aucune catégorie_id d'article ne pointe dessus
  // (croisement local listes catégories × articles, 0 appel en plus).
  const idsUtilisees = new Set((articles ?? []).map((a) => a.category_id).filter(Boolean))
  const nbActives = (categories ?? []).filter((c) => c.is_active).length
  const nbVides = (categories ?? []).filter((c) => !idsUtilisees.has(c.id)).length

  return (
    <div className="flex flex-col gap-3">
      {/* Compteurs (cycle 14, sélection utilisateur) */}
      <div className="grid grid-cols-3 gap-3">
        <CarteCompteur label="Catégories" valeur={categories?.length ?? 0} chargement={isLoading} />
        <CarteCompteur label="Actives" valeur={nbActives} chargement={isLoading} />
        <CarteCompteur label="Sans article" valeur={nbVides} chargement={isLoading} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Catégories d'articles — utilisées dans les filtres publics et l'onglet Articles.
        </p>
        <Button size="sm" onClick={() => setEdition({})}>
          <Plus aria-hidden /> Nouvelle catégorie
        </Button>
      </div>

      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les catégories." />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
      ) : !categories?.length ? (
        <SectionVide message="Aucune catégorie." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Catégorie</TableHead>
                <TableHead className="hidden font-mono text-[10px] md:table-cell">Code</TableHead>
                <TableHead className="text-right">Ordre</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="text-sm font-medium">{cat.label}</TableCell>
                  <TableCell className="hidden font-mono text-[10px] text-muted-foreground md:table-cell">{cat.code}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{cat.sort_order}</TableCell>
                  <TableCell>
                    <Badge variant={cat.is_active ? "secondary" : "outline"}>
                      {cat.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => setEdition(cat)} aria-label={`Modifier ${cat.label}`}>
                        <Pencil aria-hidden />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setSuppression(cat)} aria-label={`Supprimer ${cat.label}`}>
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
        <DialogCategorie
          categorie={edition.id ? edition : null}
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
              <DialogTitle>Supprimer « {suppression.label} » ?</DialogTitle>
              <DialogDescription>
                Les articles rattachés perdront leur catégorie. Action irréversible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSuppression(null)}>Annuler</Button>
              <Button
                variant="destructive"
                disabled={supprimerMutation.isPending}
                onClick={() =>
                  supprimerMutation.mutate(suppression.id, {
                    onSuccess: () => { notify("Catégorie supprimée", "success"); setSuppression(null) },
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

export default OngletCategories
