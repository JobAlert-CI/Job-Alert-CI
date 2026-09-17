import { memo, useCallback, useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  FolderTree,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import {
  useAdminCategoriesQuery,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "@/features/admin-contenu.tools"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"
import { Badge } from "@/components/ui/badge"
import BtnAction from "@/components/admin/BtnAction"
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
import { SectionErreur, SectionVide,TransitionEtat } from "@/components/admin/EtatsSection"
import DialogCategorie from "@/components/dialog/DialogCategorie"
import DialogSupprCategorie from "@/components/dialog/DialogSupprCategorie"
import Bloc from "@/components/admin/Bloc"

/* ─────────────────────────────────────────────────────────────────────
Onglet 14.2a — Catégories d'articles : CRUD simple + tri par colonne.
Version améliorée :
- skeleton fidèle desktop/mobile
- animation de changement d'état
- mode mobile en cartes
- tri mobile accessible
───────────────────────────────────────────────────────────────────── */

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
    cle: "label",
    libelle: "Catégorie",
    directionInitiale: "asc",
    triValeur: (c) => (c.label ?? "").toLowerCase(),
  },
  {
    cle: "code",
    libelle: "Code",
    directionInitiale: "asc",
    className: "hidden font-mono text-[10px] md:table-cell",
    triValeur: (c) => c.code ?? "",
  },
  {
    cle: "ordre",
    libelle: "Ordre",
    directionInitiale: "asc",
    className: "text-right",
    triValeur: (c) => c.sort_order ?? 0,
  },
  {
    cle: "statut",
    libelle: "Statut",
    directionInitiale: "desc",
    triValeur: (c) => (c.is_active ? 1 : 0),
  },
]

const OPTIONS_TRI_MOBILE = COLONNES.map((colonne) => ({
  valeur: colonne.cle,
  libelle: colonne.libelle,
}))

/* ─── Actions partagées desktop / mobile ─── */
const ActionsCategorie = memo(({ categorie, onModifier, onSupprimer }) => {
  const libelle = categorie.label ?? categorie.code ?? "la catégorie"

  return (
    <div className="flex items-center justify-end gap-1">
      <BtnAction
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => onModifier(categorie)}
        aria-label={`Modifier ${libelle}`}
      >
        <Pencil aria-hidden />
      </BtnAction>

      <BtnAction
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => onSupprimer(categorie)}
        aria-label={`Supprimer ${libelle}`}
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 aria-hidden />
      </BtnAction>
    </div>
  )
})

ActionsCategorie.displayName = "ActionsCategorie"

/* ─── Skeleton desktop fidèle aux colonnes réelles ─── */
const LigneSkeletonCategorie = () => (
  <TableRow className="hover:bg-transparent" aria-hidden="true">
    <TableCell>
      <Skeleton className="h-4 w-40" />
    </TableCell>

    <TableCell className="hidden md:table-cell">
      <Skeleton className="h-3 w-20" />
    </TableCell>

    <TableCell className="text-right">
      <Skeleton className="ml-auto h-3.5 w-8" />
    </TableCell>

    <TableCell>
      <Skeleton className="h-5 w-16 rounded-full" />
    </TableCell>

    <TableCell>
      <div className="flex justify-end gap-1">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
      </div>
    </TableCell>
  </TableRow>
)

/* ─── Skeleton mobile fidèle à la carte réelle ─── */
const CarteSkeletonCategorieMobile = () => (
  <div className="p-4" aria-hidden="true">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-[65%]" />
        <Skeleton className="h-2.5 w-20" />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
      </div>
    </div>

    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-3 w-20" />
    </div>
  </div>
)

/* ─── Carte mobile réelle ─── */
const CarteCategorieMobile = memo(
  ({ categorie, onModifier, onSupprimer }) => {
    return (
      <article className="p-4 transition-colors hover:bg-muted/40">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onModifier(categorie)}
              className="block w-full truncate text-left text-sm font-medium text-primary underline-offset-4 hover:underline"
              title={categorie.label}
            >
              {categorie.label}
            </button>

            <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
              {categorie.code ?? "—"}
            </p>
          </div>

          <ActionsCategorie
            categorie={categorie}
            onModifier={onModifier}
            onSupprimer={onSupprimer}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant={categorie.is_active ? "secondary" : "outline"}>
            {categorie.is_active ? "Active" : "Inactive"}
          </Badge>

          <span className="text-xs text-muted-foreground">
            Ordre : {categorie.sort_order ?? 0}
          </span>
        </div>
      </article>
    )
  }
)

CarteCategorieMobile.displayName = "CarteCategorieMobile"

const ListeCategories = () => {
  const {
    data: categories,
    isLoading,
    isError,
    refetch,
  } = useAdminCategoriesQuery()

  const [edition, setEdition] = useState(null) // null fermé ; {} création ; catégorie = édition
  const [suppression, setSuppression] = useState(null)

  /* Tri INITIALISÉ : « Ordre » ascendant = ordre serveur d'affichage. */
  const [tri, setTri] = useState({ cle: "ordre", direction: "asc" })

  const creerMutation = useCreateCategory()
  const modifierMutation = useUpdateCategory()
  const supprimerMutation = useDeleteCategory()

  const ouvrirCreation = useCallback(() => {
    setEdition({})
  }, [])

  const fermerEdition = useCallback(() => {
    setEdition(null)
  }, [])

  const modifierCategorie = useCallback((categorie) => {
    setEdition(categorie)
  }, [])

  const supprimerCategorie = useCallback((categorie) => {
    setSuppression(categorie)
  }, [])

  const categoriesTriees = useMemo(() => {
    const base = categories ?? []

    if (!tri) return base

    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base

    const copie = [...base].sort((a, b) =>
      comparerValeurs(colonne.triValeur(a), colonne.triValeur(b))
    )

    return tri.direction === "asc" ? copie : copie.reverse()
  }, [categories, tri])

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
      if (!prec) return prec

      return {
        ...prec,
        direction: prec.direction === "asc" ? "desc" : "asc",
      }
    })
  }, [])

  /* key = fondu léger du corps à chaque changement de tri / état. */
  const cleCorps = `${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  const etat = isError
    ? "erreur"
    : isLoading
      ? "chargement"
      : !categories?.length
        ? "vide"
        : "donnees"

  return (
    <>
      <SectionCardAdmin
        title="Catégories"
        description="Catégories d'articles — utilisées dans les filtres publics et l'onglet Articles. Tri par colonne."
        icon={FolderTree}
        contentClassName="p-0 sm:p-0"
        action={
          <BtnAction type="button" size="sm" onClick={ouvrirCreation}>
            <Plus aria-hidden /> Nouvelle catégorie
          </BtnAction>
        }
      >
        {/* ─── Tri mobile ─── */}
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3 md:hidden">
          <p className="text-xs font-medium text-muted-foreground">Tri</p>

          <div className="flex items-center gap-2">
            <Select value={tri?.cle ?? "aucun"} onValueChange={changerTriMobile}>
              <SelectTrigger
                className="h-8 flex-1 text-xs"
                aria-label="Choisir la colonne de tri"
              >
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="aucun">Ordre serveur</SelectItem>
                {OPTIONS_TRI_MOBILE.map((option) => (
                  <SelectItem key={option.valeur} value={option.valeur}>
                    {option.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <BtnAction
              type="button"
              variant="outline"
              size="xs"
              className="h-8 shrink-0 text-xs"
              onClick={inverserTriMobile}
              disabled={!tri}
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

        {/* ─── Corps : mobile cards + desktop table ─── */}
        <Bloc>
          <TransitionEtat etat={`${cleCorps}-${etat}`}>
            {isError ? (
              <div className="p-4">
                <SectionErreur
                  onRetry={refetch}
                  message="Impossible de charger les catégories."
                />
              </div>
            ) : !categories?.length && !isLoading ? (
              <div className="p-4">
                <SectionVide message="Aucune catégorie." />
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
                      aria-label="Chargement des catégories"
                    >
                      <span className="sr-only">
                        Chargement des catégories…
                      </span>

                      {[...Array(10)].map((_, index) => (
                        <CarteSkeletonCategorieMobile key={index} />
                      ))}
                    </div>
                  ) : (
                    <div
                      key={`${cleCorps}-${etat}-mobile`}
                      className="divide-y divide-border animate-in fade-in duration-200 motion-reduce:animate-none"
                    >
                      {categoriesTriees.map((categorie) => (
                        <CarteCategorieMobile
                          key={categorie.id}
                          categorie={categorie}
                          onModifier={modifierCategorie}
                          onSupprimer={supprimerCategorie}
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
                            colonne={COLONNES.find((c) => c.cle === "label")}
                            tri={tri}
                            onTri={basculerTri}
                          />
                          <EnteteTriable
                            colonne={COLONNES.find((c) => c.cle === "code")}
                            tri={tri}
                            onTri={basculerTri}
                          />
                          <EnteteTriable
                            colonne={COLONNES.find((c) => c.cle === "ordre")}
                            tri={tri}
                            onTri={basculerTri}
                            aligneDroite
                          />
                          <EnteteTriable
                            colonne={COLONNES.find((c) => c.cle === "statut")}
                            tri={tri}
                            onTri={basculerTri}
                          />
                          <TableHead className="w-20">
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
                            <LigneSkeletonCategorie key={index} />
                          ))
                        ) : (
                          categoriesTriees.map((categorie) => (
                            <TableRow
                              key={categorie.id}
                              className="transition-colors hover:bg-muted/50"
                            >
                              <TableCell className="text-sm font-medium">
                                {categorie.label}
                              </TableCell>

                              <TableCell className="hidden font-mono text-[10px] text-muted-foreground md:table-cell">
                                {categorie.code ?? "—"}
                              </TableCell>

                              <TableCell className="text-right tabular-nums text-muted-foreground">
                                {categorie.sort_order ?? 0}
                              </TableCell>

                              <TableCell>
                                <Badge
                                  variant={
                                    categorie.is_active
                                      ? "secondary"
                                      : "outline"
                                  }
                                >
                                  {categorie.is_active
                                    ? "Active"
                                    : "Inactive"}
                                </Badge>
                              </TableCell>

                              <TableCell>
                                <ActionsCategorie
                                  categorie={categorie}
                                  onModifier={modifierCategorie}
                                  onSupprimer={supprimerCategorie}
                                />
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

      {/* Dialog création / édition */}
      {edition && (
        <DialogCategorie
          categorie={edition.id ? edition : null}
          creer={creerMutation}
          modifier={modifierMutation}
          onFermer={fermerEdition}
        />
      )}

      {/* Confirmation suppression */}
      {suppression && (
        <DialogSupprCategorie
          suppression={suppression}
          setSuppression={setSuppression}
          supprimerMutation={supprimerMutation}
        />
      )}
    </>
  )
}

export default ListeCategories