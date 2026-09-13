import { useState } from "react"
import { CalendarClock, Check, Clock, Copy, Repeat2, Timer } from "lucide-react"
import { useSystemePlanificationQuery } from "@/features/admin-systeme.tools"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { SectionErreur, SectionVide } from "../components/EtatsSection"

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
  return `${Math.round(minutes / 60)} h`
}

/* Bouton copie avec feedback « Copié ! » (presse-papiers navigateur). */
const BoutonCopie = ({ texte }) => {
  const [copie, setCopie] = useState(false)

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte)
      setCopie(true)
      window.setTimeout(() => setCopie(false), 1600)
    } catch {
      /* Presse-papiers indisponible (contexte non sécurisé) : on ignore. */
    }
  }

  return (
    <button
      type="button"
      onClick={copier}
      aria-label={`Copier ${texte}`}
      title={copie ? "Copié !" : "Copier la valeur"}
      className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {copie ? (
        <Check className="size-3 text-emerald-600" aria-hidden="true" />
      ) : (
        <Copy className="size-3" aria-hidden="true" />
      )}
    </button>
  )
}

const OngletPlanification = () => {
  const { data: schedule, isLoading, isError, refetch } = useSystemePlanificationQuery()
  const entrees = schedule?.entries ?? []

  return (
    <SectionCardAdmin
      title="Planification effective"
      description="Tâches récurrentes du beat Celery, telles qu'elles tourneront au prochain redémarrage du stack — lecture seule, les heures se règlent par variables d'environnement."
      icon={CalendarClock}
      contentClassName="p-0 sm:p-0"
    >
      {/* ─── Badges globaux : timezone + kill-switchs ─── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3" aria-label="Configuration globale">
        <Badge variant="outline" className="gap-1">
          <Timer className="size-3" aria-hidden="true" /> Fuseau : {schedule?.timezone ?? "—"}
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
        <div className="p-4">
          <SectionErreur onRetry={refetch} message="Impossible de charger la planification." />
        </div>
      ) : isLoading ? (
        <div className="flex flex-col gap-2 p-4" aria-busy="true">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : !entrees.length ? (
        <div className="p-4">
          <SectionVide message="Aucune entrée de planification configurée." />
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
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
                  <TableRow key={entree.name} className="transition-colors hover:bg-muted/50">
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
                        <IconeRythme className="size-3" aria-hidden="true" />
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
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {entree.utc_time ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {entree.queue ?? "celery"}
                      </Badge>
                    </TableCell>
                    {/* Variables d'env copiables en un clic (→ Render). */}
                    <TableCell className="text-[10px] text-muted-foreground">
                      {entree.env_key && (
                        <p className="flex items-center gap-1">
                          Variable : <span className="font-mono">{entree.env_key}</span>
                          <BoutonCopie texte={entree.env_key} />
                        </p>
                      )}
                      {entree.toggle && (
                        <p className="flex items-center gap-1">
                          Bascule : <span className="font-mono">{entree.toggle}</span>
                          <BoutonCopie texte={entree.toggle} />
                        </p>
                      )}
                      {!entree.env_key && !entree.toggle && "—"}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ─── Note ─── */}
      <p className="border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
        Les heures affichées sont celles du <em>prochain redémarrage</em> du stack : le rechargement à chaud de l'API
        (uvicorn --reload) ne recharge <em>ni</em> le beat ni les workers Celery. Après un changement de variable{" "}
        <span className="font-mono">DAILY_*</span>, redémarrez la stack complète pour que la nouvelle planification
        s'applique.
      </p>
    </SectionCardAdmin>
  )
}

export default OngletPlanification