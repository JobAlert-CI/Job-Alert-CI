/* ─────────────────────────────────────────────────────────────────────
   Libellés / variantes / helpers partagés par les sections de la page
   Scraping. Statuts = enum serveur ScrapeRunStatus (vérifié
   server/models/enums.py) : pending, running, success,
   partial_failure, failed.
   ───────────────────────────────────────────────────────────────────── */

export const LIBELLE_STATUT_RUN = {
  pending: "En attente",
  running: "En cours",
  success: "Réussi",
  partial_failure: "Échec partiel",
  failed: "Échoué",
}

/* Variante Badge par statut (mêmes conventions que RunsRecents). */
export const VARIANTE_STATUT_RUN = {
  pending: "outline",
  running: "default",
  success: "secondary",
  partial_failure: "destructive",
  failed: "destructive",
}

/* Ton StatusChip pour l'état global de la collecte. */
export const TONE_STATUT_RUN = {
  pending: "navy",
  running: "navy",
  success: "emerald",
  partial_failure: "orange",
  failed: "orange",
}

export const statutRunActif = (statut) => statut === "pending" || statut === "running"

/* Durée lisible : duration_ms par source, ou started_at→finished_at. */
export const dureeLisible = (durationMs, startedAt, finishedAt) => {
  if (typeof durationMs === "number") return formaterDuree(durationMs)
  if (startedAt && finishedAt) {
    return formaterDuree(new Date(finishedAt) - new Date(startedAt))
  }
  return null
}

const formaterDuree = (ms) => {
  if (ms < 1000) return `${ms} ms`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m} min ${r} s` : `${m} min`
}

/* Date + heure courtes (fr-FR). */
export const dateHeure = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

/* Relative « il y a X » sans dépendance externe. */
export const ilYA = (iso) => {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return null
  const min = Math.round(ms / 60000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const j = Math.floor(h / 24)
  return `il y a ${j} j`
}

/* Nom de source depuis source_id (Map sourceId → name, memoïsée page). */
export const nomSource = (sourceId, sourcesParId) =>
  sourcesParId?.get(sourceId)?.source_name ?? sourcesParId?.get(sourceId)?.source_code ?? "Source inconnue"
