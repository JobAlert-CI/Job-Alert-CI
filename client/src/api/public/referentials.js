import api from "../axiosInstance";

const API_URL = "/api/referentials";

/** GET /api/referentials/sources */
const getSources = async ({ signal } = {}) => {
  const response = await api.get(`${API_URL}/sources`, { signal });
  return response.data;
};

/** GET /api/referentials/filieres */
const getFilieres = async ({ signal } = {}) => {
  const response = await api.get(`${API_URL}/filieres`, { signal });
  return response.data;
};

/** GET /api/referentials/filieres/{slug} */
const getFilieresBySlug = async (slug, { signal } = {}) => {
  const response = await api.get(`${API_URL}/filieres/${encodeURIComponent(slug)}`, { signal });
  return response.data;
};

/** GET /api/referentials/filieres/{slug}/specialites */
const getSpecialitesFiliere = async (slug, { signal } = {}) => {
  const response = await api.get(`${API_URL}/filieres/${encodeURIComponent(slug)}/specialites`, {
    signal,
  });
  return response.data;
};

/** GET /api/referentials/contract-types */
const getContractTypes = async ({ signal } = {}) => {
  const response = await api.get(`${API_URL}/contract-types`, { signal });
  return response.data;
};

/** GET /api/referentials/experience-levels */
const getExperienceLevels = async ({ signal } = {}) => {
  const response = await api.get(`${API_URL}/experience-levels`, { signal });
  return response.data;
};

/** GET /api/referentials/education-levels */
const getEducationLevels = async ({ signal } = {}) => {
  const response = await api.get(`${API_URL}/education-levels`, { signal });
  return response.data;
};

/** GET /api/referentials/locations */
const getLocations = async ({ signal } = {}) => {
  const response = await api.get(`${API_URL}/locations`, { signal });
  return response.data;
};

/** Charge en une fois tous les référentiels utiles aux filtres d'offres. */
const getAllReferentials = async ({ signal } = {}) => {
  const [filieres, sources, contractTypes, experienceLevels, educationLevels, locations] =
    await Promise.all([
      getFilieres({ signal }),
      getSources({ signal }),
      getContractTypes({ signal }),
      getExperienceLevels({ signal }),
      getEducationLevels({ signal }),
      getLocations({ signal }),
    ]);
  return { filieres, sources, contractTypes, experienceLevels, educationLevels, locations };
};

export {
  getSources,
  getFilieres,
  getFilieresBySlug,
  getSpecialitesFiliere,
  getContractTypes,
  getExperienceLevels,
  getEducationLevels,
  getLocations,
  getAllReferentials,
};

export default {
  getSources,
  getFilieres,
  getFilieresBySlug,
  getSpecialitesFiliere,
  getContractTypes,
  getExperienceLevels,
  getEducationLevels,
  getLocations,
  getAllReferentials,
};
