import adminApi from "./axiosAdmin";
import { cleanParams } from "../utils";

/* Gestion des entreprises : super_admin uniquement (impact direct sur les
   offres exposees publiquement). */

const API_URL = "/api/admin/companies";

/**
 * GET /api/admin/companies — liste paginee avec recherche.
 * @param {Object} params q (max 120, LIKE echappe), limit (1-200, defaut 50), offset (>= 0)
 */
const getCompanies = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(API_URL, { params: cleanParams(params), signal });
  return response.data;
};

/**
 * GET /api/admin/companies/top-recruiters — entreprises qui recrutent le plus.
 * @param {Object} params { limit: 1-50 (defaut 10) }
 */
const getTopRecruiters = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/top-recruiters`, { params: cleanParams(params), signal });
  return response.data;
};

/**
 * POST /api/admin/companies → 201.
 * @param {Object} data { name, website_url?, logo_url?, description?, primary_filiere_id? }
 */
const createCompany = async (data, { signal } = {}) => {
  const response = await adminApi.post(API_URL, data, { signal });
  return response.data;
};

/** PUT /api/admin/companies/{company_id} — champs fournis uniquement. */
const updateCompany = async (companyId, data, { signal } = {}) => {
  const response = await adminApi.put(`${API_URL}/${encodeURIComponent(companyId)}`, data, { signal });
  return response.data;
};

/** DELETE /api/admin/companies/{company_id} → 204 — soft delete. */
const deleteCompany = async (companyId, { signal } = {}) => {
  await adminApi.delete(`${API_URL}/${encodeURIComponent(companyId)}`, { signal });
  return true;
};

/**
 * POST /api/admin/companies/{target_id}/merge/{source_id}
 * Fusionne `source` dans `target` (reattribution des offres + soft-delete du source).
 * → { message, offers_reassigned, ... }
 */
const mergeCompanies = async (targetId, sourceId, { signal } = {}) => {
  const response = await adminApi.post(
    `${API_URL}/${encodeURIComponent(targetId)}/merge/${encodeURIComponent(sourceId)}`,
    null,
    { signal },
  );
  return response.data;
};

export {
  getCompanies,
  getTopRecruiters,
  createCompany,
  updateCompany,
  deleteCompany,
  mergeCompanies,
};

export default {
  getCompanies,
  getTopRecruiters,
  createCompany,
  updateCompany,
  deleteCompany,
  mergeCompanies,
};
