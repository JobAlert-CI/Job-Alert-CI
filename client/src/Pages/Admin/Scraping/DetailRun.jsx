import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, FileClock, Globe } from "lucide-react"
import {
  useAdminRunDetailQuery, useAdminRunLogsQuery, messageErreurScraping,
} from "@/features/admin-scraping.tools"
import { useReferentialsQuery } from "@/lib/referentiels-query"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import StatusChip from "@/components/shared/StatusChip"
import { SectionErreur, SectionVide, SectionAucunResultat } from "./components/EtatsSection"
import {
  LIBELLE_STATUT_RUN, VARIANTE_STATUT_RUN, TONE_STATUT_RUN,
  statutRunActif, dureeLisible, dateHeure,
} from "./components/statuts-scraping"

/* ─────────────────────────────────────────────────────────────────────
   Page Détail d'un run — /admin/scraping/runs/:id (page 11, cycle 11).

   super_admin (guard par route, router scraping entier).

   Diagnostic d'un run (doc v3 §11) :
   - statistiques globales (brutes, insérées, mises à jour, doublons,
     erreurs, durée) ;
   - tableau récapitulatif par source (statut, durée, code HTTP,
     volumes, message d'erreur) ;
   - journal des événements d'ingestion (une ligne par offre traitée,
     niveau dérivé serveur : failed→error, skipped→warning, sinon
     info), filtrable par niveau.

   Données :
   - GET /api/admin/scraping/runs/{id}          (sous-runs préchargés)
   - GET /api/admin/scraping/runs/{id}/logs     (journal)
   - Noms de sources : référentiel PUBLIC /api/referentials/sources
     (useReferentialsQuery, cache déjà chaud depuis les pages offres —
     résolution Map source_id → name, zéro appel dédié).

   ⚠️ Champs de sous-run vérifiés LIVE (2026-09-06) : duplicate_count /
   error_count — les fixtures écrivent duplicates_count/errors_count à
   tort (divergence documentée, on code contre le live).
   ⚠️ Le journal est SPÉCIFIQUE au scraping (doc v3 §11) : il ne
   remonte aucun autre événement technique.
   ───────────────────────────────────────────────────────────────────── */

const LIBELLE_NIVEAU = {
  error: ["Erreur", "destructive"],
  warning: ["Avertissement", "outline"],
  info: ["Info", "secondary"],
}

const LIBELLE_ACTION = {
  inserted: "Insérée",
  updated: "Mise à jour",
  duplicate: "Doublon",
  skipped: "Ignorée",
  failed: "Échec",
}

const DetailRun = () => {
  const { id: runId } = useParams()
  const [niveauFiltre, setNiveauFiltre] = useState("")

  const {
    data: run, isLoading, isError, error, refetch,
  } = useAdminRunDetailQuery(runId)
  const runActif = statutRunActif(run?.status)
  const { data: logs, isLoading: logsChargement } = useAdminRunLogsQuery(runId, { runActif })

  // Résolution source_id → nom : référentiel public déjà en cache.
  const { data: referentiels } = useReferentialsQuery()
  const sourcesParId = useMemo(() => {
    const map = new Map()
    for (const s of referentiels?.sources ?? []) map.set(s.id, s.label ?? s.code)
    return map
  }, [referentiels])

  const logsFiltres = niveauFiltre ? (logs ?? []).filter((l) => l.niveau === niveauFiltre) : logs

  /* ─── 404 : run introuvable ─── */
  if (isError) {
    const introuvable = error?.response?.status === 404
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <LienRetour />
        <SectionErreur
          onRetry={refetch}
          message={introuvable ? "Ce run n'existe pas (ou plus)." : messageErreurScraping(error)}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* ─── En-tête : retour + titre + statut ─── */}
      <LienRetour />

      {isLoading ? (
        <>
          <Skeleton className="h-8 w-72" />
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <Skeleton className="h-40 w-full rounded-xl" />
        </>
      ) : !run ? null : (
        <>
          <section aria-label="En-tête du run" className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-heading text-lg font-bold">
                Run du {dateHeure(run.started_at ?? run.created_at) ?? run.run_date}
              </h1>
              <p className="text-xs text-muted-foreground">
                Déclenché par {run.triggered_by}
                {run.notes ? ` — « ${run.notes} »` : ""}
              </p>
            </div>
            <StatusChip
              tone={TONE_STATUT_RUN[run.status] ?? "navy"}
              ping={runActif}
              tooltip={`Statut : ${LIBELLE_STATUT_RUN[run.status] ?? run.status}`}
            >
              {LIBELLE_STATUT_RUN[run.status] ?? run.status}
              {runActif ? "…" : ""}
            </StatusChip>
          </section>

          {/* ─── Statistiques globales ─── */}
          <section aria-label="Statistiques globales du run" className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <StatGlobale label="Offres brutes" valeur={run.total_raw} />
            <StatGlobale label="Insérées" valeur={run.total_inserted} />
            <StatGlobale label="Mises à jour" valeur={run.total_updated} />
            <StatGlobale label="Doublons" valeur={run.total_duplicates} />
            <StatGlobale label="Erreurs" valeur={run.total_errors} destructif />
            <StatGlobale
              label="Durée"
              texte={dureeLisible(null, run.started_at, run.finished_at) ?? (runActif ? "en cours…" : "—")}
            />
          </section>

          {/* ─── Détail par source ─── */}
          <section aria-label="Détail par source" className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 font-heading text-sm font-semibold">
              <Globe className="size-4 text-primary" aria-hidden />
              Sous-runs par source
            </h2>
            {!run.source_runs?.length ? (
              <SectionVide message="Aucun sous-run pour ce run." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Durée</TableHead>
                      <TableHead className="hidden text-right md:table-cell">HTTP</TableHead>
                      <TableHead className="text-right">Brutes</TableHead>
                      <TableHead className="text-right">Insérées</TableHead>
                      <TableHead className="hidden text-right md:table-cell">M. à jour</TableHead>
                      <TableHead className="hidden text-right md:table-cell">Doublons</TableHead>
                      <TableHead className="hidden text-right lg:table-cell">Erreurs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {run.source_runs.map((sr) => {
                      const srActif = statutRunActif(sr.status)
                      return (
                        <TableRow key={sr.id}>
                          <TableCell className="font-medium">
                            {sourcesParId.get(sr.source_id) ?? "Source inconnue"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={VARIANTE_STATUT_RUN[sr.status] ?? "outline"}>
                              {LIBELLE_STATUT_RUN[sr.status] ?? sr.status}
                              {srActif ? "…" : ""}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {dureeLisible(sr.duration_ms, sr.started_at, sr.finished_at) ?? (srActif ? "…" : "—")}
                          </TableCell>
                          <TableCell className="hidden text-right tabular-nums md:table-cell">
                            {sr.http_status ?? "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{sr.raw_count}</TableCell>
                          <TableCell className="text-right tabular-nums">{sr.inserted_count}</TableCell>
                          <TableCell className="hidden text-right tabular-nums md:table-cell">{sr.updated_count}</TableCell>
                          <TableCell className="hidden text-right tabular-nums md:table-cell">{sr.duplicate_count}</TableCell>
                          <TableCell className="hidden text-right tabular-nums lg:table-cell">
                            <span className={sr.error_count > 0 ? "font-semibold text-destructive" : ""}>
                              {sr.error_count}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            {/* Message d'erreur éventuel d'un sous-run échoué */}
            {run.source_runs?.some((sr) => sr.error_message) && (
              <div className="flex flex-col gap-2" role="alert">
                {run.source_runs
                  .filter((sr) => sr.error_message)
                  .map((sr) => (
                    <p
                      key={sr.id}
                      className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                    >
                      <span className="font-semibold">
                        {sourcesParId.get(sr.source_id) ?? sr.source_id} :
                      </span>{" "}
                      {sr.error_message}
                    </p>
                  ))}
              </div>
            )}
          </section>

          {/* ─── Journal des événements ─── */}
          <section aria-label="Journal des événements" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-heading text-sm font-semibold">
                <FileClock className="size-4 text-primary" aria-hidden />
                Journal d'ingestion
              </h2>
              <Select value={niveauFiltre} onValueChange={setNiveauFiltre}>
                <SelectTrigger className="h-7 w-40" aria-label="Filtrer le journal par niveau">
                  <SelectValue placeholder="Niveau" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous</SelectItem>
                  {Object.entries(LIBELLE_NIVEAU).map(([valeur, [libelle]]) => (
                    <SelectItem key={valeur} value={valeur}>{libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="text-[10px] text-muted-foreground">
              Une ligne par offre traitée — journal spécifique au scraping (les événements
              d'envoi ou d'IA n'y figurent pas).
            </p>

            {logsChargement ? (
              <div className="flex flex-col gap-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}
              </div>
            ) : !logs?.length ? (
              <SectionVide message="Aucun événement pour ce run." />
            ) : !logsFiltres?.length ? (
              <SectionAucunResultat
                message="Aucun événement à ce niveau."
                onReset={() => setNiveauFiltre("")}
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Heure</TableHead>
                      <TableHead>Niveau</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead className="hidden md:table-cell">Offre</TableHead>
                      <TableHead>URL source</TableHead>
                      <TableHead className="hidden lg:table-cell">Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsFiltres.map((log) => {
                      const [libelleNiveau, variante] = LIBELLE_NIVEAU[log.niveau] ?? [log.niveau, "outline"]
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                            {dateHeure(log.created_at)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={variante}>{libelleNiveau}</Badge>
                          </TableCell>
                          <TableCell>{LIBELLE_ACTION[log.action] ?? log.action}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {log.offer_id ? (
                              <Link
                                to={`/admin/offres/${log.offer_id}`}
                                className="font-mono text-[10px] text-primary underline-offset-4 hover:underline"
                                title={log.offer_id}
                              >
                                {log.offer_id.slice(0, 8)}…
                              </Link>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="max-w-56">
                            {log.raw_url ? (
                              <a
                                href={log.raw_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block truncate text-xs text-primary underline-offset-4 hover:underline"
                                title={log.raw_url}
                              >
                                {log.raw_url}
                              </a>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="hidden max-w-52 truncate text-xs text-muted-foreground lg:table-cell" title={log.message ?? ""}>
                            {log.message ?? "—"}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

/* Lien de retour vers /admin/scraping (doc v3 §11). */
const LienRetour = () => (
  <Link
    to="/admin/scraping"
    className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
  >
    <ArrowLeft className="size-3.5" aria-hidden /> Retour au pilotage du scraping
  </Link>
)

/* Petite tuile de statistique globale (pas cliquable — vue de diagnostic). */
const StatGlobale = ({ label, valeur = null, texte = null, destructif = false }) => (
  <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3">
    <p className="text-[10px] font-bold tracking-wider text-muted-foreground/80 uppercase">{label}</p>
    <p className={`font-heading text-xl font-bold tabular-nums ${destructif && (valeur ?? 0) > 0 ? "text-destructive" : ""}`}>
      {texte ?? valeur ?? 0}
    </p>
  </div>
)

export default DetailRun
