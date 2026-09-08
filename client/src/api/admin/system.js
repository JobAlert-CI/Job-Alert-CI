import adminApi from "./axiosAdmin";
import { cleanParams } from "../utils";

/* Sante du systeme + exports de donnees + emails transactionnels. */

/* ─── Sante systeme (super_admin) ────────────────────────────────────── */

/**
 * GET /api/admin/system/health — supervision technique globale.
 * → { database, celery, redis_queues, heartbeat, admin_auth, overall_status }
 * overall_status : "ok" | "degraded" (celery down) | "error" (base KO).
 */
const getSystemHealth = async ({ signal } = {}) => {
  const response = await adminApi.get("/api/admin/system/health", { signal });
  return response.data;
};

/* ─── Exports de donnees (CSV/JSON, streaming) ────────────────────────── */

/**
 * Telecharge un export et renvoie le contenu texte (CSV ou JSON texte).
 * Le Content-Disposition est inspecte pour retrouver le nom de fichier.
 * @param {"csv"|"json"} format
 */
const _downloadExport = async (url, params, format = "csv", { signal } = {}) => {
  const response = await adminApi.get(url, {
    params: cleanParams({ ...params, format }),
    responseType: "blob",
    signal,
  });
  const disposition = response.headers?.["content-disposition"] || "";
  const match = /filename="?([^"]+)"?/.exec(disposition);
  return {
    blob: response.data,
    filename: match ? match[1] : "export.csv",
  };
};

/**
 * GET /api/admin/exports/data-export/offers — memes filtres que /api/admin/offers.
 * @param {Object} params status, origin, visible_site, filiere_id, source_id, q
 */
const exportOffers = async (params = {}, format = "csv", { signal } = {}) =>
  _downloadExport("/api/admin/exports/data-export/offers", params, format, { signal });

/**
 * GET /api/admin/exports/data-export/subscribers.
 * @param {Object} params status, city, q, to_email (exact, ou ilike si motif avec %)
 */
const exportSubscribers = async (params = {}, format = "csv", { signal } = {}) =>
  _downloadExport("/api/admin/exports/data-export/subscribers", params, format, { signal });

/**
 * GET /api/admin/exports/data-export/sending — envois avec palier de matching.
 * @param {Object} params status, template_version, match_tier, to_email
 */
const exportSending = async (params = {}, format = "csv", { signal } = {}) =>
  _downloadExport("/api/admin/exports/data-export/sending", params, format, { signal });

/* ─── Emails transactionnels (super_admin + gestionnaire_utilisateurs) ── */

/**
 * GET /api/admin/transactional-emails — historique des emails transactionnels.
 * @param {Object} params purpose ("confirm_email"|"resend_confirmation"|"manage_alert"|"unsubscribe"|"reset_password"),
 *   status ("queued"|"sent"|"failed"), to_email (exact ou ilike si prefixe %),
 *   subscriber_id, limit (1-200, defaut 50), offset (>= 0)
 */
const getTransactionalEmails = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get("/api/admin/transactional-emails", {
    params: cleanParams(params),
    signal,
  });
  return response.data;
};

/**
 * GET /api/admin/transactional-emails/stats — stats des emails
 * transactionnels (cycle 17) pour les compteurs et charts de /admin/logs.
 * @param {Object} params days (1-365, defaut 30) : fenetre des axes par_jour
 *   et du badge echecs_fenetre (days=1 = « aujourd'hui »).
 *   Réponse : { total, par_statut {queued,sent,failed}, par_motif (6 valeurs),
 *   echecs_fenetre, par_jour [{jour,total,par_statut}], days }
 */
const getTransactionalEmailStats = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get("/api/admin/transactional-emails/stats", {
    params: cleanParams(params),
    signal,
  });
  return response.data;
};

/**
 * GET /api/admin/transactional-emails/count — total (meme filtres status/purpose)
 * → { count }
 */
const countTransactionalEmails = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get("/api/admin/transactional-emails/count", {
    params: cleanParams(params),
    signal,
  });
  return response.data;
};

export {
  getSystemHealth,
  exportOffers,
  exportSubscribers,
  exportSending,
  getTransactionalEmails,
  getTransactionalEmailStats,
  countTransactionalEmails,
};

export default {
  getSystemHealth,
  exportOffers,
  exportSubscribers,
  exportSending,
  getTransactionalEmails,
  getTransactionalEmailStats,
  countTransactionalEmails,
};
