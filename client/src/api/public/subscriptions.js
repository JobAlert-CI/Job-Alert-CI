import api from "../axiosInstance";
import { cleanParams } from "../utils";

const API_URL = "/api/subscriptions";

/**
 * POST /api/subscriptions → 201
 * @param {Object} data {
 *   email, full_name, city,
 *   filieres: string[], experience, contract_types: string[],
 *   wants_career_tips: boolean, source: "site"
 * }
 */
const subscribe = async (data, { signal } = {}) => {
  const response = await api.post(API_URL, data, { signal });
  return response.data;
};

/** GET /api/subscriptions/confirm/{token} */
const confirmSubscribe = async (token, { signal } = {}) => {
  const response = await api.get(`${API_URL}/confirm/${encodeURIComponent(token)}`, { signal });
  return response.data;
};

/**
 * POST /api/subscriptions/resend-confirmation — body { email }.
 * Reponse generique anti-enumeration ; rate-limit metier cote serveur.
 */
const resendConfirmation = async (email, { signal } = {}) => {
  const response = await api.post(`${API_URL}/resend-confirmation`, { email }, { signal });
  return response.data;
};

/**
 * POST /api/subscriptions/unsubscribe/{token}
 * Le backend attend `reason` en query param, pas dans le corps JSON.
 * @param {string|{reason?: string}} params raison ou objet { reason }
 */
const unsubscribe = async (token, params = {}, { signal } = {}) => {
  const query = typeof params === "string" ? { reason: params } : params;
  const response = await api.post(`${API_URL}/unsubscribe/${encodeURIComponent(token)}`, null, {
    params: cleanParams(query),
    signal,
  });
  return response.data;
};

/** GET /api/subscriptions/preferences/{token} */
const getPreferences = async (token, { signal } = {}) => {
  const response = await api.get(`${API_URL}/preferences/${encodeURIComponent(token)}`, { signal });
  return response.data;
};

/**
 * PUT /api/subscriptions/preferences/{token}
 * @param {Object} data { filieres: string[], contract_types: string[], wants_career_tips: boolean }
 */
const updatePreferences = async (token, data, { signal } = {}) => {
  const response = await api.put(`${API_URL}/preferences/${encodeURIComponent(token)}`, data, {
    signal,
  });
  return response.data;
};

export {
  subscribe,
  confirmSubscribe,
  resendConfirmation,
  unsubscribe,
  getPreferences,
  updatePreferences,
};

export default {
  subscribe,
  confirmSubscribe,
  resendConfirmation,
  unsubscribe,
  getPreferences,
  updatePreferences,
};
