import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getAlerts, getJobs, getKeys, getQueue, getStats, getSuggestions,
  acknowledgeAlert, createKey, deleteKey, reviewSuggestion, runProcessing,
  testKey, updateKey,
} from "@/api/admin/ai"
import { formatApiError } from "@/api/errors"

/* ─────────────────────────────────────────────────────────────────────
   Page Normalisation IA (/admin/ia) — hooks TanStack (cycle 19, doc v3 §19).

   super_admin uniquement. DEUX onglets (décision utilisateur cycle 19) :
   - Pilotage : queue + run + jobs + clés API + alertes + suggestions ;
   - Statistiques : compteurs IA1-IA6 + charts C1-C5 (GET /stats).

   Le pipeline tourne AUTONOMEMENT (sweep Celery toutes les 5 min) : la
   page sert à SURVEILLER et intervenir, pas à faire tourner le système.

   ⚠️ Vocabulaires (vérifiés live) :
   - jobs AiProcessingJob : status pending|running|completed|failed|
     skipped|locked ; trigger immediate|sweep|manual ;
   - alertes sévérité : info|warning|error|critical ;
   - suggestions : pending|approved|rejected (PATCH body = statut API
     minuscule) — approuver CRÉE la filière + mot-clé poids 50, 409 si
     concurrence ;
   - clés : api_key_last4 affichable (****ab12), JAMAIS la clé complète —
     le formulaire d'édition ne pré-remplit JAMAIS le champ clé.

   Cache : queue/jobs volatils (polling adaptatif tant que running > 0,
   pattern cycle 10 : refetchInterval FONCTION qui lit ses propres
   données) ; stats 60 s ; clés/suggestions listes standard.
   ───────────────────────────────────────────────────────────────────── */

export const adminIaKeys = {
  root: ["admin", "ia"],
  queue: ["admin", "ia", "queue"],
  jobs: (params) => ["admin", "ia", "jobs", params],
  stats: (days) => ["admin", "ia", "stats", days],
  cles: ["admin", "ia", "cles"],
  alertes: (params) => ["admin", "ia", "alertes", params],
  suggestions: (params) => ["admin", "ia", "suggestions", params],
}

/* ─── Vocabulaires (vérifiés live cycle 19 — AIJob/ai_jobs, la table que
   GET /jobs ET /stats servent toutes les deux) ───────────────────────── */

export const STATUTS_JOB = {
  pending: { libelle: "En attente", variante: "secondary" },
  running: { libelle: "En cours", variante: "default" },
  completed: { libelle: "Terminé", variante: "default" },
  partial_failure: { libelle: "Échec partiel", variante: "secondary" },
  failed: { libelle: "Échoué", variante: "destructive" },
}

export const TRIGGERS_JOB = {
  manual: "Manuel",
  sweep: "Sweep planifié (5 min)",
  auto: "Automatique (post-scraping)",
  delayed_check: "Vérification différée",
}

export const SEVERITES = {
  info: { libelle: "Info", variante: "secondary" },
  warning: { libelle: "Avertissement", variante: "secondary" },
  error: { libelle: "Erreur", variante: "destructive" },
  critical: { libelle: "Critique", variante: "destructive" },
}

export const STATUTS_SUGGESTION = [
  { valeur: "pending", libelle: "En attente" },
  { valeur: "approved", libelle: "Approuvées" },
  { valeur: "rejected", libelle: "Rejetées" },
]

export const VARIANTE_SUGGESTION = {
  pending: "secondary",
  approved: "default",
  rejected: "outline",
}

export const libelleStatutJob = (valeur) => STATUTS_JOB[valeur]?.libelle ?? valeur
export const libelleTrigger = (valeur) => TRIGGERS_JOB[valeur] ?? valeur

/* ─── Erreurs ──────────────────────────────────────────────────────── */

/** Message d'erreur lisible — formatApiError obligatoire (422 = tableau,
 *  409 concurrence suggestions = string serveur). */
export const messageErreurIa = (err) => formatApiError(err) || "Action impossible"

/* ─── Queries ──────────────────────────────────────────────────────── */

/** Queue agrégée — polling adaptatif : 5 s tant qu'un job running,
 *  60 s sinon (refetchInterval FONCTION, pattern cycle 10). */
export const useQueueIaQuery = () =>
  useQuery({
    queryKey: adminIaKeys.queue,
    queryFn: ({ signal }) => getQueue({ signal }),
    staleTime: 5 * 1000,
    refetchInterval: (query) =>
      (query.state.data?.running ?? 0) > 0 ? 5 * 1000 : 60 * 1000,
    retry: 1,
  })

/** Historique des jobs (liste plate → pagination heuristique). */
export const useJobsIaQuery = (params) =>
  useQuery({
    queryKey: adminIaKeys.jobs(params),
    queryFn: ({ signal }) => getJobs(params, { signal }),
    staleTime: 30 * 1000,
    retry: 1,
    placeholderData: (precedente) => precedente,
  })

/** Stats pipeline (onglet Statistiques : IA1-IA6 + C1-C5). */
export const useStatsIaQuery = (days = 30) =>
  useQuery({
    queryKey: adminIaKeys.stats(days),
    queryFn: ({ signal }) => getStats({ days }, { signal }),
    staleTime: 60 * 1000,
    retry: 1,
  })

/** Clés API (last4 affichable, clé complète jamais renvoyée). */
export const useClesIaQuery = () =>
  useQuery({
    queryKey: adminIaKeys.cles,
    queryFn: ({ signal }) => getKeys({ signal }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

/** Alertes (filtres serveur : include_acknowledged, severity). */
export const useAlertesIaQuery = (params) =>
  useQuery({
    queryKey: adminIaKeys.alertes(params),
    queryFn: ({ signal }) => getAlerts(params, { signal }),
    staleTime: 30 * 1000,
    retry: 1,
    placeholderData: (precedente) => precedente,
  })

/** Suggestions de filière (status_filter). */
export const useSuggestionsIaQuery = (params) =>
  useQuery({
    queryKey: adminIaKeys.suggestions(params),
    queryFn: ({ signal }) => getSuggestions(params, { signal }),
    staleTime: 60 * 1000,
    retry: 1,
    placeholderData: (precedente) => precedente,
  })

/* ─── Mutations ─────────────────────────────────────────────────────── */

/** Invalide tout le domaine IA après une écriture. */
const _invalider = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: adminIaKeys.root })
}

/** POST /run — 202 asynchrone : le résultat arrive via queue/jobs. */
export const useLancerCycleIa = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => runProcessing(data),
    onSuccess: () => _invalider(queryClient),
  })
}

/** CRUD clés : création/édition (édition = PATCH champs fournis uniquement,
 *  clé rotative OPTIONNELLE — jamais pré-remplir le champ). */
export const useCreerCleIa = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => createKey(data),
    onSuccess: () => _invalider(queryClient),
  })
}

export const useModifierCleIa = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ cleId, data }) => updateKey(cleId, data),
    onSuccess: () => _invalider(queryClient),
  })
}

export const useSupprimerCleIa = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (cleId) => deleteKey(cleId),
    onSuccess: () => _invalider(queryClient),
  })
}

/** Test de connexion — résultat inline (ok/model/message), pas d'invalidation. */
export const useTesterCleIa = () =>
  useMutation({
    mutationFn: (cleId) => testKey(cleId),
  })

/** Accuser une alerte (idempotent). */
export const useAcquitterAlerte = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (alerteId) => acknowledgeAlert(alerteId),
    onSuccess: () => _invalider(queryClient),
  })
}

/**
 * Approuver/rejeter une suggestion. Approuver CRÉE la filière (mot-clé
 * poids 50) → le front redirige vers /admin/filieres?etendue=<id> pour
 * l'atterrissage mots-clés (doc v3 §19) — la réponse ne contient PAS
 * l'id de filière : on redirige vers la page filières qui ouvrira le
 * panneau de la filière portant le code suggéré (recherche par code).
 */
export const useRevoirSuggestion = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ suggestionId, status }) => reviewSuggestion(suggestionId, status),
    onSuccess: () => _invalider(queryClient),
  })
}
