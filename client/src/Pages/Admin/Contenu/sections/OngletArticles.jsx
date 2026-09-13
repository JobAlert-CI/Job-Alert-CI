import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  CheckCircle2, Eye, FileEdit, FileText, MoreHorizontal, Pencil, Plus, Search, Star, Trash2, X,
} from "lucide-react"
import { cn } from "cn"
import { useNotify } from "@/contexts/Notify.context"
import {
  useAdminArticlesQuery, useAdminCategoriesQuery, useChangerStatutArticle,
  useMettreALaUne, useDeleteArticle, messageErreurContenu,
} from "@/features/admin-contenu.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import CarteCompteur from "@/components/admin/CarteCompteur"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"
import { SectionErreur, SectionVide, SectionAucunResultat } from "../components/EtatsSection"
import EditeurArticle from "../components/EditeurArticle"

/* ─────────────────────────────────────────────────────────────────────
   Onglet 14.1 — Articles : compteurs, liste filtrable (statut,
   catégorie, recherche titre) TRIABLE par colonne, actions rapides
   (publier/dépublier, à la une, suppression) + éditeur complet.
   Tri CLIENT sur la liste retournée (le serveur filtre q/status/
   category_id mais ne trie pas).
   ───────────────────────────────────────────────────────────────────── */
const STATUTS_ARTICLE = [
  { valeur: "draft", libelle: "Brouillon" },
  { valeur: "published", libelle: "Publié" },
  { valeur: "archived", libelle: "Archivé" },
]
const VARIANTE_STATUT = { draft: "outline", published: "secondary", archived: "outline" }
const LIBELLE_STATUT = { draft: "Brouillon", published: "Publié", archived: "Archivé" }
const RANG_STATUT = { draft: 1, published: 2, archived: 3 }

/* Sentinelle ISO : les articles SANS date de publication (brouillons)
   restent en fin de liste en desc. */
const JAMAIS = "0000-01-01T00:00:00"

const dateCourte = (iso) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) : "—"

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
  { cle: "titre", libelle: "Titre", directionInitiale: "asc", triValeur: (a) => (a.title ?? "").toLowerCase() },
  { cle: "statut", libelle: "Statut", directionInitiale: "asc", triValeur: (a) => RANG_STATUT[a.status] ?? 0 },
  {
    cle: "categorie", libelle: "Catégorie", directionInitiale: "asc",
    className: "hidden md:table-cell",
    triValeur: (a) => (a.category?.label ?? "").toLowerCase(),
  },
  {
    cle: "vues", libelle: "Vues", directionInitiale: "desc",
    className: "hidden text-right md:table-cell",
    triValeur: (a) => a.view_count ?? 0,
  },
  {
    cle: "publie", libelle: "Publié le", directionInitiale: "desc",
    className: "hidden text-right lg:table-cell",
    triValeur: (a) => a.published_at ?? JAMAIS,
  },
]

/* Déclencheur de filtre : surbrillance quand une valeur non défaut est
   sélectionnée. */
const classeDeclencheur = (actif, largeur) =>
  cn(
    "h-8 text-xs transition-colors",
    largeur,
    actif
      ? "border-brand-navy/30 bg-secondary font-semibold text-secondary-foreground"
      : "text-muted-foreground"
  )

/* ─── Skeleton fidèle aux colonnes réelles ─── */
const LigneSkeletonArticle = () => (
  <TableRow className="hover:bg-transparent">
    <TableCell>
      <div className="flex flex-col gap-1.5 py-0.5">
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="h-2.5 w-24" />
      </div>
    </TableCell>
    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
    <TableCell className="hidden md:table-cell"><Skeleton className="h-3 w-24" /></TableCell>
    <TableCell className="hidden md:table-cell"><Skeleton className="ml-auto h-3.5 w-10" /></TableCell>
    <TableCell className="hidden lg:table-cell"><Skeleton className="ml-auto h-3.5 w-16" /></TableCell>
    <TableCell><div className="flex justify-end"><Skeleton className="size-7 rounded-md" /></div></TableCell>
  </TableRow>
)

const OngletArticles = () => {
  const notify = useNotify()
  const [recherche, setRecherche] = useState("")
  const [statut, setStatut] = useState("")
  const [categorieId, setCategorieId] = useState("")
  const [editeurOuvert, setEditeurOuvert] = useState(null)   // null fermé ; {} création ; { id } édition
  const [suppression, setSuppression] = useState(null)
  /* Tri INITIALISÉ : « Publié le » descendant (le plus récent d'abord). */
  const [tri, setTri] = useState({ cle: "publie", direction: "desc" })

  const params = { q: recherche || undefined, status: statut || undefined, category_id: categorieId || undefined }
  const { data: articles, isLoading, isError, refetch } = useAdminArticlesQuery(params)
  const { data: categories } = useAdminCategoriesQuery()
  const statutMutation = useChangerStatutArticle()
  const featuredMutation = useMettreALaUne()
  const supprimerMutation = useDeleteArticle()

  // Compteurs dérivés de la fenêtre affichée (liste plafonnée à la
  // limite serveur — comptage honnête, pas de total inventé).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const listeBrute = articles ?? []
  const nbPublies = listeBrute.filter((a) => a.status === "published").length
  const nbBrouillons = listeBrute.filter((a) => a.status === "draft").length
  const nbALaUne = listeBrute.filter((a) => a.is_featured).length
  const nbFiltres = [recherche, statut, categorieId].filter(Boolean).length

  const articlesTries = useMemo(() => {
    if (!tri) return listeBrute
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return listeBrute
    const copie = [...listeBrute].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [listeBrute, tri])

  /* Cycle de tri : sens initial → sens inverse → aucun (ordre serveur). */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  const reinitialiserFiltres = () => {
    setRecherche("")
    setStatut("")
    setCategorieId("")
  }

  const changerStatut = (article, status) =>
    statutMutation.mutate(
      { id: article.id, status },
      {
        onSuccess: () => notify(`Article ${status === "published" ? "publié" : status === "draft" ? "dépublié" : "archivé"}`, "success"),
        onError: (err) => notify(messageErreurContenu(err), "error"),
      }
    )

  const basculerALaUne = (article) =>
    featuredMutation.mutate(
      {
        id: article.id,
        data: { is_featured: !article.is_featured, featured_order: article.is_featured ? null : undefined },
      },
      {
        onSuccess: () => notify(article.is_featured ? "Retiré de la une" : "Mis à la une", "success"),
        onError: (err) => notify(messageErreurContenu(err), "error"),
      }
    )

  /* key = fondu léger du corps à chaque changement de tri / filtres. */
  const cleCorps = `${recherche}-${statut}-${categorieId}-${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  return (
    <div className="flex flex-col gap-3">
      {/* ─── Compteurs dérivés de la liste ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CarteCompteur label="Articles" valeur={listeBrute.length} icone={FileText} chargement={isLoading} />
        <CarteCompteur label="Publiés" valeur={nbPublies} icone={CheckCircle2} chargement={isLoading} />
        <CarteCompteur label="Brouillons" valeur={nbBrouillons} icone={FileEdit} chargement={isLoading} />
        <CarteCompteur label="À la une" valeur={nbALaUne} icone={Star} chargement={isLoading} />
      </div>

      <SectionCardAdmin
        title="Articles"
        description="Recherche, filtres et tri — l'éditeur complet s'ouvre depuis le titre ou le menu d'actions."
        icon={FileText}
        contentClassName="p-0 sm:p-0"
        action={
          <Button size="sm" onClick={() => setEditeurOuvert({})}>
            <Plus aria-hidden /> Nouvel article
          </Button>
        }
      >
        {/* ─── Barre de filtres (selects shadcn + recherche) ─── */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher par titre…"
              aria-label="Rechercher un article par titre"
              className={cn("h-8 pl-8 text-xs", recherche && "pr-8")}
            />
            {recherche && (
              <button
                type="button"
                onClick={() => setRecherche("")}
                aria-label="Effacer la recherche"
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            )}
          </div>
          {/* Sentinelle « tous/toutes » : Radix refuse la valeur vide. */}
          <Select value={statut || "tous"} onValueChange={(v) => setStatut(v === "tous" ? "" : v)}>
            <SelectTrigger className={classeDeclencheur(!!statut, "w-36")} aria-label="Filtrer par statut">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous les statuts</SelectItem>
              {STATUTS_ARTICLE.map((s) => (
                <SelectItem key={s.valeur} value={s.valeur}>{s.libelle}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categorieId || "toutes"} onValueChange={(v) => setCategorieId(v === "toutes" ? "" : v)}>
            <SelectTrigger className={classeDeclencheur(!!categorieId, "w-44")} aria-label="Filtrer par catégorie">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toutes">Toutes les catégories</SelectItem>
              {(categories ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {nbFiltres > 0 && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={reinitialiserFiltres}>
              Réinitialiser ({nbFiltres})
            </Button>
          )}
        </div>

        {/* ─── Corps : table triable, skeleton fidèle ─── */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${recherche}-${statut}-${categorieId}-${isLoading ? "chargement" : isError ? "erreur" : "donnees"}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {isError ? (
              <div className="p-4">
                <SectionErreur onRetry={refetch} message="Impossible de charger les articles." />
              </div>
            ) : !articles?.length && !isLoading ? (
              <div className="p-4">
                {nbFiltres > 0 ? (
                  <SectionAucunResultat
                    message="Aucun article ne correspond à ces filtres."
                    onReset={reinitialiserFiltres}
                  />
                ) : (
                  <SectionVide message="Aucun article pour le moment." />
                )}
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "titre")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "statut")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "categorie")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "vues")} tri={tri} onTri={basculerTri} aligneDroite />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "publie")} tri={tri} onTri={basculerTri} aligneDroite />
                      <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                    {isLoading ? (
                      [...Array(4)].map((_, i) => <LigneSkeletonArticle key={i} />)
                    ) : (
                      articlesTries.map((article) => (
                        <TableRow key={article.id} className="transition-colors hover:bg-muted/50">
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => setEditeurOuvert({ id: article.id })}
                              className="block max-w-72 truncate text-left text-sm font-medium text-primary underline-offset-4 hover:underline"
                              title={article.title}
                            >
                              {article.title ?? article.slug}
                            </button>
                            <span className="block truncate font-mono text-[10px] text-muted-foreground">
                              /{article.slug}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={VARIANTE_STATUT[article.status] ?? "outline"}>
                              {LIBELLE_STATUT[article.status] ?? article.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                            {article.category?.label ?? "—"}
                          </TableCell>
                          <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
                            {article.view_count ?? 0}
                          </TableCell>
                          <TableCell className="hidden text-right tabular-nums text-muted-foreground lg:table-cell">
                            {dateCourte(article.published_at)}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${article.title ?? article.slug}`}>
                                    <MoreHorizontal className="size-4" aria-hidden />
                                  </Button>
                                }
                              />
                              <DropdownMenuContent align="end" className="min-w-48">
                                <DropdownMenuGroup>
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                </DropdownMenuGroup>
                                <DropdownMenuItem onClick={() => setEditeurOuvert({ id: article.id })} className="cursor-pointer">
                                  <Pencil className="size-3.5" aria-hidden /> Éditer
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => changerStatut(article, article.status === "published" ? "draft" : "published")}
                                  className="cursor-pointer"
                                >
                                  <Eye className="size-3.5" aria-hidden />
                                  {article.status === "published" ? "Dépublier" : "Publier"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => basculerALaUne(article)} className="cursor-pointer">
                                  <Star className="size-3.5" aria-hidden />
                                  {article.is_featured ? "Retirer de la une" : "Mettre à la une"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => changerStatut(article, "archived")}
                                  disabled={article.status === "archived"}
                                  className="cursor-pointer"
                                >
                                  Archiver
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setSuppression(article)}
                                  className="cursor-pointer text-destructive"
                                >
                                  <Trash2 className="size-3.5" aria-hidden /> Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </SectionCardAdmin>

      {/* Éditeur complet (gros composant dédié) */}
      {editeurOuvert && (
        <EditeurArticle
          articleId={editeurOuvert.id ?? null}
          onFermer={() => setEditeurOuvert(null)}
        />
      )}

      {/* Confirmation suppression */}
      {suppression && (
        <Dialog open onOpenChange={(ouvert) => !ouvert && setSuppression(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Supprimer « {suppression.title ?? suppression.slug} » ?</DialogTitle>
              <DialogDescription>
                Sections, blocs, points clés et chiffres seront supprimés en cascade. Action irréversible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSuppression(null)}>Annuler</Button>
              <Button
                variant="destructive"
                disabled={supprimerMutation.isPending}
                onClick={() =>
                  supprimerMutation.mutate(suppression.id, {
                    onSuccess: () => {
                      notify("Article supprimé", "success")
                      setSuppression(null)
                    },
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

export default OngletArticles