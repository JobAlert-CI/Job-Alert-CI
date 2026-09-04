import adminApi from "./axiosAdmin";

/* Dashboard : point d'entree du back-office, accessible a tous les roles admin. */

const API_URL = "/api/admin/dashboard";

/**
 * GET /api/admin/dashboard/overview → DashboardOverviewRead
 * { offers_total, offers_active, subscribers_total, subscribers_active,
 *   contact_messages_new, sources_active, last_scrape_run_at,
 *   last_scrape_status, pending_digests }
 */
const getOverview = async ({ signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/overview`, { signal });
  return response.data;
};

/** GET /api/admin/dashboard/runs — params : limit (1-100, defaut 30), offset (>= 0). */
const getRuns = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/runs`, { params, signal });
  return response.data;
};

/** GET /api/admin/dashboard/runs/{run_id} — detail d'un run (stats, sous-runs par source). */
const getRunDetail = async (runId, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/runs/${encodeURIComponent(runId)}`, { signal });
  return response.data;
};

/* ─── Widgets transverses (prefixe /api/admin, cf. aggregates.py) ────── */

/**
 * GET /api/admin/dashboard/top-viewed-offers — top N offres actives par vues.
 * @param {Object} params { days: 1-90 (defaut 7, reserve), limit: 1-50 (defaut 10) }
 */
const getTopViewedOffers = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`/api/admin/dashboard/top-viewed-offers`, { params, signal });
  return response.data;
};

/**
 * GET /api/admin/search — recherche transverse (offres, abonnes, entreprises).
 * @param {Object} params { q (>= 1 caractere, requis), per_type_limit: 1-50 (defaut 10) }
 * → { query, per_type_limit, offers[], subscribers[], companies[] }
 */
const globalSearch = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`/api/admin/search`, { params, signal });
  return response.data;
};

export { getOverview, getRuns, getRunDetail, getTopViewedOffers, globalSearch };

export default { getOverview, getRuns, getRunDetail, getTopViewedOffers, globalSearch };
