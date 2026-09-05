import adminApi from "./axiosAdmin";
import { cleanParams } from "../utils";

/* Pilotage IA : cles API, jobs, file d'attente, alertes, suggestions de filiere.
   Super_admin uniquement. */

const API_URL = "/api/admin/ai";

/* ─── Cles API ───────────────────────────────────────────────────────── */

/** GET /api/admin/ai/keys — cles actives (api_key_last4 exclu de la reponse). */
const getKeys = async ({ signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/keys`, { signal });
  return response.data;
};

/**
 * POST /api/admin/ai/keys → 201.
 * @param {Object} data { name (2-160), provider_type?, base_url?, models?, api_key (1-4096),
 *   priority? (>= 0), is_active?, max_concurrent_requests?, timeout_seconds?,
 *   max_retries?, retry_backoff_seconds?, rate_limit_per_minute?, notes? }
 */
const createKey = async (data, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/keys`, data, { signal });
  return response.data;
};

/** PATCH /api/admin/ai/keys/{key_id} — champs fournis uniquement (api_key rotative incluse). */
const updateKey = async (keyId, data, { signal } = {}) => {
  const response = await adminApi.patch(`${API_URL}/keys/${encodeURIComponent(keyId)}`, data, { signal });
  return response.data;
};

/**
 * DELETE /api/admin/ai/keys/{key_id} → 204 — soft delete.
 * Le serveur refuse de supprimer/desactiver la DERNIERE cle active.
 */
const deleteKey = async (keyId, { signal } = {}) => {
  await adminApi.delete(`${API_URL}/keys/${encodeURIComponent(keyId)}`, { signal });
  return true;
};

/** POST /api/admin/ai/keys/{key_id}/test → { ok, provider?, model?, message? }. */
const testKey = async (keyId, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/keys/${encodeURIComponent(keyId)}/test`, null, { signal });
  return response.data;
};

/* ─── Jobs et file d'attente ─────────────────────────────────────────── */

/** GET /api/admin/ai/jobs — params : limit (1-200, defaut 50), offset (>= 0). */
const getJobs = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/jobs`, { params: cleanParams(params), signal });
  return response.data;
};

/**
 * GET /api/admin/ai/queue → { pending, running, pending_ai_jobs, last_sweep_at, last_sweep_status }
 * Lecture directe SQL, pas de cache.
 */
const getQueue = async ({ signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/queue`, { signal });
  return response.data;
};

/* ─── Alertes ────────────────────────────────────────────────────────── */

/**
 * GET /api/admin/ai/alerts
 * @param {Object} params include_acknowledged (bool, defaut false),
 *   severity ("info"|"warning"|"error"|"critical"), limit (1-200, defaut 50), offset
 */
const getAlerts = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/alerts`, { params: cleanParams(params), signal });
  return response.data;
};

/** PATCH /api/admin/ai/alerts/{alert_id}/ack — accuse reception idempotent. */
const acknowledgeAlert = async (alertId, { signal } = {}) => {
  const response = await adminApi.patch(`${API_URL}/alerts/${encodeURIComponent(alertId)}/ack`, null, { signal });
  return response.data;
};

/* ─── Execution ─────────────────────────────────────────────────────── */

/**
 * POST /api/admin/ai/run → 202 — declenche le traitement IA des offres brutes.
 * @param {Object} data { force?: bool, trigger_type?: "manual"|"sweep"|"api" }
 * → { status: "queued", task_id, triggered_by }
 */
const runProcessing = async (data = {}, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/run`, cleanParams(data), { signal });
  return response.data;
};

/* ─── Suggestions de filiere ─────────────────────────────────────────── */

/**
 * GET /api/admin/ai/suggestions
 * @param {Object} params status_filter ("pending"|"approved"|"rejected"), limit (1-100, defaut 20), offset
 */
const getSuggestions = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/suggestions`, { params: cleanParams(params), signal });
  return response.data;
};

/**
 * PATCH /api/admin/ai/suggestions/{suggestion_id} — body { status: "approved"|"rejected" }.
 * Approver cree la filiere + son mot-cle de poids 50 si elle n'existe pas deja.
 */
const reviewSuggestion = async (suggestionId, status, { signal } = {}) => {
  const response = await adminApi.patch(
    `${API_URL}/suggestions/${encodeURIComponent(suggestionId)}`,
    { status },
    { signal },
  );
  return response.data;
};

export {
  getKeys,
  createKey,
  updateKey,
  deleteKey,
  testKey,
  getJobs,
  getQueue,
  getAlerts,
  acknowledgeAlert,
  runProcessing,
  getSuggestions,
  reviewSuggestion,
};

export default {
  getKeys,
  createKey,
  updateKey,
  deleteKey,
  testKey,
  getJobs,
  getQueue,
  getAlerts,
  acknowledgeAlert,
  runProcessing,
  getSuggestions,
  reviewSuggestion,
};
