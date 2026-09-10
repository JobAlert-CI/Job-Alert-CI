import { CalendarClock, Clock, Repeat2, Timer } from "lucide-react"
import { useSystemePlanificationQuery } from "@/features/admin-systeme.tools"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { SectionErreur, SectionVide } from "../components/EtatsSection"

/* ─────────────────────────────────────────────────────────────────────
   Onglet Planification (audit 4, F.2 — Lot 4).

   GET /api/admin/system/schedule : vue LECTURE SEULE de la
   planification effective du beat, dérivée de celery_app au boot
   (aucune constante dupliquée côté front). L'édition des heures reste
   du ressort des variables d'env (DAILY_*) — un redémarrage du stack
   est requis après changement (uvicorn --reload recharge l'API mais
   PAS beat/workers).

   Shape vérifiée live 2026-09-10 : { timezone, scraper_beat_enabled,
   retry_failed_digests_enabled, no_offer_email_enabled, entries[] }
   entries[] : { name, task, queue, label, description, env_key?,
   toggle?, schedule_kind: daily|interval|hourly-range, utc_time?,
   local_time?, interval_seconds? }
   ───────────────────────────────────────────────────────────────────── */

const ICONE_RYTHME = {
  daily: Clock,
  "hourly-range": Clock,
  interval: Repeat2,
}

const RYTHME = {
  daily: "Quotidien",
  "hourly-range": "Plage horaire",
  interval: "Intervalle",
  other: "Autre",
}

/** Formate un intervalle en secondes → « 1 min », « 5 min », « 30 min ». */
const formatIntervalle = (secondes) => {
  if (!secondes) return "—"
  if (secondes < 60) return `${secondes} s`
  const minutes = Math.round(secondes / 60)
  if (minutes < 60) return `${minutes} min`
  const heures = Math.round(minutes / 60)
  return `${heures} h`
}

const OngletPlanification = () => {
  const { data: schedule, isLoading, isError, refetch } = useSystemePlanificationQuery()

  const entrees = schedule?.entries ?? []

  return (
    <div className="flex flex-col gap-4">
      {/* ─── En-tête ─── */}
      <section aria-label="En-tête planification" className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-sm font-bold">
            <CalendarClock className="size-4 text-primary" aria-hidden /> Planification effective
          </h2>
          <p className="text-xs text-muted-foreground">
            Tâches récurrentes du beat Celery, telles qu'elles tourneront au prochain redémarrage du stack —
            lecture seule, les heures se règlent par variables d'environnement.
          </p>
        </div>
      </section>

      {/* ─── Badges globaux : timezone + kill-switchs ─── */}
      <div className="flex flex-wrap items-center gap-2" aria-label="Configuration globale">
        <Badge variant="outline" className="gap-1">
          <Timer className="size-3" aria-hidden /> Fuseau : {schedule?.timezone ?? "—"}
        </Badge>
        {schedule && (
          <Badge variant={schedule.scraper_beat_enabled ? "secondary" : "destructive"}>
            Scraping planifié : {schedule.scraper_beat_enabled ? "actif" : "désactivé"}
          </Badge>
        )}
        {schedule && (
          <Badge variant={schedule.no_offer_email_enabled ? "secondary" : "outline"}>
            Emails « aucune offre » : {schedule.no_offer_email_enabled ? "actifs" : "désactivés"}
          </Badge>
        )}
        {schedule && (
          <Badge variant={schedule.retry_failed_digests_enabled ? "secondary" : "outline"}>
            Rattrapage digests failed : {schedule.retry_failed_digests_enabled ? "actif" : "désactivé"}
          </Badge>
        )}
      </div>

      {/* ─── Table des entrées ─── */}
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger la planification." />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : !entrees.length ? (
        <SectionVide message="Aucune entrée de planification configurée." />
      ) : (
        <section aria-label="Entrées de planification" className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tâche</TableHead>
                <TableHead>Rythme</TableHead>
                <TableHead>Heure locale</TableHead>
                <TableHead>Heure UTC</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Configuration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entrees.map((entree) => {
                const IconeRythme = ICONE_RYTHME[entree.schedule_kind] ?? Clock
                return (
                  <TableRow key={entree.name}>
                    <TableCell>
                      <span className="block text-xs font-medium" title={entree.description ?? undefined}>
                        {entree.label ?? entree.name}
                      </span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground" title={entree.task}>
                        {entree.task}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <IconeRythme className="size-3" aria-hidden />
                        {RYTHME[entree.schedule_kind] ?? entree.schedule_kind}
                        {entree.schedule_kind === "interval" && entree.interval_seconds
                          ? ` · ${formatIntervalle(entree.interval_seconds)}`
                          : ""}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {entree.schedule_kind === "interval"
                        ? `toutes les ${formatIntervalle(entree.interval_seconds)}`
                        : entree.local_time ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {entree.utc_time ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[10px]">{entree.queue ?? "celery"}</Badge>
                    </TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">
                      {entree.env_key && <p>Variable : <span className="font-mono">{entree.env_key}</span></p>}
                      {entree.toggle && <p>Bascule : <span className="font-mono">{entree.toggle}</span></p>}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </section>
      )}

      {/* ─── Note ─── */}
      <p className="text-[11px] text-muted-foreground">
        Les heures affichées sont celles du <em>prochain redémarrage</em> du stack : le rechargement à chaud de l'API
        (uvicorn --reload) ne recharge <em>ni</em> le beat ni les workers Celery. Après un changement de variable
        <span className="font-mono"> DAILY_* </span>, redémarrez la stack complète pour que la nouvelle planification s'applique.
      </p>
    </div>
  )
}

export default OngletPlanification
