import { useMemo, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"
import {
  Activity, AlertTriangle, CalendarDays, RotateCcw,
} from "lucide-react"
import { cn } from "cn"
import { fmtDay } from "@/lib/dates"
import { useFiltresLogsAdmin } from "@/contexts/FiltresLogsAdmin.context"
import {
  LIBELLE_ACTION_EVENT, NIVEAUX_EVENT,
  useEventsQuery, useLogsStatsQuery, useRunsParents, useSourcesReferentiel,
} from "@/features/admin-logs.tools"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import PaginationListe from "@/components/admin/PaginationListe"
import EnteteTriable from "@/components/admin/EnteteTriable"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { Table, TableHeader, TableBody, TableHead, TableRow } from "@/components/ui/table"
import { SectionErreur, SectionVide, SectionAucunResultat, TransitionEtat } from "@/components/admin/EtatsSection"
import Bloc from "@/components/admin/Bloc"
import { FilterPopover, MiniCalendar } from "@/components/shared"
import CarteEventMobile, { SkeletonCarteEventMobile } from "../components/CarteEventMobile"
import BlocSkel from "../components/BlocSkel"
import LigneEvent, { SkeletonLigneEvent } from "../components/LigneEvent"

/* ─────────────────────────────────────────────────────────────────────
   Liste des événements techniques — /admin/logs (onglet Événements).
   Mobile (< md) : cartes + tri par Select — Desktop : table triable.
───────────────────────────────────────────────────────────────────── */

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



/* ─── SKELETONS FIDÈLES ────────────────────────────────────────────
   ⚠️ `Bloc` est déjà le composant de layout importé de
   @/components/admin/Bloc → le helper skeleton s'appelle BlocSkel. */


const EvenementsSkeleton = ({ nbLignes = 20 }) => {
  const lignes = Array.from({ length: nbLignes }, (_, i) => i)
  /* Le skeleton mobile est borné : inutile de monter des dizaines de
     cartes skeleton quand la taille de page est grande. */
  const lignesMobile = lignes.slice(0, Math.min(nbLignes, 8))
  return (
    <div role="status" aria-label="Chargement des événements">
      {/* Mobile : Select de tri + cartes */}
      <div className="px-4 pt-3 md:hidden" aria-hidden="true">
        <Skeleton className="h-8 w-full" />
      </div>
      <ul className="flex flex-col gap-3 px-4 pb-2 md:hidden" aria-hidden="true">
        {lignesMobile.map((i) => (
          <li key={i}><SkeletonCarteEventMobile delay={i * 70} /></li>
        ))}
      </ul>

      {/* Desktop : table avec en-tête */}
      <div className="hidden overflow-x-auto scrollbar-thin md:block">
        <Table aria-hidden="true">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead><BlocSkel className="h-3 w-10" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-12" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-12" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-16" /></TableHead>
              <TableHead><BlocSkel className="h-3 w-20" /></TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((i) => <SkeletonLigneEvent key={i} delay={i * 70} />)}
          </TableBody>
        </Table>
      </div>

      {/* Pied partagé : équivalent de PaginationListe */}
      <div className="border-t border-border px-4 py-3" aria-hidden="true">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-3 w-24" />
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }, (_, j) => (
              <Skeleton key={j} className="size-8 rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── COMPOSANT PRINCIPAL ────────────────────────────────────────── */
const ListeEvenements = () => {
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

  /* Tri mobile : un Select (les en-têtes cliquables sont masqués < md).
     Chaque option applique la direction initiale naturelle de la colonne ;
     « serveur » revient à l'ordre naturel (tri = null). */
  const trierMobile = (valeur) => {
    if (valeur === "serveur") return setTri(null)
    const colonne = COLONNES.find((c) => c.cle === valeur)
    if (colonne) setTri({ cle: colonne.cle, direction: colonne.directionInitiale })
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

  /* ⚠️ Clé d'état : le tri / filtres n'en font PAS partie — l'ancienne
     clé `${etat}-${cleCorps}` rejouait le fondu global de la section à
     chaque tri en plus du fondu du corps (double animation). Le fondu
     tri/filtres est porté par key={cleCorps} sur le TableBody / la liste. */
  const etat = isError
    ? "erreur"
    : isLoading
      ? "chargement"
      : !events?.length
        ? filtresActifs ? "aucun-resultat" : "vide"
        : "donnees"

  return (
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

        {/* ─── Corps : états + cartes mobile / table desktop ─── */}
        <Bloc>
          <TransitionEtat etat={etat}>
            {isError ? (
              <div className="p-4">
                <SectionErreur onRetry={refetch} message="Impossible de charger les événements." />
              </div>
            ) : isLoading ? (
              <EvenementsSkeleton nbLignes={paramsEvents.limit} />
            ) : !events?.length ? (
              <div className="p-4">
                {filtresActifs ? (
                  <SectionAucunResultat onReset={reinitialiserEvents} message="Aucun événement ne correspond aux critères." />
                ) : (
                  <SectionVide message="Aucun événement d'ingestion pour l'instant." />
                )}
                {/* Erreurs existantes hors filtre courant */}
                {stats?.events_errors > 0 && (
                  <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangle className="size-3.5 text-amber-500" aria-hidden />
                    Des erreurs existent hors filtre courant — {stats.events_errors} au total.
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* ── Tri — mobile (desktop : en-têtes cliquables) ── */}
                <div className="px-4 pt-3 md:hidden">
                  <Select value={tri?.cle ?? "serveur"} onValueChange={trierMobile}>
                    <SelectTrigger className="h-8 w-full text-xs" aria-label="Trier les événements">
                      <SelectValue placeholder="Trier par…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="serveur">Ordre du serveur (défaut)</SelectItem>
                      <SelectItem value="date">Date (plus récentes d'abord)</SelectItem>
                      <SelectItem value="niveau">Niveau (erreurs d'abord)</SelectItem>
                      <SelectItem value="action">Action (A→Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* ── Mobile : cartes ─────────────────────────── */}
                <ul
                  key={cleCorps}
                  className="flex animate-in flex-col gap-3 px-4 pb-2 duration-200 motion-reduce:animate-none md:hidden"
                >
                  {eventsAffiches.map((evt) => (
                    <li key={evt.id}>
                      <CarteEventMobile
                        evt={evt}
                        runParent={evt.source_scrape_run_id ? parentParSousRun.get(evt.source_scrape_run_id) : null}
                      />
                    </li>
                  ))}
                </ul>

                {/* ── Desktop : table ─────────────────────────── */}
                <section aria-label="Événements" className="hidden overflow-x-auto scrollbar-thin md:block">
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
                    {/* key = fondu léger à chaque changement de tri / filtres */}
                    <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                      {eventsAffiches.map((evt) => (
                        <LigneEvent
                          key={evt.id}
                          evt={evt}
                          runParent={evt.source_scrape_run_id ? parentParSousRun.get(evt.source_scrape_run_id) : null}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </section>

                {/* ─── Pagination heuristique (liste plate sans total) ─── */}
                <div className="border-t border-border px-4 py-3">
                  <PaginationListe page={pageEvents} pagePleine={pagePleine} onPageChange={changerPage} />
                </div>
              </>
            )}
          </TransitionEtat>
        </Bloc>
      </SectionCardAdmin>
    </div>
  )
}

export default ListeEvenements