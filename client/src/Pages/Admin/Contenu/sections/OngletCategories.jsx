import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, FolderTree, Pencil, Plus, Tag, Trash2 } from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import {
  useAdminCategoriesQuery, useAdminArticlesQuery, useCreateCategory, useUpdateCategory,
  useDeleteCategory, messageErreurContenu,
} from "@/features/admin-contenu.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { SectionErreur, SectionVide } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Onglet 14.2a — Catégories d'articles : CRUD simple + tri par colonne.
   ───────────────────────────────────────────────────────────────────── */

/* Tri « français » robuste : nombres, textes, dates ISO ; vides en fin. */
const comparerValeurs = (a, b) => {
  const videA = a === null || a === undefined || a === ""
  const videB = b === null || b === undefined || b === ""
  if (videA && videB) return 0
  if (videA) return 1
  if (videB) return -1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" })
}

/* Colonnes triables — le menu d'actions reste un en-tête simple. */
const COLONNES = [
  { cle: "label", libelle: "Catégorie", directionInitiale: "asc", triValeur: (c) => (c.label ?? "").toLowerCase() },
  {
    cle: "code", libelle: "Code", directionInitiale: "asc",
    className: "hidden font-mono text-[10px] md:table-cell",
    triValeur: (c) => c.code ?? "",
  },
  { cle: "ordre", libelle: "Ordre", directionInitiale: "asc", className: "text-right", triValeur: (c) => c.sort_order ?? 0 },
  { cle: "statut", libelle: "Statut", directionInitiale: "desc", triValeur: (c) => (c.is_active ? 1 : 0) },
]

const LigneSkeletonCategorie = () => (
  <TableRow className="hover:bg-transparent">
    <TableCell><Skeleton className="h-3.5 w-40" /></TableCell>
    <TableCell className="hidden md:table-cell"><Skeleton className="h-3 w-20" /></TableCell>
    <TableCell className="text-right"><Skeleton className="ml-auto h-3.5 w-8" /></TableCell>
    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
    <TableCell>
      <div className="flex justify-end gap-1">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
      </div>
    </TableCell>
  </TableRow>
)

const OngletCategories = () => {
  const notify = useNotify()
  const { data: categories, isLoading, isError, refetch } = useAdminCategoriesQuery()
  const { data: articles } = useAdminArticlesQuery({ limit: 100 })
  const [edition, setEdition] = useState(null)  // null fermé ; {} création ; catégorie = édition
  const [suppression, setSuppression] = useState(null)
  /* Tri INITIALISÉ : « Ordre » ascendant = ordre serveur d'affichage. */
  const [tri, setTri] = useState({ cle: "ordre", direction: "asc" })

  const creerMutation = useCreateCategory()
  const modifierMutation = useUpdateCategory()
  const supprimerMutation = useDeleteCategory()

  // Compteurs : vides = aucune catégorie_id d'article ne pointe dessus
  // (croisement local listes catégories × articles, 0 appel en plus).
  const idsUtilisees = new Set((articles ?? []).map((a) => a.category_id).filter(Boolean))
  const nbActives = (categories ?? []).filter((c) => c.is_active).length
  const nbVides = (categories ?? []).filter((c) => !idsUtilisees.has(c.id)).length

  const categoriesTriees = useMemo(() => {
    const base = categories ?? []
    if (!tri) return base
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base
    const copie = [...base].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [categories, tri])

  /* Cycle de tri : sens initial → sens inverse → aucun (ordre serveur). */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  /* key = fondu léger du corps à chaque changement de tri. */
  const cleCorps = `${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  return (
    <div className="flex flex-col gap-3">
      {/* ─── Compteurs ─── */}
      <div className="grid grid-cols-3 gap-3">
        <CarteCompteur label="Catégories" valeur={categories?.length ?? 0} icone={FolderTree} chargement={isLoading} />
        <CarteCompteur label="Actives" valeur={nbActives} icone={CheckCircle2} chargement={isLoading} />
        <CarteCompteur label="Sans article" valeur={nbVides} icone={Tag} chargement={isLoading} />
      </div>

      <SectionCardAdmin
        title="Catégories"
        description="Catégories d'articles — utilisées dans les filtres publics et l'onglet Articles. Tri par colonne."
        icon={FolderTree}
        contentClassName="p-0 sm:p-0"
        action={
          <Button size="sm" onClick={() => setEdition({})}>
            <Plus aria-hidden /> Nouvelle catégorie
          </Button>
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={isLoading ? "chargement" : isError ? "erreur" : "donnees"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {isError ? (
              <div className="p-4">
                <SectionErreur onRetry={refetch} message="Impossible de charger les catégories." />
              </div>
            ) : isLoading ? (
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableBody>
                    {[...Array(3)].map((_, i) => <LigneSkeletonCategorie key={i} />)}
                  </TableBody>
                </Table>
              </div>
            ) : !categories?.length ? (
              <div className="p-4">
                <SectionVide message="Aucune catégorie." />
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "label")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "code")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "ordre")} tri={tri} onTri={basculerTri} aligneDroite />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "statut")} tri={tri} onTri={basculerTri} />
                      <TableHead className="w-20"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                    {categoriesTriees.map((cat) => (
                      <TableRow key={cat.id} className="transition-colors hover:bg-muted/50">
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
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setSuppression(cat)}
                              aria-label={`Supprimer ${cat.label}`}
                              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
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
          </motion.div>
        </AnimatePresence>
      </SectionCardAdmin>

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