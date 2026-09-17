import { memo, useCallback, useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  Eye,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Star,
  Trash2,
} from "lucide-react"
import { cn } from "cn"
import { useNotify } from "@/contexts/Notify.context"
import {
  useAdminArticlesQuery,
  useAdminCategoriesQuery,
  useChangerStatutArticle,
  useMettreALaUne,
  useDeleteArticle,
  messageErreurContenu,
} from "@/features/admin-contenu.tools"
import { Badge } from "@/components/ui/badge"
import BtnAction from "@/components/admin/BtnAction"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"
import {
  SectionErreur,
  SectionVide,
  SectionAucunResultat,
  TransitionEtat
} from "@/components/admin/EtatsSection"
import EditeurArticle from "../components/EditeurArticle"
import Bloc from "@/components/admin/Bloc"
import DialogSupprArticle from "@/components/dialog/DialogSupprArticle"
import { Spinner } from "@/components/ui/spinner"

const STATUTS_ARTICLE = [
  { valeur: "draft", libelle: "Brouillon" },
  { valeur: "published", libelle: "Publié" },
  { valeur: "archived", libelle: "Archivé" },
]

const VARIANTE_STATUT = {
  draft: "outline",
  published: "secondary",
  archived: "outline",
}

const LIBELLE_STATUT = {
  draft: "Brouillon",
  published: "Publié",
  archived: "Archivé",
}

const RANG_STATUT = {
  draft: 1,
  published: 2,
  archived: 3,
}

/* Sentinelle ISO : les articles SANS date de publication (brouillons)
   restent en fin de liste en desc. */
const JAMAIS = "0000-01-01T00:00:00"

const dateCourte = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    })
    : "—"

/* Tri « français » robuste : nombres, textes, dates ISO ; vides en fin. */
const comparerValeurs = (a, b) => {
  const videA = a === null || a === undefined || a === ""
  const videB = b === null || b === undefined || b === ""

  if (videA && videB) return 0
  if (videA) return 1
  if (videB) return -1

  if (typeof a === "number" && typeof b === "number") return a - b

  return String(a).localeCompare(String(b), "fr", {
    numeric: true,
    sensitivity: "base",
  })
}

/* Colonnes triables — le menu d'actions reste un en-tête simple. */
const COLONNES = [
  {
    cle: "titre",
    libelle: "Titre",
    directionInitiale: "asc",
    triValeur: (a) => (a.title ?? "").toLowerCase(),
  },
  {
    cle: "statut",
    libelle: "Statut",
    directionInitiale: "asc",
    triValeur: (a) => RANG_STATUT[a.status] ?? 0,
  },
  {
    cle: "categorie",
    libelle: "Catégorie",
    directionInitiale: "asc",
    className: "hidden md:table-cell",
    triValeur: (a) => (a.category?.label ?? "").toLowerCase(),
  },
  {
    cle: "vues",
    libelle: "Vues",
    directionInitiale: "desc",
    className: "hidden text-right md:table-cell",
    triValeur: (a) => a.view_count ?? 0,
  },
  {
    cle: "publie",
    libelle: "Publié le",
    directionInitiale: "desc",
    className: "hidden text-right lg:table-cell",
    triValeur: (a) => a.published_at ?? JAMAIS,
  },
]

const OPTIONS_TRI_MOBILE = COLONNES.map((colonne) => ({
  valeur: colonne.cle,
  libelle: colonne.libelle,
}))

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

/* ─── Menu d’actions partagé entre desktop et mobile ─── */
const MenuActionsArticle = memo(
  ({
    article,
    onEditer,
    onBasculerPublication,
    onBasculerALaUne,
    onArchiver,
    onSupprimer,
  }) => {
    const libelleArticle = article.title ?? article.slug

    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <BtnAction
              variant="ghost"
              size="xs"
              aria-label={`Actions pour ${libelleArticle}`}
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </BtnAction>
          }
        />
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
          </DropdownMenuGroup>

          <DropdownMenuItem
            onClick={() => onEditer(article)}
            className="cursor-pointer"
          >
            <Pencil className="size-3.5" aria-hidden /> Éditer
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => onBasculerPublication(article)}
            className="cursor-pointer"
          >
            <Eye className="size-3.5" aria-hidden />
            {article.status === "published" ? "Dépublier" : "Publier"}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => onBasculerALaUne(article)}
            className="cursor-pointer"
          >
            <Star className="size-3.5" aria-hidden />
            {article.is_featured ? "Retirer de la une" : "Mettre à la une"}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => onArchiver(article)}
            disabled={article.status === "archived"}
            className="cursor-pointer"
          >
            Archiver
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => onSupprimer(article)}
            className="cursor-pointer text-destructive"
          >
            <Trash2 className="size-3.5" aria-hidden /> Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
)

MenuActionsArticle.displayName = "MenuActionsArticle"

/* ─── Skeleton desktop fidèle aux colonnes réelles ─── */
const LigneSkeletonArticle = () => (
  <TableRow className="hover:bg-transparent" aria-hidden="true">
    <TableCell>
      <div className="flex flex-col gap-1.5 py-0.5">
        <Skeleton className="h-3.5 w-full max-w-48" />
        <Skeleton className="h-2.5 w-24" />
      </div>
    </TableCell>

    <TableCell>
      <Skeleton className="h-5 w-20 rounded-full" />
    </TableCell>

    <TableCell className="hidden md:table-cell">
      <Skeleton className="h-3 w-24" />
    </TableCell>

    <TableCell className="hidden md:table-cell">
      <Skeleton className="ml-auto h-3.5 w-10" />
    </TableCell>

    <TableCell className="hidden lg:table-cell">
      <Skeleton className="ml-auto h-3.5 w-16" />
    </TableCell>

    <TableCell>
      <div className="flex justify-end">
        <Skeleton className="size-7 rounded-md" />
      </div>
    </TableCell>
  </TableRow>
)

/* ─── Skeleton mobile fidèle à la carte réelle ─── */
const CarteSkeletonArticleMobile = () => (
  <div className="p-4" aria-hidden="true">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-[82%]" />
        <Skeleton className="h-2.5 w-24" />
      </div>

      <Skeleton className="size-7 shrink-0 rounded-md" />
    </div>

    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-3 w-24" />
    </div>

    <div className="mt-3 flex items-center justify-between gap-3">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-3 w-20" />
    </div>
  </div>
)

/* ─── Carte mobile réelle ─── */
const CarteArticleMobile = memo(
  ({
    article,
    onEditer,
    onBasculerPublication,
    onBasculerALaUne,
    onArchiver,
    onSupprimer,
  }) => {
    return (
      <article className="p-4 transition-colors hover:bg-muted/40">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onEditer(article)}
              className="line-clamp-2 w-full text-left text-sm font-medium text-primary underline-offset-4 hover:underline"
              title={article.title}
            >
              {article.title ?? article.slug}
            </button>

            <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
              /{article.slug}
            </span>
          </div>

          <MenuActionsArticle
            article={article}
            onEditer={onEditer}
            onBasculerPublication={onBasculerPublication}
            onBasculerALaUne={onBasculerALaUne}
            onArchiver={onArchiver}
            onSupprimer={onSupprimer}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant={VARIANTE_STATUT[article.status] ?? "outline"}>
            {LIBELLE_STATUT[article.status] ?? article.status}
          </Badge>

          <span className="text-xs text-muted-foreground">
            {article.category?.label ?? "—"}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Eye className="size-3.5" aria-hidden />
            {article.view_count ?? 0} vues
          </span>

          <span className="tabular-nums">
            {dateCourte(article.published_at)}
          </span>
        </div>
      </article>
    )
  }
)

CarteArticleMobile.displayName = "CarteArticleMobile"

const ListeArticles = () => {
  const notify = useNotify()

  const [recherche, setRecherche] = useState("")
  const [statut, setStatut] = useState("")
  const [categorieId, setCategorieId] = useState("")
  const [editeurOuvert, setEditeurOuvert] = useState(null) // null fermé ; {} création ; { id } édition
  const [suppression, setSuppression] = useState(null)

  /* Tri INITIALISÉ : « Publié le » descendant (le plus récent d'abord). */
  const [tri, setTri] = useState({ cle: "publie", direction: "desc" })

  const params = {
    q: recherche || undefined,
    status: statut || undefined,
    category_id: categorieId || undefined,
  }

  const {
    data: articles,
    isLoading,
    isError,
    refetch,
  } = useAdminArticlesQuery(params)

  const { data: categories, isLoading: categoriesChargement } =
    useAdminCategoriesQuery()

  const statutMutation = useChangerStatutArticle()
  const featuredMutation = useMettreALaUne()
  const supprimerMutation = useDeleteArticle()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const listeBrute = articles ?? []
  const nbFiltres = [recherche, statut, categorieId].filter(Boolean).length

  const articlesTries = useMemo(() => {
    if (!tri) return listeBrute

    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return listeBrute

    const copie = [...listeBrute].sort((a, b) =>
      comparerValeurs(colonne.triValeur(a), colonne.triValeur(b))
    )

    return tri.direction === "asc" ? copie : copie.reverse()
  }, [listeBrute, tri])

  /* Cycle de tri : sens initial → sens inverse → aucun (ordre serveur). */
  const basculerTri = useCallback((colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) {
        return {
          cle: colonne.cle,
          direction: colonne.directionInitiale ?? "desc",
        }
      }

      if (prec.direction === (colonne.directionInitiale ?? "desc")) {
        return {
          cle: colonne.cle,
          direction: prec.direction === "asc" ? "desc" : "asc",
        }
      }

      return null
    })
  }, [])

  const reinitialiserFiltres = useCallback(() => {
    setRecherche("")
    setStatut("")
    setCategorieId("")
  }, [])

  const changerStatut = useCallback(
    (article, status) =>
      statutMutation.mutate(
        { id: article.id, status },
        {
          onSuccess: () =>
            notify(
              `Article ${status === "published"
                ? "publié"
                : status === "draft"
                  ? "dépublié"
                  : "archivé"
              }`,
              "success"
            ),
          onError: (err) => notify(messageErreurContenu(err), "error"),
        }
      ),
    [statutMutation, notify]
  )

  const basculerALaUne = useCallback(
    (article) =>
      featuredMutation.mutate(
        {
          id: article.id,
          data: {
            is_featured: !article.is_featured,
            featured_order: article.is_featured ? null : undefined,
          },
        },
        {
          onSuccess: () =>
            notify(
              article.is_featured ? "Retiré de la une" : "Mis à la une",
              "success"
            ),
          onError: (err) => notify(messageErreurContenu(err), "error"),
        }
      ),
    [featuredMutation, notify]
  )

  const ouvrirEditeurArticle = useCallback((article) => {
    setEditeurOuvert({ id: article.id })
  }, [])

  const demanderSuppression = useCallback((article) => {
    setSuppression(article)
  }, [])

  const basculerPublication = useCallback(
    (article) =>
      changerStatut(
        article,
        article.status === "published" ? "draft" : "published"
      ),
    [changerStatut]
  )

  const archiverArticle = useCallback(
    (article) => changerStatut(article, "archived"),
    [changerStatut]
  )

  const changerTriMobile = useCallback((valeur) => {
    if (valeur === "aucun") {
      setTri(null)
      return
    }

    const colonne = COLONNES.find((c) => c.cle === valeur)

    setTri({
      cle: valeur,
      direction: colonne?.directionInitiale ?? "desc",
    })
  }, [])

  const inverserTriMobile = useCallback(() => {
    setTri((prec) => {
      if (!prec) {
        return {
          cle: "publie",
          direction: "desc",
        }
      }

      return {
        ...prec,
        direction: prec.direction === "asc" ? "desc" : "asc",
      }
    })
  }, [])

  /* key = fondu léger du corps à chaque changement de tri / filtres / état. */
  const cleCorps = `${recherche}-${statut}-${categorieId}-${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  const etat = isError
    ? "error"
    : isLoading
      ? "loading"
      : !articles?.length
        ? "vide"
        : "success"

  return (
    <>
      <SectionCardAdmin
        title="Articles"
        description="Recherche, filtres et tri — l'éditeur complet s'ouvre depuis le titre ou le menu d'actions."
        icon={FileText}
        contentClassName="p-0 sm:p-0"
        action={
          <BtnAction size="sm" onClick={() => setEditeurOuvert({})}>
            <Plus aria-hidden /> Nouvel article
          </BtnAction>
        }
      >
        {/* ─── Barre de filtres responsive ─── */}
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            {/* Recherche : Spinner tant que la requête est en cours */}
            <div className="relative w-full lg:min-w-52 lg:flex-1">
              {isLoading ? (
                <Spinner
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-primary"
                  aria-label="Recherche en cours"
                />
              ) : (
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
              )}

              <Input
                type="search"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher un titre…"
                aria-label="Rechercher une offre par titre"
                aria-busy={isLoading}
                className="h-8 w-full pl-8 text-xs"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {/* Sentinelle « tous/toutes » : Radix refuse la valeur vide. */}
              <Select
                value={statut || "tous"}
                onValueChange={(v) => setStatut(v === "tous" ? "" : v)}
              >
                <SelectTrigger
                  className={classeDeclencheur(!!statut, "w-full sm:w-36")}
                  aria-label="Filtrer par statut"
                >
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous les statuts</SelectItem>
                  {STATUTS_ARTICLE.map((s) => (
                    <SelectItem key={s.valeur} value={s.valeur}>
                      {s.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={categorieId || "toutes"}
                onValueChange={(v) =>
                  setCategorieId(v === "toutes" ? "" : v)
                }
                disabled={categoriesChargement}
              >
                <SelectTrigger
                  className={classeDeclencheur(!!categorieId, "w-full sm:w-44")}
                  aria-label="Filtrer par catégorie"
                  aria-busy={categoriesChargement}
                >
                  <SelectValue
                    placeholder={
                      categoriesChargement ? "Chargement…" : "Catégorie"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="toutes">Toutes les catégories</SelectItem>
                  {(categories ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {nbFiltres > 0 && (
                <BtnAction
                  variant="ghost"
                  size="xs"
                  className="h-8 text-xs"
                  onClick={reinitialiserFiltres}
                >
                  <RotateCcw aria-hidden className="size-3" /> Réinitialiser
                </BtnAction>
              )}
            </div>
          </div>

          {/* ─── Tri mobile ─── */}
          <div className="flex flex-col gap-2 border-t border-border pt-3 md:hidden">
            <p className="text-xs font-medium text-muted-foreground">Tri</p>

            <div className="flex items-center gap-2">
              <Select
                value={tri?.cle ?? "aucun"}
                onValueChange={changerTriMobile}
              >
                <SelectTrigger
                  className="h-8 flex-1 text-xs"
                  aria-label="Choisir la colonne de tri"
                >
                  <SelectValue placeholder="Trier par" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aucun">Tri par défaut</SelectItem>
                  {OPTIONS_TRI_MOBILE.map((option) => (
                    <SelectItem key={option.valeur} value={option.valeur}>
                      {option.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <BtnAction
                variant="outline"
                size="xs"
                className="h-8 shrink-0 text-xs"
                onClick={inverserTriMobile}
                aria-label="Inverser le sens du tri"
              >
                {tri?.direction === "asc" ? (
                  <ArrowUp aria-hidden className="size-3.5" />
                ) : (
                  <ArrowDown aria-hidden className="size-3.5" />
                )}
                {tri?.direction === "asc" ? "Croissant" : "Décroissant"}
              </BtnAction>
            </div>
          </div>
        </div>

        {/* ─── Corps : mobile cards + desktop table ─── */}
        <Bloc>
          <TransitionEtat etat={`${cleCorps}-${etat}`}>
            {isError ? (
              <div className="p-4">
                <SectionErreur
                  onRetry={refetch}
                  message="Impossible de charger les articles."
                />
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
              <div
                key={`${cleCorps}-${etat}`}
                aria-busy={isLoading}
                className="animate-in fade-in duration-300 motion-reduce:animate-none"
              >
                {/* ─── Vue mobile ─── */}
                <div className="md:hidden">
                  {isLoading ? (
                    <div
                      className="divide-y divide-border"
                      role="status"
                      aria-label="Chargement des articles"
                    >
                      <span className="sr-only">
                        Chargement des articles…
                      </span>

                      {[...Array(10)].map((_, index) => (
                        <CarteSkeletonArticleMobile key={index} />
                      ))}
                    </div>
                  ) : (
                    <div
                      key={`${cleCorps}-${etat}-mobile`}
                      className="divide-y divide-border animate-in fade-in duration-200 motion-reduce:animate-none"
                    >
                      {articlesTries.map((article) => (
                        <CarteArticleMobile
                          key={article.id}
                          article={article}
                          onEditer={ouvrirEditeurArticle}
                          onBasculerPublication={basculerPublication}
                          onBasculerALaUne={basculerALaUne}
                          onArchiver={archiverArticle}
                          onSupprimer={demanderSuppression}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* ─── Vue desktop ─── */}
                <div className="hidden md:block">
                  <div className="overflow-x-auto scrollbar-thin">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <EnteteTriable
                            colonne={COLONNES.find((c) => c.cle === "titre")}
                            tri={tri}
                            onTri={basculerTri}
                          />
                          <EnteteTriable
                            colonne={COLONNES.find((c) => c.cle === "statut")}
                            tri={tri}
                            onTri={basculerTri}
                          />
                          <EnteteTriable
                            colonne={COLONNES.find(
                              (c) => c.cle === "categorie"
                            )}
                            tri={tri}
                            onTri={basculerTri}
                          />
                          <EnteteTriable
                            colonne={COLONNES.find((c) => c.cle === "vues")}
                            tri={tri}
                            onTri={basculerTri}
                            aligneDroite
                          />
                          <EnteteTriable
                            colonne={COLONNES.find((c) => c.cle === "publie")}
                            tri={tri}
                            onTri={basculerTri}
                            aligneDroite
                          />
                          <TableHead className="w-10">
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody
                        key={`${cleCorps}-${etat}-desktop`}
                        className="animate-in fade-in duration-200 motion-reduce:animate-none"
                      >
                        {isLoading ? (
                          [...Array(10)].map((_, index) => (
                            <LigneSkeletonArticle key={index} />
                          ))
                        ) : (
                          articlesTries.map((article) => (
                            <TableRow
                              key={article.id}
                              className="transition-colors hover:bg-muted/50"
                            >
                              <TableCell>
                                <button
                                  type="button"
                                  onClick={() => ouvrirEditeurArticle(article)}
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
                                <Badge
                                  variant={
                                    VARIANTE_STATUT[article.status] ??
                                    "outline"
                                  }
                                >
                                  {LIBELLE_STATUT[article.status] ??
                                    article.status}
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
                                <div className="flex justify-end">
                                  <MenuActionsArticle
                                    article={article}
                                    onEditer={ouvrirEditeurArticle}
                                    onBasculerPublication={basculerPublication}
                                    onBasculerALaUne={basculerALaUne}
                                    onArchiver={archiverArticle}
                                    onSupprimer={demanderSuppression}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </TransitionEtat>
        </Bloc>
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
        <DialogSupprArticle
          suppression={suppression}
          supprimerMutation={supprimerMutation}
          setSuppression={setSuppression}
        />
      )}
    </>
  )
}

export default ListeArticles