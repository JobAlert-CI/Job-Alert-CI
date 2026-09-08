import adminApi from "./axiosAdmin";
import { cleanParams } from "../utils";

/* Journaux : audit des actions admin, evenements de scraping, messages de contact. */

const API_URL = "/api/admin/logs";

/**
 * GET /api/admin/logs/audit — historique des actions admin.
 * Cycle 16 : enveloppe PAGINEE { items, total, limit, offset } — le total
 * est exact SOUS FILTRES (pagination honnete, plus d'heuristique).
 * @param {Object} params admin_id, action ("creation"|"modification"|"suppression"|
 *   "envoi"|"connexion"|"scraping"), target_table, limit (1-200, defaut 50), offset (>= 0)
 */
const getAuditLogs = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/audit`, { params: cleanParams(params), signal });
  return response.data;
};

/**
 * GET /api/admin/logs/audit/stats — stats du journal (cycle 16).
 * @param {Object} params days (1-365, defaut 30) : fenetre de par_jour/top_auteurs.
 *   Réponse : { total (global), by_action (global), par_jour [{jour,total}],
 *   top_auteurs [{admin_id,nom,email,total}] } — orphelins = « Admin supprimé ».
 */
const getAuditStats = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/audit/stats`, { params: cleanParams(params), signal });
  return response.data;
};

/**
 * GET /api/admin/logs/stats — stats du journal technique (cycle 17).
 * @param {Object} params days (1-365, defaut 30) : fenetre des axes.
 *   Réponse : { events_total, events_errors, events_warnings, events_duplicates,
 *   events_par_jour [{jour,total,par_action}], events_par_action [{action,total}],
 *   contacts_total, contacts_par_statut {new,read,replied,archived,spam} (vocabulaire API), days }
 */
const getLogsStats = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/stats`, { params: cleanParams(params), signal });
  return response.data;
};

/**
 * GET /api/admin/logs/events — evenements d'ingestion.
 * @param {Object} params module ("scraping" seul disponible), level ("info"|"warning"|"error"),
 *   source_id, limit (1-200, defaut 50), offset (>= 0)
 */
const getEventLogs = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/events`, { params: cleanParams(params), signal });
  return response.data;
};

/**
 * GET /api/admin/logs/contacts — messages de contact.
 * @param {Object} params status ("new"|"read"|"replied"|"archived"|"spam"), limit (1-100, defaut 20), offset
 */
const getContactMessages = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/contacts`, { params: cleanParams(params), signal });
  return response.data;
};

/**
 * PATCH /api/admin/logs/contacts/{contact_id}/status — body { status: "new"|"read"|"replied"|"archived"|"spam" }.
 * Cycle 17 : "spam" est desormais assignable. La réponse renvoie le statut
 * STOCKE (valeurs internes : "in_progress" pour read, "closed" pour archived,
 * "spam" identique) — le front affiche via la map STATUTS_CONTACT.
 */
const updateContactStatus = async (contactId, status, { signal } = {}) => {
  const response = await adminApi.patch(
    `${API_URL}/contacts/${encodeURIComponent(contactId)}/status`,
    { status },
    { signal },
  );
  return response.data;
};

export { getAuditLogs, getAuditStats, getLogsStats, getEventLogs, getContactMessages, updateContactStatus };

export default { getAuditLogs, getAuditStats, getLogsStats, getEventLogs, getContactMessages, updateContactStatus };
