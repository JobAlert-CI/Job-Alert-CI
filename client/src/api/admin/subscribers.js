import adminApi from "./axiosAdmin";
import { cleanParams } from "../utils";

/* Gestion des abonnes : super_admin + gestionnaire_utilisateurs. */

const API_URL = "/api/admin/subscribers";

/**
 * GET /api/admin/subscribers — liste avec filtres.
 * @param {Object} params q (email ou nom), status
 *   ("active"|"unsubscribed"|"bouncing"|"paused"|"pending"|"deleted"),
 *   filiere_id, limit (1-100, defaut 20), offset (>= 0)
 */
const getSubscribers = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(API_URL, { params: cleanParams(params), signal });
  return response.data;
};

/** GET /api/admin/subscribers/{subscriber_id} — profil, filieres, preferences. */
const getSubscriber = async (subscriberId, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/${encodeURIComponent(subscriberId)}`, { signal });
  return response.data;
};

/**
 * PUT /api/admin/subscribers/{subscriber_id} — edition (champs fournis uniquement).
 * @param {Object} data { full_name?, city?, admin_notes?, wants_career_tips? }
 */
const updateSubscriber = async (subscriberId, data, { signal } = {}) => {
  const response = await adminApi.put(`${API_URL}/${encodeURIComponent(subscriberId)}`, data, { signal });
  return response.data;
};

/**
 * PATCH /api/admin/subscribers/{subscriber_id}/status — body { status, reason? }.
 * status : "active" | "unsubscribed" | "bouncing" | "paused"
 * (les mots "bouncing"/"paused" sont traduits cote serveur vers l'enum interne).
 */
const updateSubscriberStatus = async (subscriberId, status, reason = null, { signal } = {}) => {
  const response = await adminApi.patch(
    `${API_URL}/${encodeURIComponent(subscriberId)}/status`,
    cleanParams({ status, reason }),
    { signal },
  );
  return response.data;
};

/**
 * GET /api/admin/subscribers/{subscriber_id}/sends — historique des envois
 * pour un abonne (digests + envois personnalises). params : limit (1-100, defaut 20).
 */
const getSubscriberSends = async (subscriberId, params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/${encodeURIComponent(subscriberId)}/sends`, {
    params: cleanParams(params),
    signal,
  });
  return response.data;
};

/**
 * POST /api/admin/subscribers/{subscriber_id}/send → 201 — envoi personnalise.
 * @param {Object} data { offer_ids: string[] (min 1), subject? (max 255) }
 * Met en file un digest manuel (template_version="manual").
 */
const sendCustomEmail = async (subscriberId, data, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/${encodeURIComponent(subscriberId)}/send`, data, { signal });
  return response.data;
};

/** DELETE /api/admin/subscribers/{subscriber_id} → 204 — anonymisation RGPD (pas de suppression physique). */
const deleteSubscriber = async (subscriberId, { signal } = {}) => {
  await adminApi.delete(`${API_URL}/${encodeURIComponent(subscriberId)}`, { signal });
  return true;
};

export {
  getSubscribers,
  getSubscriber,
  updateSubscriber,
  updateSubscriberStatus,
  getSubscriberSends,
  sendCustomEmail,
  deleteSubscriber,
};

export default {
  getSubscribers,
  getSubscriber,
  updateSubscriber,
  updateSubscriberStatus,
  getSubscriberSends,
  sendCustomEmail,
  deleteSubscriber,
};
