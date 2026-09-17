import { useMemo, useRef, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import EnteteTriable from "@/components/admin/EnteteTriable"
import { Link, useParams } from "react-router-dom"
import { AlertCircle, ArrowLeft, Copy, FileClock, FileEdit, FilePlus, FileText, Globe, Pencil, Timer } from "lucide-react"
import {
  useAdminRunDetailQuery, useAdminRunLogsQuery, useModifierNotesRun, messageErreurScraping,
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
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { SectionErreur, SectionVide, SectionAucunResultat } from "@/components/admin/EtatsSection"
import {
  LIBELLE_STATUT_RUN, VARIANTE_STATUT_RUN, TONE_STATUT_RUN,
  statutRunActif, dureeLisible, dateHeure,
  sufixDuree,
} from "./components/statuts-scraping"
import HeroAdmin from "@/components/admin/HeroAdmin"
import BtnAction from "@/components/admin/BtnAction"
import DialogNotesRun from "@/components/dialog/DialogNotesRun"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { TransitionEtat } from "@/components/admin/EtatsSection"
import { cn } from "@/lib/utils"
import PaginationListe from "@/components/admin/PaginationListe"
import { formatNombre } from "@/lib/utils"

/* ─────────────────────────────────────────────────────────────────────
   Page Détail d'un run — /admin/scraping/runs/:id (super_admin).
   ───────────────────────────────────────────────────────────────────── */

const LIBELLE_NIVEAU = {
  error: ["Erreur", "destructive"],
  warning: ["Avertissement", "outline"],
  info: ["Info", "secondary"],
}

/* Ordre de sévérité : en tri croissant, les erreurs remontent en premier. */
const ORDRE_NIVEAU = { error: 0, warning: 1, info: 2 }

/* Colonnes triables du journal — Heure initialisée desc (plus récent
d'abord, cohérent avec l'ordre serveur). Offre / URL / Message restent
des colonnes simples (contenu long, tri sans intérêt). */
const COLONNES_JOURNAL = [
  {
    cle: "created_at", libelle: "Heure", directionInitiale: "desc",
    triValeur: (l) => l.created_at,
  },
  {
    cle: "niveau", libelle: "Niveau", directionInitiale: "asc",
    triValeur: (l) => ORDRE_NIVEAU[l.niveau] ?? 99,
  },
  {
    cle: "action", libelle: "Action", directionInitiale: "asc",
    triValeur: (l) => LIBELLE_ACTION[l.action] ?? l.action,
  },
]

const LIBELLE_ACTION = {
  inserted: "Insérée",
  updated: "Mise à jour",
  duplicate: "Doublon",
  skipped: "Ignorée",
  failed: "Échec",
}

const TAILLE_PAGE_JOURNAL = 20

/* Comparateur générique (même implémentation qu'HistoriqueRuns). */
const comparerValeurs = (a, b) => {
  const videA = a === null || a === undefined || a === ""
  const videB = b === null || b === undefined || b === ""
  if (videA && videB) return 0
  if (videA) return 1
  if (videB) return -1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" })
}

const VARIANTS_PAGE = {
  cache: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
}
const VARIANTS_SECTION = {
  cache: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
}

/* ─────────────────────────────────────────────────────────────────────
   SKELETONS FIDÈLES — géométrie exacte de chaque section
   ───────────────────────────────────────────────────────────────────── */

const Bloc = ({ className, delay = 0 }) => (
  <Skeleton
    className={className}
    style={delay ? { animationDelay: `${delay}ms` } : undefined}
  />
)

/** Skeleton du HeroAdmin : titre + description + badge statut + notes + bouton. */
const HeroAdminSkeleton = () => (
  <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-soft">
    <div className="flex flex-col gap-2">
      <Bloc className="h-7 w-72" />
      <Bloc className="h-4 w-44" />
    </div>
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <Bloc className="h-6 w-28 rounded-full" />
      <Bloc className="h-6 w-40 rounded-md" />
      <Bloc className="h-6 w-20 rounded-md" />
    </div>
  </div>
)

/** Skeleton de la grille de 6 CarteCompteur : 2 cols mobile, 3 sm, 6 lg. */
const StatsGridSkeleton = () => (
  <section
    aria-label="Chargement des statistiques globales"
    aria-busy="true"
    className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
  >
    {Array.from({ length: 6 }, (_, i) => (
      <div
        key={i}
        className="relative flex flex-col gap-2 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-soft"
        style={{ animationDelay: `${i * 60}ms` }}
      >
        <Bloc className="h-2.5 w-16" />
        <Bloc className="mt-1 h-7 w-20" delay={i * 60} />
        <Bloc className="mt-1 h-3 w-24 rounded-full" delay={i * 60} />
        {/* Filigrane décoratif (icône en bas-droite) */}
        <span className="pointer-events-none absolute -bottom-3 -right-3 size-16 rounded-full bg-muted opacity-40" />
      </div>
    ))}
  </section>
)

/** Géométrie des 7 tuiles de stats pour CarteSourceRunMobile. */
const TUILES_SOURCE_RUN = [
  { dt: "w-9", dd: "w-8" }, // Durée
  { dt: "w-8", dd: "w-7" }, // HTTP
  { dt: "w-10", dd: "w-8" }, // Brutes
  { dt: "w-12", dd: "w-8" }, // Insérées
  { dt: "w-12", dd: "w-8" }, // M. à jour
  { dt: "w-12", dd: "w-9" }, // Doublons
  { dt: "w-10", dd: "w-6" }, // Erreurs
]

/** Skeleton du tableau des sous-runs — cartes mobile + tableau desktop. */
const SourceRunsTableSkeleton = ({ nbLignes = 4 }) => {
  const lignes = Array.from({ length: nbLignes }, (_, i) => i)
  return (
    <div role="status" aria-label="Chargement des sous-runs par source">
      {/* ── Mobile : cartes ──────────────────────────────────────── */}
      <ul className="flex flex-col gap-3 px-4 pb-2 md:hidden" aria-hidden="true">
        {lignes.map((i) => {
          const delay = i * 80
          return (
            <li key={i}>
              <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <Bloc className="h-3.5 w-24" delay={delay} />
                  <Bloc className="h-5 w-20 shrink-0 rounded-full" delay={delay} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {TUILES_SOURCE_RUN.map(({ dt, dd }, k) => (
                    <div key={k} className="rounded-lg bg-muted/40 px-2 py-1.5">
                      <Bloc className={cn("h-2", dt)} delay={delay} />
                      <Bloc className={cn("mt-1 h-3.5", dd)} delay={delay} />
                    </div>
                  ))}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {/* ── Desktop : tableau ────────────────────────────────────── */}
      <div className="hidden overflow-x-auto scrollbar-thin md:block">
        <Table aria-hidden="true">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead><Bloc className="h-3 w-20" /></TableHead>
              <TableHead><Bloc className="h-3 w-14" /></TableHead>
              <TableHead className="text-right"><Bloc className="ml-auto h-3 w-10" /></TableHead>
              <TableHead className="hidden text-right md:table-cell"><Bloc className="ml-auto h-3 w-8" /></TableHead>
              <TableHead className="text-right"><Bloc className="ml-auto h-3 w-8" /></TableHead>
              <TableHead className="text-right"><Bloc className="ml-auto h-3 w-9" /></TableHead>
              <TableHead className="hidden text-right md:table-cell"><Bloc className="ml-auto h-3 w-8" /></TableHead>
              <TableHead className="hidden text-right md:table-cell"><Bloc className="ml-auto h-3 w-10" /></TableHead>
              <TableHead className="hidden text-right lg:table-cell"><Bloc className="ml-auto h-3 w-8" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((i) => {
              const delay = i * 80
              return (
                <TableRow key={i} className="hover:bg-transparent">
                  <TableCell><Bloc className="h-3.5 w-24" delay={delay} /></TableCell>
                  <TableCell><Bloc className="h-5 w-20 rounded-full" delay={delay} /></TableCell>
                  <TableCell className="text-right"><Bloc className="ml-auto h-3 w-10" delay={delay} /></TableCell>
                  <TableCell className="hidden text-right md:table-cell"><Bloc className="ml-auto h-3 w-6" delay={delay} /></TableCell>
                  <TableCell className="text-right"><Bloc className="ml-auto h-3 w-8" delay={delay} /></TableCell>
                  <TableCell className="text-right"><Bloc className="ml-auto h-3 w-8" delay={delay} /></TableCell>
                  <TableCell className="hidden text-right md:table-cell"><Bloc className="ml-auto h-3 w-8" delay={delay} /></TableCell>
                  <TableCell className="hidden text-right md:table-cell"><Bloc className="ml-auto h-3 w-9" delay={delay} /></TableCell>
                  <TableCell className="hidden text-right lg:table-cell"><Bloc className="ml-auto h-3 w-6" delay={delay} /></TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/** Géométrie des tuiles pour CarteLogMobile. */
const TUILES_LOG = [
  { dt: "w-8", dd: "w-16" }, // Heure
  { dt: "w-10", dd: "w-14" }, // Action
  { dt: "w-10", dd: "w-20" }, // Offre ID
  { dt: "w-14", dd: "w-24" }, // URL source
]

/** Skeleton du journal d'ingestion — cartes mobile + tableau desktop + filtre. */
const LogsTableSkeleton = ({ nbLignes = 8 }) => {
  const lignes = Array.from({ length: nbLignes }, (_, i) => i)
  return (
    <div role="status" aria-label="Chargement du journal d'ingestion">
      {/* Barre de filtre skeleton */}
      <div className="flex items-center justify-end px-4 pb-2" aria-hidden="true">
        <Skeleton className="h-8 w-40" />
      </div>

      {/* ── Mobile : cartes ──────────────────────────────────────── */}
      <ul className="flex flex-col gap-2 px-4 pb-2 md:hidden" aria-hidden="true">
        {lignes.map((i) => {
          const delay = i * 60
          return (
            <li key={i}>
              <div className="rounded-lg border border-border bg-card p-3 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <Bloc className="h-2.5 w-20" delay={delay} />
                  <Bloc className="h-5 w-24 shrink-0 rounded-full" delay={delay} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {TUILES_LOG.map(({ dt, dd }, k) => (
                    <div key={k} className="rounded-md bg-muted/40 px-2 py-1.5">
                      <Bloc className={cn("h-2", dt)} delay={delay} />
                      <Bloc className={cn("mt-1 h-3", dd)} delay={delay} />
                    </div>
                  ))}
                </div>
                <Bloc className="mt-2 h-2.5 w-full" delay={delay} />
              </div>
            </li>
          )
        })}
      </ul>

      {/* ── Desktop : tableau ────────────────────────────────────── */}
      <div className="hidden overflow-x-auto scrollbar-thin md:block">
        <Table aria-hidden="true">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead><Bloc className="h-3 w-16" /></TableHead>
              <TableHead><Bloc className="h-3 w-20" /></TableHead>
              <TableHead><Bloc className="h-3 w-16" /></TableHead>
              <TableHead className="hidden md:table-cell"><Bloc className="h-3 w-20" /></TableHead>
              <TableHead><Bloc className="h-3 w-28" /></TableHead>
              <TableHead className="hidden lg:table-cell"><Bloc className="h-3 w-24" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((i) => {
              const delay = i * 60
              return (
                <TableRow key={i} className="hover:bg-transparent">
                  <TableCell><Bloc className="h-3 w-20" delay={delay} /></TableCell>
                  <TableCell><Bloc className="h-5 w-24 rounded-full" delay={delay} /></TableCell>
                  <TableCell><Bloc className="h-3 w-16" delay={delay} /></TableCell>
                  <TableCell className="hidden md:table-cell"><Bloc className="h-3 w-20 font-mono" delay={delay} /></TableCell>
                  <TableCell><Bloc className="h-3 w-40 max-w-56" delay={delay} /></TableCell>
                  <TableCell className="hidden lg:table-cell"><Bloc className="h-3 w-32 max-w-52" delay={delay} /></TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pied : pagination skeleton */}
      <div className="flex items-center justify-between px-4 py-3" aria-hidden="true">
        <Skeleton className="h-3 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   CARTES MOBILE pour les deux tableaux
   ───────────────────────────────────────────────────────────────────── */

/** Carte mobile d'un sous-run (miroir de la ligne du tableau desktop). */
const CarteSourceRunMobile = ({ sr, sourceLabel }) => {
  const srActif = statutRunActif(sr.status)
  const stats = [
    { label: "Durée", valeur: dureeLisible(sr.duration_ms, sr.started_at, sr.finished_at) ?? (srActif ? "…" : "—") },
    { label: "HTTP", valeur: sr.http_status ?? "—" },
    { label: "Brutes", valeur: formatNombre(sr.raw_count) },
    { label: "Insérées", valeur: formatNombre(sr.inserted_count) },
    { label: "M. à jour", valeur: formatNombre(sr.updated_count) },
    { label: "Doublons", valeur: formatNombre(sr.duplicate_count) },
    {
      label: "Erreurs",
      valeur: formatNombre(sr.error_count),
      enErreur: (sr.error_count ?? 0) > 0,
    },
  ]

  return (
    <article
      aria-label={`Sous-run ${sourceLabel}`}
      className="rounded-xl border border-border bg-card p-4 shadow-soft"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate font-medium leading-tight text-primary">{sourceLabel}</p>
        <Badge variant={VARIANTE_STATUT_RUN[sr.status] ?? "outline"}>
          {LIBELLE_STATUT_RUN[sr.status] ?? sr.status}
          {srActif ? "…" : ""}
        </Badge>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {stats.map(({ label, valeur, enErreur }) => (
          <div key={label} className="rounded-lg bg-muted/40 px-2 py-1.5">
            <dt className="truncate text-[10px] text-muted-foreground">{label}</dt>
            <dd
              className={cn(
                "truncate text-sm font-medium tabular-nums",
                enErreur && "font-semibold text-destructive"
              )}
            >
              {valeur}
            </dd>
          </div>
        ))}
      </dl>

      {sr.error_message && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-1.5 rounded-lg border border-destructive/20 bg-destructive/5 px-2 py-1.5 text-xs text-destructive"
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 wrap-break-word">{sr.error_message}</span>
        </p>
      )}
    </article>
  )
}

/** Carte mobile d'un événement du journal (miroir de la ligne du tableau desktop). */
const CarteLogMobile = ({ log }) => {
  const [libelleNiveau, variante] = LIBELLE_NIVEAU[log.niveau] ?? [log.niveau, "outline"]

  return (
    <article
      aria-label={`Événement du ${dateHeure(log.created_at)}`}
      className="rounded-lg border border-border bg-card p-3 shadow-soft"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
          {dateHeure(log.created_at)}
        </p>
        <Badge variant={variante}>{libelleNiveau}</Badge>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-md bg-muted/40 px-2 py-1.5">
          <dt className="truncate text-[10px] text-muted-foreground">Action</dt>
          <dd className="truncate text-sm font-medium">{LIBELLE_ACTION[log.action] ?? log.action}</dd>
        </div>
        <div className="rounded-md bg-muted/40 px-2 py-1.5">
          <dt className="truncate text-[10px] text-muted-foreground">Offre</dt>
          <dd className="truncate text-sm font-medium tabular-nums">
            {log.offer_id ? (
              <Link
                to={`/admin/offres/${log.offer_id}`}
                className="font-mono text-[11px] text-primary underline-offset-4 hover:underline"
                title={log.offer_id}
              >
                {log.offer_id.slice(0, 8)}…
              </Link>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>

      {log.raw_url && (
        <a
          href={log.raw_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block truncate rounded-md bg-muted/40 px-2 py-1.5 text-xs text-primary underline-offset-4 hover:underline"
          title={log.raw_url}
        >
          {log.raw_url}
        </a>
      )}

      {log.message && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{log.message}</p>
      )}
    </article>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   COMPOSANT PRINCIPAL
   ───────────────────────────────────────────────────────────────────── */

const DetailRun = () => {
  const { id: runId } = useParams()
  const [niveauFiltre, setNiveauFiltre] = useState("")
  const [pageJournal, setPageJournal] = useState(1)
  const [notesOuvertes, setNotesOuvertes] = useState(false)
  /* Tri INITIALISÉ : « Heure » descendante d'office — le chevron actif
  est visible dès le premier rendu. */
  const [triJournal, setTriJournal] = useState({ cle: "created_at", direction: "desc" })

  const mouvementReduit = useReducedMotion()

  const { data: run, isLoading, isError, error, refetch } = useAdminRunDetailQuery(runId)
  const runActif = statutRunActif(run?.status)

  const paramsJournal = useMemo(
    () => ({
      level: niveauFiltre || undefined,
      limit: TAILLE_PAGE_JOURNAL,
      offset: (pageJournal - 1) * TAILLE_PAGE_JOURNAL,
    }),
    [niveauFiltre, pageJournal]
  )
  const { data: logs, isLoading: logsChargement } = useAdminRunLogsQuery(runId, { runActif, params: paramsJournal })

  const notesMutation = useModifierNotesRun()

  const { data: referentiels } = useReferentialsQuery()
  const sourcesParId = useMemo(() => {
    const map = new Map()
    for (const s of referentiels?.sources ?? []) map.set(s.id, s.label ?? s.code)
    return map
  }, [referentiels])

  const changerNiveau = (valeur) => {
    setNiveauFiltre(valeur)
    setPageJournal(1)
  }

  /* Cycle 3 états : direction initiale → inverse → sans tri. */
  const basculerTriJournal = (colonne) => {
    setTriJournal((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  /* Tri client sur la page courante : les 20 lignes chargées sont triées
     en mémoire — aucun appel réseau au changement de colonne / direction. */
  const logsAffiches = useMemo(() => {
    const base = logs ?? []
    if (!triJournal) return base
    const colonne = COLONNES_JOURNAL.find((c) => c.cle === triJournal.cle)
    if (!colonne) return base
    const copie = [...base].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return triJournal.direction === "asc" ? copie : copie.reverse()
  }, [logs, triJournal])

  const refJournal = useRef(null)
  const changerPageJournal = (nouvellePage) => {
    setPageJournal(nouvellePage)
    refJournal.current?.scrollIntoView({
      behavior: mouvementReduit ? "auto" : "smooth",
      block: "start",
    })
  }

  const pageSuivantePossible = logs?.length === TAILLE_PAGE_JOURNAL

  const duree = run?.started_at && run?.finished_at
    ? new Date(run.finished_at) - new Date(run.started_at)
    : 0

  const STATS = [
    { label: "Offres brutes", valeur: run?.total_raw ?? 0, icone: FileText },
    { label: "Insérées", valeur: run?.total_inserted ?? 0, icone: FilePlus },
    { label: "Mises à jour", valeur: run?.total_updated ?? 0, icone: FileEdit },
    { label: "Doublons", valeur: run?.total_duplicates ?? 0, icone: Copy, ton: (run?.total_duplicates ?? 0) > 0 ? "warning" : "normal" },
    { label: "Erreurs", valeur: run?.total_errors ?? 0, icone: AlertCircle, ton: (run?.total_errors ?? 0) > 0 ? "critical" : "normal" },
    { label: "Durée", valeur: sufixDuree(duree)[0] ?? 0, icone: Timer, suff: sufixDuree(duree)[1], ton: duree > 60000 ? "warning" : "normal" },
  ]

  /* Clés d'état pour les transitions. */
  const etatRun = isError ? "erreur" : isLoading ? "chargement" : !run ? "vide" : "donnees"
  const etatSourceRuns = isLoading ? "chargement" : !run?.source_runs?.length ? "vide" : "donnees"
  const etatLogs = logsChargement
    ? "chargement"
    : !logs?.length
      ? niveauFiltre ? "aucun-resultat" : "vide"
      : "donnees"

  /* ─── Erreur / 404 : run introuvable ─── */
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
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      <motion.div variants={VARIANTS_SECTION}>
        <LienRetour />
      </motion.div>

      {/* ─── Section 1 : En-tête (HeroAdmin) ─────────────────────── */}
      <motion.div variants={VARIANTS_SECTION}>
        <TransitionEtat etat={etatRun}>
          {isLoading || !run ? (
            <HeroAdminSkeleton />
          ) : (
            <HeroAdmin
              title={`Run du ${dateHeure(run.started_at ?? run.created_at) ?? run.run_date}`}
              description={`Déclenché par ${run.triggered_by}`}
              badges={
                <StatusChip
                  tone={TONE_STATUT_RUN[run.status] ?? "navy"}
                  ping={runActif}
                  tooltip={`Statut : ${LIBELLE_STATUT_RUN[run.status] ?? run.status}`}
                >
                  {LIBELLE_STATUT_RUN[run.status] ?? run.status}
                  {runActif ? "…" : ""}
                </StatusChip>
              }
            >
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {run.notes ? (
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs italic text-muted-foreground">
                    « {run.notes} »
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">Aucune annotation.</span>
                )}
                <BtnAction
                  size="lg"
                  variant="primary"
                  onClick={() => setNotesOuvertes(true)}
                  className="h-6 text-[11px]"
                >
                  <Pencil aria-hidden className="size-4 transition-transform duration-300" />
                  {run.notes ? "Modifier" : "Annoter"}
                </BtnAction>
              </div>
            </HeroAdmin>
          )}
        </TransitionEtat>
      </motion.div>

      {/* ─── Section 2 : Statistiques globales (6 cartes) ────────── */}
      <motion.div variants={VARIANTS_SECTION}>
        <TransitionEtat etat={etatRun}>
          {isLoading || !run ? (
            <StatsGridSkeleton />
          ) : (
            <section aria-label="Statistiques globales du run" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {STATS.map(({ label, valeur, ton, icone, suff }, i) => (
                <CarteCompteur
                  key={i}
                  label={label}
                  valeur={valeur}
                  icone={icone}
                  suffixe={suff}
                  tone={ton}
                />
              ))}
            </section>
          )}
        </TransitionEtat>
      </motion.div>

      {/* ─── Section 3 : Sous-runs par source ───────────────────── */}
      <motion.div variants={VARIANTS_SECTION}>
        <SectionCardAdmin
          title="Sous-runs par source"
          description="Statut, durée, code HTTP et volumes détaillés par source scrapée."
          icon={Globe}
          contentClassName="p-0 sm:p-0"
        >
          <TransitionEtat etat={etatSourceRuns}>
            {etatSourceRuns === "chargement" ? (
              <SourceRunsTableSkeleton nbLignes={4} />
            ) : etatSourceRuns === "vide" ? (
              <div className="p-4">
                <SectionVide message="Aucun sous-run pour ce run." />
              </div>
            ) : (
              <>
                {/* ── Mobile : cartes ────────────────────────────── */}
                <ul className="flex flex-col gap-3 px-4 pb-2 md:hidden">
                  {run.source_runs.map((sr) => (
                    <li key={sr.id}>
                      <CarteSourceRunMobile
                        sr={sr}
                        sourceLabel={sourcesParId.get(sr.source_id) ?? "Source inconnue"}
                      />
                    </li>
                  ))}
                </ul>

                {/* ── Desktop : tableau ──────────────────────────── */}
                <div className="hidden overflow-x-auto scrollbar-thin md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
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
                          <TableRow key={sr.id} className="transition-colors hover:bg-muted/50">
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
                            <TableCell className="text-right tabular-nums">{formatNombre(sr.raw_count)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatNombre(sr.inserted_count)}</TableCell>
                            <TableCell className="hidden text-right tabular-nums md:table-cell">{formatNombre(sr.updated_count)}</TableCell>
                            <TableCell className="hidden text-right tabular-nums md:table-cell">{formatNombre(sr.duplicate_count)}</TableCell>
                            <TableCell className="hidden text-right tabular-nums lg:table-cell">
                              <span className={(sr.error_count ?? 0) > 0 ? "font-semibold text-destructive" : undefined}>
                                {formatNombre(sr.error_count)}
                              </span>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Bandeau d'erreur éventuel (mobile + desktop) */}
                {run.source_runs.some((sr) => sr.error_message) && (
                  <div className="flex flex-col gap-2 border-t border-border p-4" role="alert">
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
              </>
            )}
          </TransitionEtat>
        </SectionCardAdmin>
      </motion.div>

      {/* ─── Section 4 : Journal d'ingestion ─────────────────────── */}
      <motion.div variants={VARIANTS_SECTION}>
        <div ref={refJournal} className="scroll-mt-20">
          <SectionCardAdmin
            title="Journal d'ingestion"
            description="Une ligne par offre traitée — journal spécifique au scraping. 20 lignes par page, filtrées côté serveur."
            icon={FileClock}
            contentClassName="p-0 sm:p-0"
            action={
              <Select value={niveauFiltre} onValueChange={changerNiveau}>
                <SelectTrigger className="h-8 w-40 text-xs" aria-label="Filtrer le journal par niveau">
                  <SelectValue placeholder="Tous les niveaux" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous</SelectItem>
                  {Object.entries(LIBELLE_NIVEAU).map(([valeur, [libelle]]) => (
                    <SelectItem key={valeur} value={valeur}>{libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${niveauFiltre}-${pageJournal}-${triJournal?.cle ?? "aucun"}-${triJournal?.direction ?? ""}-${logsChargement ? "chargement" : "donnees"}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <TransitionEtat etat={`${niveauFiltre}-${pageJournal}-${etatLogs}`}>
                  {etatLogs === "chargement" ? (
                    <LogsTableSkeleton nbLignes={8} />
                  ) : etatLogs === "vide" ? (
                    <div className="p-4">
                      <SectionVide message="Aucun événement pour ce run." />
                    </div>
                  ) : etatLogs === "aucun-resultat" ? (
                    <div className="p-4">
                      <SectionAucunResultat
                        message="Aucun événement à ce niveau."
                        onReset={() => changerNiveau("")}
                      />
                    </div>
                  ) : (
                    <>
                      {/* ── Mobile : cartes ────────────────────────────── */}
                      <ul className="flex flex-col gap-2 px-4 pb-2 md:hidden">
                        {logsAffiches.map((log) => (
                          <li key={log.id}>
                            <CarteLogMobile log={log} />
                          </li>
                        ))}
                      </ul>

                      {/* ── Desktop : tableau ──────────────────────────── */}
                      <div className="hidden overflow-x-auto scrollbar-thin md:block">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              {/* Heure / Niveau / Action — triables */}
                              {COLONNES_JOURNAL.map((colonne) => (
                                <EnteteTriable
                                  key={colonne.cle}
                                  colonne={colonne}
                                  tri={triJournal}
                                  onTri={basculerTriJournal}
                                />
                              ))}
                              {/* Offre / URL / Message — non triables */}
                              <TableHead className="hidden md:table-cell">Offre</TableHead>
                              <TableHead>URL source</TableHead>
                              <TableHead className="hidden lg:table-cell">Message</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {logsAffiches.map((log) => {
                              const [libelleNiveau, variante] = LIBELLE_NIVEAU[log.niveau] ?? [log.niveau, "outline"]
                              return (
                                <TableRow key={log.id} className="transition-colors hover:bg-muted/50">
                                  <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                                    {dateHeure(log.created_at)}
                                  </TableCell>
                                  <TableCell><Badge variant={variante}>{libelleNiveau}</Badge></TableCell>
                                  <TableCell className="text-sm">{LIBELLE_ACTION[log.action] ?? log.action}</TableCell>
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
                                  <TableCell
                                    className="hidden max-w-52 truncate text-xs text-muted-foreground lg:table-cell"
                                    title={log.message ?? ""}
                                  >
                                    {log.message ?? "—"}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Pagination */}
                      {!logsChargement && (
                        <PaginationListe page={pageJournal} pagePleine={pageSuivantePossible} onPageChange={changerPageJournal} className="p-2 border-t" />
                      )}
                    </>
                  )}
                </TransitionEtat>

              </motion.div>
            </AnimatePresence>
          </SectionCardAdmin>
        </div>
      </motion.div>

      {/* ─── Dialog annotation des notes (audit 4, C.4) ─── */}
      {run && (
        <DialogNotesRun
          ouvert={notesOuvertes}
          onFermer={() => setNotesOuvertes(false)}
          run={run}
          mutation={notesMutation}
        />
      )}
    </motion.div>
  )
}

/* Lien de retour vers /admin/scraping (doc v3 §11). */
const LienRetour = () => (
  <Link
    to="/admin/scraping"
    className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
  >
    <ArrowLeft className="size-3.5" aria-hidden="true" /> Retour au pilotage du scraping
  </Link>
)

export default DetailRun