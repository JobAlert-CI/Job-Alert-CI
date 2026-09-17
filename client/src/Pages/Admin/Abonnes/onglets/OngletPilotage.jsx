import { memo, useCallback, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowDown, ArrowUp, Eye, MoreHorizontal } from "lucide-react"
import { cn } from "cn"
import { useFiltresAbonnesAdmin } from "@/contexts/FiltresAbonnesAdmin.context"
import {
  STATUTS_ABONNE,
  useAdminSubscribersQuery,
  useChangerStatutAbonne,
  useAnonymiserAbonne,
  useActionGroupeeAbonnes,
  messageErreurAbonne,
} from "@/features/admin-abonnes.tools"
import { useNotify } from "@/contexts/Notify.context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import PaginationListe from "@/components/admin/PaginationListe"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"
import {
  SectionErreur,
  SectionVide,
  SectionAucunResultat,
} from "../components/EtatsSection"
import BarreFiltres from "../components/BarreFiltres"
import DialogConfirmRGPD from "@/components/dialog/DialogConfirmRGPD"
import Bloc, { VARIANTS_CONTENEUR } from "@/components/admin/Bloc"
import { TransitionEtat } from "@/components/admin/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
Onglet Pilotage — liste des abonnés (doc v3 §7).
Recherche par email/nom (debouncée → URL), filtres statut/filière,
sélection multiple + actions groupées, anonymisation RGPD.
Vocabulaire statut = VOCABULAIRE API : active, unsubscribed,
bouncing, paused, pending, deleted.

Améliorations :
- skeleton fidèle desktop/mobile
- animation de changement d'état
- entêtes triables
- mode mobile en cartes
- tri mobile accessible
───────────────────────────────────────────────────────────────────── */

const VARIANTE_STATUT = {
  active: "secondary",
  unsubscribed: "outline",
  bouncing: "destructive",
  paused: "outline",
  pending: "outline",
  deleted: "outline",
}

const LIBELLE_STATUT = Object.fromEntries(
  STATUTS_ABONNE.map((s) => [s.valeur, s.libelle])
)

const RANG_STATUT = {
  active: 1,
  pending: 2,
  paused: 3,
  bouncing: 4,
  unsubscribed: 5,
  deleted: 6,
}

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

/* Colonnes triables.
   NB : la liste étant paginée côté serveur, le tri s'applique ici
   à la page courante. Si l'API expose un tri serveur plus tard,
   il suffira de pousser `tri` dans `paramsApi`. */
const COLONNES = [
  {
    cle: "abonne",
    libelle: "Abonné",
    directionInitiale: "asc",
    triValeur: (a) => (a.email ?? "").toLowerCase(),
  },
  {
    cle: "statut",
    libelle: "Statut",
    directionInitiale: "asc",
    triValeur: (a) => RANG_STATUT[a.status] ?? 0,
  },
  {
    cle: "filieres",
    libelle: "Filières",
    directionInitiale: "desc",
    className: "hidden md:table-cell",
    triValeur: (a) => a.filiere_links?.length ?? 0,
  },
  {
    cle: "inscription",
    libelle: "Inscription",
    directionInitiale: "desc",
    className: "hidden lg:table-cell",
    triValeur: (a) => a.subscribed_at ?? a.created_at ?? "",
  },
]

const OPTIONS_TRI_MOBILE = COLONNES.map((colonne) => ({
  valeur: colonne.cle,
  libelle: colonne.libelle,
}))

/* ─── Menu d’actions partagé desktop / mobile ─── */
const MenuActionsAbonne = memo(
  ({ abonne, enCours, onChangerStatut, onAnonymiser }) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions pour ${abonne.email}`}
              disabled={enCours}
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
          }
        />

        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
          </DropdownMenuGroup>

          <DropdownMenuItem
            render={
              <Link
                to={`/admin/utilisateurs/${abonne.id}`}
                className="cursor-pointer"
              />
            }
          >
            <Eye className="size-3.5" aria-hidden="true" /> Voir la fiche
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => onChangerStatut(abonne, "active")}
            disabled={enCours || abonne.status === "active"}
            className="cursor-pointer"
          >
            Réactiver
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => onChangerStatut(abonne, "paused")}
            disabled={enCours || abonne.status === "paused"}
            className="cursor-pointer"
          >
            Mettre en pause
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => onChangerStatut(abonne, "bouncing")}
            disabled={enCours || abonne.status === "bouncing"}
            className="cursor-pointer"
          >
            Marquer en rebond
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => onChangerStatut(abonne, "unsubscribed")}
            disabled={enCours || abonne.status === "unsubscribed"}
            className="cursor-pointer"
          >
            Marquer désinscrit
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            onClick={() => onAnonymiser(abonne)}
            disabled={enCours || abonne.status === "deleted"}
            className="cursor-pointer"
          >
            Anonymiser (RGPD)…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
)

MenuActionsAbonne.displayName = "MenuActionsAbonne"

/* ─── Entêtes de table partagées loading / succès ─── */
const EntetesTableAbonnes = ({
  tri,
  onTri,
  toutSelectionner,
  tousPageSelectionnee,
  disabled = false,
}) => (
  <TableHeader>
    <TableRow className="hover:bg-transparent">
      <TableHead className="w-8">
        <input
          type="checkbox"
          className="size-3.5 accent-primary"
          checked={tousPageSelectionnee}
          onChange={toutSelectionner}
          disabled={disabled}
          aria-label="Sélectionner tous les abonnés de la page"
        />
      </TableHead>

      <EnteteTriable
        colonne={COLONNES.find((c) => c.cle === "abonne")}
        tri={tri}
        onTri={onTri}
      />

      <EnteteTriable
        colonne={COLONNES.find((c) => c.cle === "statut")}
        tri={tri}
        onTri={onTri}
      />

      <EnteteTriable
        colonne={COLONNES.find((c) => c.cle === "filieres")}
        tri={tri}
        onTri={onTri}
      />

      <EnteteTriable
        colonne={COLONNES.find((c) => c.cle === "inscription")}
        tri={tri}
        onTri={onTri}
      />

      <TableHead className="w-10">
        <span className="sr-only">Actions</span>
      </TableHead>
    </TableRow>
  </TableHeader>
)

/* ─── Skeleton desktop fidèle à la table réelle ─── */
const LigneSkeletonAbonne = () => (
  <TableRow className="hover:bg-transparent" aria-hidden="true">
    <TableCell className="pr-0">
      <Skeleton className="size-3.5 rounded-sm" />
    </TableCell>

    <TableCell className="max-w-56">
      <div className="space-y-1.5 py-0.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-2.5 w-24" />
      </div>
    </TableCell>

    <TableCell>
      <Skeleton className="h-5 w-20 rounded-full" />
    </TableCell>

    <TableCell className="hidden md:table-cell">
      <Skeleton className="h-3 w-16" />
    </TableCell>

    <TableCell className="hidden lg:table-cell">
      <Skeleton className="h-3.5 w-20" />
    </TableCell>

    <TableCell>
      <div className="flex justify-end">
        <Skeleton className="size-7 rounded-md" />
      </div>
    </TableCell>
  </TableRow>
)

/* ─── Skeleton mobile fidèle à la carte réelle ─── */
const CarteSkeletonAbonneMobile = () => (
  <div className="p-4" aria-hidden="true">
    <div className="flex items-start gap-3">
      <Skeleton className="mt-1 size-3.5 rounded-sm" />

      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-[72%]" />
        <Skeleton className="h-2.5 w-28" />

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>

      <Skeleton className="size-7 shrink-0 rounded-md" />
    </div>
  </div>
)

/* ─── Ligne desktop réelle ─── */
const LigneAbonne = memo(
  ({
    abonne,
    selectionne,
    enCours,
    onBasculerSelection,
    onChangerStatut,
    onAnonymiser,
  }) => {
    return (
      <TableRow
        className={cn(
          "transition-colors hover:bg-muted/50",
          enCours && "opacity-60"
        )}
      >
        <TableCell className="pr-0">
          <input
            type="checkbox"
            className="size-3.5 accent-primary"
            checked={selectionne}
            onChange={() => onBasculerSelection(abonne.id)}
            aria-label={`Sélectionner ${abonne.email}`}
          />
        </TableCell>

        <TableCell className="max-w-56">
          <Link
            to={`/admin/utilisateurs/${abonne.id}`}
            className="block truncate text-sm font-medium text-primary underline-offset-4 hover:underline"
            title={abonne.email}
          >
            {abonne.email}
          </Link>

          <span className="block text-[10px] text-muted-foreground">
            {abonne.full_name || "—"}
            {abonne.city && ` · ${abonne.city}`}
          </span>
        </TableCell>

        <TableCell>
          <Badge variant={VARIANTE_STATUT[abonne.status] ?? "outline"}>
            {LIBELLE_STATUT[abonne.status] ?? abonne.status}
          </Badge>
        </TableCell>

        <TableCell className="hidden max-w-40 truncate text-xs text-muted-foreground md:table-cell">
          {abonne.filiere_links?.length
            ? `${abonne.filiere_links.length} filière${
                abonne.filiere_links.length > 1 ? "s" : ""
              }`
            : "—"}
        </TableCell>

        <TableCell className="hidden whitespace-nowrap text-muted-foreground tabular-nums lg:table-cell">
          {dateCourte(abonne.subscribed_at ?? abonne.created_at)}
        </TableCell>

        <TableCell>
          <MenuActionsAbonne
            abonne={abonne}
            enCours={enCours}
            onChangerStatut={onChangerStatut}
            onAnonymiser={onAnonymiser}
          />
        </TableCell>
      </TableRow>
    )
  }
)

LigneAbonne.displayName = "LigneAbonne"

/* ─── Carte mobile réelle ─── */
const CarteAbonneMobile = memo(
  ({
    abonne,
    selectionne,
    enCours,
    onBasculerSelection,
    onChangerStatut,
    onAnonymiser,
  }) => {
    return (
      <article
        className={cn(
          "p-4 transition-colors hover:bg-muted/40",
          enCours && "opacity-60"
        )}
      >
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-3.5 accent-primary"
            checked={selectionne}
            onChange={() => onBasculerSelection(abonne.id)}
            aria-label={`Sélectionner ${abonne.email}`}
          />

          <div className="min-w-0 flex-1">
            <Link
              to={`/admin/utilisateurs/${abonne.id}`}
              className="block truncate text-sm font-medium text-primary underline-offset-4 hover:underline"
              title={abonne.email}
            >
              {abonne.email}
            </Link>

            <span className="mt-0.5 block text-[10px] text-muted-foreground">
              {abonne.full_name || "—"}
              {abonne.city && ` · ${abonne.city}`}
            </span>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={VARIANTE_STATUT[abonne.status] ?? "outline"}>
                {LIBELLE_STATUT[abonne.status] ?? abonne.status}
              </Badge>

              <span className="text-xs text-muted-foreground">
                {abonne.filiere_links?.length
                  ? `${abonne.filiere_links.length} filière${
                      abonne.filiere_links.length > 1 ? "s" : ""
                    }`
                  : "—"}
              </span>

              <span className="text-xs text-muted-foreground tabular-nums">
                {dateCourte(abonne.subscribed_at ?? abonne.created_at)}
              </span>
            </div>
          </div>

          <MenuActionsAbonne
            abonne={abonne}
            enCours={enCours}
            onChangerStatut={onChangerStatut}
            onAnonymiser={onAnonymiser}
          />
        </div>
      </article>
    )
  }
)

CarteAbonneMobile.displayName = "CarteAbonneMobile"

const OngletPilotage = () => {
  const notify = useNotify()

  const {
    query,
    status,
    filiereId,
    page,
    pageTaille,
    paramsApi,
    setPage,
    reinitialiser,
  } = useFiltresAbonnesAdmin()

  const {
    data: abonnes,
    isLoading,
    isError,
    refetch,
  } = useAdminSubscribersQuery(paramsApi)

  const [anonymCible, setAnonymCible] = useState(null)
  const [selection, setSelection] = useState(() => new Set())

  /* Tri INITIALISÉ : inscription descendante (plus récents d'abord). */
  const [tri, setTri] = useState({ cle: "inscription", direction: "desc" })

  const statutMutation = useChangerStatutAbonne()
  const anonymiserMutation = useAnonymiserAbonne()
  const groupeeMutation = useActionGroupeeAbonnes()

  const listeBrute = useMemo(
    () => (Array.isArray(abonnes) ? abonnes : []),
    [abonnes]
  )

  const abonnesTries = useMemo(() => {
    if (!tri) return listeBrute

    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return listeBrute

    const copie = [...listeBrute].sort((a, b) =>
      comparerValeurs(colonne.triValeur(a), colonne.triValeur(b))
    )

    return tri.direction === "asc" ? copie : copie.reverse()
  }, [listeBrute, tri])

  const pageSuivantePossible = listeBrute.length === pageTaille

  const tousPageSelectionnee = useMemo(
    () =>
      listeBrute.length > 0 &&
      listeBrute.every((abonne) => selection.has(abonne.id)),
    [listeBrute, selection]
  )

  const basculerSelection = useCallback((id) => {
    setSelection((prev) => {
      const suivant = new Set(prev)

      if (suivant.has(id)) {
        suivant.delete(id)
      } else {
        suivant.add(id)
      }

      return suivant
    })
  }, [])

  const toutSelectionner = useCallback(() => {
    setSelection((prev) => {
      const suivant = new Set(prev)

      const tousCourantsSelectionnes =
        listeBrute.length > 0 &&
        listeBrute.every((abonne) => suivant.has(abonne.id))

      if (tousCourantsSelectionnes) {
        listeBrute.forEach((abonne) => suivant.delete(abonne.id))
      } else {
        listeBrute.forEach((abonne) => suivant.add(abonne.id))
      }

      return suivant
    })
  }, [listeBrute])

  const viderSelection = useCallback(() => {
    setSelection(new Set())
  }, [])

  const changerStatut = useCallback(
    (abonne, nouveauStatut) => {
      statutMutation.mutate(
        { subscriberId: abonne.id, status: nouveauStatut },
        {
          onSuccess: (res) =>
            notify(
              res?.message ||
                `Statut de ${
                  abonne.full_name ?? abonne.email
                } mis à jour`,
              "success"
            ),
          onError: (err) =>
            notify(
              messageErreurAbonne(err) || "Action impossible",
              "error"
            ),
        }
      )
    },
    [statutMutation, notify]
  )

  const demanderAnonymisation = useCallback((abonne) => {
    setAnonymCible(abonne)
  }, [])

  const anonymiser = useCallback(() => {
    if (!anonymCible) return

    anonymiserMutation.mutate(anonymCible.id, {
      onSuccess: () => {
        notify(
          `${
            anonymCible.full_name ?? anonymCible.email
          } anonymisé — historique conservé`,
          "success"
        )
        setAnonymCible(null)
      },
      onError: (err) =>
        notify(
          messageErreurAbonne(err) || "Anonymisation impossible",
          "error"
        ),
    })
  }, [anonymCible, anonymiserMutation, notify])

  const actionGroupee = useCallback(
    (statut) => {
      if (!selection.size) return

      groupeeMutation.mutate(
        { subscriberIds: [...selection], status: statut },
        {
          onSuccess: (res) => {
            notify(
              res?.message || `${selection.size} abonné(s) mis à jour`,
              "success"
            )
            setSelection(new Set())
          },
          onError: (err) =>
            notify(
              messageErreurAbonne(err) || "Action groupée impossible",
              "error"
            ),
        }
      )
    },
    [selection, groupeeMutation, notify]
  )

  /* Cycle de tri : sens initial → sens inverse → aucun. */
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

  /* key = fondu léger du corps à chaque changement de filtres / page / tri / état. */
  const cleCorps = `${query}-${status}-${filiereId}-${page}-${pageTaille}-${
    tri?.cle ?? "aucun"
  }-${tri?.direction ?? ""}`

  const etat = isError
    ? "erreur"
    : isLoading
      ? "chargement"
      : !listeBrute.length
        ? "vide"
        : "donnees"

  const afficherControles = !isError && (isLoading || listeBrute.length > 0)

  return (
    <motion.div
      variants={VARIANTS_CONTENEUR}
      initial="cache"
      animate="visible"
      className="flex flex-col gap-4"
    >
      {/* ─── Table enveloppée dans SectionCardAdmin ─── */}
      <SectionCardAdmin
        title="Liste des abonnés"
        description="Recherche, filtres par statut et filière, tri, actions rapides par ligne."
        icon={Eye}
        contentClassName="p-0 sm:p-0"
      >
        <div className="flex flex-col gap-4">
          <BarreFiltres />

          {/* ─── Tri mobile ─── */}
          {afficherControles && (
            <div className="flex flex-col gap-2 border-b border-border pb-3 md:hidden">
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

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
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
                </Button>
              </div>
            </div>
          )}

          {/* ─── Barre actions groupées : slide + fondu ─── */}
          <AnimatePresence initial={false}>
            {selection.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-hidden motion-reduce:transition-none"
              >
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                  <span className="text-xs font-semibold tabular-nums">
                    {selection.size} abonné
                    {selection.size > 1 ? "s" : ""} sélectionné
                    {selection.size > 1 ? "s" : ""}
                  </span>

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          size="sm"
                          disabled={groupeeMutation.isPending}
                        >
                          Action groupée
                        </Button>
                      }
                    />

                    <DropdownMenuContent align="start" className="min-w-44">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>
                          Appliquer à la sélection
                        </DropdownMenuLabel>
                      </DropdownMenuGroup>

                      <DropdownMenuItem
                        onClick={() => actionGroupee("active")}
                        disabled={groupeeMutation.isPending}
                        className="cursor-pointer"
                      >
                        Réactiver
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => actionGroupee("paused")}
                        disabled={groupeeMutation.isPending}
                        className="cursor-pointer"
                      >
                        Mettre en pause
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => actionGroupee("unsubscribed")}
                        disabled={groupeeMutation.isPending}
                        className="cursor-pointer"
                      >
                        Marquer désinscrits
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => actionGroupee("bouncing")}
                        disabled={groupeeMutation.isPending}
                        className="cursor-pointer"
                      >
                        Marquer en rebond
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      <DropdownMenuItem
                        onClick={viderSelection}
                        className="cursor-pointer"
                      >
                        Vider la sélection
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toutSelectionner}
                  >
                    {tousPageSelectionnee
                      ? "Tout désélectionner"
                      : "Tout sélectionner (page)"}
                  </Button>

                  <p className="ml-auto hidden text-[10px] text-muted-foreground sm:block">
                    L'anonymisation RGPD reste strictement individuelle.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Corps : mobile cards + desktop table ─── */}
          <Bloc>
            <TransitionEtat etat={`${cleCorps}-${etat}`}>
              {isError ? (
                <div className="p-4">
                  <SectionErreur
                    onRetry={refetch}
                    message="Impossible de charger les abonnés."
                  />
                </div>
              ) : isLoading ? (
                <div
                  key={`${cleCorps}-${etat}`}
                  aria-busy="true"
                  className="animate-in fade-in duration-300 motion-reduce:animate-none"
                >
                  {/* ─── Vue mobile ─── */}
                  <div className="md:hidden">
                    <div
                      className="divide-y divide-border"
                      role="status"
                      aria-label="Chargement des abonnés"
                    >
                      <span className="sr-only">
                        Chargement des abonnés…
                      </span>

                      {[...Array(6)].map((_, index) => (
                        <CarteSkeletonAbonneMobile key={index} />
                      ))}
                    </div>
                  </div>

                  {/* ─── Vue desktop ─── */}
                  <div className="hidden md:block">
                    <div className="overflow-x-auto scrollbar-thin">
                      <Table>
                        <EntetesTableAbonnes
                          tri={tri}
                          onTri={basculerTri}
                          toutSelectionner={toutSelectionner}
                          tousPageSelectionnee={false}
                          disabled
                        />

                        <TableBody
                          key={`${cleCorps}-${etat}-desktop`}
                          className="animate-in fade-in duration-200 motion-reduce:animate-none"
                        >
                          {[...Array(6)].map((_, index) => (
                            <LigneSkeletonAbonne key={index} />
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              ) : !listeBrute.length ? (
                <div className="p-4">
                  {query || status || filiereId ? (
                    <SectionAucunResultat
                      message="Aucun abonné ne correspond à ces filtres."
                      onReset={reinitialiser}
                    />
                  ) : (
                    <SectionVide message="Aucun abonné pour le moment." />
                  )}
                </div>
              ) : (
                <div
                  key={`${cleCorps}-${etat}`}
                  className="animate-in fade-in duration-300 motion-reduce:animate-none"
                >
                  {/* ─── Vue mobile ─── */}
                  <div className="md:hidden">
                    <div
                      key={`${cleCorps}-${etat}-mobile`}
                      className="divide-y divide-border animate-in fade-in duration-200 motion-reduce:animate-none"
                    >
                      {abonnesTries.map((abonne) => {
                        const enCours =
                          statutMutation.isPending &&
                          statutMutation.variables?.subscriberId === abonne.id

                        return (
                          <CarteAbonneMobile
                            key={abonne.id}
                            abonne={abonne}
                            selectionne={selection.has(abonne.id)}
                            enCours={enCours}
                            onBasculerSelection={basculerSelection}
                            onChangerStatut={changerStatut}
                            onAnonymiser={demanderAnonymisation}
                          />
                        )
                      })}
                    </div>
                  </div>

                  {/* ─── Vue desktop ─── */}
                  <div className="hidden md:block">
                    <div className="overflow-x-auto scrollbar-thin">
                      <Table>
                        <EntetesTableAbonnes
                          tri={tri}
                          onTri={basculerTri}
                          toutSelectionner={toutSelectionner}
                          tousPageSelectionnee={tousPageSelectionnee}
                        />

                        <TableBody
                          key={`${cleCorps}-${etat}-desktop`}
                          className="animate-in fade-in duration-200 motion-reduce:animate-none"
                        >
                          {abonnesTries.map((abonne) => {
                            const enCours =
                              statutMutation.isPending &&
                              statutMutation.variables?.subscriberId ===
                                abonne.id

                            return (
                              <LigneAbonne
                                key={abonne.id}
                                abonne={abonne}
                                selectionne={selection.has(abonne.id)}
                                enCours={enCours}
                                onBasculerSelection={basculerSelection}
                                onChangerStatut={changerStatut}
                                onAnonymiser={demanderAnonymisation}
                              />
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="border-t border-border px-4 py-3">
                    <PaginationListe
                      page={page}
                      pagePleine={pageSuivantePossible}
                      onPageChange={setPage}
                    />
                  </div>
                </div>
              )}
            </TransitionEtat>
          </Bloc>
        </div>
      </SectionCardAdmin>

      <DialogConfirmRGPD
        anonymCible={anonymCible}
        setAnonymCible={setAnonymCible}
        anonymiser={anonymiser}
        anonymiserMutation={anonymiserMutation}
      />
    </motion.div>
  )
}

export default OngletPilotage