import { memo, useMemo, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"
import { AlertCircle, ListTodo } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  libelleStatutJob, libelleTrigger, useJobsIaQuery,
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
import { SectionErreur, SectionVide, TransitionEtat } from "@/components/admin/EtatsSection"

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

/* ── Carte mobile (miroir de la ligne desktop) ────────────────────────
   Pas de <Link> global : la table n'a pas de page de détail par job —
   la carte reste un <article> informatif, comme la ligne. */
const CarteJobMobile = memo(function CarteJobMobile({ job }) {
  const dateLabel = dateHeure(job.created_at)
  const stats = [
    { label: "Offres", valeur: formatNombre(job.offers_total) },
    { label: "Activées", valeur: formatNombre(job.offers_activated) },
    { label: "Rejetées", valeur: formatNombre(job.offers_rejected) },
    { label: "Revue", valeur: formatNombre(job.offers_pending_review) },
    { label: "À retraiter", valeur: formatNombre(job.offers_reprocess_required) },
    { label: "Durée", valeur: dureeJob(job) },
  ]
  return (
    <article
      aria-label={`Job IA du ${dateLabel}`}
      className="rounded-xl border border-border bg-card p-4 shadow-soft"
    >
      {/* En-tête : date + déclencheur / badge de statut */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium leading-tight text-primary">{dateLabel}</p>
          <p className="text-[10px] text-muted-foreground">{libelleTrigger(job.trigger_type)}</p>
        </div>
        <Badge variant={VARIANTE_STATUT[job.status] ?? "outline"}>
          {libelleStatutJob(job.status)}
        </Badge>
      </div>

      {/* 6 indicateurs en grille 3×2 — mêmes données que les colonnes */}
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {stats.map(({ label, valeur }) => (
          <div key={label} className="rounded-lg bg-muted/40 px-2 py-1.5">
            <dt className="truncate text-[10px] text-muted-foreground">{label}</dt>
            <dd className="truncate text-sm font-medium tabular-nums">{valeur}</dd>
          </div>
        ))}
      </dl>

      {/* Message d'erreur éventuel (miroir de la colonne Erreur) */}
      {job.error_message && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-1.5 rounded-lg border border-destructive/20 bg-destructive/5 px-2 py-1.5 text-xs text-destructive"
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 wrap-break-word">{job.error_message}</span>
        </p>
      )}
    </article>
  )
})

/* ── SKELETONS FIDÈLES ───────────────────────────────────────────── */

/** Bloc skeleton avec délai décalé (cascade ligne par ligne). */
const Bloc = ({ className, delay = 0 }) => (
  <Skeleton className={className} style={delay ? { animationDelay: `${delay}ms` } : undefined} />
)

/** Géométrie des 6 tuiles de stats : Offres, Activées, Rejetées, Revue, À retraiter, Durée. */
const TUILES_STATS_JOB = [
  { dt: "w-10", dd: "w-8" },
  { dt: "w-14", dd: "w-8" },
  { dt: "w-14", dd: "w-8" },
  { dt: "w-10", dd: "w-8" },
  { dt: "w-16", dd: "w-8" },
  { dt: "w-9", dd: "w-12" },
]

/**
 * État de chargement de l'historique des jobs IA (/admin/ia).
 * Reprend les mêmes classes responsives que la table réelle :
 *   mobile : cartes (date + déclencheur + statut + 6 tuiles)
 *   md+    : + rejetées + revue
 *   lg+    : + à retraiter
 * `nbLignes` = taille de page réelle (zéro layout shift).
 */
const HistoriqueJobsSkeleton = ({ nbLignes = 10 }) => {
  const lignes = Array.from({ length: nbLignes }, (_, i) => i)
  return (
    <div role="status" aria-label="Chargement de l'historique des jobs IA">
      {/* ── Mobile : cartes (miroir de CarteJobMobile) ─────────────── */}
      <ul className="flex flex-col gap-3 px-4 pb-2 md:hidden" aria-hidden="true">
        {lignes.map((i) => {
          const delay = i * 80
          return (
            <li key={i}>
              <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <Bloc className="h-3.5 w-36" delay={delay} />
                    <Bloc className="h-2.5 w-16" delay={delay} />
                  </div>
                  <Bloc className="h-5 w-20 shrink-0 rounded-full" delay={delay} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {TUILES_STATS_JOB.map(({ dt, dd }, k) => (
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

      {/* ── Desktop : table ────────────────────────────────────────── */}
      <div className="hidden overflow-x-auto scrollbar-thin md:block">
        <Table aria-hidden="true">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead><Bloc className="h-3 w-28" /></TableHead>
              <TableHead><Bloc className="h-3 w-20" /></TableHead>
              <TableHead><Bloc className="h-3 w-12" /></TableHead>
              <TableHead className="text-right"><Bloc className="ml-auto h-3 w-10" /></TableHead>
              <TableHead className="text-right"><Bloc className="ml-auto h-3 w-12" /></TableHead>
              <TableHead className="hidden text-right md:table-cell"><Bloc className="ml-auto h-3 w-12" /></TableHead>
              <TableHead className="hidden text-right md:table-cell"><Bloc className="ml-auto h-3 w-10" /></TableHead>
              <TableHead className="hidden text-right lg:table-cell"><Bloc className="ml-auto h-3 w-14" /></TableHead>
              <TableHead><Bloc className="h-3 w-10" /></TableHead>
              <TableHead className="max-w-52"><Bloc className="h-3 w-16" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((i) => {
              const delay = i * 80
              return (
                <TableRow key={i} className="hover:bg-transparent">
                  <TableCell><Bloc className="h-3.5 w-36" delay={delay} /></TableCell>
                  <TableCell><Bloc className="h-3 w-16" delay={delay} /></TableCell>
                  <TableCell><Bloc className="h-5 w-20 rounded-full" delay={delay} /></TableCell>
                  <TableCell className="text-right"><Bloc className="ml-auto h-3 w-8" delay={delay} /></TableCell>
                  <TableCell className="text-right"><Bloc className="ml-auto h-3 w-8" delay={delay} /></TableCell>
                  <TableCell className="hidden text-right md:table-cell"><Bloc className="ml-auto h-3 w-8" delay={delay} /></TableCell>
                  <TableCell className="hidden text-right md:table-cell"><Bloc className="ml-auto h-3 w-8" delay={delay} /></TableCell>
                  <TableCell className="hidden text-right lg:table-cell"><Bloc className="ml-auto h-3 w-8" delay={delay} /></TableCell>
                  <TableCell><Bloc className="h-3 w-12" delay={delay} /></TableCell>
                  <TableCell className="max-w-52"><Bloc className="h-3 w-40" delay={delay} /></TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pied partagé : équivalent de PaginationListe */}
      <div className="flex flex-col gap-2 border-t border-border px-4 py-3" aria-hidden="true">
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

/* ── COMPOSANT PRINCIPAL ─────────────────────────────────────────── */

const HistoriqueJobs = () => {
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

  /* Clé d'état de la transition : page incluse pour le fondu au
     changement de page, comme HistoriqueRuns. */
  const etat = isError ? "erreur" : isLoading ? "chargement" : !jobs?.length ? "vide" : "donnees"

  return (
    <div ref={refTableau} className="scroll-mt-20">
      <SectionCardAdmin
        title="Historique des jobs"
        description="Cycles provider : sweep automatiques toutes les 5 minutes et lancements manuels. Tri par colonne."
        icon={ListTodo}
        contentClassName="p-0 sm:p-0"
      >
        {/* Fondu enchaîné au changement de page / état. */}
        <TransitionEtat etat={`${pageJobs}-${etat}`}>
          {isError ? (
            <div className="p-4">
              <SectionErreur onRetry={refetch} message="Impossible de charger l'historique des jobs." />
            </div>
          ) : isLoading ? (
            <HistoriqueJobsSkeleton nbLignes={paramsJobs.limit ?? 10} />
          ) : !jobs?.length ? (
            <div className="p-4">
              <SectionVide message="Aucun job de normalisation enregistré pour l'instant." />
            </div>
          ) : (
            <>
              {/* ── Mobile : cartes ────────────────────────────── */}
              <ul
                key={cleCorps}
                className="flex animate-in flex-col gap-3 px-4 pb-2 duration-200 motion-reduce:animate-none md:hidden"
              >
                {jobsAffiches.map((job) => (
                  <li key={job.id}>
                    <CarteJobMobile job={job} />
                  </li>
                ))}
              </ul>

              {/* ── Desktop : table ────────────────────────────── */}
              <div className="hidden overflow-x-auto scrollbar-thin md:block">
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
                  {/* key = fondu léger à chaque changement de tri */}
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
        </TransitionEtat>
      </SectionCardAdmin>
    </div>
  )
}

export default HistoriqueJobs