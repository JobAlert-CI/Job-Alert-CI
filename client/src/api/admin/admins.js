import adminApi from "./axiosAdmin";
import { cleanParams } from "../utils";

/* Gestion des comptes administrateurs : super_admin uniquement. */

const API_URL = "/api/admin/admins";

/**
 * GET /api/admin/admins
 * @param {Object} params q (recherche email/nom, cycle 15), role ("super_admin"|"gestionnaire_offres"|"gestionnaire_utilisateurs"|"moderateur"),
 *   is_active (bool), limit (1-200, defaut 50), offset (>= 0)
 */
const getAdmins = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(API_URL, { params: cleanParams(params), signal });
  return response.data;
};

/**
 * POST /api/admin/admins → 201.
 * @param {Object} data { email, password? (8-128 ; absent = mot de passe
 *   TEMPORAIRE genere serveur, renvoye une seule fois dans
 *   `temporary_password`, changement obligatoire a la premiere connexion),
 *   full_name (2-180), role? (defaut "moderateur") }
 */
const createAdmin = async (data, { signal } = {}) => {
  const response = await adminApi.post(API_URL, data, { signal });
  return response.data;
};

/** GET /api/admin/admins/{admin_id}. */
const getAdmin = async (adminId, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/${encodeURIComponent(adminId)}`, { signal });
  return response.data;
};

/** PUT /api/admin/admins/{admin_id} — body { email?, full_name?, is_active? } (auto-desactivation interdite). */
const updateAdmin = async (adminId, data, { signal } = {}) => {
  const response = await adminApi.put(`${API_URL}/${encodeURIComponent(adminId)}`, data, { signal });
  return response.data;
};

/**
 * PATCH /api/admin/admins/{admin_id}/role — body { role }.
 * Le serveur refuse de retirer son propre role super_admin.
 */
const updateAdminRole = async (adminId, role, { signal } = {}) => {
  const response = await adminApi.patch(`${API_URL}/${encodeURIComponent(adminId)}/role`, { role }, { signal });
  return response.data;
};

/**
 * PATCH /api/admin/admins/{admin_id}/status — bascule active/inactive (sans corps).
 * Le serveur refuse le changement de statut de son propre compte.
 */
const toggleAdminStatus = async (adminId, { signal } = {}) => {
  const response = await adminApi.patch(`${API_URL}/${encodeURIComponent(adminId)}/status`, null, { signal });
  return response.data;
};

/** DELETE /api/admin/admins/{admin_id} → 204. */
const deleteAdmin = async (adminId, { signal } = {}) => {
  await adminApi.delete(`${API_URL}/${encodeURIComponent(adminId)}`, { signal });
  return true;
};

export {
  getAdmins,
  createAdmin,
  getAdmin,
  updateAdmin,
  updateAdminRole,
  toggleAdminStatus,
  deleteAdmin,
};

export default {
  getAdmins,
  createAdmin,
  getAdmin,
  updateAdmin,
  updateAdminRole,
  toggleAdminStatus,
  deleteAdmin,
};
