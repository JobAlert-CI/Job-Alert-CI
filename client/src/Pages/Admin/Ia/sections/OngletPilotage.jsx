import { Activity, Play } from "lucide-react"
import {
  libelleStatutJob, libelleTrigger, messageErreurIa,
  useJobsIaQuery, useLancerCycleIa, useQueueIaQuery,
} from "@/features/admin-ia.tools"
import { useNotify } from "@/contexts/Notify.context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import PaginationListe from "@/components/admin/PaginationListe"
import { useFiltresIaAdmin } from "@/contexts/FiltresIaAdmin.context"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { SectionErreur, SectionVide } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Onglet Pilotage — file d'attente + jobs (cycle 19, doc v3 §19).

   Le pipeline tourne en AUTONOMIE (sweep Celery toutes les 5 min) :
   cette vue sert à surveiller et intervenir. Queue polling adaptatif :
   5 s tant qu'un job AiProcessingJob running (pattern cycle 10), 60 s
   sinon. POST /run → 202 : le résultat arrive via queue/jobs, jamais
   dans la réponse.

   ⚠️ Vocabulaires distincts (vérifiés live) :
   - queue.pending/running = AiProcessingJob (file post-ingestion) ;
   - table /jobs = AIJob (cycles provider : sweep ET manuels).
   ───────────────────────────────────────────────────────────────────── */

const VARIANTE_STATUT = {
  pending: "secondary",
  running: "default",
  completed: "default",
  partial_failure: "secondary",
  failed: "destructive",
}

const dateHeure = (iso) => {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) +
    " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

/** Durée calculée côté front (started→finished), badge « en cours » sinon (F6). */
const dureeJob = (job) => {
  if (!job.started_at) return "—"
  if (!job.finished_at) return <Badge variant="outline">En cours</Badge>
  const secondes = Math.round((new Date(job.finished_at) - new Date(job.started_at)) / 1000)
  if (secondes < 60) return `${secondes} s`
  return `${Math.floor(secondes / 60)} min ${secondes % 60} s`
}

const CarteQueue = () => {
  const { data: queue, isLoading } = useQueueIaQuery()

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-[10px] font-bold tracking-wider text-muted-foreground/80 uppercase">
          En attente (ingestion)
        </p>
        <p className="mt-2 font-heading text-2xl font-bold tabular-nums">
          {isLoading ? "…" : (queue?.pending ?? 0)}
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-[10px] font-bold tracking-wider text-muted-foreground/80 uppercase">
          En cours (ingestion)
        </p>
        <p className="mt-2 font-heading text-2xl font-bold tabular-nums">
          {isLoading ? "…" : (queue?.running ?? 0)}
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-[10px] font-bold tracking-wider text-muted-foreground/80 uppercase">
          Jobs provider en attente
        </p>
        <p className="mt-2 font-heading text-2xl font-bold tabular-nums">
          {isLoading ? "…" : (queue?.pending_ai_jobs ?? 0)}
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-[10px] font-bold tracking-wider text-muted-foreground/80 uppercase">
          Dernier sweep
        </p>
        <p className="mt-2 text-sm font-medium">
          {isLoading ? "…" : queue?.last_sweep_at ? (
            <>
              <span className="block text-xs text-muted-foreground">{dateHeure(queue.last_sweep_at)}</span>
              <Badge variant={queue.last_sweep_status === "failed" ? "destructive" : "secondary"} className="mt-1">
                {libelleStatutJob(queue.last_sweep_status)}
              </Badge>
            </>
          ) : "Aucun sweep enregistré"}
        </p>
      </div>
    </div>
  )
}

const OngletPilotage = () => {
  const notify = useNotify()
  const { pageJobs, paramsJobs, setPageJobs } = useFiltresIaAdmin()
  const { data: queue } = useQueueIaQuery()
  const { data: jobs, isLoading, isError, refetch } = useJobsIaQuery(paramsJobs)
  const lancer = useLancerCycleIa()

  const pagePleine = Array.isArray(jobs) && jobs.length === paramsJobs.limit
  const dernierSweepEchoue = queue?.last_sweep_status === "failed"

  const relancer = (force) => {
    lancer.mutate(
      { force },
      {
        onSuccess: () => notify(`Cycle lancé${force ? " (forcé)" : ""} — suivez la file ci-dessous`, "success"),
        onError: (err) => notify(messageErreurIa(err), "error"),
      }
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ─── File d'attente + déclenchement ─── */}
      <CarteQueue />
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-4">
        <div className="flex-1">
          <p className="text-xs font-medium">Lancer un cycle de normalisation</p>
          <p className="text-[11px] text-muted-foreground">
            Le pipeline tourne déjà seul (sweep toutes les 5 min) — un lancement manuel sert à traiter le backlog sans attendre le prochain sweep.
          </p>
        </div>
        <Button size="sm" onClick={() => relancer(false)} disabled={lancer.isPending}>
          <Play aria-hidden /> Lancer un cycle
        </Button>
        <Button size="sm" variant="outline" onClick={() => relancer(true)} disabled={lancer.isPending}>
          Forcer (ignorer le garde-fou scraping)
        </Button>
      </div>

      {/* ─── Table jobs ─── */}
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger l'historique des jobs." />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
        </div>
      ) : !jobs?.length ? (
        <SectionVide message="Aucun job de normalisation enregistré pour l'instant." />
      ) : (
        <section aria-label="Historique des jobs de normalisation" className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Créé</TableHead>
                <TableHead>Déclencheur</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Offres</TableHead>
                <TableHead className="text-right">Activées</TableHead>
                <TableHead className="hidden text-right md:table-cell">Rejetées</TableHead>
                <TableHead className="hidden text-right md:table-cell">Revue</TableHead>
                <TableHead className="hidden text-right lg:table-cell">À retraiter</TableHead>
                <TableHead>Durée</TableHead>
                <TableHead className="max-w-52">Erreur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {dateHeure(job.created_at)}
                  </TableCell>
                  <TableCell className="text-xs">{libelleTrigger(job.trigger_type)}</TableCell>
                  <TableCell>
                    <Badge variant={VARIANTE_STATUT[job.status] ?? "outline"}>
                      {libelleStatutJob(job.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{job.offers_total}</TableCell>
                  <TableCell className="text-right tabular-nums">{job.offers_activated}</TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{job.offers_rejected}</TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{job.offers_pending_review}</TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">{job.offers_reprocess_required}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{dureeJob(job)}</TableCell>
                  <TableCell className="max-w-52">
                    {job.error_message ? (
                      <span className="block truncate text-[11px] text-destructive" title={job.error_message}>
                        {job.error_message}
                      </span>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
      <PaginationListe page={pageJobs} pagePleine={pagePleine} onPageChange={setPageJobs} />

      {/* ─── Bandeau diagnostic si le dernier sweep a échoué ─── */}
      {dernierSweepEchoue && (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          <Activity className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
          <p>
            Le dernier sweep a échoué (détail dans la section <strong>Alertes</strong> ci-dessous ou dans la colonne Erreur).
            Cause fréquente en démo : <strong>aucune clé IA active</strong> — ajoutez-en une dans la section Clés API.
          </p>
        </div>
      )}
    </div>
  )
}

export default OngletPilotage
