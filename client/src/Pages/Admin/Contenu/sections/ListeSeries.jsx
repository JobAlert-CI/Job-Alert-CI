import { memo, useCallback, useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  Layers,
  ListOrdered,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import {
  useAdminSeriesQuery,
  useCreateSeries,
  useUpdateSeries,
  useDeleteSeries,
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
import { SectionErreur, SectionVide, TransitionEtat } from "@/components/admin/EtatsSection"
import DialogSerie from "@/components/dialog/DialogSerie"
import DialogComposition from "@/components/dialog/DialogComposition"
import DialogSupprSerie from "@/components/dialog/DialogSupprSerie"
import Bloc from "@/components/admin/Bloc"

/* ─────────────────────────────────────────────────────────────────────
Onglet Séries éditoriales : CRUD + composition + tri par colonne.
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

/* Colonnes triables — « Description » et les actions restent des en-têtes simples. */
const COLONNES = [
  {
    cle: "titre",
    libelle: "Série",
    directionInitiale: "asc",
    triValeur: (s) => (s.title ?? "").toLowerCase(),
  },
  {
    cle: "ordre",
    libelle: "Ordre",
    directionInitiale: "asc",
    className: "text-right",
    triValeur: (s) => s.sort_order ?? 0,
  },
  {
    cle: "statut",
    libelle: "Statut",
    directionInitiale: "desc",
    triValeur: (s) => (s.is_active ? 1 : 0),
  },
]

const OPTIONS_TRI_MOBILE = COLONNES.map((colonne) => ({
  valeur: colonne.cle,
  libelle: colonne.libelle,
}))

/* ─── Actions partagées desktop / mobile ─── */
const ActionsSerie = memo(({ serie, onComposer, onModifier, onSupprimer }) => {
  const libelle = serie.title ?? "la série"

  return (
    <div className="flex items-center justify-end gap-1">
      <BtnAction
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => onComposer(serie)}
        aria-label={`Composition de ${libelle}`}
        title="Composer la série"
      >
        <ListOrdered aria-hidden />
      </BtnAction>

      <BtnAction
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => onModifier(serie)}
        aria-label={`Modifier ${libelle}`}
      >
        <Pencil aria-hidden />
      </BtnAction>

      <BtnAction
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => onSupprimer(serie)}
        aria-label={`Supprimer ${libelle}`}
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 aria-hidden />
      </BtnAction>
    </div>
  )
})

ActionsSerie.displayName = "ActionsSerie"

/* ─── Skeleton desktop fidèle aux colonnes réelles ─── */
const LigneSkeletonSerie = () => (
  <TableRow className="hover:bg-transparent" aria-hidden="true">
    <TableCell>
      <Skeleton className="h-4 w-44" />
    </TableCell>

    <TableCell className="hidden md:table-cell">
      <Skeleton className="h-3 w-56" />
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
        <Skeleton className="size-7 rounded-md" />
      </div>
    </TableCell>
  </TableRow>
)

/* ─── Skeleton mobile fidèle à la carte réelle ─── */
const CarteSkeletonSerieMobile = () => (
  <div className="p-4" aria-hidden="true">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-[68%]" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-[82%]" />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Skeleton className="size-7 rounded-md" />
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
const CarteSerieMobile = memo(
  ({ serie, onComposer, onModifier, onSupprimer }) => {
    return (
      <article className="p-4 transition-colors hover:bg-muted/40">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onModifier(serie)}
              className="block w-full truncate text-left text-sm font-medium text-primary underline-offset-4 hover:underline"
              title={serie.title}
            >
              {serie.title}
            </button>

            <p
              className="mt-1 line-clamp-2 text-xs text-muted-foreground"
              title={serie.description ?? ""}
            >
              {serie.description ?? "—"}
            </p>
          </div>

          <ActionsSerie
            serie={serie}
            onComposer={onComposer}
            onModifier={onModifier}
            onSupprimer={onSupprimer}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant={serie.is_active ? "secondary" : "outline"}>
            {serie.is_active ? "Active" : "Inactive"}
          </Badge>

          <span className="text-xs text-muted-foreground">
            Ordre : {serie.sort_order ?? 0}
          </span>
        </div>
      </article>
    )
  }
)

CarteSerieMobile.displayName = "CarteSerieMobile"

const ListeSeries = () => {
  const {
    data: series,
    isLoading,
    isError,
    refetch,
  } = useAdminSeriesQuery()

  const [edition, setEdition] = useState(null)
  const [composition, setComposition] = useState(null)
  const [suppression, setSuppression] = useState(null)

  /* Tri INITIALISÉ : « Ordre » ascendant = ordre serveur d'affichage. */
  const [tri, setTri] = useState({ cle: "ordre", direction: "asc" })

  const creerMutation = useCreateSeries()
  const modifierMutation = useUpdateSeries()
  const supprimerMutation = useDeleteSeries()

  const ouvrirCreation = useCallback(() => {
    setEdition({})
  }, [])

  const fermerEdition = useCallback(() => {
    setEdition(null)
  }, [])

  const modifierSerie = useCallback((serie) => {
    setEdition(serie)
  }, [])

  const ouvrirComposition = useCallback((serie) => {
    setComposition(serie)
  }, [])

  const fermerComposition = useCallback(() => {
    setComposition(null)
  }, [])

  const supprimerSerie = useCallback((serie) => {
    setSuppression(serie)
  }, [])

  const seriesTriees = useMemo(() => {
    const base = series ?? []

    if (!tri) return base

    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base

    const copie = [...base].sort((a, b) =>
      comparerValeurs(colonne.triValeur(a), colonne.triValeur(b))
    )

    return tri.direction === "asc" ? copie : copie.reverse()
  }, [series, tri])

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
      : !series?.length
        ? "vide"
        : "donnees"

  const afficherControles = !isError && (isLoading || !!series?.length)

  return (
    <>
      <SectionCardAdmin
        title="Séries"
        description="Séries éditoriales — collections d'articles (guides, dossiers…). Tri par colonne."
        icon={Layers}
        contentClassName="p-0 sm:p-0"
        action={
          <BtnAction type="button" size="sm" onClick={ouvrirCreation}>
            <Plus aria-hidden /> Nouvelle série
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
                  message="Impossible de charger les séries."
                />
              </div>
            ) : !series?.length && !isLoading ? (
              <div className="p-4">
                <SectionVide message="Aucune série pour le moment." />
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
                      aria-label="Chargement des séries"
                    >
                      <span className="sr-only">Chargement des séries…</span>

                      {[...Array(10)].map((_, index) => (
                        <CarteSkeletonSerieMobile key={index} />
                      ))}
                    </div>
                  ) : (
                    <div
                      key={`${cleCorps}-${etat}-mobile`}
                      className="divide-y divide-border animate-in fade-in duration-200 motion-reduce:animate-none"
                    >
                      {seriesTriees.map((serie) => (
                        <CarteSerieMobile
                          key={serie.id}
                          serie={serie}
                          onComposer={ouvrirComposition}
                          onModifier={modifierSerie}
                          onSupprimer={supprimerSerie}
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

                          <TableHead className="hidden md:table-cell">
                            Description
                          </TableHead>

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
                          [...Array(10)].map((_, index) => (
                            <LigneSkeletonSerie key={index} />
                          ))
                        ) : (
                          seriesTriees.map((serie) => (
                            <TableRow
                              key={serie.id}
                              className="transition-colors hover:bg-muted/50"
                            >
                              <TableCell className="text-sm font-medium">
                                {serie.title}
                              </TableCell>

                              <TableCell
                                className="hidden max-w-64 truncate text-xs text-muted-foreground md:table-cell"
                                title={serie.description ?? ""}
                              >
                                {serie.description ?? "—"}
                              </TableCell>

                              <TableCell className="text-right tabular-nums text-muted-foreground">
                                {serie.sort_order ?? 0}
                              </TableCell>

                              <TableCell>
                                <Badge
                                  variant={
                                    serie.is_active ? "secondary" : "outline"
                                  }
                                >
                                  {serie.is_active ? "Active" : "Inactive"}
                                </Badge>
                              </TableCell>

                              <TableCell>
                                <ActionsSerie
                                  serie={serie}
                                  onComposer={ouvrirComposition}
                                  onModifier={modifierSerie}
                                  onSupprimer={supprimerSerie}
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

      {/* Dialog CRUD */}
      {edition && (
        <DialogSerie
          serie={edition.id ? edition : null}
          creer={creerMutation}
          modifier={modifierMutation}
          onFermer={fermerEdition}
        />
      )}

      {/* Dialog composition */}
      {composition && (
        <DialogComposition serie={composition} onFermer={fermerComposition} />
      )}

      {/* Confirmation suppression */}
      {suppression && (
        <DialogSupprSerie
          suppression={suppression}
          setSuppression={setSuppression}
          supprimerMutation={supprimerMutation}
        />
      )}
    </>
  )
}

export default ListeSeries