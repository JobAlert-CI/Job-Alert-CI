import adminApi from "../axiosAdmin";
import { cleanParams } from "../utils";

/* Sante du systeme + planification beat + journal evenements + exports de donnees + emails transactionnels. */

/* ─── Sante systeme (super_admin) ────────────────────────────────────── */

/**
 * GET /api/admin/system/health — supervision technique globale.
 * → { database, celery, redis_queues, heartbeat, email_provider, ai_provider, admin_auth, overall_status }
 * - redis_queues.queues porte les VRAIES profondeurs broker LLEN (audit 4, H.3) :
 *   ingestion_depth, ai_depth, emails_depth, default_depth ("N/A" si broker down).
 * - email_provider / ai_provider : sante DERIVEE des echecs en base (audit 4, O.4,
 *   aucun ping) — statuts ok | degraded | warning | disabled.
 * - overall_status : "ok" | "degraded" (celery/redis/providers down) | "error" (base KO).
 */
const getSystemHealth = async ({ signal } = {}) => {
  const response = await adminApi.get("/api/admin/system/health", { signal });
  return response.data;
};

/* ─── Planification Celery beat (super_admin, lecture seule) ──────────── */

/**
 * GET /api/admin/system/schedule — planification effective du beat (audit 4, F.2).
 * → { timezone, scraper_beat_enabled, retry_failed_digests_enabled,
 *     no_offer_email_enabled, entries[] }
 * entries[] : { name, task, queue, label, description, env_key, toggle?,
 *   schedule_kind: "daily"|"interval"|"hourly-range", utc_time?, local_time?,
 *   interval_seconds? }
 */
const getSystemSchedule = async ({ signal } = {}) => {
  const response = await adminApi.get("/api/admin/system/schedule", { signal });
  return response.data;
};

/* ─── Journal des evenements systeme (super_admin, audit 4 G.1) ──────── */

/**
 * GET /api/admin/system/events — derniers evenements systeme (plus recents en tete).
 * Enveloppe paginee honnete : { total, limit, days, events[] }.
 * @param {Object} params
 *   source ("celery"|"email"|"scraping"|"ia"|"api"), severity ("info"|"warning"|"error"|"critical"),
 *   event_type (exact), days (1-90, defaut 7), limit (1-200, defaut 50), offset (>= 0)
 *   ⚠ 400 explicite sur valeur source/severity inconnue (pas une liste vide).
 * events[] : { id, source, severity, event_type, message, context (JSON), created_at }
 */
const getSystemEvents = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get("/api/admin/system/events", {
    params: cleanParams(params),
    signal,
  });
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
  getSystemSchedule,
  getSystemEvents,
  exportOffers,
  exportSubscribers,
  exportSending,
  getTransactionalEmails,
  getTransactionalEmailStats,
  countTransactionalEmails,
};

export default {
  getSystemHealth,
  getSystemSchedule,
  getSystemEvents,
  exportOffers,
  exportSubscribers,
  exportSending,
  getTransactionalEmails,
  getTransactionalEmailStats,
  countTransactionalEmails,
};
