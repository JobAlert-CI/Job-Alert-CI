import { memo, useCallback, useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  Lightbulb,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import {
  useAdminDailyTipsQuery,
  useCreateDailyTip,
  useUpdateDailyTip,
  useDeleteDailyTip,
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
import Bloc from "@/components/admin/Bloc"
import DialogConseil from "@/components/dialog/DialogConseil"
import DialogSupprConseil from "@/components/dialog/DialogSupprConseil"

/* ─────────────────────────────────────────────────────────────────────
Onglet Conseils du jour : CRUD + créneau de rotation + tri.
Version améliorée :
- skeleton fidèle desktop/mobile
- animation de changement d'état
- mode mobile en cartes
- tri mobile accessible
───────────────────────────────────────────────────────────────────── */

const JOURS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
]

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
    cle: "jour",
    libelle: "Jour",
    directionInitiale: "asc",
    triValeur: (t) => t.rotation_order ?? 0,
  },
  {
    cle: "conseil",
    libelle: "Conseil",
    directionInitiale: "asc",
    triValeur: (t) => (t.text ?? "").toLowerCase(),
  },
  {
    cle: "statut",
    libelle: "Statut",
    directionInitiale: "desc",
    triValeur: (t) => (t.is_active ? 1 : 0),
  },
]

const OPTIONS_TRI_MOBILE = COLONNES.map((colonne) => ({
  valeur: colonne.cle,
  libelle: colonne.libelle,
}))

/* ─── Actions partagées desktop / mobile ─── */
const ActionsConseil = memo(({ conseil, onModifier, onSupprimer }) => {
  const libelle = conseil.text ?? "le conseil"

  return (
    <div className="flex items-center justify-end gap-1">
      <BtnAction
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => onModifier(conseil)}
        aria-label={`Modifier ${libelle}`}
      >
        <Pencil aria-hidden />
      </BtnAction>

      <BtnAction
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => onSupprimer(conseil)}
        aria-label={`Supprimer ${libelle}`}
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 aria-hidden />
      </BtnAction>
    </div>
  )
})

ActionsConseil.displayName = "ActionsConseil"

/* ─── Skeleton desktop fidèle aux colonnes réelles ─── */
const LigneSkeletonConseil = () => (
  <TableRow className="hover:bg-transparent" aria-hidden="true">
    <TableCell className="whitespace-nowrap">
      <div className="flex items-center gap-1">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-3 w-12" />
      </div>
    </TableCell>

    <TableCell className="max-w-96">
      <Skeleton className="h-3.5 w-72" />
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
const CarteSkeletonConseilMobile = () => (
  <div className="p-4" aria-hidden="true">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>

        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-[85%]" />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
      </div>
    </div>
  </div>
)

/* ─── Carte mobile réelle ─── */
const CarteConseilMobile = memo(
  ({ conseil, parCreneau, onModifier, onSupprimer }) => {
    const nbCeJour = parCreneau.get(conseil.rotation_order) ?? 0

    return (
      <article className="p-4 transition-colors hover:bg-muted/40">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {JOURS[conseil.rotation_order] ?? `#${conseil.rotation_order}`}
              </Badge>

              {nbCeJour > 1 && (
                <span className="text-[10px] text-muted-foreground">
                  ({nbCeJour} ce jour)
                </span>
              )}

              <Badge variant={conseil.is_active ? "secondary" : "outline"}>
                {conseil.is_active ? "Actif" : "Inactif"}
              </Badge>
            </div>

            <p
              className="mt-2 line-clamp-3 text-xs text-muted-foreground"
              title={conseil.text ?? ""}
            >
              {conseil.text ?? "—"}
            </p>
          </div>

          <ActionsConseil
            conseil={conseil}
            onModifier={onModifier}
            onSupprimer={onSupprimer}
          />
        </div>
      </article>
    )
  }
)

CarteConseilMobile.displayName = "CarteConseilMobile"

const ListeConseils = () => {
  const {
    data: conseils,
    isLoading,
    isError,
    refetch,
  } = useAdminDailyTipsQuery()

  const [edition, setEdition] = useState(null)
  const [suppression, setSuppression] = useState(null)

  /* Tri INITIALISÉ : « Jour » ascendant = ordre de la semaine. */
  const [tri, setTri] = useState({ cle: "jour", direction: "asc" })

  const creerMutation = useCreateDailyTip()
  const modifierMutation = useUpdateDailyTip()
  const supprimerMutation = useDeleteDailyTip()

  const ouvrirCreation = useCallback(() => {
    setEdition({})
  }, [])

  const fermerEdition = useCallback(() => {
    setEdition(null)
  }, [])

  const modifierConseil = useCallback((conseil) => {
    setEdition(conseil)
  }, [])

  const supprimerConseil = useCallback((conseil) => {
    setSuppression(conseil)
  }, [])

  /* Compte par créneau (affiché en table + dialog) + compteurs onglet. */
  const parCreneau = useMemo(() => {
    const map = new Map()

    for (const tip of conseils ?? []) {
      map.set(
        tip.rotation_order,
        (map.get(tip.rotation_order) ?? 0) + 1
      )
    }

    return map
  }, [conseils])

  const conseilsTries = useMemo(() => {
    const base = conseils ?? []

    if (!tri) {
      return [...base].sort(
        (a, b) => (a.rotation_order ?? 0) - (b.rotation_order ?? 0)
      )
    }

    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base

    const copie = [...base].sort((a, b) =>
      comparerValeurs(colonne.triValeur(a), colonne.triValeur(b))
    )

    return tri.direction === "asc" ? copie : copie.reverse()
  }, [conseils, tri])

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
      : !conseils?.length
        ? "vide"
        : "donnees"

  const afficherControles = !isError && (isLoading || !!conseils?.length)

  return (
    <>
      <SectionCardAdmin
        title="Conseils du jour"
        description="Plusieurs conseils peuvent partager un jour — le site public les fait tourner déterministement. Tri par colonne."
        icon={Lightbulb}
        contentClassName="p-0 sm:p-0"
        action={
          <BtnAction type="button" size="sm" onClick={ouvrirCreation}>
            <Plus aria-hidden /> Nouveau conseil
          </BtnAction>
        }
      >
        {/* ─── Tri mobile ─── */}
        {afficherControles && (
          <div className="flex flex-col gap-2 border-b border-border px-4 py-3 md:hidden">
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
                  message="Impossible de charger les conseils."
                />
              </div>
            ) : !conseils?.length && !isLoading ? (
              <div className="p-4">
                <SectionVide message="Aucun conseil pour le moment." />
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
                      aria-label="Chargement des conseils"
                    >
                      <span className="sr-only">
                        Chargement des conseils…
                      </span>

                      {[...Array(5)].map((_, index) => (
                        <CarteSkeletonConseilMobile key={index} />
                      ))}
                    </div>
                  ) : (
                    <div
                      key={`${cleCorps}-${etat}-mobile`}
                      className="divide-y divide-border animate-in fade-in duration-200 motion-reduce:animate-none"
                    >
                      {conseilsTries.map((conseil) => (
                        <CarteConseilMobile
                          key={conseil.id}
                          conseil={conseil}
                          parCreneau={parCreneau}
                          onModifier={modifierConseil}
                          onSupprimer={supprimerConseil}
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
                            colonne={COLONNES.find((c) => c.cle === "jour")}
                            tri={tri}
                            onTri={basculerTri}
                          />

                          <EnteteTriable
                            colonne={COLONNES.find(
                              (c) => c.cle === "conseil"
                            )}
                            tri={tri}
                            onTri={basculerTri}
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
                          [...Array(5)].map((_, index) => (
                            <LigneSkeletonConseil key={index} />
                          ))
                        ) : (
                          conseilsTries.map((conseil) => (
                            <TableRow
                              key={conseil.id}
                              className="transition-colors hover:bg-muted/50"
                            >
                              <TableCell className="whitespace-nowrap">
                                <Badge variant="outline">
                                  {JOURS[conseil.rotation_order] ??
                                    `#${conseil.rotation_order}`}
                                </Badge>

                                {(parCreneau.get(conseil.rotation_order) ??
                                  0) > 1 && (
                                  <span className="ml-1 text-[10px] text-muted-foreground">
                                    (
                                    {parCreneau.get(conseil.rotation_order)}
                                    ce jour)
                                  </span>
                                )}
                              </TableCell>

                              <TableCell className="max-w-96">
                                <span
                                  className="block truncate text-xs"
                                  title={conseil.text ?? ""}
                                >
                                  {conseil.text ?? "—"}
                                </span>
                              </TableCell>

                              <TableCell>
                                <Badge
                                  variant={
                                    conseil.is_active
                                      ? "secondary"
                                      : "outline"
                                  }
                                >
                                  {conseil.is_active ? "Actif" : "Inactif"}
                                </Badge>
                              </TableCell>

                              <TableCell>
                                <ActionsConseil
                                  conseil={conseil}
                                  onModifier={modifierConseil}
                                  onSupprimer={supprimerConseil}
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
        <DialogConseil
          conseil={edition.id ? edition : null}
          parCreneau={parCreneau}
          creer={creerMutation}
          modifier={modifierMutation}
          onFermer={fermerEdition}
        />
      )}

      {/* Confirmation suppression */}
      {suppression && (
        <DialogSupprConseil
          suppression={suppression}
          parCreneau={parCreneau}
          supprimerMutation={supprimerMutation}
          setSuppression={setSuppression}
        />
      )}
    </>
  )
}

export default ListeConseils