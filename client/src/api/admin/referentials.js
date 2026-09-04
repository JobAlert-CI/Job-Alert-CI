import adminApi from "./axiosAdmin";

/* Referentiels partages (filieres, sources, types de contrat, niveaux, villes) :
   super_admin uniquement. */

const API_URL = "/api/admin/referentials";

/* ─── Filieres ───────────────────────────────────────────────────────── */

/** GET /api/admin/referentials/filieres — avec specialites chargees. */
const getFilieres = async ({ signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/filieres`, { signal });
  return response.data;
};

/** POST /api/admin/referentials/filieres → 201 — body FiliereCreate { code, label, slug?, is_active?, sort_order? }. */
const createFiliere = async (data, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/filieres`, data, { signal });
  return response.data;
};

/** PUT /api/admin/referentials/filieres/{filiere_id} — champs fournis uniquement. */
const updateFiliere = async (filiereId, data, { signal } = {}) => {
  const response = await adminApi.put(`${API_URL}/filieres/${encodeURIComponent(filiereId)}`, data, { signal });
  return response.data;
};

/** DELETE /api/admin/referentials/filieres/{filiere_id} → 204. */
const deleteFiliere = async (filiereId, { signal } = {}) => {
  await adminApi.delete(`${API_URL}/filieres/${encodeURIComponent(filiereId)}`, { signal });
  return true;
};

/**
 * PUT /api/admin/referentials/filieres/{filiere_id}/keywords
 * Remplace INTEGRALEMENT les mots-cles de matching (pas d'ajout incrementiel).
 * @param {Object} data { keywords: [{ keyword, weight: 1-100 }, ...] }
 */
const updateFiliereKeywords = async (filiereId, data, { signal } = {}) => {
  const response = await adminApi.put(
    `${API_URL}/filieres/${encodeURIComponent(filiereId)}/keywords`,
    data,
    { signal },
  );
  return response.data;
};

/**
 * POST /api/admin/referentials/filieres/simulate
 * Simule l'impact d'une liste de mots-cles candidats SANS modifier la base.
 * @param {Object} data { filiere_code, keywords: string[] }
 */
const simulateFiliere = async (data, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/filieres/simulate`, data, { signal });
  return response.data;
};

/* ─── Specialites ────────────────────────────────────────────────────── */

/** GET /api/admin/referentials/filieres/{filiere_id}/specialites. */
const getSpecialites = async (filiereId, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/filieres/${encodeURIComponent(filiereId)}/specialites`, { signal });
  return response.data;
};

/** POST /api/admin/referentials/filieres/{filiere_id}/specialites → 201. */
const createSpecialite = async (filiereId, data, { signal } = {}) => {
  const response = await adminApi.post(
    `${API_URL}/filieres/${encodeURIComponent(filiereId)}/specialites`,
    data,
    { signal },
  );
  return response.data;
};

/** PUT /api/admin/referentials/specialites/{specialite_id}. */
const updateSpecialite = async (specialiteId, data, { signal } = {}) => {
  const response = await adminApi.put(`${API_URL}/specialites/${encodeURIComponent(specialiteId)}`, data, { signal });
  return response.data;
};

/** DELETE /api/admin/referentials/specialites/{specialite_id} → 204. */
const deleteSpecialite = async (specialiteId, { signal } = {}) => {
  await adminApi.delete(`${API_URL}/specialites/${encodeURIComponent(specialiteId)}`, { signal });
  return true;
};

/* ─── Sources ─────────────────────────────────────────────────────────── */

/** GET /api/admin/referentials/sources. */
const getSources = async ({ signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/sources`, { signal });
  return response.data;
};

/** POST /api/admin/referentials/sources → 201. */
const createSource = async (data, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/sources`, data, { signal });
  return response.data;
};

/** PUT /api/admin/referentials/sources/{source_id}. */
const updateSource = async (sourceId, data, { signal } = {}) => {
  const response = await adminApi.put(`${API_URL}/sources/${encodeURIComponent(sourceId)}`, data, { signal });
  return response.data;
};

/** PATCH /api/admin/referentials/sources/{source_id}/status — body { status: "active"|"paused"|"error"|"disabled" }. */
const updateSourceStatus = async (sourceId, status, { signal } = {}) => {
  const response = await adminApi.patch(
    `${API_URL}/sources/${encodeURIComponent(sourceId)}/status`,
    { status },
    { signal },
  );
  return response.data;
};

/** DELETE /api/admin/referentials/sources/{source_id} → 204. */
const deleteSource = async (sourceId, { signal } = {}) => {
  await adminApi.delete(`${API_URL}/sources/${encodeURIComponent(sourceId)}`, { signal });
  return true;
};

/* ─── Types de contrat / niveaux / villes ────────────────────────────── */

const makeCrud = (segment) => ({
  list: async ({ signal } = {}) => {
    const response = await adminApi.get(`${API_URL}/${segment}`, { signal });
    return response.data;
  },
  create: async (data, { signal } = {}) => {
    const response = await adminApi.post(`${API_URL}/${segment}`, data, { signal });
    return response.data;
  },
  update: async (id, data, { signal } = {}) => {
    const response = await adminApi.put(`${API_URL}/${segment}/${encodeURIComponent(id)}`, data, { signal });
    return response.data;
  },
  remove: async (id, { signal } = {}) => {
    await adminApi.delete(`${API_URL}/${segment}/${encodeURIComponent(id)}`, { signal });
    return true;
  },
});

export const contractTypes = makeCrud("contract-types");
export const experienceLevels = makeCrud("experience-levels");
export const educationLevels = makeCrud("education-levels");
export const locations = makeCrud("locations");

export {
  getFilieres,
  createFiliere,
  updateFiliere,
  deleteFiliere,
  updateFiliereKeywords,
  simulateFiliere,
  getSpecialites,
  createSpecialite,
  updateSpecialite,
  deleteSpecialite,
  getSources,
  createSource,
  updateSource,
  updateSourceStatus,
  deleteSource,
};

export default {
  getFilieres,
  createFiliere,
  updateFiliere,
  deleteFiliere,
  updateFiliereKeywords,
  simulateFiliere,
  getSpecialites,
  createSpecialite,
  updateSpecialite,
  deleteSpecialite,
  getSources,
  createSource,
  updateSource,
  updateSourceStatus,
  deleteSource,
  contractTypes,
  experienceLevels,
  educationLevels,
  locations,
};
