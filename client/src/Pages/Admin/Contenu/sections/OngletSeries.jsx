import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, FileText, Layers, ListOrdered, Pencil, Plus, Trash2 } from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import {
  useAdminSeriesQuery, useAdminArticlesQuery, useCreateSeries,
  useUpdateSeries, useDeleteSeries, useUpdateSeriesArticles, messageErreurContenu,
} from "@/features/admin-contenu.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { SectionErreur, SectionVide } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Onglet 14.2b — Séries : CRUD + composition + tri par colonne.
   ⚠️ PUT /series/{id}/articles REMPLACE intégralement la composition
   (même logique que les mots-clés de filière) : on envoie toujours la
   liste COMPLÈTE des IDs d'articles, jamais un delta.
   ⚠️ L'API série ne renvoie PAS sa composition actuelle : la
   composition part d'une sélection vide à chaque ouverture — le dialog
   prévient explicitement avant de remplacer.
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

/* Colonnes triables — « Description » (texte long) et les actions
   restent des en-têtes simples. */
const COLONNES = [
  { cle: "titre", libelle: "Série", directionInitiale: "asc", triValeur: (s) => (s.title ?? "").toLowerCase() },
  { cle: "ordre", libelle: "Ordre", directionInitiale: "asc", className: "text-right", triValeur: (s) => s.sort_order ?? 0 },
  { cle: "statut", libelle: "Statut", directionInitiale: "desc", triValeur: (s) => (s.is_active ? 1 : 0) },
]

const LigneSkeletonSerie = () => (
  <TableRow className="hover:bg-transparent">
    <TableCell><Skeleton className="h-3.5 w-44" /></TableCell>
    <TableCell className="hidden md:table-cell"><Skeleton className="h-3 w-56" /></TableCell>
    <TableCell className="text-right"><Skeleton className="ml-auto h-3.5 w-8" /></TableCell>
    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
    <TableCell>
      <div className="flex justify-end gap-1">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
      </div>
    </TableCell>
  </TableRow>
)

const OngletSeries = () => {
  const notify = useNotify()
  const { data: series, isLoading, isError, refetch } = useAdminSeriesQuery()
  const { data: articles } = useAdminArticlesQuery({ limit: 100 })
  const [edition, setEdition] = useState(null)
  const [composition, setComposition] = useState(null)   // série dont on édite la composition
  const [suppression, setSuppression] = useState(null)
  /* Tri INITIALISÉ : « Ordre » ascendant = ordre serveur d'affichage. */
  const [tri, setTri] = useState({ cle: "ordre", direction: "asc" })

  const creerMutation = useCreateSeries()
  const modifierMutation = useUpdateSeries()
  const supprimerMutation = useDeleteSeries()
  const nbActives = (series ?? []).filter((s) => s.is_active).length

  const seriesTriees = useMemo(() => {
    const base = series ?? []
    if (!tri) return base
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base
    const copie = [...base].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [series, tri])

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
      {/* ─── Compteurs — le nombre d'articles DANS les séries n'est pas
          exposé par l'API : on affiche le total d'articles disponibles
          pour composition, honnête. ─── */}
      <div className="grid grid-cols-3 gap-3">
        <CarteCompteur label="Séries" valeur={series?.length ?? 0} icone={Layers} chargement={isLoading} />
        <CarteCompteur label="Actives" valeur={nbActives} icone={CheckCircle2} chargement={isLoading} />
        <CarteCompteur label="Articles disponibles" valeur={articles?.length ?? 0} icone={FileText} chargement={isLoading} />
      </div>

      <SectionCardAdmin
        title="Séries"
        description="Séries éditoriales — collections d'articles (guides, dossiers…). Tri par colonne."
        icon={Layers}
        contentClassName="p-0 sm:p-0"
        action={
          <Button size="sm" onClick={() => setEdition({})}>
            <Plus aria-hidden /> Nouvelle série
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
                <SectionErreur onRetry={refetch} message="Impossible de charger les séries." />
              </div>
            ) : isLoading ? (
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableBody>
                    {[...Array(3)].map((_, i) => <LigneSkeletonSerie key={i} />)}
                  </TableBody>
                </Table>
              </div>
            ) : !series?.length ? (
              <div className="p-4">
                <SectionVide message="Aucune série pour le moment." />
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "titre")} tri={tri} onTri={basculerTri} />
                      <TableHead className="hidden md:table-cell">Description</TableHead>
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "ordre")} tri={tri} onTri={basculerTri} aligneDroite />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "statut")} tri={tri} onTri={basculerTri} />
                      <TableHead className="w-28"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                    {seriesTriees.map((s) => (
                      <TableRow key={s.id} className="transition-colors hover:bg-muted/50">
                        <TableCell className="text-sm font-medium">{s.title}</TableCell>
                        <TableCell className="hidden max-w-64 truncate text-xs text-muted-foreground md:table-cell" title={s.description ?? ""}>
                          {s.description ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{s.sort_order}</TableCell>
                        <TableCell>
                          <Badge variant={s.is_active ? "secondary" : "outline"}>
                            {s.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => setComposition(s)} aria-label={`Composition de ${s.title}`} title="Composer la série">
                              <ListOrdered aria-hidden />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => setEdition(s)} aria-label={`Modifier ${s.title}`}>
                              <Pencil aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setSuppression(s)}
                              aria-label={`Supprimer ${s.title}`}
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

      {/* Dialog CRUD */}
      {edition && (
        <DialogSerie
          serie={edition.id ? edition : null}
          creer={creerMutation}
          modifier={modifierMutation}
          onFermer={() => setEdition(null)}
        />
      )}

      {/* Dialog composition */}
      {composition && (
        <DialogComposition serie={composition} onFermer={() => setComposition(null)} />
      )}

      {/* Confirmation suppression */}
      {suppression && (
        <Dialog open onOpenChange={(ouvert) => !ouvert && setSuppression(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Supprimer « {suppression.title} » ?</DialogTitle>
              <DialogDescription>
                La composition sera supprimée ; les articles eux-mêmes restent intacts.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSuppression(null)}>Annuler</Button>
              <Button
                variant="destructive"
                disabled={supprimerMutation.isPending}
                onClick={() =>
                  supprimerMutation.mutate(suppression.id, {
                    onSuccess: () => { notify("Série supprimée", "success"); setSuppression(null) },
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

/* ─── CRUD série ─── */
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

/* ─── Composition (remplacement total) ─── */
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

export default OngletSeries