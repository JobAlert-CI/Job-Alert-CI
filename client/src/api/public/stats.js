import api from "../axiosInstance";
import { cleanParams } from "../utils";

const API_URL = "/api/stats";

/** GET /api/stats/global → { active_offers, new_today, subscribers, sources } */
const getGlobalStats = async ({ signal } = {}) => {
  const response = await api.get(`${API_URL}/global`, { signal });
  return response.data;
};

/** GET /api/stats/pipeline */
const getPipelineStatus = async ({ signal } = {}) => {
  const response = await api.get(`${API_URL}/pipeline`, { signal });
  return response.data;
};

/**
 * GET /api/stats/offers → { total_offers, new_offers }
 * @param {Object} params filiere_id, source_id, visible_only (bool, défaut true),
 *   active_only (bool, défaut true)
 */
const getOfferStats = async (params = {}, { signal } = {}) => {
  const response = await api.get(`${API_URL}/offers`, { params: cleanParams(params), signal });
  return response.data;
};

/** GET /api/stats/offers/by-filiere — params : source_id, limit (1-500, défaut 50). */
const getOfferStatsByFiliere = async (params = {}, { signal } = {}) => {
  const response = await api.get(`${API_URL}/offers/by-filiere`, {
    params: cleanParams(params),
    signal,
  });
  return response.data;
};

/** GET /api/stats/offers/by-source — params : filiere_id, limit (1-500, défaut 50). */
const getOfferStatsBySource = async (params = {}, { signal } = {}) => {
  const response = await api.get(`${API_URL}/offers/by-source`, {
    params: cleanParams(params),
    signal,
  });
  return response.data;
};

/** GET /api/stats/offers/by-contract — aucun paramètre accepté par le backend. */
const getOfferStatsByContract = async ({ signal } = {}) => {
  const response = await api.get(`${API_URL}/offers/by-contract`, { signal });
  return response.data;
};

export {
  getGlobalStats,
  getPipelineStatus,
  getOfferStats,
  getOfferStatsByFiliere,
  getOfferStatsBySource,
  getOfferStatsByContract,
};

export default {
  getGlobalStats,
  getPipelineStatus,
  getOfferStats,
  getOfferStatsByFiliere,
  getOfferStatsBySource,
  getOfferStatsByContract,
};
