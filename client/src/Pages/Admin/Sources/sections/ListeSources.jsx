import { useCallback, useMemo, useState } from "react"
import { AnimatePresence } from "framer-motion"
import { useQueryClient } from "@tanstack/react-query"
import { Globe, Search, X, } from "lucide-react"
import {
  useAdminSourcesQuery, useCreateSource, useUpdateSource, useChangerStatutSource,
  useDeleteSource, messageErreurSource, adminSourcesKeys,
} from "@/features/admin-sources.tools"
import { useNotify } from "@/contexts/Notify.context"
import EnteteTriable from "@/components/admin/EnteteTriable"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import DialogSource from "@/components/dialog/DialogSource"
import { SectionErreur, SectionVide, SectionAucunResultat, TransitionEtat } from "@/components/admin/EtatsSection"
import { Spinner } from "@/components/ui/spinner"
import { CarteSkeletonMobile, CarteSourceMobile } from "../components/CarteSourceMobile"
import { LigneSkeleton, LigneSource } from "../components/LigneSource"
import Bloc from "@/components/admin/Bloc"
import BtnAction from "@/components/admin/BtnAction"

const LIBELLE_STATUT = {
  active: ["Active", "secondary"],
  paused: ["En pause", "outline"],
  disabled: ["Désactivée", "outline"],
  error: ["En erreur", "destructive"],
}


/* Rang de tri des statuts : actif d'abord (desc), erreur en dernier. */
const RANG_STATUT = { active: 4, paused: 3, disabled: 2, error: 1 }

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

/* Colonnes triables — Actions exclue. `className` embarqué : repris par
   le <th> (EnteteTriable) pour suivre la responsivité du corps. */
const COLONNES = [
  { cle: "source", libelle: "Source", directionInitiale: "asc", triValeur: (s) => (s.name ?? "").toLowerCase() },
  { cle: "statut", libelle: "Statut", directionInitiale: "desc", triValeur: (s) => RANG_STATUT[s.status] ?? 0 },
  { cle: "priorite", libelle: "Priorité", directionInitiale: "asc", triValeur: (s) => s.priority ?? 0 },
  { cle: "protection", libelle: "Anti-scraping", directionInitiale: "desc", triValeur: (s) => s.anti_scraping_level ?? 0 },
  {
    cle: "dernier", libelle: "Dernier scraping", directionInitiale: "desc",
    className: "hidden md:table-cell",
    triValeur: (s) => s.last_scraped_at ?? null,
  },
  {
    cle: "url", libelle: "URL de base", directionInitiale: "asc",
    className: "hidden lg:table-cell",
    triValeur: (s) => s.base_url ?? "",
  },
]




const ListeSources = () => {
  const notify = useNotify()
  const queryClient = useQueryClient()
  const { data: sources, isLoading, isError, refetch } = useAdminSourcesQuery()
  const creerMutation = useCreateSource()
  const modifierMutation = useUpdateSource()
  const statutMutation = useChangerStatutSource()
  const supprimerMutation = useDeleteSource()

  /* Filtres + tri 100 % client (liste courte chargée en une fois). */
  const [recherche, setRecherche] = useState("")
  const [filtreStatut, setFiltreStatut] = useState("")
  /* Tri INITIALISÉ : « Priorité » ascendante = ordre naturel de
     planification du scraping (le chevron actif est visible d'emblée). */
  const [tri, setTri] = useState({ cle: "priorite", direction: "asc" })

  /* Dialog : monté en permanence (prop open) — `enEdition` survit à la
     fermeture pour rester affiché pendant l'animation de sortie. */
  const [enEdition, setEnEdition] = useState(null)
  const [editionOuverte, setEditionOuverte] = useState(false)
  const [suppression, setSuppression] = useState(null)

  const ouvrirEdition = useCallback((source) => {
    setEnEdition(source)
    setEditionOuverte(true)
  }, [])
  const fermerEdition = useCallback(() => setEditionOuverte(false), [])
  const demanderSuppression = useCallback((source) => setSuppression(source), [])

  /* Recherche (nom/code) + filtre statut + tri, en une dérivation. */
  const sourcesAffichees = useMemo(() => {
    let base = sources ?? []
    const q = recherche.trim().toLowerCase()
    if (q) {
      base = base.filter(
        (s) => (s.name ?? "").toLowerCase().includes(q) || (s.code ?? "").toLowerCase().includes(q)
      )
    }
    if (filtreStatut) base = base.filter((s) => s.status === filtreStatut)
    if (!tri) return base
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base
    const copie = [...base].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [sources, recherche, filtreStatut, tri])

  /* Cycle de tri : sens initial → sens inverse → aucun (ordre naturel). */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "asc" }
      if (prec.direction === (colonne.directionInitiale ?? "asc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  const reinitialiserFiltres = () => {
    setRecherche("")
    setFiltreStatut("")
  }
  const filtresActifs = !!(recherche.trim() || filtreStatut)

  /* ─── Bascule statut OPTIMISTE ─────────────────────────────────────
     Le cache TanStack est mis à jour AVANT la réponse serveur : le
     flip PauseCircle ↔ PlayCircle est immédiat. En cas d'erreur :
     rollback sur l'instantané puis resynchronisation (onSettled). ─── */
  const basculerStatut = useCallback(
    (source) => {
      const nouveau = source.status === "active" ? "paused" : "active"
      const cle = [...adminSourcesKeys.root]
      const instantane = queryClient.getQueryData(cle)
      queryClient.setQueryData(cle, (ancien) =>
        (ancien ?? []).map((s) => (s.id === source.id ? { ...s, status: nouveau } : s))
      )
      statutMutation.mutate(
        { id: source.id, status: nouveau },
        {
          onSuccess: () =>
            notify(`Source « ${source.name} » ${nouveau === "active" ? "réactivée" : "mise en pause"}`, "success"),
          onError: (err) => {
            queryClient.setQueryData(cle, instantane) // rollback
            notify(messageErreurSource(err) || "Action impossible", "error")
          },
          onSettled: () => queryClient.invalidateQueries({ queryKey: adminSourcesKeys.root }),
        }
      )
    },
    [queryClient, statutMutation, notify]
  )

  const confirmerSuppression = () => {
    if (!suppression) return
    supprimerMutation.mutate(suppression.id, {
      onSuccess: () => {
        notify(`Source « ${suppression.name} » supprimée`, "success")
        setSuppression(null)
        refetch()
      },
      onError: (err) => {
        notify(messageErreurSource(err) || "Suppression impossible (source liée à des offres ?)", "error")
        setSuppression(null)
      },
    })
  }

  const statutEnCoursPour = (source) =>
    statutMutation.isPending && statutMutation.variables?.id === source.id

  /* key = fondu du corps à chaque changement de tri / filtre statut
     (la recherche, elle, est gérée par l'AnimatePresence ligne à ligne). */
  const cleCorps = `${filtreStatut}-${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  const etat = isError ? "erreur" : isLoading ? "chargement" : !sources?.length ? "vide" : "donnees"


  return (
    <>
      <SectionCardAdmin
        title="Liste des sources"
        description="Gestion des sources de scraping : activation, pause, priorité et niveau de protection."
        icon={Globe}
        contentClassName="p-0 sm:p-0"
        badge={
          !isLoading && !isError && (sources?.length ?? 0) > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              {sources.length} source{sources.length > 1 ? "s" : ""}
            </Badge>
          )
        }
      >
        {/* ─── Barre de filtres : recherche nom/code + statut ─── */}
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* ─── Recherche : Spinner tant que la requête est en cours ─── */}
            <div className="relative min-w-52 flex-1">
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
                placeholder="Rechercher un nom ou un code…"
                aria-label="Rechercher une source par nom ou code"
                className="h-8 pl-8 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Sentinelle « tous » : Radix refuse la valeur vide. */}
              <Select value={filtreStatut || "tous"} onValueChange={(v) => setFiltreStatut(v === "tous" ? "" : v)}>
                <SelectTrigger className="h-8 w-44 text-xs" aria-label="Filtrer par statut">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous les statuts</SelectItem>
                  {Object.entries(LIBELLE_STATUT).map(([valeur, [libelle]]) => (
                    <SelectItem key={valeur} value={valeur}>{libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filtresActifs && (
                <BtnAction variant="outline" size="xs" className="text-xs" onClick={reinitialiserFiltres}>
                  Réinitialiser
                </BtnAction>
              )}
            </div>
          </div>
        </div>

        <Bloc>
          <TransitionEtat etat={etat}>
            {isError ? (
              <div className="p-4">
                <SectionErreur onRetry={refetch} message="Impossible de charger les sources." />
              </div>
            ) : (
              <>
                {/* ─── Vue mobile : cartes empilées ─── */}
                <div key={`mobile-${cleCorps}`} className="animate-in fade-in duration-200 motion-reduce:animate-none md:hidden">
                  <AnimatePresence mode="wait" initial={false}>
                    {isLoading ? (
                      [...Array(9)].map((_, i) => <CarteSkeletonMobile key={`msquel-${i}`} />)
                    ) : !sources?.length ? (
                      <SectionVide message="Aucune source configurée. Lancez le seed (npm run seed:scraper-sources)." className="m-4" />
                    ) : !sourcesAffichees.length ? (
                      <SectionAucunResultat onReset={reinitialiserFiltres} message="Aucune source ne correspond à ces critères." className="m-4" />
                    ) : (
                      sourcesAffichees.map((source) => (
                        <CarteSourceMobile
                          key={source.id}
                          source={source}
                          statutEnCours={statutEnCoursPour(source)}
                          onBasculer={basculerStatut}
                          onEditer={ouvrirEdition}
                          onSupprimer={demanderSuppression}
                        />
                      ))
                    )}
                  </AnimatePresence>
                </div>

                {/* ─── Vue desktop : table triable ─── */}
                <div key={`table-${cleCorps}`} className="hidden overflow-x-auto scrollbar-thin animate-in fade-in duration-200 motion-reduce:animate-none md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "source")} tri={tri} onTri={basculerTri} />
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "statut")} tri={tri} onTri={basculerTri} />
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "priorite")} tri={tri} onTri={basculerTri} aligneDroite />
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "protection")} tri={tri} onTri={basculerTri} aligneDroite />
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "dernier")} tri={tri} onTri={basculerTri} aligneDroite />
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "url")} tri={tri} onTri={basculerTri} />
                        <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    {/* AnimatePresence + motion.tr : le squelette fond en
                    douceur vers les lignes réelles (pas de tressautement). */}
                    <TableBody>
                      <AnimatePresence mode="wait" initial={false}>
                        {isLoading ? (
                          [...Array(6)].map((_, i) => <LigneSkeleton key={`squel-${i}`} />)
                        ) : !sources?.length ? (
                          <TableCell colSpan={7}>
                            <SectionVide message="Aucune source configurée. Lancez le seed (npm run seed:scraper-sources)." />
                          </TableCell>
                        ) : !sourcesAffichees.length ? (
                          <TableCell colSpan={7}>
                            <SectionAucunResultat onReset={reinitialiserFiltres} message="Aucune source ne correspond à ces critères." />
                          </TableCell>
                        ) : (
                          sourcesAffichees.map((source) => (
                            <LigneSource
                              key={source.id}
                              source={source}
                              statutEnCours={statutEnCoursPour(source)}
                              onBasculer={basculerStatut}
                              onEditer={ouvrirEdition}
                              onSupprimer={demanderSuppression}
                            />
                          ))
                        )}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>

                {/* ─── Pied : compteur affiché + reset ─── */}
                {!isLoading && (sources?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      {sourcesAffichees.length} source{sourcesAffichees.length > 1 ? "s" : ""} affichée{sourcesAffichees.length > 1 ? "s" : ""} sur {sources.length}
                    </span>
                    {filtresActifs && (
                      <BtnAction
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={reinitialiserFiltres}
                      >
                        <X className="size-3.5" aria-hidden="true" /> Réinitialiser
                      </BtnAction>
                    )}
                  </div>
                )}
              </>
            )}
          </TransitionEtat>
        </Bloc>
      </SectionCardAdmin>

      {/* Dialog création/édition — monté en permanence, piloté par `open`. */}
      <DialogSource
        open={editionOuverte}
        source={enEdition?.id ? enEdition : null}
        mutation={enEdition?.id ? modifierMutation : creerMutation}
        onFermer={fermerEdition}
      />

      {/* Confirmation suppression — AlertDialog (overlay + focus trap). */}
      <AlertDialog open={!!suppression} onOpenChange={(o) => !o && setSuppression(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {suppression?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Si des offres sont rattachées à cette source
              (clé étrangère), la suppression sera refusée par le serveur.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <BtnAction variant="ghost" onClick={() => setSuppression(null)}>Annuler</BtnAction>
            <BtnAction variant="destructive" onClick={confirmerSuppression} disabled={supprimerMutation.isPending}>
              {supprimerMutation.isPending ? "Suppression…" : "Supprimer"}
            </BtnAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default ListeSources