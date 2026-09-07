import adminApi from "./axiosAdmin";
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
 */
const getRunLogs = async (runId, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/runs/${encodeURIComponent(runId)}/logs`, { signal });
  return response.data;
};

export { getScrapingStatus, getScrapingSummary, triggerScraping, getRuns, getRunDetail, getRunLogs };

export default { getScrapingStatus, getScrapingSummary, triggerScraping, getRuns, getRunDetail, getRunLogs };
