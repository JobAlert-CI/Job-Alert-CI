import api from "../axiosInstance";
import { cleanParams } from "../utils";

const API_URL = "/api/offers";

/**
 * GET /api/offers — flux public des offres.
 * @param {Object} params
 *  IDs : filiere_id, specialite_id, source_id, contract_type_id,
 *        experience_level_id, education_level_id, location_id
 *  Codes (tableau/Set accepté, sérialisé en CSV) :
 *        filieres, sources, contrats, experiences, niveaux
 *  q (min. 2 caractères), published_since, published_until (Date | ISO),
 *  sort: "recent" | "old" | "az" | "ent" (défaut "recent"),
 *  limit (1-100, défaut 20), offset (>= 0)
 */
const getOffers = async (params = {}, { signal } = {}) => {
  const response = await api.get(API_URL, { params: cleanParams(params), signal });
  return response.data;
};

/** GET /api/offers/{offer_id} — accepte un id OU un slug. */
const getOfferById = async (idOrSlug, { signal } = {}) => {
  const response = await api.get(`${API_URL}/${encodeURIComponent(idOrSlug)}`, { signal });
  return response.data;
};

/** GET /api/offers/{offer_id}/similar — params : { limit } (1-10, défaut 3). */
const getSimilarOffers = async (idOrSlug, params = {}, { signal } = {}) => {
  const response = await api.get(`${API_URL}/${encodeURIComponent(idOrSlug)}/similar`, {
    params: cleanParams(params),
    signal,
  });
  return response.data;
};

/** POST /api/offers/{offer_id}/view → { view_count } (rate-limité côté serveur). */
const incrementeView = async (idOrSlug, { signal } = {}) => {
  const response = await api.post(`${API_URL}/${encodeURIComponent(idOrSlug)}/view`, null, {
    signal,
  });
  return response.data;
};

/** POST /api/offers/{offer_id}/save → { save_count } (rate-limité côté serveur). */
const saveOffer = async (idOrSlug, { signal } = {}) => {
  const response = await api.post(`${API_URL}/${encodeURIComponent(idOrSlug)}/save`, null, {
    signal,
  });
  return response.data;
};

export { getOffers, getOfferById, getSimilarOffers, incrementeView, saveOffer };

export default { getOffers, getOfferById, getSimilarOffers, incrementeView, saveOffer };
