import { memo, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  CalendarClock, ChevronRight, History, UserRound, X,
} from "lucide-react"
import { cn } from "cn"
import { useAdminRunsQuery } from "@/features/admin-dashboard.tools"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import { SectionErreur, SectionVide, SectionAucunResultat, TransitionEtat } from "@/components/admin/EtatsSection"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import EnteteTriable from "@/components/admin/EnteteTriable"
import { usePeutVoirEnvois } from "@/features/admin-matching.tools"
import BtnAction from "@/components/admin/BtnAction"

const STYLES_STATUT = {
  success: { libelle: "Réussi", badge: "border-transparent bg-emerald-100 text-emerald-800", pastille: "bg-emerald-500" },
  running: { libelle: "En cours", badge: "border-transparent bg-secondary text-secondary-foreground", pastille: "bg-brand-navy", ping: true },
  pending: { libelle: "En attente", badge: "border-border bg-muted text-muted-foreground", pastille: "bg-muted-foreground/60" },
  failed: { libelle: "Échoué", badge: "border-transparent bg-red-100 text-red-700", pastille: "bg-red-500" },
}

const OPTIONS_STATUT = ["success", "running", "pending", "failed"].map(
  (valeur) => ({ valeur, ...STYLES_STATUT[valeur] })
)

const formatNombre = (v) => (v ?? 0).toLocaleString("fr-FR")

const dateHeure = (iso) => {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

const dureeAffichage = (debut, fin) => {
  if (!debut || !fin) return "—"
  const ms = new Date(fin) - new Date(debut)
  if (ms < 1000) return `${ms} ms`
  return `${Math.round(ms / 1000)} s`
}

/** Valeur numérique de la durée (pour le tri) ; null = trié en fin. */
const dureeMsValeur = (run) => {
  if (!run.started_at || !run.finished_at) return null
  return new Date(run.finished_at) - new Date(run.started_at)
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

/* Colonnes triables — « Statut » est volontairement exclu (filtre). */
const COLONNES = [
  { cle: "started_at", libelle: "Date", directionInitiale: "desc", triValeur: (r) => r.started_at },
  { cle: "total_raw", libelle: "Brutes", directionInitiale: "desc", triValeur: (r) => r.total_raw ?? 0 },
  { cle: "total_inserted", libelle: "Insérées", directionInitiale: "desc", triValeur: (r) => r.total_inserted ?? 0 },
  { cle: "total_updated", libelle: "M. à jour", directionInitiale: "desc", triValeur: (r) => r.total_updated ?? 0 },
  { cle: "total_duplicates", libelle: "Doublons", directionInitiale: "desc", triValeur: (r) => r.total_duplicates ?? 0 },
  { cle: "total_errors", libelle: "Erreurs", directionInitiale: "desc", triValeur: (r) => r.total_errors ?? 0 },
  { cle: "duree", libelle: "Durée", directionInitiale: "desc", triValeur: dureeMsValeur },
]

/* ── Ligne desktop mémoïsée (inchangée) ──────────────────────────── */
const LigneRun = memo(({ run }) => {
  const meta = STYLES_STATUT[run.status] ?? { libelle: run.status, badge: "", pastille: "bg-muted-foreground" }
  const declenchementAdmin = run.triggered_by?.startsWith("admin")
  return (
    <TableRow className="transition-colors hover:bg-muted/50">
      <TableCell className="whitespace-nowrap">
        <span className="flex items-center gap-1.5">
          {declenchementAdmin ? (
            <UserRound className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <CalendarClock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="sr-only">
            {declenchementAdmin ? "Déclenché manuellement par un admin — " : "Exécution planifiée — "}
          </span>
          <Link
            to={`/admin/scraping/runs/${run.id}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {dateHeure(run.started_at)}
          </Link>
        </span>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={cn("gap-1.5 font-medium", meta.badge)}>
          <span className="relative flex size-1.5" aria-hidden="true">
            {meta.ping && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-navy opacity-50" />
            )}
            <span className={cn("relative inline-flex size-1.5 rounded-full", meta.pastille)} />
          </span>
          {meta.libelle}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatNombre(run.total_raw)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatNombre(run.total_inserted)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatNombre(run.total_updated)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatNombre(run.total_duplicates)}</TableCell>
      <TableCell
        className={cn(
          "text-right tabular-nums",
          (run.total_errors ?? 0) > 0 ? "font-medium text-destructive" : "text-muted-foreground"
        )}
      >
        {formatNombre(run.total_errors)}
      </TableCell>
      <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
        {dureeAffichage(run.started_at, run.finished_at)}
      </TableCell>
    </TableRow>
  )
})
LigneRun.displayName = "LigneRun"

/* ── Filtre statut mutualisé : en-tête desktop + barre mobile ────── */
const SelectStatutRuns = memo(function SelectStatutRuns({ valeur, onChange, compteurs, total, varianteEntete = false }) {
  return (
    <Select value={valeur} onValueChange={onChange}>
      <SelectTrigger
        aria-label="Filtrer par statut"
        className={varianteEntete
          ? cn(
            "h-7 w-auto gap-1.5 rounded-md px-2 text-xs font-medium shadow-none",
            valeur === "tous"
              ? "border-transparent text-muted-foreground/90 hover:text-foreground"
              : "border-brand-navy/30 bg-secondary text-secondary-foreground"
          )
          : "h-8 w-full text-xs"}
      >
        {valeur === "tous" ? (
          <span>{varianteEntete ? "Statut" : "Tous les statuts"}</span>
        ) : (
          <span className="flex items-center gap-1.5">
            <span className={cn("size-1.5 rounded-full", STYLES_STATUT[valeur]?.pastille)} aria-hidden="true" />
            {STYLES_STATUT[valeur]?.libelle}
          </span>
        )}
      </SelectTrigger>
      <SelectContent align="start">
        <SelectItem value="tous">Tous les statuts ({formatNombre(total)})</SelectItem>
        {OPTIONS_STATUT.map((o) => (
          <SelectItem key={o.valeur} value={o.valeur}>
            <span className="flex items-center gap-1.5">
              <span className={cn("size-1.5 rounded-full", o.pastille)} aria-hidden="true" />
              {o.libelle}
              <span className="tabular-nums text-muted-foreground">({compteurs[o.valeur] ?? 0})</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
})

/* ── Carte mobile (miroir de la ligne desktop) ─────────────────────
   Toute la carte est un seul <Link> vers le détail du run. */
const CarteRunRecentMobile = memo(function CarteRunRecentMobile({ run }) {
  const meta = STYLES_STATUT[run.status] ?? { libelle: run.status, badge: "", pastille: "bg-muted-foreground" }
  const declenchementAdmin = run.triggered_by?.startsWith("admin")
  const stats = [
    { label: "Brutes", valeur: formatNombre(run.total_raw) },
    { label: "Insérées", valeur: formatNombre(run.total_inserted) },
    { label: "M. à jour", valeur: formatNombre(run.total_updated) },
    { label: "Doublons", valeur: formatNombre(run.total_duplicates) },
    {
      label: "Erreurs",
      valeur: formatNombre(run.total_errors),
      enErreur: (run.total_errors ?? 0) > 0,
    },
    { label: "Durée", valeur: dureeAffichage(run.started_at, run.finished_at) },
  ]
  return (
    <Link
      to={`/admin/scraping/runs/${run.id}`}
      aria-label={`Voir le détail du run du ${dateHeure(run.started_at)}`}
      className="block rounded-xl border border-border bg-card p-4 shadow-soft transition-colors hover:bg-muted/50"
    >
      {/* En-tête : date + déclencheur / badge de statut à pastille */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-medium leading-tight text-primary">
            {declenchementAdmin ? (
              <UserRound className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            ) : (
              <CalendarClock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            {dateHeure(run.started_at)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {declenchementAdmin ? "Déclenché par un admin" : "Exécution planifiée"}
          </p>
        </div>
        <Badge variant="outline" className={cn("gap-1.5 font-medium", meta.badge)}>
          <span className="relative flex size-1.5" aria-hidden="true">
            {meta.ping && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-navy opacity-50" />
            )}
            <span className={cn("relative inline-flex size-1.5 rounded-full", meta.pastille)} />
          </span>
          {meta.libelle}
        </Badge>
      </div>

      {/* 6 indicateurs en grille 3×2 — mêmes données que la table */}
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {stats.map(({ label, valeur, enErreur }) => (
          <div key={label} className="rounded-lg bg-muted/40 px-2 py-1.5">
            <dt className="truncate text-[10px] text-muted-foreground">{label}</dt>
            <dd className={cn("text-sm font-medium tabular-nums", enErreur && "font-semibold text-destructive")}>
              {valeur}
            </dd>
          </div>
        ))}
      </dl>

      {/* Pied : affordance de navigation */}
      <span className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">
        Voir le détail
        <ChevronRight className="size-3.5" aria-hidden="true" />
      </span>
    </Link>
  )
})

/* ── SKELETONS FIDÈLES ───────────────────────────────────────────── */

const Bloc = ({ className, delay = 0 }) => (
  <Skeleton className={className} style={delay ? { animationDelay: `${delay}ms` } : undefined} />
)

/* Géométrie des 6 tuiles : Brutes, Insérées, M. à jour, Doublons, Erreurs, Durée. */
const TUILES_STATS_RUN = [
  { dt: "w-9", dd: "w-8" },
  { dt: "w-11", dd: "w-8" },
  { dt: "w-14", dd: "w-8" },
  { dt: "w-11", dd: "w-9" },
  { dt: "w-10", dd: "w-6" },
  { dt: "w-9", dd: "w-12" },
]

const RunsRecentsSkeleton = ({ nbLignes = 8 }) => {
  const lignes = Array.from({ length: nbLignes }, (_, i) => i)
  return (
    <div role="status" aria-label="Chargement des derniers runs de scraping">
      {/* Mobile : filtre statut + cartes */}
      <div className="px-4 pb-2 md:hidden" aria-hidden="true">
        <Skeleton className="h-8 w-full" />
      </div>
      <ul className="flex flex-col gap-3 px-4 pb-2 md:hidden" aria-hidden="true">
        {lignes.map((i) => {
          const delay = i * 80
          return (
            <li key={i}>
              <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <Bloc className="h-3.5 w-32" delay={delay} />
                    <Bloc className="h-2.5 w-20" delay={delay} />
                  </div>
                  <Bloc className="h-5 w-20 shrink-0 rounded-full" delay={delay} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {TUILES_STATS_RUN.map(({ dt, dd }, k) => (
                    <div key={k} className="rounded-lg bg-muted/40 px-2 py-1.5">
                      <Bloc className={cn("h-2", dt)} delay={delay} />
                      <Bloc className={cn("mt-1 h-3.5", dd)} delay={delay} />
                    </div>
                  ))}
                </div>
                <Bloc className="mt-3 h-3 w-24" delay={delay} />
              </div>
            </li>
          )
        })}
      </ul>

      {/* Desktop : tableau (8 colonnes, toutes visibles à ce breakpoint) */}
      <div className="hidden overflow-x-auto scrollbar-thin md:block">
        <Table aria-hidden="true">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead><Bloc className="h-3 w-28" /></TableHead>
              <TableHead className="w-40"><Bloc className="h-3 w-24" /></TableHead>
              <TableHead className="text-right"><Bloc className="ml-auto h-3 w-10" /></TableHead>
              <TableHead className="text-right"><Bloc className="ml-auto h-3 w-10" /></TableHead>
              <TableHead className="text-right"><Bloc className="ml-auto h-3 w-10" /></TableHead>
              <TableHead className="text-right"><Bloc className="ml-auto h-3 w-12" /></TableHead>
              <TableHead className="text-right"><Bloc className="ml-auto h-3 w-10" /></TableHead>
              <TableHead className="text-right"><Bloc className="ml-auto h-3 w-12" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((i) => {
              const delay = i * 80
              return (
                <TableRow key={i} className="hover:bg-transparent">
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Bloc className="size-3.5 rounded-sm" delay={delay} />
                      <Bloc className="h-3.5 w-24" delay={delay} />
                    </div>
                  </TableCell>
                  <TableCell><Bloc className="h-5 w-20 rounded-full" delay={delay} /></TableCell>
                  <TableCell className="text-right"><Bloc className="ml-auto h-3 w-8" delay={delay} /></TableCell>
                  <TableCell className="text-right"><Bloc className="ml-auto h-3 w-8" delay={delay} /></TableCell>
                  <TableCell className="text-right"><Bloc className="ml-auto h-3 w-8" delay={delay} /></TableCell>
                  <TableCell className="text-right"><Bloc className="ml-auto h-3 w-9" delay={delay} /></TableCell>
                  <TableCell className="text-right"><Bloc className="ml-auto h-3 w-6" delay={delay} /></TableCell>
                  <TableCell className="text-right"><Bloc className="ml-auto h-3 w-12" delay={delay} /></TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pied : compteur */}
      <div className="border-t border-border px-4 py-2.5" aria-hidden="true">
        <Skeleton className="h-3 w-40" />
      </div>
    </div>
  )
}

/* ── COMPOSANT PRINCIPAL ─────────────────────────────────────────── */
const RunsRecents = () => {
  const autorise = usePeutVoirEnvois()
  const { data, isLoading, isError, refetch } = useAdminRunsQuery({ limit: 30 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const donnees = data ?? []

  /* Tri : « Date » descendante par défaut (le plus récent d'abord). */
  const [tri, setTri] = useState({ cle: "started_at", direction: "desc" })
  const [filtreStatut, setFiltreStatut] = useState("tous")

  const compteurs = useMemo(() => {
    const c = { success: 0, running: 0, pending: 0, failed: 0 }
    for (const r of donnees) if (c[r.status] !== undefined) c[r.status] += 1
    return c
  }, [donnees])

  const runsAffiches = useMemo(() => {
    const base = filtreStatut === "tous" ? donnees : donnees.filter((r) => r.status === filtreStatut)
    if (!tri) return base
    const colonne = COLONNES.find((c) => c.cle === tri.cle)
    if (!colonne) return base
    const copie = [...base].sort((a, b) => comparerValeurs(colonne.triValeur(a), colonne.triValeur(b)))
    return tri.direction === "asc" ? copie : copie.reverse()
  }, [donnees, filtreStatut, tri])

  /* Cycle de tri : desc → asc → aucun (retour à l'ordre serveur). */
  const basculerTri = (colonne) => {
    setTri((prec) => {
      if (prec?.cle !== colonne.cle) return { cle: colonne.cle, direction: colonne.directionInitiale ?? "desc" }
      if (prec.direction === (colonne.directionInitiale ?? "desc"))
        return { cle: colonne.cle, direction: prec.direction === "asc" ? "desc" : "asc" }
      return null
    })
  }

  const cleCorps = `${filtreStatut}-${tri?.cle ?? "aucun"}-${tri?.direction ?? ""}`

  /* Clé d'état pour la transition — le tri est exclu (le fondu du tri
     est porté par le key du TableBody / de la liste mobile). */
  const etat = !autorise
    ? "refuse"
    : isError
      ? "erreur"
      : isLoading
        ? "chargement"
        : !donnees.length
          ? "vide"
          : "donnees"

  return (
    <SectionCardAdmin
      title="Derniers runs de scraping"
      description="Historique des 30 derniers runs"
      icon={History}
      contentClassName="p-0 sm:p-0"
      action={
        <Link
          to="/admin/scraping"
          className="flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          Tout voir <ChevronRight className="size-3.5" aria-hidden="true" />
        </Link>
      }
    >      
      <TransitionEtat etat={`${filtreStatut}-${etat}`}>
        {!autorise ? (
          <SectionVide message="Statistiques d'envoi réservées aux super admins et gestionnaires utilisateurs." />
        ) : isError ? (
          <div className="p-4">
            <SectionErreur onRetry={refetch} message="Impossible de charger l'historique des runs." />
          </div>
        ) : isLoading ? (
          <RunsRecentsSkeleton nbLignes={8} />
        ) : !donnees.length ? (
          <div className="p-4">
            <SectionVide message="Aucun run de scraping enregistré." />
          </div>
        ) : (
          <>
            {/* Filtre statut — mobile (desktop : select dans l'en-tête de table) */}
            <div className="px-4 pb-2 md:hidden">
              <SelectStatutRuns
                valeur={filtreStatut}
                onChange={setFiltreStatut}
                compteurs={compteurs}
                total={donnees.length}
              />
            </div>

            {runsAffiches.length === 0 ? (
                <SectionAucunResultat
                  message={`Aucun run avec le statut « ${STYLES_STATUT[filtreStatut]?.libelle} ».`}
                  onReset={() => setFiltreStatut("tous")}
                  className="m-4"
                />
            ) : (
              <>
                {/* ── Mobile : cartes ────────────────────────────── */}
                <ul
                  key={cleCorps}
                  className="flex animate-in flex-col gap-3 px-4 pb-2 duration-200 motion-reduce:animate-none md:hidden"
                >
                  {runsAffiches.map((run) => (
                    <li key={run.id}>
                      <CarteRunRecentMobile run={run} />
                    </li>
                  ))}
                </ul>

                {/* ── Desktop : tableau ──────────────────────────── */}
                <div className="hidden overflow-x-auto scrollbar-thin md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        {/* Date — triable */}
                        <EnteteTriable
                          colonne={COLONNES.find((c) => c.cle === "started_at")}
                          tri={tri}
                          onTri={basculerTri}
                        />
                        {/* Statut — filtre directement dans l'en-tête */}
                        <TableHead className="w-40">
                          <SelectStatutRuns
                            valeur={filtreStatut}
                            onChange={setFiltreStatut}
                            compteurs={compteurs}
                            total={donnees.length}
                            varianteEntete
                          />
                        </TableHead>
                        {/* Colonnes numériques + durée — triables, alignées à droite */}
                        {COLONNES.filter((c) => c.cle !== "started_at").map((colonne) => (
                          <EnteteTriable
                            key={colonne.cle}
                            colonne={colonne}
                            tri={tri}
                            onTri={basculerTri}
                            aligneDroite
                          />
                        ))}
                      </TableRow>
                    </TableHeader>
                    {/* key = fondu léger à chaque changement de tri / filtre */}
                    <TableBody key={cleCorps} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                      {runsAffiches.map((run) => <LigneRun key={run.id} run={run} />)}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            {/* Pied : compteur + reset du filtre actif */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {formatNombre(runsAffiches.length)} run{runsAffiches.length > 1 ? "s" : ""} affiché
                {runsAffiches.length > 1 ? "s" : ""} sur {formatNombre(donnees.length)}
              </span>
              {filtreStatut !== "tous" && (
                <BtnAction
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setFiltreStatut("tous")}
                >
                  <X className="size-3.5" aria-hidden="true" /> Réinitialiser
                </BtnAction>
              )}
            </div>
          </>
        )}
      </TransitionEtat>
    </SectionCardAdmin>
  )
}

export default RunsRecents