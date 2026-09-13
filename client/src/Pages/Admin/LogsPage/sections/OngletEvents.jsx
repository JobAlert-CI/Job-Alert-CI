import { memo, useMemo, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Link } from "react-router-dom"
import {
  Activity, AlertCircle, AlertTriangle, CalendarDays, Copy, CopyCheck, ExternalLink, RotateCcw,
} from "lucide-react"
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, Tooltip, XAxis, YAxis,
} from "recharts"
import { cn } from "cn"
import { useNotify } from "@/contexts/Notify.context"
import { fmtDay, dateHeure } from "@/lib/dates"
import { useFiltresLogsAdmin } from "@/contexts/FiltresLogsAdmin.context"
import {
  LIBELLE_ACTION_EVENT, NIVEAUX_EVENT, VARIANTE_NIVEAU,
  useEventsQuery, useLogsStatsQuery, useRunsParents, useSourcesReferentiel,
} from "@/features/admin-logs.tools"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import CarteCompteur from "@/components/admin/CarteCompteur"
import PaginationListe from "@/components/admin/PaginationListe"
import EnteteTriable from "@/components/admin/EnteteTriable"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import CadreChart, { TooltipChart } from "../components/CadreChart"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { SectionErreur, SectionVide, SectionAucunResultat } from "../components/EtatsSection"
import { VARIANTS_PAGE } from "@/components/admin/Bloc"
import { FilterPopover, MiniCalendar } from "@/components/shared"

/* ─────────────────────────────────────────────────────────────────────
   Onglet Événements techniques (cycle 17, doc v3 §17.1) — module
   scraping seul (source: OfferIngestionEvent).
   Compteurs E1-E4 + charts E5-E6 servis par UN SEUL appel /logs/stats ;
   table via /logs/events (liste plate → pagination heuristique).
   Refonte : tri par en-tête initialisé (« Date » desc), selects shadcn
   avec surbrillance, période via MiniCalendar, retour en haut du
   tableau au changement de page, skeleton fidèle (limite de page),
   animations Recharts conditionnées par prefers-reduced-motion.
   ───────────────────────────────────────────────────────────────────── */
const COULEURS_NIVEAU = { error: "#ef4444", warning: "#f59e0b", info: "#0F2D4D" }
const COULEURS_ACTION = ["#0F2D4D", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"]

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

/* Date → « AAAA-MM-JJ » local (symétrique du parse en T00:00:00). */
const isoJour = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/* Rang de tri des niveaux : erreur d'abord (desc). */
const RANG_NIVEAU = { error: 3, warning: 2, info: 1 }

/* Colonnes triables — Message (texte long) et Source/run (lien croisé)
   restent des en-têtes simples. */
const COLONNES = [
  { cle: "date", libelle: "Date", directionInitiale: "desc", triValeur: (e) => e.created_at ?? null },
  { cle: "niveau", libelle: "Niveau", directionInitiale: "desc", triValeur: (e) => RANG_NIVEAU[e.niveau] ?? 0 },
  { cle: "action", libelle: "Action", directionInitiale: "asc", triValeur: (e) => LIBELLE_ACTION_EVENT[e.action] ?? e.action ?? "" },
]

/* Déclencheur de filtre : surbrillance quand une valeur non défaut est
   sélectionnée. */
const classeDeclencheur = (actif, largeur) =>
  cn(
    "h-8 text-xs transition-colors",
    largeur,
    actif
      ? "border-brand-navy/30 bg-secondary font-semibold text-secondary-foreground"
      : "text-muted-foreground"
  )

/* ─── Ligne mémoïsée ─── */
const LigneEvent = memo(function LigneEvent({ evt, runParent }) {
  const notify = useNotify()
  return (
    <TableRow className="transition-colors hover:bg-muted/50">
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{dateHeure(evt.created_at)}</TableCell>
      <TableCell><Badge variant={VARIANTE_NIVEAU[evt.niveau] ?? "outline"}>{evt.niveau}</Badge></TableCell>
      <TableCell className="text-xs">{LIBELLE_ACTION_EVENT[evt.action] ?? evt.action}</TableCell>
      <TableCell className="max-w-72 truncate font-mono text-[10px] text-muted-foreground" title={evt.message ?? ""}>
        {evt.message ?? "—"}
      </TableCell>
      <TableCell className="text-xs">
        {/* Résolution sous-run → run PARENT (fix cycle 17). */}
        {runParent ? (
          <Link to={`/admin/scraping/runs/${runParent}`} className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">
            Voir le run <ExternalLink className="size-3" aria-hidden />
          </Link>
        ) : evt.source_scrape_run_id ? (
          <span
            className="text-[10px] text-muted-foreground"
            title="Run trop ancien pour le lien (hors des 100 derniers runs) — voir l'historique Scraping"
          >
            Run #…&nbsp;<ExternalLink className="inline size-3 opacity-40" aria-hidden />
          </span>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {evt.hash_unique && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Copier le hash"
              onClick={() => { navigator.clipboard?.writeText(evt.hash_unique); notify("Hash copié", "success") }}
            >
              <Copy className="size-3.5" aria-hidden />
            </Button>
          )}
          {evt.offer_id && (
            <Link
              to={`/admin/offres/${evt.offer_id}`}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Voir l'offre liée"
            >
              <ExternalLink className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
})

/* ─── Skeleton fidèle aux colonnes réelles ─── */
const LigneSkeletonEvent = () => (
  <TableRow className="hover:bg-transparent">
    <TableCell><Skeleton className="h-3.5 w-24" /></TableCell>
    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
    <TableCell><Skeleton className="h-3.5 w-20" /></TableCell>
    <TableCell><Skeleton className="h-3 w-56" /></TableCell>
    <TableCell><Skeleton className="h-3.5 w-24" /></TableCell>
    <TableCell>
      <div className="flex justify-end gap-1">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
      </div>
    </TableCell>
  </TableRow>
)

const OngletEvents = () => {
  const mouvementReduit = useReducedMotion()
  const {
    niveau, source, debutEvents, finEvents, pageEvents, paramsEvents,
    setNiveau, setSource, setDebutEvents, setFinEvents, setPageEvents, reinitialiserEvents,
  } = useFiltresLogsAdmin()
  const { data: stats } = useLogsStatsQuery(30)
  const { data: events, isLoading, isError, refetch } = useEventsQuery(paramsEvents)
  const { data: referentiels } = useSourcesReferentiel()
  const { data: runsParents } = useRunsParents()

  /* Tri INITIALISÉ : « Date » descendante (le plus récent d'abord). */
  const [tri, setTri] = useState({ cle: "date", direction: "desc" })
  const [calendrierOuvert, setCalendrierOuvert] = useState(false)
  /* Ancrage du retour en haut du tableau au changement de page. */
  const refTableau = useRef(null)

  /* Résolution sous-run → run parent (pattern cycle 12). */
  const parentParSousRun = useMemo(() => {
    const m = new Map()
    for (const run of runsParents ?? []) {
      for (const sousRun of run.source_runs ?? []) m.set(sousRun.id, run.id)
    }
    return m
  }, [runsParents])

  // E5 : par jour, empilé par niveau.
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

  // E6 : par action (fenêtre), top en tête.
  const parAction = useMemo(
    () =>
      (stats?.events_par_action ?? []).map((a) => ({
        action: LIBELLE_ACTION_EVENT[a.action] ?? a.action,
        total: a.total,
      })),
    [stats]
  )

  const filtresActifs = !!(niveau || source || debutEvents || finEvents)
  const pagePleine = Array.isArray(events) && events.length === paramsEvents.limit

  const eventsAffiches = useMemo(() => {
    const base = events ?? []
    if (!tri) return base
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base
    const copie = [...base].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [events, tri])

  /* Cycle de tri : sens initial → sens inverse → aucun (ordre serveur). */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  /* ─── Période : URL « AAAA-MM-JJ » ↔ MiniCalendar ─── */
  const plageDates = useMemo(() => ({
    start: debutEvents ? new Date(`${debutEvents}T00:00:00`) : null,
    end: finEvents ? new Date(`${finEvents}T00:00:00`) : null,
  }), [debutEvents, finEvents])

  const changerPlage = (r) => {
    setDebutEvents(r?.start ? isoJour(r.start) : "")
    setFinEvents(r?.end ? isoJour(r.end) : "")
  }

  const libellePeriode = debutEvents && finEvents
    ? `Du ${fmtDay(plageDates.start)} au ${fmtDay(plageDates.end)}`
    : debutEvents
      ? `Depuis le ${fmtDay(plageDates.start)}`
      : "Période"

  /* Changement de page → retour en haut du tableau. */
  const changerPage = (nouvellePage) => {
    setPageEvents(nouvellePage)
    refTableau.current?.scrollIntoView({
      behavior: mouvementReduit ? "auto" : "smooth",
      block: "start",
    })
  }

  /* key = fondu léger du corps à chaque changement de tri / filtres. */
  const cleCorps = `${niveau}-${source}-${debutEvents}-${finEvents}-${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  return (
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      {/* ─── Compteurs E1-E4 ─── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <CarteCompteur label="Total événements" valeur={stats?.events_total ?? 0} icone={Activity} />
        <CarteCompteur label="Erreurs" valeur={stats?.events_errors ?? 0} icone={AlertCircle} href="/admin/logs" query="?niveau=error" />
        <CarteCompteur label="Avertissements" valeur={stats?.events_warnings ?? 0} icone={AlertTriangle} href="/admin/logs" query="?niveau=warning" />
        <CarteCompteur label="Doublons détectés" valeur={stats?.events_duplicates ?? 0} icone={CopyCheck} />
      </div>

      {/* ─── Charts E5-E6 (animations conditionnées reduced-motion) ─── */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SectionCardAdmin
            title="Événements par jour (30 j)"
            description="Statistiques des événements par jour, empilé par niveau."
            contentClassName="p-0 sm:p-0"
            icon={CalendarDays}
          >
            <CadreChart vide={!parJourNiveau.length} videMessage="Aucun événement dans la fenêtre.">
              <BarChart data={parJourNiveau} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="jour" fontSize={10} tickLine={false} />
                <YAxis allowDecimals={false} fontSize={10} tickLine={false} />
                <Tooltip content={<TooltipChart />} cursor={{ fill: "var(--color-muted)", opacity: 0.4 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Erreurs" stackId="n" fill={COULEURS_NIVEAU.error} isAnimationActive={!mouvementReduit} animationDuration={600} animationEasing="ease-out" />
                <Bar dataKey="Avertissements" stackId="n" fill={COULEURS_NIVEAU.warning} isAnimationActive={!mouvementReduit} animationDuration={600} animationEasing="ease-out" />
                <Bar dataKey="Infos" stackId="n" fill={COULEURS_NIVEAU.info} isAnimationActive={!mouvementReduit} animationDuration={600} animationEasing="ease-out" radius={[4, 4, 0, 0]} />
              </BarChart>
            </CadreChart>
          </SectionCardAdmin>
        </div>
        <SectionCardAdmin
          title="Événements par action"
          description="Statistiques des événements par action (total par action)."
          icon={Activity}
        >
          <CadreChart vide={!parAction.length} videMessage="Aucune action dans la fenêtre.">
            <PieChart>
              <Tooltip content={<TooltipChart />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Pie
                data={parAction}
                dataKey="total"
                nameKey="action"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={2}
                isAnimationActive={!mouvementReduit}
                animationDuration={600}
                animationEasing="ease-out"
              >
                {parAction.map((entree, i) => (
                  <Cell key={entree.action} fill={COULEURS_ACTION[i % COULEURS_ACTION.length]} />
                ))}
              </Pie>
            </PieChart>
          </CadreChart>
        </SectionCardAdmin>
      </div>

      {/* ─── Table des événements ─── */}
      <div ref={refTableau} className="scroll-mt-20">
        <SectionCardAdmin
          title="Événements"
          description="Liste des événements d'ingestion — filtrez, triez, croisez avec les runs et les offres."
          icon={Activity}
          contentClassName="p-0 sm:p-0"
        >
          {/* ─── Filtres : selects shadcn + période MiniCalendar ─── */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
            {/* Sentinelle « tous/toutes » : Radix refuse la valeur vide. */}
            <Select value={niveau || "tous"} onValueChange={(v) => setNiveau(v === "tous" ? "" : v)}>
              <SelectTrigger className={classeDeclencheur(!!niveau, "w-full sm:w-44")} aria-label="Filtrer par niveau">
                <SelectValue placeholder="Filtrer par niveau" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous les niveaux</SelectItem>
                {NIVEAUX_EVENT.map((n) => (
                  <SelectItem key={n.valeur} value={n.valeur}>{n.libelle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={source || "toutes"} onValueChange={(v) => setSource(v === "toutes" ? "" : v)}>
              <SelectTrigger className={classeDeclencheur(!!source, "w-full sm:w-56")} aria-label="Filtrer par source">
                <SelectValue placeholder="Filtrer par source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes les sources</SelectItem>
                {(referentiels?.sources ?? []).map((s) => (
                  <SelectItem key={s.id ?? s.code} value={s.id ?? s.code}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Période : déclencheur → panneau MiniCalendar (presets inclus). */}
            <FilterPopover
              open={calendrierOuvert}
              onToggle={() => setCalendrierOuvert((o) => !o)}
              onClose={() => setCalendrierOuvert(false)}
              label={libellePeriode}
              icon={CalendarDays}
              align="right"
              panelClassName="w-[19.5rem] p-3"
            >
              <MiniCalendar range={plageDates} onChange={changerPlage} />
            </FilterPopover>
            {filtresActifs && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={reinitialiserEvents}>
                <RotateCcw aria-hidden /> Réinitialiser
              </Button>
            )}
          </div>

          {/* ─── Corps : table triable, skeleton fidèle ─── */}
          {isError ? (
            <div className="p-4">
              <SectionErreur onRetry={refetch} message="Impossible de charger les événements." />
            </div>
          ) : !events?.length && !isLoading ? (
            <div className="p-4">
              {filtresActifs ? (
                <SectionAucunResultat onReset={reinitialiserEvents} message="Aucun événement ne correspond aux critères." />
              ) : (
                <SectionVide message="Aucun événement d'ingestion pour l'instant." />
              )}
            </div>
          ) : (
            <>
              <section aria-label="Événements" className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "date")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "niveau")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "action")} tri={tri} onTri={basculerTri} />
                      <TableHead>Message</TableHead>
                      <TableHead>Source / run</TableHead>
                      <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                    {isLoading ? (
                      [...Array(paramsEvents.limit)].map((_, i) => <LigneSkeletonEvent key={i} />)
                    ) : !eventsAffiches.length ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6}>
                          <SectionAucunResultat onReset={reinitialiserEvents} message="Aucun événement ne correspond aux critères." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      eventsAffiches.map((evt) => (
                        <LigneEvent
                          key={evt.id}
                          evt={evt}
                          runParent={evt.source_scrape_run_id ? parentParSousRun.get(evt.source_scrape_run_id) : null}
                        />
                      ))
                    )}
                  </TableBody>
                </Table>
              </section>
              {/* ─── Pagination heuristique (liste plate sans total) ─── */}
              <div className="border-t border-border px-4 py-3">
                <PaginationListe page={pageEvents} pagePleine={pagePleine} onPageChange={changerPage} />
              </div>
              {!isLoading && !events?.length && stats?.events_errors > 0 && (
                <p className="flex items-center gap-1 px-4 pb-3 text-xs text-muted-foreground">
                  <AlertTriangle className="size-3.5 text-amber-500" aria-hidden />
                  Des erreurs existent hors filtre courant — {stats.events_errors} au total.
                </p>
              )}
            </>
          )}
        </SectionCardAdmin>
      </div>
    </motion.div>
  )
}

export default OngletEvents