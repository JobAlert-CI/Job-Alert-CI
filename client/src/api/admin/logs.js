import adminApi from "./axiosAdmin";
import { cleanParams } from "../utils";

/* Journaux : audit des actions admin, evenements de scraping, messages de contact. */

const API_URL = "/api/admin/logs";

/**
 * GET /api/admin/logs/audit — historique des actions admin.
 * @param {Object} params admin_id, action ("creation"|"modification"|...),
 *   target_table, limit (1-200, defaut 50), offset (>= 0)
 */
const getAuditLogs = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/audit`, { params: cleanParams(params), signal });
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
 * @param {Object} params status ("new"|"read"|"replied"|"archived"), limit (1-100, defaut 20), offset
 */
const getContactMessages = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/contacts`, { params: cleanParams(params), signal });
  return response.data;
};

/**
 * PATCH /api/admin/logs/contacts/{contact_id}/status — body { status: "new"|"read"|"replied"|"archived" }.
 */
const updateContactStatus = async (contactId, status, { signal } = {}) => {
  const response = await adminApi.patch(
    `${API_URL}/contacts/${encodeURIComponent(contactId)}/status`,
    { status },
    { signal },
  );
  return response.data;
};

export { getAuditLogs, getEventLogs, getContactMessages, updateContactStatus };

export default { getAuditLogs, getEventLogs, getContactMessages, updateContactStatus };
