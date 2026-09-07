import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getScrapingStatus, getScrapingSummary, getRuns, getRunDetail, getRunLogs, triggerScraping,
} from "@/api/admin/scraping"

/* ─────────────────────────────────────────────────────────────────────
   Page Gestion du scraping (/admin/scraping) — hooks TanStack.

   Volatilité (cf. prompt §4 « Cache » — les défauts globaux de
   queryClient.js sont un réglage public, pas admin) :
   - status : dernier passage par source — CHANGE dès qu'un worker
     fait avancer un run ;
   - runs   : historique — seules les dernières lignes bougent.

   POLLING ADAPTATIF (doc v3 §10 : « pas de websocket, prévoir un
   intervalle raisonnable, ex. 5–10 s tant qu'un run est pending/
   running ») : TanStack v5 accepte refetchInterval en FONCTION de
   la query — chaque query lit ses PROPRES données et passe de
   60 s → 5 s tant qu'elle voit un run actif, sans état partagé ni
   coordination entre sections (une section démontée arrête son
   polling, aucune boucle globale à nettoyer).
   - runs   : actif si l'une des lignes de la page courante est
     pending/running ;
   - status : actif si le dernier passage d'une source est
     pending/running (le worker avance le SourceScrapeRun en même
     temps que le run global).

   - trigger : mutation 201 → ScrapeRunRead "pending", l'exécution
     réelle est ASYNCHRONE (worker Celery) — le message de succès
     doit dire « en file d'attente », jamais « scraping terminé ».
   ───────────────────────────────────────────────────────────────────── */

export const adminScrapingKeys = {
  root: ["admin", "scraping"],
  status: ["admin", "scraping", "status"],
  summary: ["admin", "scraping", "summary"],
  runs: (params) => ["admin", "scraping", "runs", params],
  run: (runId) => ["admin", "scraping", "run", runId],
  runLogs: (runId) => ["admin", "scraping", "run", runId, "logs"],
}

/* Statuts de run qui signalent une activité en cours. */
export const STATUTS_ACTIFS = ["pending", "running"]

const INTERVALLE_ACTIF = 5 * 1000
const INTERVALLE_REPOS = 60 * 1000

/**
 * Un run actif dans les N premières lignes ?
 * (exporté pour l'indicateur « collecte en cours » de l'en-tête)
 */
export const aUnRunActif = (runs, nbMax = 10) =>
  Array.isArray(runs) && runs.slice(0, nbMax).some((r) => STATUTS_ACTIFS.includes(r?.status))

/* ─── État des sources (GET /status) ─────────────────────────────────── */

export const useAdminScrapingStatusQuery = () =>
  useQuery({
    queryKey: adminScrapingKeys.status,
    queryFn: ({ signal }) => getScrapingStatus({ signal }),
    // Dernier passage par source — bouge quand un worker avance un run.
    staleTime: 5 * 1000,
    // Polling adaptatif : 5 s si une source est pending/running, 60 s sinon.
    refetchInterval: (query) =>
      (query.state.data ?? []).some((s) => STATUTS_ACTIFS.includes(s?.last_status))
        ? INTERVALLE_ACTIF
        : INTERVALLE_REPOS,
    retry: 1,
  })

/* ─── Agrégats all-time (GET /stats/summary) ────────────────────────── */

export const useAdminScrapingSummaryQuery = () =>
  useQuery({
    queryKey: adminScrapingKeys.summary,
    queryFn: ({ signal }) => getScrapingSummary({ signal }),
    // Agrégat all-time : bouge seulement quand un run se termine —
    // pas de polling, mais invalidé par le trigger (via root) et
    // staleTime court car peu coûteux (une requête SQL).
    staleTime: 30 * 1000,
    retry: 1,
  })

/* ─── Historique des runs (GET /runs) ────────────────────────────────── */

/**
 * @param {Object} params { limit (1-100, defaut 30), offset } — liste
 *   PLATE sans total (pattern PaginationListe : « page suivante
 *   possible si page pleine », jamais de numérotation inventée).
 */
export const useAdminScrapingRunsQuery = (params = {}) =>
  useQuery({
    queryKey: adminScrapingKeys.runs(params),
    queryFn: ({ signal }) => getRuns(params, { signal }),
    staleTime: 5 * 1000,
    refetchInterval: (query) => (aUnRunActif(query.state.data) ? INTERVALLE_ACTIF : INTERVALLE_REPOS),
    retry: 1,
  })

/* ─── Détail d'un run + journal (page 11) ────────────────────────────── */

/**
 * Détail d'un run avec ses sous-runs par source préchargés.
 * Polling adaptatif tant que CE run est pending/running.
 */
export const useAdminRunDetailQuery = (runId, { enabled = true } = {}) =>
  useQuery({
    queryKey: adminScrapingKeys.run(runId),
    queryFn: ({ signal }) => getRunDetail(runId, { signal }),
    enabled: !!runId && enabled,
    staleTime: 5 * 1000,
    refetchInterval: (query) =>
      STATUTS_ACTIFS.includes(query.state.data?.status) ? INTERVALLE_ACTIF : false,
    retry: 1,
  })

/**
 * Journal d'événements du run (une ligne par offre traitée, niveau
 * dérivé serveur : failed→error, skipped→warning, sinon info).
 * Rechargé en même temps que le détail tant que le run est actif.
 */
export const useAdminRunLogsQuery = (runId, { enabled = true, runActif = false } = {}) =>
  useQuery({
    queryKey: adminScrapingKeys.runLogs(runId),
    queryFn: ({ signal }) => getRunLogs(runId, { signal }),
    enabled: !!runId && enabled,
    staleTime: 5 * 1000,
    // Polling piloté par l'état du DÉTAIL (le journal ne porte pas le
    // statut du run) : la page lui passe runActif → 5 s, sinon stop.
    refetchInterval: runActif ? INTERVALLE_ACTIF : false,
    retry: 1,
  })


/* ─── Déclenchement manuel (POST /trigger) ───────────────────────────── */

/** Erreur → message lisible (404 = aucune source active correspondante). */
export const messageErreurScraping = (err) =>
  err?.response?.data?.detail || err?.message || "Action impossible"

export const useTriggerScraping = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => triggerScraping(data),
    onSuccess: (run) => {
      // Le run part "pending" : les listes et l'état des sources doivent
      // se rafraîchir immédiatement (le polling adaptatif prend le relais
      // — il basculera à 5 s dès qu'il verra le run pending).
      queryClient.invalidateQueries({ queryKey: adminScrapingKeys.root })
      return run
    },
  })
}
