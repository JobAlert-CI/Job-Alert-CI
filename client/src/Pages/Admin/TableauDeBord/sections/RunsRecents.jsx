import { memo, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  CalendarClock, ChevronRight, History, UserRound, X,
} from "lucide-react"
import { cn } from "cn"
import { useAdminRunsQuery } from "@/features/admin-dashboard.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import { SectionErreur, SectionVide, SectionAucunResultat } from "../components/EtatsSection"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"


const STYLES_STATUT = {
  success: { libelle: "Réussi", badge: "border-transparent bg-emerald-100 text-emerald-800", pastille: "bg-emerald-500" },
  running: { libelle: "En cours", badge: "border-transparent bg-secondary text-secondary-foreground", pastille: "bg-brand-navy", ping: true },
  pending: { libelle: "En attente", badge: "border-border bg-muted text-muted-foreground", pastille: "bg-muted-foreground/60" },
  failed: { libelle: "Échoué", badge: "border-transparent bg-red-100 text-red-700", pastille: "bg-red-500" },
}

const OPTIONS_STATUT = ["success", "running", "pending", "failed"].map(
  (valeur) => ({ valeur, ...STYLES_STATUT[valeur] })
)

const formatNombre = (v) => (v ?? 0).toLocaleString("fr-FR")

const dateHeure = (iso) => {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

const dureeAffichage = (debut, fin) => {
  if (!debut || !fin) return "—"
  const ms = new Date(fin) - new Date(debut)
  if (ms < 1000) return `${ms} ms`
  return `${Math.round(ms / 1000)} s`
}

/** Valeur numérique de la durée (pour le tri) ; null = trié en fin. */
const dureeMsValeur = (run) => {
  if (!run.started_at || !run.finished_at) return null
  return new Date(run.finished_at) - new Date(run.started_at)
}

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

/* Colonnes triables — « Statut » est volontairement exclu (filtre). */
const COLONNES = [
  { cle: "started_at", libelle: "Date", directionInitiale: "desc", triValeur: (r) => r.started_at },
  { cle: "total_raw", libelle: "Brutes", directionInitiale: "desc", triValeur: (r) => r.total_raw ?? 0 },
  { cle: "total_inserted", libelle: "Insérées", directionInitiale: "desc", triValeur: (r) => r.total_inserted ?? 0 },
  { cle: "total_updated", libelle: "M. à jour", directionInitiale: "desc", triValeur: (r) => r.total_updated ?? 0 },
  { cle: "total_duplicates", libelle: "Doublons", directionInitiale: "desc", triValeur: (r) => r.total_duplicates ?? 0 },
  { cle: "total_errors", libelle: "Erreurs", directionInitiale: "desc", triValeur: (r) => r.total_errors ?? 0 },
  { cle: "duree", libelle: "Durée", directionInitiale: "desc", triValeur: dureeMsValeur },
]


/* ── Ligne mémoïsée (listes répétées, cf. exigences perf) ─────────── */
const LigneRun = memo(({ run }) => {
  const meta = STYLES_STATUT[run.status] ?? { libelle: run.status, badge: "", pastille: "bg-muted-foreground" }
  const declenchementAdmin = run.triggered_by?.startsWith("admin")

  return (
    <TableRow className="transition-colors hover:bg-muted/50">
      <TableCell className="whitespace-nowrap">
        <span className="flex items-center gap-1.5">
          {declenchementAdmin ? (
            <UserRound className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <CalendarClock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="sr-only">
            {declenchementAdmin ? "Déclenché manuellement par un admin — " : "Exécution planifiée — "}
          </span>
          <Link
            to={`/admin/scraping/runs/${run.id}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {dateHeure(run.started_at)}
          </Link>
        </span>
      </TableCell>

      <TableCell>
        <Badge variant="outline" className={cn("gap-1.5 font-medium", meta.badge)}>
          <span className="relative flex size-1.5" aria-hidden="true">
            {meta.ping && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-navy opacity-50" />
            )}
            <span className={cn("relative inline-flex size-1.5 rounded-full", meta.pastille)} />
          </span>
          {meta.libelle}
        </Badge>
      </TableCell>

      <TableCell className="text-right tabular-nums">{formatNombre(run.total_raw)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatNombre(run.total_inserted)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatNombre(run.total_updated)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatNombre(run.total_duplicates)}</TableCell>
      <TableCell
        className={cn(
          "text-right tabular-nums",
          (run.total_errors ?? 0) > 0 ? "font-medium text-destructive" : "text-muted-foreground"
        )}
      >
        {formatNombre(run.total_errors)}
      </TableCell>
      <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
        {dureeAffichage(run.started_at, run.finished_at)}
      </TableCell>
    </TableRow>
  )
})
LigneRun.displayName = "LigneRun"

const RunsRecents = () => {
  const { data, isLoading, isError, refetch } = useAdminRunsQuery({ limit: 30 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const donnees = data ?? []

  /* Tri : « Date » descendante par défaut (le plus récent d'abord). */
  const [tri, setTri] = useState({ cle: "started_at", direction: "desc" })
  const [filtreStatut, setFiltreStatut] = useState("tous")

  const compteurs = useMemo(() => {
    const c = { success: 0, running: 0, pending: 0, failed: 0 }
    for (const r of donnees) if (c[r.status] !== undefined) c[r.status] += 1
    return c
  }, [donnees])

  const runsAffiches = useMemo(() => {
    const base = filtreStatut === "tous" ? donnees : donnees.filter((r) => r.status === filtreStatut)
    if (!tri) return base
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base
    const copie = [...base].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [donnees, filtreStatut, tri])

  /* Cycle de tri : desc → asc → aucun (retour à l'ordre serveur). */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  const cleCorps = `${filtreStatut}-${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  return (
    <SectionCardAdmin
      title="Derniers runs de scraping"
      description="Historique des 30 derniers runs"
      icon={History}
      contentClassName="p-0 sm:p-0"
      action={
        <Link
          to="/admin/scraping"
          className="flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          Tout voir <ChevronRight className="size-3.5" aria-hidden="true" />
        </Link>
      }
    >
      {isError ? (
        <div className="p-4">
          <SectionErreur onRetry={refetch} message="Impossible de charger l'historique des runs." />
        </div>
      ) : isLoading ? (
        <div className="flex flex-col gap-2 p-4" aria-busy="true">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !donnees.length ? (
        <div className="p-4">
          <SectionVide message="Aucun run de scraping enregistré." />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {/* Date — triable */}
                  <EnteteTriable
                    colonne={COLONNES.find((c) => c.cle === "started_at")}
                    tri={tri}
                    onTri={basculerTri}
                  />

                  {/* Statut — filtre directement dans l'en-tête */}
                  <TableHead className="w-40">
                    <Select value={filtreStatut} onValueChange={setFiltreStatut}>
                      <SelectTrigger
                        aria-label="Filtrer par statut"
                        className={cn(
                          "h-7 w-auto gap-1.5 rounded-md px-2 text-xs font-medium shadow-none",
                          filtreStatut === "tous"
                            ? "border-transparent text-muted-foreground/90 hover:text-foreground"
                            : "border-brand-navy/30 bg-secondary text-secondary-foreground"
                        )}
                      >
                        {filtreStatut === "tous" ? (
                          <span>Statut</span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <span
                              className={cn("size-1.5 rounded-full", STYLES_STATUT[filtreStatut]?.pastille)}
                              aria-hidden="true"
                            />
                            {STYLES_STATUT[filtreStatut]?.libelle}
                          </span>
                        )}
                      </SelectTrigger>
                      <SelectContent align="start">
                        <SelectItem value="tous">Tous les statuts ({donnees.length})</SelectItem>
                        {OPTIONS_STATUT.map((o) => (
                          <SelectItem key={o.valeur} value={o.valeur}>
                            <span className="flex items-center gap-1.5">
                              <span className={cn("size-1.5 rounded-full", o.pastille)} aria-hidden="true" />
                              {o.libelle}
                              <span className="tabular-nums text-muted-foreground">({compteurs[o.valeur] ?? 0})</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableHead>

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
                </TableRow>
              </TableHeader>

              {/* key = fondu léger à chaque changement de tri / filtre */}
              <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                {runsAffiches.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9}>
                      <div className="flex flex-col items-center gap-3 py-6">
                        <SectionAucunResultat
                          message={`Aucun run avec le statut « ${STYLES_STATUT[filtreStatut]?.libelle} ».`}
                        />
                        <Button variant="outline" size="sm" onClick={() => setFiltreStatut("tous")}>
                          <X className="size-3.5" aria-hidden="true" /> Réinitialiser le filtre
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  runsAffiches.map((run) => <LigneRun key={run.id} run={run} />)
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pied : compteur + reset du filtre actif */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {formatNombre(runsAffiches.length)} run{runsAffiches.length > 1 ? "s" : ""} affiché
              {runsAffiches.length > 1 ? "s" : ""} sur {formatNombre(donnees.length)}
            </span>
            {filtreStatut !== "tous" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setFiltreStatut("tous")}
              >
                <X className="size-3.5" aria-hidden="true" /> Réinitialiser
              </Button>
            )}
          </div>
        </>
      )}
    </SectionCardAdmin>
  )
}

export default RunsRecents