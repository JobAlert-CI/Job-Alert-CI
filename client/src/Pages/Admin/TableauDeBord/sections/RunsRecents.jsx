import { Link } from "react-router-dom"
import { History, ChevronRight } from "lucide-react"
import { useAdminRunsQuery } from "@/features/admin-dashboard.tools"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import { SectionErreur, SectionVide } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Section 2 — Mini-historique des derniers runs de scraping.
   GET /dashboard/runs?limit=5 → liste plate de ScrapeRunRead.
   Lien vers la page Scraping détaillée (doc v3 §2 : "mini-historique
   avec lien vers la page Scraping").
   ───────────────────────────────────────────────────────────────────── */

const LIBELLES_STATUT = {
  success: ["Réussi", "secondary"],
  running: ["En cours", "default"],
  pending: ["En attente", "outline"],
  failed: ["Échoué", "destructive"],
}

const dateHeure = (iso) => {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

const dureeMs = (debut, fin) => {
  if (!debut || !fin) return "—"
  const ms = new Date(fin) - new Date(debut)
  if (ms < 1000) return `${ms} ms`
  return `${Math.round(ms / 1000)} s`
}

const RunsRecents = () => {
  const { data, isLoading, isError, refetch } = useAdminRunsQuery({ limit: 5 })

  return (
    <section aria-label="Derniers runs de scraping" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold">
          <History className="size-4 text-primary" aria-hidden />
          Derniers runs de scraping
        </h2>
        <Link
          to="/admin/scraping"
          className="flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          Tout voir <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger l'historique des runs." />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : !data?.length ? (
        <SectionVide message="Aucun run de scraping enregistré." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Brutes</TableHead>
                <TableHead className="text-right">Insérées</TableHead>
                <TableHead className="text-right">M. à jour</TableHead>
                <TableHead className="text-right">Doublons</TableHead>
                <TableHead className="text-right">Erreurs</TableHead>
                <TableHead className="text-right">Durée</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((run) => {
                const [libelle, variante] = LIBELLES_STATUT[run.status] ?? [run.status, "outline"]
                return (
                  <TableRow key={run.id}>
                    <TableCell>
                      <Link
                        to={`/admin/scraping/runs/${run.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {dateHeure(run.started_at)}
                      </Link>
                    </TableCell>
                    <TableCell><Badge variant={variante}>{libelle}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{run.total_raw ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums">{run.total_inserted ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums">{run.total_updated ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums">{run.total_duplicates ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">{run.total_errors ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {dureeMs(run.started_at, run.finished_at)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}

export default RunsRecents
