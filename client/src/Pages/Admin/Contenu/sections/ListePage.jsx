import { memo, useCallback, useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  FileText,
  Globe,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { useNotify } from "@/contexts/Notify.context"
import {
  useAdminPagesQuery,
  useCreatePage,
  useUpdatePage,
  useChangerStatutPage,
  useDeletePage,
  messageErreurContenu,
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
import Bloc from "@/components/admin/Bloc"
import DialogPageStatique from "@/components/dialog/DialogPageStatique"
import DialogSupprPageStatic from "@/components/dialog/DialogSupprPageStatic"

/* ─────────────────────────────────────────────────────────────────────
Onglet Pages statiques : CRUD + statut + tri.
Version améliorée :
- skeleton fidèle desktop/mobile
- animation de changement d'état
- mode mobile en cartes
- tri mobile accessible
───────────────────────────────────────────────────────────────────── */

const VARIANTE_STATUT = {
  draft: "outline",
  published: "secondary",
  archived: "outline",
}

const LIBELLE_STATUT = {
  draft: "Brouillon",
  published: "Publiée",
  archived: "Archivée",
}

const LIBELLE_TYPE = {
  legal_page: "Légale",
  static_page: "Statique",
}

const RANG_STATUT = {
  draft: 1,
  published: 2,
  archived: 3,
}

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

/* Colonnes triables. */
const COLONNES = [
  {
    cle: "titre",
    libelle: "Page",
    directionInitiale: "asc",
    triValeur: (p) => (p.title ?? "").toLowerCase(),
  },
  {
    cle: "type",
    libelle: "Type",
    directionInitiale: "asc",
    className: "hidden md:table-cell",
    triValeur: (p) => LIBELLE_TYPE[p.content_type] ?? p.content_type ?? "",
  },
  {
    cle: "statut",
    libelle: "Statut",
    directionInitiale: "asc",
    triValeur: (p) => RANG_STATUT[p.status] ?? 0,
  },
]

const OPTIONS_TRI_MOBILE = COLONNES.map((colonne) => ({
  valeur: colonne.cle,
  libelle: colonne.libelle,
}))

/* ─── Actions partagées desktop / mobile ─── */
const ActionsPage = memo(
  ({ page, onChangerStatut, onModifier, onSupprimer, statutEnCours }) => {
    const libelle = page.title ?? page.slug ?? "la page"
    const statutCible =
      page.status === "published" ? "draft" : "published"
    const libelleStatut =
      page.status === "published" ? "Dépublier" : "Publier"

    return (
      <div className="flex items-center justify-end gap-1">
        <BtnAction
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => onChangerStatut(page, statutCible)}
          disabled={statutEnCours}
          aria-label={libelleStatut}
        >
          {libelleStatut}
        </BtnAction>

        <BtnAction
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => onModifier(page)}
          aria-label={`Modifier ${libelle}`}
        >
          <Pencil aria-hidden />
        </BtnAction>

        <BtnAction
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => onSupprimer(page)}
          aria-label={`Supprimer ${libelle}`}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 aria-hidden />
        </BtnAction>
      </div>
    )
  }
)

ActionsPage.displayName = "ActionsPage"

/* ─── Skeleton desktop fidèle aux colonnes réelles ─── */
const LigneSkeletonPage = () => (
  <TableRow className="hover:bg-transparent" aria-hidden="true">
    <TableCell>
      <div className="flex flex-col gap-1.5 py-0.5">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-2.5 w-24" />
      </div>
    </TableCell>

    <TableCell className="hidden md:table-cell">
      <Skeleton className="h-3 w-16" />
    </TableCell>

    <TableCell>
      <Skeleton className="h-5 w-20 rounded-full" />
    </TableCell>

    <TableCell>
      <div className="flex justify-end gap-1">
        <Skeleton className="h-7 w-20 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
      </div>
    </TableCell>
  </TableRow>
)

/* ─── Skeleton mobile fidèle à la carte réelle ─── */
const CarteSkeletonPageMobile = () => (
  <div className="p-4" aria-hidden="true">
    <div className="space-y-3">
      <div className="space-y-2">
        <Skeleton className="h-4 w-[72%]" />
        <Skeleton className="h-2.5 w-24" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-1">
        <Skeleton className="h-7 w-20 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
      </div>
    </div>
  </div>
)

/* ─── Carte mobile réelle ─── */
const CartePageMobile = memo(
  ({ page, onChangerStatut, onModifier, onSupprimer, statutEnCours }) => {
    return (
      <article className="p-4 transition-colors hover:bg-muted/40">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => onModifier(page)}
            className="block w-full text-left"
            aria-label={`Modifier ${page.title ?? page.slug}`}
            title={page.title ?? page.slug}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
              <FileText
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="truncate">
                {page.title ?? page.slug}
              </span>
            </span>
          </button>

          <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
            /{page.slug}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {LIBELLE_TYPE[page.content_type] ?? page.content_type ?? "—"}
          </Badge>

          <Badge variant={VARIANTE_STATUT[page.status] ?? "outline"}>
            {LIBELLE_STATUT[page.status] ?? page.status}
          </Badge>
        </div>

        <div className="mt-3">
          <ActionsPage
            page={page}
            onChangerStatut={onChangerStatut}
            onModifier={onModifier}
            onSupprimer={onSupprimer}
            statutEnCours={statutEnCours}
          />
        </div>
      </article>
    )
  }
)

CartePageMobile.displayName = "CartePageMobile"

const ListePage = () => {
  const notify = useNotify()

  const {
    data: pages,
    isLoading,
    isError,
    refetch,
  } = useAdminPagesQuery()

  const [edition, setEdition] = useState(null)
  const [suppression, setSuppression] = useState(null)

  /* Tri INITIALISÉ : « Page » ascendante (alphabétique). */
  const [tri, setTri] = useState({ cle: "titre", direction: "asc" })

  const creerMutation = useCreatePage()
  const modifierMutation = useUpdatePage()
  const statutMutation = useChangerStatutPage()
  const supprimerMutation = useDeletePage()

  const ouvrirCreation = useCallback(() => {
    setEdition({})
  }, [])

  const fermerEdition = useCallback(() => {
    setEdition(null)
  }, [])

  const modifierPage = useCallback((page) => {
    setEdition(page)
  }, [])

  const supprimerPage = useCallback((page) => {
    setSuppression(page)
  }, [])

  const pagesTriees = useMemo(() => {
    const base = pages ?? []

    if (!tri) return base

    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base

    const copie = [...base].sort((a, b) =>
      comparerValeurs(colonne.triValeur(a), colonne.triValeur(b))
    )

    return tri.direction === "asc" ? copie : copie.reverse()
  }, [pages, tri])

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

  const changerStatut = useCallback(
    (page, status) =>
      statutMutation.mutate(
        { id: page.id, status },
        {
          onSuccess: () =>
            notify(
              `Page ${
                status === "published"
                  ? "publiée"
                  : status === "draft"
                    ? "dépubliée"
                    : "archivée"
              }`,
              "success"
            ),
          onError: (err) => notify(messageErreurContenu(err), "error"),
        }
      ),
    [statutMutation, notify]
  )

  /* key = fondu léger du corps à chaque changement de tri / état. */
  const cleCorps = `${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  const etat = isError
    ? "erreur"
    : isLoading
      ? "chargement"
      : !pages?.length
        ? "vide"
        : "donnees"

  const afficherControles = !isError && (isLoading || !!pages?.length)

  return (
    <>
      <SectionCardAdmin
        title="Pages statiques"
        description="Mentions légales, politique de confidentialité et pages institutionnelles. Tri par colonne."
        icon={Globe}
        contentClassName="p-0 sm:p-0"
        action={
          <BtnAction type="button" size="sm" onClick={ouvrirCreation}>
            <Plus aria-hidden /> Nouvelle page
          </BtnAction>
        }
      >
        {/* ─── Tri mobile ─── */}
        {afficherControles && (
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
                  <SelectItem value="aucun">Tri par défaut</SelectItem>
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
        )}

        {/* ─── Corps : mobile cards + desktop table ─── */}
        <Bloc>
          <TransitionEtat etat={`${cleCorps}-${etat}`}>
            {isError ? (
              <div className="p-4">
                <SectionErreur
                  onRetry={refetch}
                  message="Impossible de charger les pages."
                />
              </div>
            ) : !pages?.length && !isLoading ? (
              <div className="p-4">
                <SectionVide message="Aucune page statique — créez les mentions légales et la politique de confidentialité." />
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
                      aria-label="Chargement des pages"
                    >
                      <span className="sr-only">
                        Chargement des pages…
                      </span>

                      {[...Array(3)].map((_, index) => (
                        <CarteSkeletonPageMobile key={index} />
                      ))}
                    </div>
                  ) : (
                    <div
                      key={`${cleCorps}-${etat}-mobile`}
                      className="divide-y divide-border animate-in fade-in duration-200 motion-reduce:animate-none"
                    >
                      {pagesTriees.map((page) => (
                        <CartePageMobile
                          key={page.id}
                          page={page}
                          onChangerStatut={changerStatut}
                          onModifier={modifierPage}
                          onSupprimer={supprimerPage}
                          statutEnCours={statutMutation.isPending}
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
                            colonne={COLONNES.find((c) => c.cle === "type")}
                            tri={tri}
                            onTri={basculerTri}
                          />

                          <EnteteTriable
                            colonne={COLONNES.find((c) => c.cle === "statut")}
                            tri={tri}
                            onTri={basculerTri}
                          />

                          <TableHead className="w-28">
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody
                        key={`${cleCorps}-${etat}-desktop`}
                        className="animate-in fade-in duration-200 motion-reduce:animate-none"
                      >
                        {isLoading ? (
                          [...Array(3)].map((_, index) => (
                            <LigneSkeletonPage key={index} />
                          ))
                        ) : (
                          pagesTriees.map((page) => (
                            <TableRow
                              key={page.id}
                              className="transition-colors hover:bg-muted/50"
                            >
                              <TableCell>
                                <span className="flex items-center gap-2 text-sm font-medium">
                                  <FileText
                                    className="size-3.5 text-muted-foreground"
                                    aria-hidden
                                  />
                                  {page.title}
                                </span>

                                <span className="block truncate font-mono text-[10px] text-muted-foreground">
                                  /{page.slug}
                                </span>
                              </TableCell>

                              <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                                {LIBELLE_TYPE[page.content_type] ??
                                  page.content_type}
                              </TableCell>

                              <TableCell>
                                <Badge
                                  variant={
                                    VARIANTE_STATUT[page.status] ?? "outline"
                                  }
                                >
                                  {LIBELLE_STATUT[page.status] ?? page.status}
                                </Badge>
                              </TableCell>

                              <TableCell>
                                <ActionsPage
                                  page={page}
                                  onChangerStatut={changerStatut}
                                  onModifier={modifierPage}
                                  onSupprimer={supprimerPage}
                                  statutEnCours={statutMutation.isPending}
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
        <DialogPageStatique
          page={edition.id ? edition : null}
          creer={creerMutation}
          modifier={modifierMutation}
          onFermer={fermerEdition}
        />
      )}

      {/* Confirmation suppression */}
      {suppression && (
        <DialogSupprPageStatic
          suppression={suppression}
          supprimerMutation={supprimerMutation}
          setSuppression={setSuppression}
        />
      )}
    </>
  )
}

export default ListePage