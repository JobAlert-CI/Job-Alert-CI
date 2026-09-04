import adminApi from "./axiosAdmin";

/* Parametres du site editables sans deploiement : super_admin uniquement. */

const API_URL = "/api/admin/settings";

/** GET /api/admin/settings — tous les parametres. */
const getSettings = async ({ signal } = {}) => {
  const response = await adminApi.get(API_URL, { signal });
  return response.data;
};

/** GET /api/admin/settings/{key} — un parametre (404 si inconnu). */
const getSetting = async (key, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/${encodeURIComponent(key)}`, { signal });
  return response.data;
};

/**
 * PUT /api/admin/settings/{key} — cree ou met a jour un parametre.
 * @param {Object} data { value, description? }
 */
const updateSetting = async (key, data, { signal } = {}) => {
  const response = await adminApi.put(`${API_URL}/${encodeURIComponent(key)}`, data, { signal });
  return response.data;
};

/**
 * POST /api/admin/settings/bulk — mise a jour de plusieurs parametres.
 * @param {Object} settings { [key]: value } — renvoie la liste complete mise a jour.
 */
const bulkUpdateSettings = async (settings, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/bulk`, { settings }, { signal });
  return response.data;
};

export { getSettings, getSetting, updateSetting, bulkUpdateSettings };

export default { getSettings, getSetting, updateSetting, bulkUpdateSettings };
