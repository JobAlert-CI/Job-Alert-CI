import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, FileClock, Globe, Pencil } from "lucide-react"
import { cn } from "cn"
import {
  useAdminRunDetailQuery, useAdminRunLogsQuery, useModifierNotesRun, messageErreurScraping,
} from "@/features/admin-scraping.tools"
import { useReferentialsQuery } from "@/lib/referentiels-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import StatusChip from "@/components/shared/StatusChip"
import SectionCardAdmin from "@/components/admin/SectionCardAdmin"
import { SectionErreur, SectionVide, SectionAucunResultat } from "./components/EtatsSection"
import {
  LIBELLE_STATUT_RUN, VARIANTE_STATUT_RUN, TONE_STATUT_RUN,
  statutRunActif, dureeLisible, dateHeure,
} from "./components/statuts-scraping"
import HeroAdmin from "@/components/admin/HeroAdmin"
import BtnAction from "@/components/admin/BtnAction"
import DialogNotesRun from "@/components/dialog/DialogNotesRun"

/* ─────────────────────────────────────────────────────────────────────
  Page Détail d'un run — /admin/scraping/runs/:id (super_admin).
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

const TAILLE_PAGE_JOURNAL = 20
const formatNombre = (v) => (v ?? 0).toLocaleString("fr-FR")

const VARIANTS_PAGE = {
  cache: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
}

const VARIANTS_SECTION = {
  cache: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
}

/* Tuile de statistique globale avec niveau d'alerte visuel :
   normal / avertissement (doublons) / critique (erreurs). */
const TONS_STAT = {
  normal: { carte: "", valeur: "" },
  avertissement: { carte: "border-l-[3px] border-l-[#D97706] bg-[#D97706]/5", valeur: "text-[#B45309]" },
  critique: { carte: "border-l-[3px] border-l-destructive bg-destructive/5", valeur: "text-destructive" },
}

const StatGlobale = ({ label, valeur = null, texte = null, ton = "normal" }) => {
  const style = TONS_STAT[ton] ?? TONS_STAT.normal
  return (
    <div className={cn("flex flex-col gap-1 rounded-xl border border-border bg-card p-3 shadow-soft", style.carte)}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">{label}</p>
      <p className={cn("font-heading text-xl font-bold tabular-nums", style.valeur)}>
        {texte ?? formatNombre(valeur)}
      </p>
    </div>
  )
}

const DetailRun = () => {
  const { id: runId } = useParams()
  const [niveauFiltre, setNiveauFiltre] = useState("")
  const [pageJournal, setPageJournal] = useState(1)
  const [notesOuvertes, setNotesOuvertes] = useState(false)

  const { data: run, isLoading, isError, error, refetch } = useAdminRunDetailQuery(runId)
  const runActif = statutRunActif(run?.status)

  /* Audit 4, C.6 : filtre niveau SQL-side — les params sont le miroir
     exact des Query params serveur. */
  const paramsJournal = useMemo(
    () => ({
      level: niveauFiltre || undefined,
      limit: TAILLE_PAGE_JOURNAL,
      offset: (pageJournal - 1) * TAILLE_PAGE_JOURNAL,
    }),
    [niveauFiltre, pageJournal]
  )

  const { data: logs, isLoading: logsChargement } = useAdminRunLogsQuery(runId, { runActif, params: paramsJournal })

  /* Audit 4, C.4 : annotation des notes après coup. */
  const notesMutation = useModifierNotesRun()

  /* Résolution source_id → nom : référentiel public déjà en cache. */
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

  const STATS = [
    { label: "Offres brutes", valeur: run?.total_raw ?? 0 },
    { label: "Insérées", valeur: run?.total_inserted ?? 0 },
    { label: "Mises à jour", valeur: run?.total_updated ?? 0 },
    { label: "Doublons", valeur: run?.total_duplicates ?? 0, ton: (run?.total_duplicates ?? 0) > 0 ? "avertissement" : "normal" },
    { label: "Erreurs", valeur: run?.total_errors ?? 0, ton: (run?.total_errors ?? 0) > 0 ? "critique" : "normal" },
    { label: "Durée", texte: dureeLisible(null, run?.started_at, run?.finished_at) ?? (runActif ? "en cours—" : "—") },
  ]

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

      {isLoading ? (
        <>
          <motion.div variants={VARIANTS_SECTION} className="flex flex-col gap-2">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-4 w-44" />
          </motion.div>
          <motion.div variants={VARIANTS_SECTION} className="grid grid-cols-3 gap-3 sm:grid-cols-6" aria-busy="true">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </motion.div>
          <motion.div variants={VARIANTS_SECTION}>
            <Skeleton className="h-48 w-full rounded-xl" />
          </motion.div>
          <motion.div variants={VARIANTS_SECTION}>
            <Skeleton className="h-64 w-full rounded-xl" />
          </motion.div>
        </>
      ) : !run ? null : (
        <>
          {/* ─── En-tête : titre + annotation + statut ─── */}
          <motion.section variants={VARIANTS_SECTION} aria-label="En-tête du run">
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
          </motion.section>

          {/* ─── Statistiques globales (erreurs / doublons exergués) ─── */}
          <motion.div variants={VARIANTS_SECTION}>
            <section aria-label="Statistiques globales du run" className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {STATS.map(({ label, valeur, ton, texte }, i) => (
                <StatGlobale key={i} label={label} valeur={valeur} ton={ton} texte={texte} />
              ))}
            </section>
          </motion.div>

          {/* ─── Sous-runs par source ─── */}
          <motion.div variants={VARIANTS_SECTION}>
            <SectionCardAdmin
              title="Sous-runs par source"
              description="Statut, durée, code HTTP et volumes détaillés par source scrapée."
              icon={Globe}
              contentClassName="p-0 sm:p-0"
            >
              {!run.source_runs?.length ? (
                <div className="p-4">
                  <SectionVide message="Aucun sous-run pour ce run." />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto scrollbar-thin">
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

                  {/* Message d'erreur éventuel d'un sous-run échoué */}
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
            </SectionCardAdmin>
          </motion.div>

          {/* ─── Journal des événements ─── */}
          <motion.div variants={VARIANTS_SECTION}>
            <SectionCardAdmin
              title="Journal d'ingestion"
              description="Une ligne par offre traitée — journal spécifique au scraping. 200 lignes par page, filtrées côté serveur."
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
              {/* Fondu enchaîné au changement de niveau / page. */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${niveauFiltre}-${pageJournal}-${logsChargement ? "chargement" : "donnees"}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  {logsChargement ? (
                    <div className="flex flex-col gap-2 p-4" aria-busy="true">
                      {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                    </div>
                  ) : !logs?.length ? (
                    <div className="p-4">
                      {niveauFiltre ? (
                        <SectionAucunResultat
                          message="Aucun événement à ce niveau."
                          onReset={() => changerNiveau("")}
                        />
                      ) : (
                        <SectionVide message="Aucun événement pour ce run." />
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto scrollbar-thin">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Heure</TableHead>
                            <TableHead>Niveau</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead className="hidden md:table-cell">Offre</TableHead>
                            <TableHead>URL source</TableHead>
                            <TableHead className="hidden lg:table-cell">Message</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logs.map((log) => {
                            const [libelleNiveau, variante] = LIBELLE_NIVEAU[log.niveau] ?? [log.niveau, "outline"]
                            return (
                              <TableRow key={log.id} className="transition-colors hover:bg-muted/50">
                                <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                                  {dateHeure(log.created_at)}
                                </TableCell>
                                <TableCell><Badge variant={variante} >{libelleNiveau}</Badge></TableCell>
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
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Pagination heuristique honnête : liste plate bornée à
                  limit=200 — « page suivante possible si page pleine ». */}
              {!logsChargement && Array.isArray(logs) && (logs.length === TAILLE_PAGE_JOURNAL || pageJournal > 1) && (
                <nav
                  aria-label="Pagination du journal"
                  className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3"
                >
                  <p className="text-xs tabular-nums text-muted-foreground">Journal — page {pageJournal}</p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPageJournal(Math.max(1, pageJournal - 1))}
                      disabled={pageJournal <= 1}
                      aria-label="Page précédente du journal"
                    >
                      Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPageJournal(pageJournal + 1)}
                      disabled={logs?.length !== TAILLE_PAGE_JOURNAL}
                      aria-label="Page suivante du journal"
                    >
                      Suivant
                    </Button>
                  </div>
                </nav>
              )}
            </SectionCardAdmin>
          </motion.div>
        </>
      )}

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