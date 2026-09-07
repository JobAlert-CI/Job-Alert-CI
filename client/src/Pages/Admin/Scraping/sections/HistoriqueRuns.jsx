import { useState } from "react"
import { Link } from "react-router-dom"
import { History, ChevronRight } from "lucide-react"
import { useAdminScrapingRunsQuery, aUnRunActif } from "@/features/admin-scraping.tools"
import { Badge } from "@/components/ui/badge"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import PaginationListe from "@/components/admin/PaginationListe"
import { SectionErreur, SectionVide, SectionAucunResultat } from "../components/EtatsSection"
import {
  LIBELLE_STATUT_RUN, VARIANTE_STATUT_RUN, statutRunActif, dureeLisible, dateHeure,
} from "../components/statuts-scraping"

/* ─────────────────────────────────────────────────────────────────────
   Section 3 — Historique des runs (doc v3 §10) : table des runs
   récents, filtre par statut (client, la liste est courte), lien
   vers le détail /admin/scraping/runs/:id (page 11, cycle suivant).

   GET /api/admin/scraping/runs?limit=&offset= → liste PLATE sans
   total → pagination heuristique PaginationListe (« page suivante
   possible si page pleine », jamais de total inventé).
   ───────────────────────────────────────────────────────────────────── */

const TAILLE_PAGE = 10

const HistoriqueRuns = () => {
  const [statutFiltre, setStatutFiltre] = useState("")
  const [page, setPage] = useState(1)

  const params = { limit: TAILLE_PAGE, offset: (page - 1) * TAILLE_PAGE }
  const { data: runs, isLoading, isError, refetch } = useAdminScrapingRunsQuery(params)

  // Le filtre par statut est appliqué côté client : l'API ne propose
  // pas de filtre status (vérifié scraping.py), les pages sont courtes
  // (limit max 100) — le filtrage local reste honnête : il porte sur la
  // page courante uniquement et le décompte est explicite.
  const runsFiltres = statutFiltre
    ? (runs ?? []).filter((r) => r.status === statutFiltre)
    : runs

  const pagePleine = Array.isArray(runs) && runs.length === TAILLE_PAGE
  const enActivite = aUnRunActif(runs)

  const changerStatut = (valeur) => {
    setStatutFiltre(valeur)
    setPage(1)
  }

  return (
    <section aria-label="Historique des runs" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold">
          <History className="size-4 text-primary" aria-hidden />
          Historique des runs
        </h2>
        <div className="flex items-center gap-2">
          <Select value={statutFiltre} onValueChange={changerStatut}>
            <SelectTrigger className="h-7 w-40" aria-label="Filtrer les runs par statut">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tous</SelectItem>
              {Object.entries(LIBELLE_STATUT_RUN).map(([valeur, libelle]) => (
                <SelectItem key={valeur} value={valeur}>{libelle}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger l'historique des runs." />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
      ) : !runs?.length ? (
        <SectionVide message="Aucun run de scraping enregistré." />
      ) : !runsFiltres?.length ? (
        <SectionAucunResultat
          message="Aucun run ne correspond à ce statut sur la page courante."
          onReset={() => changerStatut("")}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Brutes</TableHead>
                  <TableHead className="text-right">Insérées</TableHead>
                  <TableHead className="hidden text-right md:table-cell">M. à jour</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Doublons</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Erreurs</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Durée</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {runsFiltres.map((run) => {
                  const actif = statutRunActif(run.status)
                  return (
                    <TableRow key={run.id}>
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
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{run.total_raw ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{run.total_inserted ?? 0}</TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">{run.total_updated ?? 0}</TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">{run.total_duplicates ?? 0}</TableCell>
                      <TableCell className="hidden text-right tabular-nums lg:table-cell">
                        <span className={(run.total_errors ?? 0) > 0 ? "font-semibold text-destructive" : ""}>
                          {run.total_errors ?? 0}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums text-muted-foreground lg:table-cell">
                        {dureeLisible(null, run.started_at, run.finished_at) ?? (actif ? "…" : "—")}
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/admin/scraping/runs/${run.id}`}
                          aria-label={`Voir le détail du run du ${dateHeure(run.started_at ?? run.created_at)}`}
                          className="inline-flex text-muted-foreground transition-colors hover:text-primary"
                        >
                          <ChevronRight className="size-4" aria-hidden />
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <PaginationListe
            page={page}
            pagePleine={pagePleine}
            onPageChange={setPage}
          />

          {enActivite && (
            <p className="text-[10px] text-muted-foreground" role="status">
              Un run est en attente ou en cours — rafraîchissement automatique toutes les 5 s.
            </p>
          )}
        </>
      )}
    </section>
  )
}

export default HistoriqueRuns
