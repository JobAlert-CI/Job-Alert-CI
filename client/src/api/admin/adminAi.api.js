import adminApi from "./adminAxios"

/**
 * API IA (super_admin) — page /admin/ia, décision produit préalable.
 * GET/POST/PATCH/DELETE /ai/keys · POST /keys/{id}/test ·
 * GET /ai/jobs · GET /ai/alerts · POST /ai/run.
 *
 * ⚠ Le backend n'expose pas encore ces routes : les fonctions basculent en
 * mode démo (données factices) tant que l'API est absente, et la page
 * affiche un bandeau « à valider par le Product Owner ».
 */

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms))

const MOCK_KEYS = [
  { id: "aik-1", provider: "openai", label: "OpenAI — production", api_key_masked: "sk-…9fJ2", priority: 1, is_active: true },
  { id: "aik-2", provider: "mistral", label: "Mistral — secours", api_key_masked: "mi-…K4t8", priority: 2, is_active: false },
]

const MOCK_JOBS = [
  { id: "aij-1", job_type: "normalize_offers", status: "success", items_processed: 74, tokens_used: 152300, error_message: null, created_at: "2026-08-22T06:50:00Z" },
  { id: "aij-2", job_type: "normalize_offers", status: "failed", items_processed: 12, tokens_used: 18400, error_message: "Quota dépassé sur la clé primaire", created_at: "2026-08-21T06:55:00Z" },
]

const MOCK_ALERTS = [
  { id: "aia-1", severity: "warning", message: "Clé Mistral jamais testée depuis sa création.", acknowledged: false, created_at: "2026-08-20T10:00:00Z" },
  { id: "aia-2", severity: "error", message: "Échec du job du 21/08 : quota OpenAI dépassé.", acknowledged: false, created_at: "2026-08-21T07:00:00Z" },
]

export const fetchAiKeys = async () => {
  try {
    const { data } = await adminApi.get("/ai/keys")
    return data
  } catch (error) {
    if (error?.response) throw error
    await delay()
    return [...MOCK_KEYS]
  }
}

export const createAiKey = async (payload) => {
  const { data } = await adminApi.post("/ai/keys", payload)
  return data
}

export const updateAiKey = async (keyId, payload) => {
  const { data } = await adminApi.patch(`/ai/keys/${keyId}`, payload)
  return data
}

export const deleteAiKey = async (keyId) => {
  await adminApi.delete(`/ai/keys/${keyId}`)
}

/** Test de connexion d'une clé. */
export const testAiKey = async (keyId) => {
  try {
    const { data } = await adminApi.post(`/ai/keys/${keyId}/test`)
    return data
  } catch (error) {
    if (error?.response) throw error
    await delay(600)
    return { ok: true, latency_ms: 420, model: "gpt-4o-mini", tested_at: new Date().toISOString() }
  }
}

export const fetchAiJobs = async ({ limit = 20, offset = 0 } = {}) => {
  try {
    const { data } = await adminApi.get("/ai/jobs", { params: { limit, offset } })
    return data
  } catch (error) {
    if (error?.response) throw error
    await delay()
    return [...MOCK_JOBS]
  }
}

export const fetchAiAlerts = async () => {
  try {
    const { data } = await adminApi.get("/ai/alerts")
    return data
  } catch (error) {
    if (error?.response) throw error
    await delay()
    return [...MOCK_ALERTS]
  }
}

/** Accusé de réception d'une alerte. */
export const acknowledgeAiAlert = async (alertId) => {
  const { data } = await adminApi.post(`/ai/alerts/${alertId}/ack`)
  return data
}

/** Lancement manuel d'un job de normalisation. */
export const runAiJob = async ({ job_type = "normalize_offers", offer_ids = null } = {}) => {
  const { data } = await adminApi.post("/ai/run", { job_type, offer_ids })
  return data
}
