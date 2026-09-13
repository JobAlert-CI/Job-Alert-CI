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