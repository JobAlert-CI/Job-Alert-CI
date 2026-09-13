This file is a merged representation of a subset of the codebase, containing specifically included files, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of a subset of the repository's contents that is considered the most important context.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Only files matching these patterns are included: src/Pages/Admin/Ia/**/*
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
```
src/
  Pages/
    Admin/
      Ia/
        components/
          EtatsSection.jsx
        sections/
          OngletPilotage.jsx
          OngletStats.jsx
          SectionAlertes.jsx
          SectionCles.jsx
          SectionSuggestions.jsx
        index.jsx
```

# Files

## File: src/Pages/Admin/Ia/components/EtatsSection.jsx
```javascript
import { AlertTriangle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

/* ─────────────────────────────────────────────────────────────────────
   États section de la page IA (pattern LogsPage/Scraping).
   ───────────────────────────────────────────────────────────────────── */

export const SectionErreur = ({ onRetry, message = "Chargement impossible." }) => (
  <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
    <AlertTriangle className="size-8 text-destructive" aria-hidden />
    <div>
      <p className="text-sm font-semibold">{message}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Vérifiez que l'API est joignable, puis réessayez.
      </p>
    </div>
    {onRetry && (
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCcw aria-hidden /> Réessayer
      </Button>
    )}
  </div>
)

export const SectionVide = ({ message }) => (
  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
    <p className="text-sm text-muted-foreground">{message}</p>
  </div>
)

export const SectionAucunResultat = ({ onReset, message }) => (
  <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
    <p className="text-sm text-muted-foreground">{message}</p>
    {onReset && (
      <Button variant="ghost" size="sm" onClick={onReset}>
        <RotateCcw aria-hidden /> Réinitialiser les filtres
      </Button>
    )}
  </div>
)
```

## File: src/Pages/Admin/Ia/sections/OngletPilotage.jsx
```javascript
import { useMemo, useRef, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { CloudDownload, History, Hourglass, ListTodo, PlayCircle } from "lucide-react"
import {
  libelleStatutJob, libelleTrigger, useJobsIaQuery, useQueueIaQuery,
} from "@/features/admin-ia.tools"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import PaginationListe from "@/components/admin/PaginationListe"
import { useFiltresIaAdmin } from "@/contexts/FiltresIaAdmin.context"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { SectionErreur, SectionVide } from "../components/EtatsSection"


const VARIANTE_STATUT = {
  pending: "secondary",
  running: "outline",
  completed: "outline",
  partial_failure: "secondary",
  failed: "destructive",
}

const formatNombre = (v) => (v ?? 0).toLocaleString("fr-FR")

const dateHeure = (iso) => {
  if (!iso) return "—"
  const d = new Date(iso)
  return (
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) +
    " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  )
}

/** Durée calculée côté front (started→finished), badge « en cours » sinon (F6). */
const dureeJob = (job) => {
  if (!job.started_at) return "—"
  if (!job.finished_at) return <Badge variant="outline">En cours</Badge>
  const secondes = Math.round((new Date(job.finished_at) - new Date(job.started_at)) / 1000)
  if (secondes < 60) return `${secondes} s`
  return `${Math.floor(secondes / 60)} min ${secondes % 60} s`
}

/** Valeur numérique de la durée (pour le tri) ; null = en cours, trié en fin. */
const dureeMsValeur = (job) => {
  if (!job.started_at || !job.finished_at) return null
  return new Date(job.finished_at) - new Date(job.started_at)
}

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

/* Rang de tri des statuts : ordre du lifecycle (pending → failed). */
const RANG_STATUT_JOB = { pending: 1, running: 2, completed: 3, partial_failure: 4, failed: 5 }

/* Colonnes triables — « Erreur » (message long tronqué) est volontairement
   exclue. Tri CLIENT sur la page courante uniquement (pagination serveur). */
const COLONNES = [
  { cle: "created", libelle: "Créé", directionInitiale: "desc", triValeur: (j) => j.created_at },
  { cle: "declencheur", libelle: "Déclencheur", directionInitiale: "asc", triValeur: (j) => libelleTrigger(j.trigger_type) },
  { cle: "statut", libelle: "Statut", directionInitiale: "asc", triValeur: (j) => RANG_STATUT_JOB[j.status] ?? 0 },
  { cle: "offres", libelle: "Offres", directionInitiale: "desc", triValeur: (j) => j.offers_total ?? 0 },
  { cle: "activees", libelle: "Activées", directionInitiale: "desc", triValeur: (j) => j.offers_activated ?? 0 },
  { cle: "rejetees", libelle: "Rejetées", directionInitiale: "desc", triValeur: (j) => j.offers_rejected ?? 0 },
  { cle: "revue", libelle: "Revue", directionInitiale: "desc", triValeur: (j) => j.offers_pending_review ?? 0 },
  { cle: "retraiter", libelle: "À retraiter", directionInitiale: "desc", triValeur: (j) => j.offers_reprocess_required ?? 0 },
  { cle: "duree", libelle: "Durée", directionInitiale: "desc", triValeur: dureeMsValeur },
]

const CarteQueue = () => {
  const { data: queue } = useQueueIaQuery()
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <CarteCompteur label="En attente" valeur={queue?.pending ?? 0} icone={Hourglass} />
      <CarteCompteur label="En cours" valeur={queue?.running ?? 0} icone={PlayCircle} />
      <CarteCompteur label="Jobs provider en attente" valeur={queue?.pending_ai_jobs ?? 0} icone={CloudDownload} />
      <CarteCompteur
        label="Dernier sweep"
        texte={dateHeure(queue?.last_sweep_at)}
        icone={History}
        description={
          <Badge variant={queue?.last_sweep_status === "failed" ? "destructive" : "secondary"} className="mt-1">
            {libelleStatutJob(queue?.last_sweep_status)}
          </Badge>
        }
      />
    </div>
  )
}

const OngletPilotage = () => {
  const mouvementReduit = useReducedMotion()
  const { pageJobs, paramsJobs, setPageJobs } = useFiltresIaAdmin()
  const { data: jobs, isLoading, isError, refetch } = useJobsIaQuery(paramsJobs)

  /* Tri INITIALISÉ : « Créé » descendant (le plus récent d'abord). */
  const [tri, setTri] = useState({ cle: "created", direction: "desc" })
  /* Ancrage du retour en haut du tableau au changement de page. */
  const refTableau = useRef(null)

  const pagePleine = Array.isArray(jobs) && jobs.length === paramsJobs.limit

  const jobsAffiches = useMemo(() => {
    const base = jobs ?? []
    if (!tri) return base
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base
    const copie = [...base].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [jobs, tri])

  /* Cycle de tri : sens initial → sens inverse → aucun (ordre serveur). */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  /* Changement de page → retour en haut du tableau. */
  const changerPage = (nouvellePage) => {
    setPageJobs(nouvellePage)
    refTableau.current?.scrollIntoView({
      behavior: mouvementReduit ? "auto" : "smooth",
      block: "start",
    })
  }

  /* key = fondu léger du corps à chaque changement de tri. */
  const cleCorps = `${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  return (
    <div className="flex flex-col gap-4">
      <CarteQueue />

      <div ref={refTableau} className="scroll-mt-20">
        <SectionCardAdmin
          title="Historique des jobs"
          description="Cycles provider : sweep automatiques toutes les 5 minutes et lancements manuels. Tri par colonne."
          icon={ListTodo}
          contentClassName="p-0 sm:p-0"
        >
          {/* Fondu enchaîné au changement de page / état. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${pageJobs}-${isLoading ? "chargement" : "donnees"}-${isError ? "erreur" : "ok"}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {isError ? (
                <div className="p-4">
                  <SectionErreur onRetry={refetch} message="Impossible de charger l'historique des jobs." />
                </div>
              ) : isLoading ? (
                <div className="flex flex-col gap-2 p-4" aria-busy="true">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
                </div>
              ) : !jobs?.length ? (
                <div className="p-4">
                  <SectionVide message="Aucun job de normalisation enregistré pour l'instant." />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto scrollbar-thin">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <EnteteTriable colonne={COLONNES.find((c) => c.cle === "created")} tri={tri} onTri={basculerTri} />
                          <EnteteTriable colonne={COLONNES.find((c) => c.cle === "declencheur")} tri={tri} onTri={basculerTri} />
                          <EnteteTriable colonne={COLONNES.find((c) => c.cle === "statut")} tri={tri} onTri={basculerTri} />
                          <EnteteTriable colonne={COLONNES.find((c) => c.cle === "offres")} tri={tri} onTri={basculerTri} aligneDroite />
                          <EnteteTriable colonne={COLONNES.find((c) => c.cle === "activees")} tri={tri} onTri={basculerTri} aligneDroite />
                          <EnteteTriable
                            colonne={COLONNES.find((c) => c.cle === "rejetees")}
                            tri={tri} onTri={basculerTri} aligneDroite
                            className="hidden md:table-cell"
                          />
                          <EnteteTriable
                            colonne={COLONNES.find((c) => c.cle === "revue")}
                            tri={tri} onTri={basculerTri} aligneDroite
                            className="hidden md:table-cell"
                          />
                          <EnteteTriable
                            colonne={COLONNES.find((c) => c.cle === "retraiter")}
                            tri={tri} onTri={basculerTri} aligneDroite
                            className="hidden lg:table-cell"
                          />
                          <EnteteTriable colonne={COLONNES.find((c) => c.cle === "duree")} tri={tri} onTri={basculerTri} />
                          <TableHead className="max-w-52">Erreur</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                        {jobsAffiches.map((job) => (
                          <TableRow key={job.id} className="transition-colors hover:bg-muted/50">
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {dateHeure(job.created_at)}
                            </TableCell>
                            <TableCell className="text-xs">{libelleTrigger(job.trigger_type)}</TableCell>
                            <TableCell>
                              <Badge variant={VARIANTE_STATUT[job.status] ?? "outline"}>
                                {libelleStatutJob(job.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatNombre(job.offers_total)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatNombre(job.offers_activated)}</TableCell>
                            <TableCell className="hidden text-right tabular-nums md:table-cell">{formatNombre(job.offers_rejected)}</TableCell>
                            <TableCell className="hidden text-right tabular-nums md:table-cell">{formatNombre(job.offers_pending_review)}</TableCell>
                            <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatNombre(job.offers_reprocess_required)}</TableCell>
                            <TableCell className="whitespace-nowrap text-xs">{dureeJob(job)}</TableCell>
                            <TableCell className="max-w-52">
                              {job.error_message ? (
                                <span className="block truncate text-[11px] text-destructive" title={job.error_message}>
                                  {job.error_message}
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="border-t border-border px-4 py-3">
                    <PaginationListe page={pageJobs} pagePleine={pagePleine} onPageChange={changerPage} />
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </SectionCardAdmin>
      </div>
    </div>
  )
}

export default OngletPilotage
```

## File: src/Pages/Admin/Ia/sections/OngletStats.jsx
```javascript
import { useMemo } from "react"
import { motion, useReducedMotion } from "framer-motion"
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { cn } from "cn"
import {
  STATUTS_JOB, TRIGGERS_JOB, SEVERITES, useStatsIaQuery,
} from "@/features/admin-ia.tools"
import { Skeleton } from "@/components/ui/skeleton"
import CarteCompteur from "@/components/admin/CarteCompteur"
import { SectionErreur, SectionVide } from "../components/EtatsSection"
import { BarChart3, BellRing, Gauge, KeyRound, Layers, Lightbulb, TrendingUp } from "lucide-react"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"


const COULEURS_VOLUMES = {
  activees: "#0F2D4D",
  rejetees: "#ef4444",
  revue: "#F5A623",
  retraiter: "#94a3b8",
}

const COULEURS_STATUT_JOB = {
  completed: "#0F2D4D",
  partial_failure: "#f59e0b",
  failed: "#ef4444",
  running: "#F5A623",
  pending: "#94a3b8",
}

const COULEURS_SEVERITE = {
  info: "#0F2D4D",
  warning: "#F5A623",
  error: "#ef4444",
  critical: "#7f1d1d",
}

const VARIANTS_CONTENEUR = {
  cache: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.03 } },
}

const VARIANTS_BLOC = {
  cache: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
}

const formatNombre = (v) => (v ?? 0).toLocaleString("fr-FR")

/* Label d'axe ISO → date courte fr-FR. */
const formaterLabel = (label) => {
  if (typeof label !== "string") return label
  if (/^\d{4}-\d{2}-\d{2}/.test(label)) {
    const d = new Date(label)
    if (!Number.isNaN(d.getTime()))
      return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
  }
  return label
}

/* Tooltip unique et stylé pour les 5 charts. */
const TooltipChart = ({ active, payload, label, suffixe = "" }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      {label != null && label !== "" && <p className="font-semibold">{formaterLabel(label)}</p>}
      {payload.map((p) => (
        <p key={p.dataKey ?? p.name} className="text-muted-foreground">
          {p.name} : {formatNombre(p.value)}{suffixe}
        </p>
      ))}
    </div>
  )
}

const CadreChart = ({ titre, chargement, vide, videMessage, children, minHeight = 220, className = "" }) => (
  <div className={cn("flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-soft", className)}>
    <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">{titre}</h3>
    {chargement ? (
      <Skeleton className="w-full rounded-lg" style={{ height: minHeight }} />
    ) : vide ? (
      <div className="py-4">
        <SectionVide message={videMessage} />
      </div>
    ) : (
      <div style={{ height: minHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    )}
  </div>
)

const OngletStats = () => {
  const mouvementReduit = useReducedMotion()
  const { data: stats, isLoading, isError, refetch } = useStatsIaQuery(30)

  // C2 : donut statuts — ordre du vocabulaire, zéros filtrés.
  const parStatut = useMemo(
    () =>
      Object.entries(STATUTS_JOB)
        .map(([valeur, conf]) => ({
          statut: conf.libelle,
          total: stats?.jobs_par_statut?.[valeur] ?? 0,
          couleur: COULEURS_STATUT_JOB[valeur],
        }))
        .filter((e) => e.total > 0),
    [stats]
  )

  // C4 : barres horizontales par trigger.
  const parTrigger = useMemo(
    () =>
      Object.entries(stats?.jobs_par_trigger ?? {}).map(([valeur, total]) => ({
        trigger: TRIGGERS_JOB[valeur] ?? valeur,
        jobs: total,
      })),
    [stats]
  )

  // C5 : alertes non acquittées par sévérité (ordre du vocabulaire).
  const parSeverite = useMemo(
    () =>
      Object.entries(SEVERITES)
        .map(([valeur, conf]) => ({
          severite: conf.libelle,
          alertes: stats?.alertes_non_acquittees?.[valeur] ?? 0,
          couleur: COULEURS_SEVERITE[valeur],
        }))
        .filter((e) => e.alertes > 0),
    [stats]
  )

  if (isError) {
    return <SectionErreur onRetry={refetch} message="Impossible de charger les statistiques du pipeline." />
  }

  return (
    <motion.div variants={VARIANTS_CONTENEUR} initial="cache" animate="visible" className="flex flex-col gap-4">
      {/* ─── Compteurs IA1-IA6 ─── */}
      <motion.div variants={VARIANTS_BLOC} className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <CarteCompteur label="Backlog brut" valeur={stats?.backlog_brut ?? 0} icone={Layers} />
        <CarteCompteur label="Jobs (30 j)" valeur={stats?.jobs_fenetre ?? 0} icone={TrendingUp} />
        <CarteCompteur label="Taux d'activation" valeur={stats?.taux_activation ?? 0} suffixe="%" icone={Gauge} />
        <CarteCompteur label="Suggestions en attente" valeur={stats?.suggestions_par_statut?.pending ?? 0} icone={Lightbulb} />
        <CarteCompteur
          label="Alertes non acquittées"
          valeur={Object.values(stats?.alertes_non_acquittees ?? {}).reduce((a, b) => a + b, 0)}
          icone={BellRing}
        />
        <CarteCompteur
          label="Clés actives"
          valeur={stats?.cles_actives ?? 0}
          suffixe={`/ ${formatNombre(stats?.cles_total ?? 0)}`}
          icone={KeyRound}
        />
      </motion.div>

      <SectionCardAdmin
        title="Analyse des jobs IA"
        description="Statistiques sur les jobs traités par IA. Voir la documentation pour comprendre les statuts et les triggers."
        icon={BarChart3}
        contentClassName="flex flex-col gap-6"
      >
        {/* ─── C1 : volumes/jour barres empilées ─── */}
        <motion.div variants={VARIANTS_BLOC}>
          <CadreChart
            titre="Volumes traités par jour (30 jours)"
            chargement={isLoading}
            vide={!stats?.jobs_par_jour?.length}
            videMessage="Aucun job de normalisation sur la fenêtre."
          >
            <BarChart data={stats?.jobs_par_jour ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis
                dataKey="jour"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(j) => new Date(j).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
              />
              <YAxis allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip content={<TooltipChart />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {Object.entries(COULEURS_VOLUMES).map(([cle, couleur]) => (
                <Bar
                  key={cle}
                  dataKey={cle}
                  name={{ activees: "Activées", rejetees: "Rejetées", revue: "En revue", retraiter: "À retraiter" }[cle]}
                  stackId="v"
                  fill={couleur}
                  isAnimationActive={!mouvementReduit}
                  animationDuration={700}
                  animationEasing="ease-out"
                />
              ))}
            </BarChart>
          </CadreChart>
        </motion.div>

        {/* ─── C2 + C3 ─── */}
        <motion.div variants={VARIANTS_BLOC} className="grid gap-4 xl:grid-cols-4">
          <CadreChart
            titre="Statut des jobs (30 jours)"
            chargement={isLoading}
            vide={!parStatut.length}
            videMessage="Aucun job sur la fenêtre."
          >
            <PieChart>
              <Tooltip content={<TooltipChart suffixe=" job(s)" />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Pie
                data={parStatut}
                dataKey="total"
                nameKey="statut"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={2}
                strokeWidth={0}
                isAnimationActive={!mouvementReduit}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {parStatut.map((e) => <Cell key={e.statut} fill={e.couleur} />)}
              </Pie>
            </PieChart>
          </CadreChart>

          <CadreChart
            titre="Durée moyenne des jobs par jour"
            chargement={isLoading}
            vide={!stats?.duree_moyenne_par_jour?.length}
            videMessage="Aucun job terminé avec durée connue."
            className="xl:col-span-3"
          >
            <LineChart data={stats?.duree_moyenne_par_jour ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis
                dataKey="jour"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(j) => new Date(j).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
              />
              <YAxis fontSize={10} tickLine={false} axisLine={false} unit=" s" />
              <Tooltip content={<TooltipChart suffixe=" s" />} />
              <Line
                type="monotone"
                dataKey="secondes"
                name="Durée moyenne"
                stroke="#F5A623"
                strokeWidth={2}
                dot={{ r: 2 }}
                isAnimationActive={!mouvementReduit}
                animationDuration={900}
                animationEasing="ease-out"
              />
            </LineChart>
          </CadreChart>
        </motion.div>

        {/* ─── C4 + C5 : barres horizontales ─── */}
        <motion.div variants={VARIANTS_BLOC} className="grid gap-4 xl:grid-cols-2">
          <CadreChart
            titre="Jobs par déclencheur (30 jours)"
            chargement={isLoading}
            vide={!parTrigger.length}
            videMessage="Aucun job sur la fenêtre."
          >
            <BarChart data={parTrigger} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
              <XAxis type="number" allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="trigger" fontSize={10} tickLine={false} axisLine={false} width={120} />
              <Tooltip content={<TooltipChart />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
              <Bar
                dataKey="jobs"
                name="Jobs"
                radius={[0, 4, 4, 0]}
                isAnimationActive={!mouvementReduit}
                animationDuration={700}
                animationEasing="ease-out"
              >
                {parTrigger.map((e) => <Cell key={e.trigger} fill="#0F2D4D" />)}
              </Bar>
            </BarChart>
          </CadreChart>

          <CadreChart
            titre="Alertes non acquittées par sévérité"
            chargement={isLoading}
            vide={!parSeverite.length}
            videMessage="Aucune alerte en attente."
          >
            <BarChart data={parSeverite} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
              <XAxis type="number" allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="severite" fontSize={10} tickLine={false} axisLine={false} width={120} />
              <Tooltip content={<TooltipChart suffixe=" alerte(s)" />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
              <Bar
                dataKey="alertes"
                name="Alertes"
                radius={[0, 4, 4, 0]}
                isAnimationActive={!mouvementReduit}
                animationDuration={700}
                animationEasing="ease-out"
              >
                {parSeverite.map((e) => <Cell key={e.severite} fill={e.couleur} />)}
              </Bar>
            </BarChart>
          </CadreChart>
        </motion.div>
      </SectionCardAdmin>
    </motion.div>
  )
}

export default OngletStats
```

## File: src/Pages/Admin/Ia/sections/SectionAlertes.jsx
```javascript
import { useMemo, useRef, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { BellRing, CheckCheck, CheckCircle2, Loader2 } from "lucide-react"
import {
  messageErreurIa, SEVERITES, useAcquitterAlerte, useAlertesIaQuery,
} from "@/features/admin-ia.tools"
import { useNotify } from "@/contexts/Notify.context"
import { useFiltresIaAdmin } from "@/contexts/FiltresIaAdmin.context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import PaginationListe from "@/components/admin/PaginationListe"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"
import { SectionErreur, SectionAucunResultat, SectionVide } from "../components/EtatsSection"

const dateHeure = (iso) => {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

/* Tri « français » robuste : nombres, textes, dates ISO ; vides en fin
   (même pattern que RunsRecents). */
const comparerValeurs = (a, b) => {
  const videA = a === null || a === undefined || a === ""
  const videB = b === null || b === undefined || b === ""
  if (videA && videB) return 0
  if (videA) return 1
  if (videB) return -1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" })
}

/* Rang de tri des sévérités — plus grave d'abord en desc ; les
   inconnues tombent à 0 (fin de liste). */
const RANG_SEVERITE = { critical: 3, warning: 2, info: 1 }

/* Sentinelle ISO : les alertes NON acquittées restent en fin de liste
   en desc (une valeur vide remonterait en tête après le reverse). */
const JAMAIS = "0000-01-01T00:00:00"

/* Colonnes triables — « Message » (texte long tronqué) est volontairement
   exclu. Tri CLIENT sur la page courante uniquement : la pagination est
   serveur (offset), l'ordre naturel fait foi entre les pages. */
const COLONNES = [
  { cle: "created", libelle: "Créée", directionInitiale: "desc", triValeur: (a) => a.created_at },
  { cle: "severite", libelle: "Sévérité", directionInitiale: "desc", triValeur: (a) => RANG_SEVERITE[a.severity] ?? 0 },
  { cle: "type", libelle: "Type", directionInitiale: "asc", triValeur: (a) => a.type ?? "" },
  { cle: "acquittee", libelle: "Acquittée", directionInitiale: "desc", triValeur: (a) => a.acknowledged_at ?? JAMAIS },
]

const SectionAlertes = () => {
  const notify = useNotify()
  const mouvementReduit = useReducedMotion()
  const {
    severite, inclureAcquittees, pageAlertes, paramsAlertes,
    setSeverite, setInclureAcquittees, setPageAlertes, reinitialiserAlertes,
  } = useFiltresIaAdmin()
  const { data: alertes, isLoading, isError, refetch } = useAlertesIaQuery(paramsAlertes)
  const acquitter = useAcquitterAlerte()

  /* Tri INITIALISÉ : « Créée » descendante (la plus récente d'abord). */
  const [tri, setTri] = useState({ cle: "created", direction: "desc" })
  /* Ancrage du retour en haut du tableau au changement de page. */
  const refTableau = useRef(null)

  const alertesAffichees = useMemo(() => {
    const base = alertes ?? []
    if (!tri) return base
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base
    const copie = [...base].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [alertes, tri])

  /* Cycle de tri : sens initial → sens inverse → aucun (ordre serveur). */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  /* Changement de page → retour en haut du tableau (scroll doux,
     remplacé par un saut instantané en prefers-reduced-motion). */
  const changerPage = (nouvellePage) => {
    setPageAlertes(nouvellePage)
    refTableau.current?.scrollIntoView({
      behavior: mouvementReduit ? "auto" : "smooth",
      block: "start",
    })
  }

  const pagePleine = Array.isArray(alertes) && alertes.length === paramsAlertes.limit
  const filtresActifs = !!severite || inclureAcquittees
  const accuser = (alerte) => {
    acquitter.mutate(alerte.id, {
      onSuccess: () => notify("Alerte acquittée", "success"),
      onError: (err) => notify(messageErreurIa(err), "error"),
    })
  }

  /* key = fondu léger du corps à chaque changement de tri / filtres. */
  const cleCorps = `${severite}-${inclureAcquittees}-${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  return (
    <div ref={refTableau} className="scroll-mt-20">
      <SectionCardAdmin
        title="Alertes"
        description="Signaux émis par le pipeline (clé indisponible, quota, désactivation auto…). Non acquittées par défaut"
        icon={BellRing}
        contentClassName="p-0 sm:p-0"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* Sentinelle « toutes » : Radix refuse la valeur vide. */}
            <Select value={severite || "toutes"} onValueChange={(v) => setSeverite(v === "toutes" ? "" : v)}>
              <SelectTrigger className="h-8 w-40 text-xs" aria-label="Filtrer par sévérité">
                <SelectValue placeholder="Toutes sévérités" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes sévérités</SelectItem>
                {Object.entries(SEVERITES).map(([valeur, conf]) => (
                  <SelectItem key={valeur} value={valeur}>{conf.libelle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={inclureAcquittees ? "avec" : "sans"} onValueChange={(v) => setInclureAcquittees(v === "avec")}>
              <SelectTrigger className="h-8 w-48 text-xs" aria-label="Inclure les alertes acquittées">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sans">Non acquittées uniquement</SelectItem>
                <SelectItem value="avec">Avec les acquittées</SelectItem>
              </SelectContent>
            </Select>
            {filtresActifs && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={reinitialiserAlertes}>
                Réinitialiser
              </Button>
            )}
          </div>
        }
      >
        {/* Fondu enchaîné au changement de filtres / page. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${pageAlertes}-${severite}-${inclureAcquittees}-${isLoading ? "chargement" : "donnees"}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {isError ? (
              <div className="p-4">
                <SectionErreur onRetry={refetch} message="Impossible de charger les alertes." />
              </div>
            ) : isLoading ? (
              <div className="flex flex-col gap-2 p-4" aria-busy="true">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
              </div>
            ) : !alertes?.length ? (
              <div className="p-4">
                {filtresActifs ? (
                  <SectionAucunResultat onReset={reinitialiserAlertes} message="Aucune alerte ne correspond aux filtres." />
                ) : (
                  <SectionVide message="Aucune alerte IA en attente — le pipeline est serein." />
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto scrollbar-thin">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "created")} tri={tri} onTri={basculerTri} />
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "severite")} tri={tri} onTri={basculerTri} />
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "type")} tri={tri} onTri={basculerTri} />
                        <TableHead className="max-w-72">Message</TableHead>
                        <EnteteTriable
                          colonne={COLONNES.find((c) => c.cle === "acquittee")}
                          tri={tri}
                          onTri={basculerTri}
                          className="hidden lg:table-cell"
                        />
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    {/* key = fondu léger à chaque changement de tri / filtres */}
                    <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                      {alertesAffichees.map((alerte) => {
                        const conf = SEVERITES[alerte.severity] ?? { libelle: alerte.severity, variante: "outline" }
                        const enCours = acquitter.isPending && acquitter.variables === alerte.id
                        return (
                          <TableRow
                            key={alerte.id}
                            className={alerte.acknowledged_at ? "opacity-60 transition-colors hover:bg-muted/50" : "transition-colors hover:bg-muted/50"}
                          >
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {dateHeure(alerte.created_at)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={conf.variante}>{conf.libelle}</Badge>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-[10px] text-muted-foreground">{alerte.type}</span>
                            </TableCell>
                            <TableCell className="max-w-72">
                              <span className="block truncate text-xs" title={alerte.message}>{alerte.message}</span>
                            </TableCell>
                            {/* Indicateur explicite : badge « Traité » + horodatage. */}
                            <TableCell className="hidden lg:table-cell">
                              {alerte.acknowledged_at ? (
                                <span className="flex flex-col gap-1">
                                  <Badge variant="secondary" className="w-fit gap-1 text-emerald-700">
                                    <CheckCircle2 className="size-3" aria-hidden="true" /> Traité
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">{dateHeure(alerte.acknowledged_at)}</span>
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {!alerte.acknowledged_at && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => accuser(alerte)}
                                  disabled={enCours}
                                  aria-label={`Acquitter l'alerte ${alerte.type}`}
                                >
                                  {enCours ? (
                                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                  ) : (
                                    <CheckCheck className="size-3.5" aria-hidden="true" />
                                  )}
                                  {enCours ? "Acquittement…" : "Acquitter"}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="border-t border-border px-4 py-3">
                  <PaginationListe page={pageAlertes} pagePleine={pagePleine} onPageChange={changerPage} />
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </SectionCardAdmin>
    </div>
  )
}

export default SectionAlertes
```

## File: src/Pages/Admin/Ia/sections/SectionCles.jsx
```javascript
import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { KeyRound, Loader2, Plug, Plus, Trash2 } from "lucide-react"
import {
  messageErreurIa, useClesIaQuery, useCreerCleIa, useModifierCleIa,
  useSupprimerCleIa, useTesterCleIa,
} from "@/features/admin-ia.tools"
import { useNotify } from "@/contexts/Notify.context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"
import { SectionErreur, SectionVide } from "../components/EtatsSection"
import DialogCleIA from "@/components/dialog/DialogCleIA"
import BtnAction from "@/components/admin/BtnAction"
import DialogSupprCleIA from "@/components/dialog/DialogSupprCleIA"

const FOURNISSEURS = [
  { valeur: "openai_compatible", libelle: "OpenAI-compatible" },
  { valeur: "openai", libelle: "OpenAI" },
  { valeur: "mistral", libelle: "Mistral" },
  { valeur: "groq", libelle: "Groq" },
  { valeur: "anthropic", libelle: "Anthropic" },
  { valeur: "google_gemini", libelle: "Google Gemini" },
  { valeur: "ollama", libelle: "Ollama (local)" },
  { valeur: "mock", libelle: "Mock (démo/tests)" },
]

const libelleFournisseur = (v) => FOURNISSEURS.find((f) => f.valeur === v)?.libelle ?? v

const dateHeure = (iso) => {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

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

/* Sentinelle ISO : une clé JAMAIS utilisée reste en fin de liste en desc. */
const JAMAIS = "0000-01-01T00:00:00"

/* Colonnes triables — « Quotas » (affichage multi-valeurs) et
   « Connexion » (résultat de test interactif) sont exclus. */
const COLONNES = [
  { cle: "nom", libelle: "Nom", directionInitiale: "asc", triValeur: (c) => (c.name ?? "").toLowerCase() },
  { cle: "fournisseur", libelle: "Fournisseur", directionInitiale: "asc", triValeur: (c) => libelleFournisseur(c.provider_type) },
  { cle: "priorite", libelle: "Priorité", directionInitiale: "asc", triValeur: (c) => c.priority ?? 0 },
  { cle: "statut", libelle: "Statut", directionInitiale: "desc", triValeur: (c) => (c.is_active ? 1 : 0) },
  { cle: "activite", libelle: "Dernière activité", directionInitiale: "desc", triValeur: (c) => c.last_used_at ?? JAMAIS },
]

/* ─── Section ─── */
const SectionCles = () => {
  const notify = useNotify()
  const { data: cles, isLoading, isError, refetch } = useClesIaQuery()
  const creer = useCreerCleIa()
  const modifier = useModifierCleIa()
  const supprimer = useSupprimerCleIa()
  const tester = useTesterCleIa()
  const [edition, setEdition] = useState(null)          // null | {} (création) | cle
  const [confirmation, setConfirmation] = useState(null) // cle à supprimer
  // Résultats de test inline : { [cleId]: { ok, model?, message?, enCours } }
  const [tests, setTests] = useState({})
  /* Tri INITIALISÉ : « Priorité » ascendante = ordre serveur (0 en
     premier) — aucun saut visuel au chargement, chevron actif visible. */
  const [tri, setTri] = useState({ cle: "priorite", direction: "asc" })

  const nbActives = (cles ?? []).filter((c) => c.is_active).length

  const clesAffichees = useMemo(() => {
    const base = cles ?? []
    if (!tri) return base
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base
    const copie = [...base].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [cles, tri])

  /* Cycle de tri : sens initial → sens inverse → aucun (ordre serveur). */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  const testerCle = (cle) => {
    setTests((t) => ({ ...t, [cle.id]: { enCours: true } }))
    tester.mutate(cle.id, {
      onSuccess: (resultat) => setTests((t) => ({ ...t, [cle.id]: resultat })),
      onError: (err) => setTests((t) => ({ ...t, [cle.id]: { ok: false, message: messageErreurIa(err) } })),
    })
  }

  const supprimerCle = (cle) => {
    supprimer.mutate(cle.id, {
      onSuccess: () => {
        notify(`Clé « ${cle.name} » supprimée`, "success")
        setConfirmation(null)
      },
      onError: (err) => notify(messageErreurIa(err), "error"),
    })
  }

  /* key = fondu léger du corps à chaque changement de tri. */
  const cleCorps = `${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  return (
    <>
      <SectionCardAdmin
        title="Clés API"
        description={`${cles?.length ?? "…"} clé${(cles?.length ?? 0) > 1 ? "s" : ""} configurée${(cles?.length ?? 0) > 1 ? "s" : ""} — ${nbActives} active${nbActives > 1 ? "s" : ""}. Le pipeline refuse de tourner sans clé active. Tri par colonne.`}
        icon={KeyRound}
        contentClassName="p-0 sm:p-0"
        action={
          <BtnAction variant="outline" size="sm" onClick={() => setEdition({})}>
            <Plus aria-hidden="true" className="size-3.5" /> Nouvelle clé
          </BtnAction>
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={isLoading ? "chargement" : isError ? "erreur" : "donnees"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {isError ? (
              <div className="p-4">
                <SectionErreur onRetry={refetch} message="Impossible de charger les clés." />
              </div>
            ) : isLoading ? (
              <div className="flex flex-col gap-2 p-4" aria-busy="true">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
              </div>
            ) : !cles?.length ? (
              <div className="p-4">
                <SectionVide message="Aucune clé API configurée — le pipeline IA ne peut pas tourner. Créez-en une pour activer la normalisation." />
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "nom")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "fournisseur")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "priorite")} tri={tri} onTri={basculerTri} aligneDroite />
                      <TableHead className="hidden text-right md:table-cell">Quotas</TableHead>
                      <EnteteTriable colonne={COLONNES.find((c) => c.cle === "statut")} tri={tri} onTri={basculerTri} />
                      <EnteteTriable
                        colonne={COLONNES.find((c) => c.cle === "activite")}
                        tri={tri}
                        onTri={basculerTri}
                        className="hidden lg:table-cell"
                      />
                      <TableHead>Connexion</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                    {clesAffichees.map((cle) => {
                      const test = tests[cle.id]
                      const derniereActive = cle.is_active && nbActives <= 1
                      return (
                        <TableRow key={cle.id} className="transition-colors hover:bg-muted/50">
                          <TableCell>
                            <span className="block text-xs font-medium">{cle.name}</span>
                            {cle.api_key_masked && (
                              <span className="block font-mono text-[10px] text-muted-foreground">{cle.api_key_masked}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{libelleFournisseur(cle.provider_type)}</TableCell>
                          <TableCell className="text-right tabular-nums">{cle.priority}</TableCell>
                          <TableCell className="hidden text-[11px] text-muted-foreground md:table-cell">
                            {cle.max_concurrent_requests}// · {cle.timeout_seconds}s · {cle.max_retries}r
                            {cle.rate_limit_per_minute ? ` · ${cle.rate_limit_per_minute}/min` : ""}
                          </TableCell>
                          <TableCell>
                            <Badge variant={cle.is_active ? "secondary" : "outline"}>
                              {cle.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden text-[11px] text-muted-foreground lg:table-cell">
                            <span className="block">util. {dateHeure(cle.last_used_at)}</span>
                            <span className="block">err. {dateHeure(cle.last_error_at)}</span>
                          </TableCell>
                          <TableCell>
                            {test?.enCours ? (
                              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                Test en cours…
                              </span>
                            ) : test ? (
                              <span className={`flex flex-col text-[11px] ${test.ok ? "text-emerald-600" : "text-destructive"}`}>
                                <span>{test.ok ? `OK${test.model ? ` · ${test.model}` : ""}` : "Échec"}</span>
                                {!test.ok && test.message && (
                                  <span className="block max-w-40 truncate text-destructive" title={test.message}>
                                    {test.message}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => testerCle(cle)}
                                aria-label={`Tester la connexion de ${cle.name}`}
                              >
                                <Plug className="size-3.5" aria-hidden="true" /> Tester
                              </Button>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEdition(cle)}
                                aria-label={`Modifier la clé ${cle.name}`}
                                className="text-xs"
                              >
                                Modifier
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={derniereActive}
                                title={derniereActive
                                  ? "Dernière clé active — le serveur refuse sa suppression (400)"
                                  : `Supprimer la clé ${cle.name}`}
                                aria-label={derniereActive
                                  ? "Suppression impossible : dernière clé active"
                                  : `Supprimer la clé ${cle.name}`}
                                onClick={() => setConfirmation(cle)}
                                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="size-3.5" aria-hidden="true" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </SectionCardAdmin>

      {/* Dialog création / édition */}
      {edition && (
        <DialogCleIA
          cle={edition.id ? edition : null}
          mutation={edition.id ? modifier : creer}
          onFermer={() => setEdition(null)}
        />
      )}

      {/* Confirmation suppression */}
      {confirmation && (
        <DialogSupprCleIA
          confirmation={confirmation}
          setConfirmation={setConfirmation}
          supprimerCle={supprimerCle}
          supprimer={supprimer}
        />
      )}
    </>
  )
}

export default SectionCles
```

## File: src/Pages/Admin/Ia/sections/SectionSuggestions.jsx
```javascript
import { useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Check, Lightbulb, X } from "lucide-react"
import {
  messageErreurIa, useRevoirSuggestion, useStatsIaQuery, useSuggestionsIaQuery,
} from "@/features/admin-ia.tools"
import { useNotify } from "@/contexts/Notify.context"
import { useFiltresIaAdmin } from "@/contexts/FiltresIaAdmin.context"
import { useAdminFilieresQuery, adminFilieresKeys } from "@/features/admin-filieres.tools"
import { queryClient } from "@/lib/queryClient"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import PaginationListe from "@/components/admin/PaginationListe"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"
import { SectionErreur, SectionVide } from "../components/EtatsSection"

const ONGLET_SUGGESTIONS = [
  { valeur: "pending", libelle: "En attente" },
  { valeur: "approved", libelle: "Approuvées" },
  { valeur: "rejected", libelle: "Rejetées" },
]

const VARIANTE_SUGGESTION = { pending: "secondary", approved: "outline", rejected: "destructive" }

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

/* Colonnes triables — « Statut » est volontairement exclu (filtre par
   onglets dans l'en-tête de carte) et « Raison IA » aussi (texte long
   tronqué). Tri CLIENT sur la page courante uniquement (pagination
   serveur offset + status_filter). */
const COLONNES = [
  { cle: "created", libelle: "Proposée", directionInitiale: "desc", triValeur: (s) => s.created_at },
  { cle: "label", libelle: "Filière proposée", directionInitiale: "asc", triValeur: (s) => (s.label ?? "").toLowerCase() },
  { cle: "code", libelle: "Code", directionInitiale: "asc", triValeur: (s) => s.code ?? "" },
]

const SectionSuggestions = () => {
  const notify = useNotify()
  const navigate = useNavigate()
  const mouvementReduit = useReducedMotion()
  const { statutSuggestion, pageSuggestions, paramsSuggestions, setStatutSuggestion, setPageSuggestions } =
    useFiltresIaAdmin()
  const params = useMemo(
    () => ({ ...paramsSuggestions, status_filter: statutSuggestion || undefined }),
    [paramsSuggestions, statutSuggestion]
  )
  const { data: suggestions, isLoading, isError, refetch } = useSuggestionsIaQuery(params)
  // Cache filières préchauffé : l'atterrissage post-approbation sur la page
  // Filières trouvera la liste déjà fraîche (fetchQuery l'actualise au pire).
  useAdminFilieresQuery()
  const revoir = useRevoirSuggestion()
  const { refetch: refetchStats } = useStatsIaQuery(30)

  /* Tri INITIALISÉ : « Proposée » descendante (la plus récente d'abord). */
  const [tri, setTri] = useState({ cle: "created", direction: "desc" })
  /* Ancrage du retour en haut du tableau au changement de page. */
  const refTableau = useRef(null)

  const pagePleine = Array.isArray(suggestions) && suggestions.length === paramsSuggestions.limit

  const suggestionsAffichees = useMemo(() => {
    const base = suggestions ?? []
    if (!tri) return base
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base
    const copie = [...base].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [suggestions, tri])

  /* Cycle de tri : sens initial → sens inverse → aucun (ordre serveur). */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  /* Changement de page → retour en haut du tableau. */
  const changerPage = (nouvellePage) => {
    setPageSuggestions(nouvellePage)
    refTableau.current?.scrollIntoView({
      behavior: mouvementReduit ? "auto" : "smooth",
      block: "start",
    })
  }

  const revoirSuggestion = (suggestion, statut) => {
    revoir.mutate(
      { suggestionId: suggestion.id, status: statut },
      {
        onSuccess: () => {
          if (statut === "approved") {
            // La filière vient d'être créée : le cache filières est périmé.
            // On invalide, on RELIT la liste fraîche, puis on atterrit sur
            // l'éditeur de mots-clés de la nouvelle filière (doc v3 §19).
            queryClient
              .invalidateQueries({ queryKey: adminFilieresKeys.root })
              .then(() => queryClient.fetchQuery({
                queryKey: adminFilieresKeys.root,
                queryFn: async () => {
                  const { getFilieres } = await import("@/api/admin/referentials")
                  return getFilieres()
                },
              }))
              .then((filieresFraiches) => {
                const idFiliere = (filieresFraiches ?? []).find((f) => f.code === suggestion.code)?.id
                if (idFiliere) {
                  notify(
                    `Filière « ${suggestion.label} » créée — enrichissez ses mots-clés pour le matching`,
                    "success",
                    6000
                  )
                  navigate(`/admin/filieres?etendue=${idFiliere}`)
                } else {
                  notify(
                    `Filière « ${suggestion.label} » créée — ouvrez la page Filières pour enrichir ses mots-clés`,
                    "success",
                    6000
                  )
                  navigate("/admin/filieres")
                }
              })
              .catch(() => {
                notify("Filière créée — allez dans Filières pour enrichir ses mots-clés", "success")
                navigate("/admin/filieres")
              })
          } else {
            notify("Suggestion rejetée", "success")
          }
          refetchStats()
        },
        onError: (err) => notify(messageErreurIa(err), "error"),
      }
    )
  }

  /* key = fondu léger du corps à chaque changement de tri / filtre. */
  const cleCorps = `${statutSuggestion}-${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  return (
    <div ref={refTableau} className="scroll-mt-20">
      <SectionCardAdmin
        title="Suggestions de filière"
        description="L'IA propose des filières quand aucune ne correspond à une offre. Approuver crée la filière (active, un mot-clé de départ) — pensez à l'enrichir. Tri par colonne."
        icon={Lightbulb}
        contentClassName="p-0 sm:p-0"
        action={
          <div className="flex items-center gap-1" role="group" aria-label="Filtrer par statut">
            {ONGLET_SUGGESTIONS.map((s) => (
              <Button
                key={s.valeur}
                variant={statutSuggestion === s.valeur ? "secondary" : "outline"}
                size="sm"
                className="text-xs"
                onClick={() => setStatutSuggestion(statutSuggestion === s.valeur ? "" : s.valeur)}
                aria-pressed={statutSuggestion === s.valeur}
              >
                {s.libelle}
              </Button>
            ))}
          </div>
        }
      >
        {/* Fondu enchaîné au changement de filtre / page. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${pageSuggestions}-${statutSuggestion}-${isLoading ? "chargement" : "donnees"}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {isError ? (
              <div className="p-4">
                <SectionErreur onRetry={refetch} message="Impossible de charger les suggestions." />
              </div>
            ) : isLoading ? (
              <div className="flex flex-col gap-2 p-4" aria-busy="true">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
              </div>
            ) : !suggestions?.length ? (
              <div className="p-4">
                {statutSuggestion === "approved" ? (
                  <SectionVide message="Aucune suggestion approuvée pour l'instant." />
                ) : statutSuggestion === "rejected" ? (
                  <SectionVide message="Aucune suggestion rejetée pour l'instant." />
                ) : (
                  <SectionVide message="Aucune suggestion en attente — l'IA n'a pas rencontré d'offre hors référentiel récemment." />
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto scrollbar-thin">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "created")} tri={tri} onTri={basculerTri} />
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "label")} tri={tri} onTri={basculerTri} />
                        <EnteteTriable colonne={COLONNES.find((c) => c.cle === "code")} tri={tri} onTri={basculerTri} />
                        <TableHead className="max-w-64">Raison IA</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="hidden lg:table-cell">Offre d'origine</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                      {suggestionsAffichees.map((suggestion) => (
                        <TableRow key={suggestion.id} className="transition-colors hover:bg-muted/50">
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {new Date(suggestion.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                          </TableCell>
                          <TableCell className="text-xs font-medium">{suggestion.label}</TableCell>
                          <TableCell>
                            <span className="font-mono text-[10px] text-muted-foreground">{suggestion.code}</span>
                          </TableCell>
                          <TableCell className="max-w-64">
                            {suggestion.reason ? (
                              <span className="block truncate text-[11px] text-muted-foreground" title={suggestion.reason}>
                                {suggestion.reason}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={VARIANTE_SUGGESTION[suggestion.status] ?? "outline"}>
                              {ONGLET_SUGGESTIONS.find((s) => s.valeur === suggestion.status)?.libelle ?? suggestion.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {suggestion.offer_id ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs"
                                onClick={() => navigate(`/admin/offres/${suggestion.offer_id}`)}
                              >
                                Voir l'offre
                              </Button>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            {suggestion.status === "pending" && (
                              <div className="flex items-center gap-1">
                                {/* Action positive : teinte verte explicite. */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={revoir.isPending && revoir.variables?.suggestionId === suggestion.id}
                                  onClick={() => revoirSuggestion(suggestion, "approved")}
                                  aria-label={`Approuver la filière ${suggestion.label}`}
                                  className="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                >
                                  <Check className="size-3.5" aria-hidden="true" /> Approuver
                                </Button>
                                {/* Action critique : teinte rouge explicite. */}
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  disabled={revoir.isPending && revoir.variables?.suggestionId === suggestion.id}
                                  onClick={() => revoirSuggestion(suggestion, "rejected")}
                                  aria-label={`Rejeter la filière ${suggestion.label}`}
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <X className="size-3.5" aria-hidden="true" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="border-t border-border px-4 py-3">
                  <PaginationListe page={pageSuggestions} pagePleine={pagePleine} onPageChange={changerPage} />
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </SectionCardAdmin>
    </div>
  )
}

export default SectionSuggestions
```

## File: src/Pages/Admin/Ia/index.jsx
```javascript
import { motion, AnimatePresence } from "framer-motion"
import { BrainCircuit, ChartArea, LayoutDashboard, Loader2, Play, Zap } from "lucide-react"
import { cn } from "cn"
import { useFiltresIaAdmin, FiltresIaAdminProvider } from "@/contexts/FiltresIaAdmin.context"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import HeroAdmin from "@/components/admin/HeroAdmin"
import { useNotify } from "@/contexts/Notify.context"
import { messageErreurIa, useLancerCycleIa } from "@/features/admin-ia.tools"
import OngletPilotage from "./sections/OngletPilotage"
import OngletStats from "./sections/OngletStats"
import SectionCles from "./sections/SectionCles"
import SectionAlertes from "./sections/SectionAlertes"
import SectionSuggestions from "./sections/SectionSuggestions"
import BtnAction from "@/components/admin/BtnAction"
import Bloc, { VARIANTS_PAGE } from "@/components/admin/Bloc"

/* ─────────────────────────────────────────────────────────────────────
  Page Normalisation IA — /admin/ia (super_admin, doc v3 §19).
  Le pipeline tourne en AUTONOMIE (sweep Celery toutes les 5 min) :
  cette page sert à surveiller et intervenir, pas à faire tourner.
───────────────────────────────────────────────────────────────────── */

const ONGLETS = [
  { valeur: "pilotage", libelle: "Pilotage", Icone: LayoutDashboard },
  { valeur: "statistiques", libelle: "Statistiques", Icone: ChartArea },
]

const VARIANTS_PANNEAU = {
  cache: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1], staggerChildren: 0.07, delayChildren: 0.05 },
  },
}

const IaAdmin = () => {
  const { onglet, setOnglet } = useFiltresIaAdmin()
  const notify = useNotify()
  const lancer = useLancerCycleIa()

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
    <motion.div
      variants={VARIANTS_PAGE}
      initial="cache"
      animate="visible"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      <Bloc>
        <HeroAdmin
          title="Normalisation IA"
          titleBdge="Pilotage"
          description="Nettoyage et tagging automatiques des offres brutes — le pipeline tourne en autonomie toutes les 5 minutes."
          icon={BrainCircuit}
        >
          <div className="flex flex-wrap items-center gap-2">
            <BtnAction size="xs" onClick={() => relancer(false)} disabled={lancer.isPending}>
              {lancer.isPending ? (
                <Loader2 className="animate-spin size-4" aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" className="size-4" />
              )}
              Lancer un cycle
            </BtnAction>

            <BtnAction
              size="xs"
              variant="outline"
              onClick={() => relancer(true)}
              disabled={lancer.isPending}
              title="Ignore le garde-fou « scraping récent »"
            >
              <Zap aria-hidden="true" className="size-4" /> Forcer (ignorer le garde-fou)
            </BtnAction>
          </div>
        </HeroAdmin>
      </Bloc>

      <Tabs value={onglet} onValueChange={setOnglet} className="mt-1 w-full">
        <TabsList
          className={cn(
            "flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg border border-border bg-muted/20 p-1",
            "scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          )}
        >
          {ONGLETS.map(({ valeur, libelle, Icone }) => (
            <TabsTrigger
              key={valeur}
              value={valeur}
              className={cn(
                "gap-1.5 whitespace-nowrap rounded-md px-4 py-2 text-xs font-semibold transition-colors",
                onglet === valeur
                  ? "bg-brand-orange text-brand-navy shadow-soft" /* navy sur orange : 6.3:1 AA */
                  : "text-muted-foreground hover:bg-card hover:text-foreground"
              )}
            >
              <Icone className="size-3.5" aria-hidden="true" />
              {libelle}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ─── Fondu enchaîné entre onglets + cascade des sections ─── */}
        <AnimatePresence mode="wait" initial={false}>
          {onglet === "pilotage" ? (
            <motion.div
              key="pilotage"
              role="tabpanel"
              aria-label="Pilotage du pipeline"
              variants={VARIANTS_PANNEAU}
              initial="cache"
              animate="visible"
              exit="cache"
              className="mt-4 flex flex-col gap-6"
            >
              <Bloc>
                <OngletPilotage />
              </Bloc>
              <Bloc>
                <SectionCles />
              </Bloc>
              <Bloc>
                <SectionAlertes />
              </Bloc>
              <Bloc>
                <SectionSuggestions />
              </Bloc>
            </motion.div>
          ) : (
            <motion.div
              key="statistiques"
              role="tabpanel"
              aria-label="Statistiques du pipeline"
              variants={VARIANTS_PANNEAU}
              initial="cache"
              animate="visible"
              exit="cache"
              className="mt-4"
            >
              <Bloc>
                <OngletStats />
              </Bloc>
            </motion.div>
          )}
        </AnimatePresence>
      </Tabs>
    </motion.div >
  )
}

const PageIa = () => (
  <FiltresIaAdminProvider>
    <IaAdmin />
  </FiltresIaAdminProvider>
)

export default PageIa
```
