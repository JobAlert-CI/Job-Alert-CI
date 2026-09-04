import api from "../axiosInstance";
import { cleanParams } from "../utils";

const API_URL = "/api/sources";

/** GET /api/sources — liste des sources avec stats de scraping. */
const getSources = async ({ signal } = {}) => {
  const response = await api.get(API_URL, { signal });
  return response.data;
};

/** GET /api/sources/{slug} */
const getSourcesBySlug = async (slug, { signal } = {}) => {
  const response = await api.get(`${API_URL}/${encodeURIComponent(slug)}`, { signal });
  return response.data;
};

/**
 * GET /api/sources/{slug}/offers
 * @param {Object} params limit (1-100, défaut 20), offset (>= 0)
 *   (seuls ces deux paramètres sont acceptés par le backend)
 */
const getSourceOffers = async (slug, params = {}, { signal } = {}) => {
  const response = await api.get(`${API_URL}/${encodeURIComponent(slug)}/offers`, {
    params: cleanParams(params),
    signal,
  });
  return response.data;
};

export { getSources, getSourcesBySlug, getSourceOffers };

export default { getSources, getSourcesBySlug, getSourceOffers };
