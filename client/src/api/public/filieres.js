import api from "../axiosInstance";
import { cleanParams } from "../utils";

const API_URL = "/api/filieres";

/**
 * GET /api/filieres — liste avec compteurs.
 * @param {Object} params q (min. 2), sort: "volume" | "az" (défaut "volume")
 */
const getFilieres = async (params = {}, { signal } = {}) => {
  const response = await api.get(API_URL, { params: cleanParams(params), signal });
  return response.data;
};

/** GET /api/filieres/{slug} — accepte le slug OU le code. */
const getFilieresBySlug = async (slug, { signal } = {}) => {
  const response = await api.get(`${API_URL}/${encodeURIComponent(slug)}`, { signal });
  return response.data;
};

/**
 * GET /api/filieres/{slug}/offers
 * @param {Object} params specialite_id, source_id, contract_type_id,
 *   experience_level_id, education_level_id, q (min. 2),
 *   published_since, published_until (Date | ISO),
 *   sort: "recent" | "old" | "az" | "ent", limit (1-100, défaut 20), offset
 *   (pas de filtres CSV ici : cette route ne les accepte pas)
 */
const getFiliereOffers = async (slug, params = {}, { signal } = {}) => {
  const response = await api.get(`${API_URL}/${encodeURIComponent(slug)}/offers`, {
    params: cleanParams(params),
    signal,
  });
  return response.data;
};

/** GET /api/filieres/{slug}/stats */
const getFilieresStats = async (slug, { signal } = {}) => {
  const response = await api.get(`${API_URL}/${encodeURIComponent(slug)}/stats`, { signal });
  return response.data;
};

export { getFilieres, getFilieresBySlug, getFiliereOffers, getFilieresStats };

export default { getFilieres, getFilieresBySlug, getFiliereOffers, getFilieresStats };
