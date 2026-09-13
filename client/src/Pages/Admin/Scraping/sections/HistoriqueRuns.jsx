import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronRight, History, Loader2 } from "lucide-react"
import { useAdminScrapingRunsQuery, aUnRunActif } from "@/features/admin-scraping.tools"
import { Badge } from "@/components/ui/badge"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import PaginationListe from "@/components/admin/PaginationListe"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"
import { SectionErreur, SectionVide, SectionAucunResultat } from "../components/EtatsSection"
import {
  LIBELLE_STATUT_RUN, VARIANTE_STATUT_RUN, statutRunActif, dureeLisible, dateHeure,
} from "../components/statuts-scraping"

const TAILLE_PAGE = 20

const formatNombre = (v) => (v ?? 0).toLocaleString("fr-FR")

const dureeMsValeur = (run) => {
  if (!run.started_at || !run.finished_at) return null
  return new Date(run.finished_at) - new Date(run.started_at)
}

const comparerValeurs = (a, b) => {
  const videA = a === null || a === undefined || a === ""
  const videB = b === null || b === undefined || b === ""
  if (videA && videB) return 0
  if (videA) return 1
  if (videB) return -1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" })
}

const COLONNES = [
  {
    cle: "started_at", libelle: "Date", directionInitiale: "desc",
    triValeur: (r) => r.started_at ?? r.created_at ?? r.run_date,
  },
  {
    cle: "total_raw", libelle: "Brutes", directionInitiale: "desc",
    triValeur: (r) => r.total_raw ?? 0,
  },
  {
    cle: "total_inserted", libelle: "Insérées", directionInitiale: "desc",
    triValeur: (r) => r.total_inserted ?? 0,
  },
  {
    cle: "total_updated", libelle: "M. à jour", directionInitiale: "desc",
    className: "hidden md:table-cell",
    triValeur: (r) => r.total_updated ?? 0,
  },
  {
    cle: "total_duplicates", libelle: "Doublons", directionInitiale: "desc",
    className: "hidden md:table-cell",
    triValeur: (r) => r.total_duplicates ?? 0,
  },
  {
    cle: "total_errors", libelle: "Erreurs", directionInitiale: "desc",
    className: "hidden lg:table-cell",
    triValeur: (r) => r.total_errors ?? 0,
  },
  {
    cle: "duree", libelle: "Durée", directionInitiale: "desc",
    className: "hidden lg:table-cell",
    triValeur: dureeMsValeur,
  },
]

const HistoriqueRuns = () => {
  const [statutFiltre, setStatutFiltre] = useState("")
  const [page, setPage] = useState(1)
  /* Tri INITIALISÉ : « Date » descendante d'office (le plus récent
     d'abord) — cohérent avec l'ordre serveur et le chevron actif est
     visible dès le premier rendu. */
  const [tri, setTri] = useState({ cle: "started_at", direction: "desc" })
  const params = { limit: TAILLE_PAGE, offset: (page - 1) * TAILLE_PAGE }
  const { data: runs, isLoading, isError, refetch } = useAdminScrapingRunsQuery(params)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const donnees = runs ?? []

  /* Filtre statut + tri s'appliquent côté client, sur la page courante. */
  const runsAffiches = useMemo(() => {
    const base = statutFiltre ? donnees.filter((r) => r.status === statutFiltre) : donnees
    if (!tri) return base
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base
    const copie = [...base].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [donnees, statutFiltre, tri])

  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  const pagePleine = Array.isArray(runs) && runs.length === TAILLE_PAGE
  const enActivite = aUnRunActif(runs)

  const changerStatut = (valeur) => {
    setStatutFiltre(valeur)
    setPage(1)
  }

  /* key = fondu léger du corps à chaque changement de tri / filtre. */
  const cleCorps = `${statutFiltre}-${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  return (
    <SectionCardAdmin
      title="Historique des runs"
      description="Voir les runs de scraping effectués et leurs statuts"
      icon={History}
      contentClassName="p-0 sm:p-0"
      action={
        <Select value={statutFiltre} onValueChange={changerStatut}>
          <SelectTrigger className="h-8 w-40 text-xs" aria-label="Filtrer les runs par statut">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tous</SelectItem>
            {Object.entries(LIBELLE_STATUT_RUN).map(([valeur, libelle]) => (
              <SelectItem key={valeur} value={valeur}>{libelle}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {/* Fondu enchaîné au changement de page / filtre / état. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${page}-${statutFiltre}-${isLoading ? "chargement" : "donnees"}-${isError ? "erreur" : "ok"}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {isError ? (
            <div className="p-4">
              <SectionErreur onRetry={refetch} message="Impossible de charger l'historique des runs." />
            </div>
          ) : isLoading ? (
            <div className="flex flex-col gap-2 p-4" aria-busy="true">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !donnees.length ? (
            <div className="p-4">
              <SectionVide message="Aucun run de scraping enregistré." />
            </div>
          ) : !runsAffiches.length ? (
            <div className="p-4">
              <SectionAucunResultat
                message="Aucun run ne correspond à ce statut sur la page courante."
                onReset={() => changerStatut("")}
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      {/* Date — triable (initialisée desc) */}
                      <EnteteTriable
                        colonne={COLONNES.find((c) => c.cle === "started_at")}
                        tri={tri}
                        onTri={basculerTri}
                      />
                      {/* Statut — reste un filtre, jamais une colonne de tri */}
                      <TableHead>Statut</TableHead>
                      {/* Colonnes numériques + durée — triables, alignées à droite */}
                      {COLONNES.filter((c) => c.cle !== "started_at").map((colonne) => (
                        <EnteteTriable
                          key={colonne.cle}
                          colonne={colonne}
                          tri={tri}
                          onTri={basculerTri}
                          aligneDroite
                        />
                      ))}
                      <TableHead className="w-10"><span className="sr-only">Détail</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  {/* key = fondu léger à chaque changement de tri / filtre */}
                  <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                    {runsAffiches.map((run) => {
                      const actif = statutRunActif(run.status)
                      return (
                        <TableRow key={run.id} className="transition-colors hover:bg-muted/50">
                          <TableCell>
                            <Link
                              to={`/admin/scraping/runs/${run.id}`}
                              className="font-medium text-primary underline-offset-4 hover:underline"
                            >
                              {dateHeure(run.started_at ?? run.created_at) ?? run.run_date}
                            </Link>
                            <span className="block text-[10px] text-muted-foreground">
                              {run.triggered_by?.startsWith("admin:")
                                ? "Manuel"
                                : run.triggered_by?.startsWith("beat:")
                                  ? "Planifié"
                                  : run.triggered_by}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={VARIANTE_STATUT_RUN[run.status] ?? "outline"}>
                              {LIBELLE_STATUT_RUN[run.status] ?? run.status}
                              {actif ? "…" : ""}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatNombre(run.total_raw)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNombre(run.total_inserted)}</TableCell>
                          <TableCell className="hidden text-right tabular-nums md:table-cell">{formatNombre(run.total_updated)}</TableCell>
                          <TableCell className="hidden text-right tabular-nums md:table-cell">{formatNombre(run.total_duplicates)}</TableCell>
                          <TableCell className="hidden text-right tabular-nums lg:table-cell">
                            <span className={(run.total_errors ?? 0) > 0 ? "font-semibold text-destructive" : undefined}>
                              {formatNombre(run.total_errors)}
                            </span>
                          </TableCell>
                          <TableCell className="hidden whitespace-nowrap text-right tabular-nums text-muted-foreground lg:table-cell">
                            {dureeLisible(null, run.started_at, run.finished_at) ?? (actif ? "…" : "—")}
                          </TableCell>
                          <TableCell>
                            <Link
                              to={`/admin/scraping/runs/${run.id}`}
                              aria-label={`Voir le détail du run du ${dateHeure(run.started_at ?? run.created_at) ?? run.run_date}`}
                              className="inline-flex text-muted-foreground transition-colors hover:text-primary"
                            >
                              <ChevronRight className="size-4" aria-hidden="true" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
                <PaginationListe page={page} pagePleine={pagePleine} onPageChange={setPage} />
                {/* Indicateur temps réel : icône animée + texte (role=status). */}
                {enActivite && (
                  <p role="status" className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Loader2
                      className="size-3.5 animate-spin animation-duration-[1.8s] motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    Un run est en attente ou en cours — rafraîchissement automatique toutes les 5 s.
                  </p>
                )}
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </SectionCardAdmin>
  )
}

export default HistoriqueRuns