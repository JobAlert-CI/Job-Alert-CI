import { useState } from "react"
import { Plus, Pencil, Trash2, Star, Eye } from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import {
  useAdminArticlesQuery, useChangerStatutArticle, useMettreALaUne,
  useDeleteArticle, messageErreurContenu,
} from "@/features/admin-contenu.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useAdminCategoriesQuery } from "@/features/admin-contenu.tools"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { SectionErreur, SectionVide, SectionAucunResultat } from "./components/EtatsSection"
import EditeurArticle from "./EditeurArticle"

/* ─────────────────────────────────────────────────────────────────────
   Onglet 14.1 — Articles : liste filtrable (statut, catégorie, recherche
   titre) + actions rapides (publier/dépublier, à la une, suppression) +
   éditeur complet (composant dédié EditeurArticle).
   ───────────────────────────────────────────────────────────────────── */

const STATUTS_ARTICLE = [
  { valeur: "draft", libelle: "Brouillon" },
  { valeur: "published", libelle: "Publié" },
  { valeur: "archived", libelle: "Archivé" },
]

const VARIANTE_STATUT = { draft: "outline", published: "secondary", archived: "outline" }
const LIBELLE_STATUT = { draft: "Brouillon", published: "Publié", archived: "Archivé" }

const dateCourte = (iso) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) : "—"

const OngletArticles = () => {
  const notify = useNotify()
  const [recherche, setRecherche] = useState("")
  const [statut, setStatut] = useState("")
  const [categorieId, setCategorieId] = useState("")
  const [editeurOuvert, setEditeurOuvert] = useState(null)   // null fermé ; {} création ; id = édition
  const [suppression, setSuppression] = useState(null)

  const params = { q: recherche || undefined, status: statut || undefined, category_id: categorieId || undefined }
  const { data: articles, isLoading, isError, refetch } = useAdminArticlesQuery(params)
  const { data: categories } = useAdminCategoriesQuery()

  const statutMutation = useChangerStatutArticle()
  const featuredMutation = useMettreALaUne()
  const supprimerMutation = useDeleteArticle()

  // Compteurs dérivés de la fenêtre affichée (liste plafonnée à la
  // limite serveur — comptage honnête « au moins », pas de total inventé).
  const listeBrute = articles ?? []
  const nbPublies = listeBrute.filter((a) => a.status === "published").length
  const nbBrouillons = listeBrute.filter((a) => a.status === "draft").length
  const nbALaUne = listeBrute.filter((a) => a.is_featured).length

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

  const nbFiltres = [recherche, statut, categorieId].filter(Boolean).length

  return (
    <div className="flex flex-col gap-3">
      {/* Compteurs (cycle 14, sélection utilisateur) — dérivés de la liste */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CarteCompteur label="Articles" valeur={listeBrute.length} chargement={isLoading} />
        <CarteCompteur label="Publiés" valeur={nbPublies} chargement={isLoading} />
        <CarteCompteur label="Brouillons" valeur={nbBrouillons} chargement={isLoading} />
        <CarteCompteur label="À la une" valeur={nbALaUne} chargement={isLoading} />
      </div>

      {/* Barre filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher par titre…"
          aria-label="Rechercher un article par titre"
          className="min-w-52 flex-1"
        />
        <Select value={statut} onValueChange={setStatut}>
          <SelectTrigger className="h-7 w-36" aria-label="Filtrer par statut">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tous</SelectItem>
            {STATUTS_ARTICLE.map((s) => (
              <SelectItem key={s.valeur} value={s.valeur}>{s.libelle}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categorieId} onValueChange={setCategorieId}>
          <SelectTrigger className="h-7 w-44" aria-label="Filtrer par catégorie">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Toutes</SelectItem>
            {(categories ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {nbFiltres > 0 && (
          <Button variant="ghost" size="sm" onClick={() => { setRecherche(""); setStatut(""); setCategorieId("") }}>
            Réinitialiser ({nbFiltres})
          </Button>
        )}
        <Button size="sm" onClick={() => setEditeurOuvert({})}>
          <Plus aria-hidden /> Nouvel article
        </Button>
      </div>

      {/* Table */}
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les articles." />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
        </div>
      ) : !articles?.length ? (
        nbFiltres > 0 ? (
          <SectionAucunResultat
            message="Aucun article ne correspond à ces filtres."
            onReset={() => { setRecherche(""); setStatut(""); setCategorieId("") }}
          />
        ) : (
          <SectionVide message="Aucun article pour le moment." />
        )
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titre</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden md:table-cell">Catégorie</TableHead>
                <TableHead className="hidden text-right md:table-cell">Vues</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Publié le</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {articles.map((article) => (
                <TableRow key={article.id}>
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
                        render={<Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${article.title ?? article.slug}`} />}
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
                        <DropdownMenuItem onClick={() => setSuppression(article)} className="cursor-pointer text-destructive">
                          <Trash2 className="size-3.5" aria-hidden /> Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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
