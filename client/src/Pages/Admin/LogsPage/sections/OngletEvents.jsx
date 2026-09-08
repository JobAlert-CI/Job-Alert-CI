import { useMemo } from "react"
import { Link } from "react-router-dom"
import { AlertTriangle, Copy, ExternalLink, Radar } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useFiltresLogsAdmin } from "@/contexts/FiltresLogsAdmin.context"
import {
  LIBELLE_ACTION_EVENT, NIVEAUX_EVENT, VARIANTE_NIVEAU,
  useEventsQuery, useLogsStatsQuery, useRunsParents, useSourcesReferentiel,
} from "@/features/admin-logs.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import CarteCompteur from "@/components/admin/CarteCompteur"
import PaginationListe from "@/components/admin/PaginationListe"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { SectionErreur, SectionVide, SectionAucunResultat } from "../components/EtatsSection"
import { useNotify } from "@/contexts/Notify.context"

/* ─────────────────────────────────────────────────────────────────────
   Onglet Événements techniques (cycle 17, doc v3 §17.1) — module
   scraping seul (source: OfferIngestionEvent).

   Compteurs E1-E4 + charts E5-E6 servis par UN SEUL appel /logs/stats ;
   table via /logs/events (liste plate → pagination heuristique honnête).
   Liens croisés : détail run scraping (/admin/scraping/runs/:id) et
   fiche offre (/admin/offres/:id).
   ───────────────────────────────────────────────────────────────────── */

const COULEURS_NIVEAU = { error: "#ef4444", warning: "#f59e0b", info: "#0F2D4D" }
const COULEURS_ACTION = ["#0F2D4D", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"]

const dateHeure = (iso) => {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) +
    " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

const CadreChart = ({ titre, chargement, vide, videMessage, children, minHeight = 220, className = "" }) => (
  <div className={`flex flex-col gap-2 rounded-xl border border-border bg-card p-4 ${className}`}>
    <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">{titre}</h3>
    {chargement ? (
      <Skeleton className="w-full rounded-lg" style={{ height: minHeight }} />
    ) : vide ? (
      <Empty className="py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon" />
          <EmptyTitle>Pas encore de données</EmptyTitle>
          <EmptyDescription>{videMessage}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    ) : (
      <div style={{ height: minHeight }}>
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    )}
  </div>
)

const OngletEvents = () => {
  const notify = useNotify()
  const { niveau, source, pageEvents, paramsEvents, setNiveau, setSource, setPageEvents, reinitialiserEvents } =
    useFiltresLogsAdmin()

  const { data: stats, isLoading: statsCharge } = useLogsStatsQuery(30)
  const { data: events, isLoading, isError, refetch } = useEventsQuery(paramsEvents)
  const { data: referentiels } = useSourcesReferentiel()
  const { data: runsParents } = useRunsParents()

  // Résolution sous-run → run parent : les événements portent l'ID du
  // SOUS-RUN (source_scrape_runs.id) mais la page détail attend l'ID du
  // run PARENT (scrape_runs.id) — lier l'ID brut → 404 systématique.
  // Croisement local avec la liste des runs (pattern cycle 12).
  const parentParSousRun = useMemo(() => {
    const m = new Map()
    for (const run of runsParents ?? []) {
      for (const sousRun of run.source_runs ?? []) m.set(sousRun.id, run.id)
    }
    return m
  }, [runsParents])

  // E5 : par jour, empilé par niveau (total par jour + répartition par_action).
  const parJourNiveau = useMemo(
    () =>
      (stats?.events_par_jour ?? []).map((j) => ({
        jour: new Date(`${j.jour}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        Erreurs: (j.par_action.failed ?? 0),
        Avertissements: (j.par_action.skipped ?? 0),
        Infos: (j.par_action.inserted ?? 0) + (j.par_action.updated ?? 0) + (j.par_action.duplicate ?? 0),
      })),
    [stats]
  )

  // E6 : par action (fenêtre), top en tête (serveur les renvoie triés DESC).
  const parAction = useMemo(
    () =>
      (stats?.events_par_action ?? []).map((a) => ({
        action: LIBELLE_ACTION_EVENT[a.action] ?? a.action,
        total: a.total,
      })),
    [stats]
  )

  const filtresActifs = !!(niveau || source)
  const pagePleine = Array.isArray(events) && events.length === paramsEvents.limit

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Compteurs E1-E4 ─── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <CarteCompteur label="Total événements" valeur={stats?.events_total ?? 0} chargement={statsCharge} />
        <button type="button" onClick={() => setNiveau("error")} className="text-left"
          aria-label={`Voir les erreurs (${stats?.events_errors ?? 0})`}>
          <CarteCompteur label="Erreurs" valeur={stats?.events_errors ?? 0} chargement={statsCharge} />
        </button>
        <button type="button" onClick={() => setNiveau("warning")} className="text-left"
          aria-label={`Voir les avertissements (${stats?.events_warnings ?? 0})`}>
          <CarteCompteur label="Avertissements" valeur={stats?.events_warnings ?? 0} chargement={statsCharge} />
        </button>
        <CarteCompteur label="Doublons détectés" valeur={stats?.events_duplicates ?? 0} chargement={statsCharge} />
      </div>

      {/* ─── Charts E5-E6 ─── */}
      <div className="grid gap-4 xl:grid-cols-3">
        <CadreChart titre="Événements par jour (30 j)" chargement={statsCharge} vide={!parJourNiveau.length}
          videMessage="Aucun événement dans la fenêtre." className="xl:col-span-2">
          <BarChart data={parJourNiveau} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="jour" fontSize={10} tickLine={false} />
            <YAxis allowDecimals={false} fontSize={10} tickLine={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Erreurs" stackId="n" fill={COULEURS_NIVEAU.error} isAnimationActive={false} />
            <Bar dataKey="Avertissements" stackId="n" fill={COULEURS_NIVEAU.warning} isAnimationActive={false} />
            <Bar dataKey="Infos" stackId="n" fill={COULEURS_NIVEAU.info} isAnimationActive={false} radius={[4, 4, 0, 0]} />
          </BarChart>
        </CadreChart>

        <CadreChart titre="Répartition par action (30 j)" chargement={statsCharge} vide={!parAction.length}
          videMessage="Aucune action dans la fenêtre.">
          <PieChart>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Pie data={parAction} dataKey="total" nameKey="action" innerRadius={50} outerRadius={75}
              paddingAngle={2} isAnimationActive={false}>
              {parAction.map((entree, i) => (
                <Cell key={entree.action} fill={COULEURS_ACTION[i % COULEURS_ACTION.length]} />
              ))}
            </Pie>
          </PieChart>
        </CadreChart>
      </div>

      {/* ─── Filtres ─── */}
      <section aria-label="Filtres événements" className="flex flex-wrap items-center gap-2">
        <select value={niveau} onChange={(e) => setNiveau(e.target.value)} aria-label="Filtrer par niveau"
          className="h-9 rounded-md border border-border bg-background px-2 text-xs">
          <option value="">Tous les niveaux</option>
          {NIVEAUX_EVENT.map((n) => (
            <option key={n.valeur} value={n.valeur}>{n.libelle}</option>
          ))}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Filtrer par source"
          className="h-9 max-w-56 rounded-md border border-border bg-background px-2 text-xs">
          <option value="">Toutes les sources</option>
          {(referentiels?.sources ?? []).map((s) => (
            <option key={s.id ?? s.code} value={s.id ?? ""}>{s.label}</option>
          ))}
        </select>
        <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Radar className="size-3" aria-hidden /> Module scraping seul — les autres modules n'émettent pas d'événements.
        </p>
        {filtresActifs && (
          <Button variant="ghost" size="sm" onClick={reinitialiserEvents}>Réinitialiser</Button>
        )}
      </section>

      {/* ─── Table ─── */}
      {isError ? (
        <SectionErreur onRetry={refetch} message="Impossible de charger les événements." />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
        </div>
      ) : !events?.length ? (
        filtresActifs ? (
          <SectionAucunResultat onReset={reinitialiserEvents} message="Aucun événement ne correspond aux critères." />
        ) : (
          <SectionVide message="Aucun événement d'ingestion pour l'instant." />
        )
      ) : (
        <section aria-label="Événements" className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Date</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Source / run</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((evt) => (
                <TableRow key={evt.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{dateHeure(evt.created_at)}</TableCell>
                  <TableCell><Badge variant={VARIANTE_NIVEAU[evt.niveau] ?? "outline"}>{evt.niveau}</Badge></TableCell>
                  <TableCell className="text-xs">{LIBELLE_ACTION_EVENT[evt.action] ?? evt.action}</TableCell>
                  <TableCell className="max-w-72 truncate font-mono text-[10px] text-muted-foreground" title={evt.message ?? ""}>
                    {evt.message ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {(() => {
                      // Résolution sous-run → run PARENT (fix cycle 17 :
                      // source_scrape_run_id est l'ID du SOUS-RUN — le
                      // lier tel quel à la page détail → 404 systématique).
                      const runParent = evt.source_scrape_run_id
                        ? parentParSousRun.get(evt.source_scrape_run_id)
                        : null
                      if (!runParent) {
                        return evt.source_scrape_run_id ? (
                          <span className="text-[10px] text-muted-foreground"
                            title="Run trop ancien pour le lien (hors des 100 derniers runs) — voir l'historique Scraping">
                            Run #…&nbsp;<ExternalLink className="inline size-3 opacity-40" aria-hidden />
                          </span>
                        ) : "—"
                      }
                      return (
                        <Link to={`/admin/scraping/runs/${runParent}`}
                          className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">
                          Voir le run <ExternalLink className="size-3" aria-hidden />
                        </Link>
                      )
                    })()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {evt.hash_unique && (
                        <Button variant="ghost" size="icon-sm" aria-label="Copier le hash"
                          onClick={() => { navigator.clipboard?.writeText(evt.hash_unique); notify("Hash copié", "success") }}>
                          <Copy className="size-3.5" aria-hidden />
                        </Button>
                      )}
                      {evt.offer_id && (
                        <Link to={`/admin/offres/${evt.offer_id}`}
                          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                          aria-label="Voir l'offre liée">
                          <ExternalLink className="size-3.5" aria-hidden />
                        </Link>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {/* ─── Pagination heuristique (liste plate sans total) ─── */}
      <PaginationListe page={pageEvents} pagePleine={pagePleine} onPageChange={setPageEvents} />

      {!isLoading && !events?.length && stats?.events_errors > 0 && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <AlertTriangle className="size-3.5 text-amber-500" aria-hidden />
          Des erreurs existent hors filtre courant — {stats.events_errors} au total.
        </p>
      )}
    </div>
  )
}

export default OngletEvents
