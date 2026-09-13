import adminApi from "../axiosAdmin";
import { cleanParams } from "../utils";

/* Pilotage du scraping : super_admin uniquement. */

const API_URL = "/api/admin/scraping";

/** GET /api/admin/scraping/status — etat des sources (dernier passage, duree, erreurs). */
const getScrapingStatus = async ({ signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/status`, { signal });
  return response.data;
};

/** GET /api/admin/scraping/stats/summary — agregats all-time (runs, taux de reussite, volumes). */
const getScrapingSummary = async ({ signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/stats/summary`, { signal });
  return response.data;
};

/**
 * POST /api/admin/scraping/trigger → 201 — declenchement manuel.
 * @param {Object} data { source_code? (sinon toutes les sources actives), notes? (max 1000) }
 * → ScrapeRunRead (statut initial "pending", execution portee par le worker).
 */
const triggerScraping = async (data = {}, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/trigger`, cleanParams(data), { signal });
  return response.data;
};

/** GET /api/admin/scraping/runs — params : limit (1-100, defaut 30), offset (>= 0). */
const getRuns = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/runs`, { params: cleanParams(params), signal });
  return response.data;
};

/** GET /api/admin/scraping/runs/{run_id} — detail d'un run avec ses sous-runs par source. */
const getRunDetail = async (runId, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/runs/${encodeURIComponent(runId)}`, { signal });
  return response.data;
};

/**
 * GET /api/admin/scraping/runs/{run_id}/logs — evenements d'ingestion du run
 * (un par offre traitee, niveau derive de l'action : error/ warning/ info).
 * Audit 4, C.6 : reponse bornee + filtre niveau COTE SQL —
 * @param {Object} params level ("info"|"warning"|"error"), limit (1-200, defaut 200), offset (>= 0)
 */
const getRunLogs = async (runId, params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/runs/${encodeURIComponent(runId)}/logs`, {
    params: cleanParams(params),
    signal,
  });
  return response.data;
};

/**
 * PATCH /api/admin/scraping/runs/{run_id} — annotation du run apres coup
 * (audit 4, C.4 : notes libres, usage forensique « source down, on
 * relancera demain »). Journalisee cote serveur. → ScrapeRunRead.
 * @param {string} runId
 * @param {Object} data { notes: string | null } — null = effacer
 */
const updateRunNotes = async (runId, data, { signal } = {}) => {
  const response = await adminApi.patch(
    `${API_URL}/runs/${encodeURIComponent(runId)}`,
    data,
    { signal },
  );
  return response.data;
};

export { getScrapingStatus, getScrapingSummary, triggerScraping, getRuns, getRunDetail, getRunLogs, updateRunNotes };

export default { getScrapingStatus, getScrapingSummary, triggerScraping, getRuns, getRunDetail, getRunLogs, updateRunNotes };
