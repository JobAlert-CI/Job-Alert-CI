import adminApi from "./axiosAdmin";
import { cleanParams } from "../utils";

/* Pilotage des envois (digests + envois personnalises) :
   super_admin + gestionnaire_utilisateurs. */

const API_URL = "/api/admin/sending";

/**
 * POST /api/admin/sending/prepare → 202 — declenche la phase 1 (preparation des digests).
 * @param {Object} data { subscriber_id?, filiere_code?, date_override? ("YYYY-MM-DD" | Date) }
 * → { status: "dispatched", phase: "prepare", digest_date, task_id }
 */
const triggerPrepare = async (data = {}, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/prepare`, cleanParams(data), { signal });
  return response.data;
};

/**
 * POST /api/admin/sending/send → 202 — declenche la phase 2 (envoi des digests queued).
 * Meme corps que prepare.
 */
const triggerSend = async (data = {}, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/send`, cleanParams(data), { signal });
  return response.data;
};

/**
 * POST /api/admin/sending/run → 202 — pipeline complet (preparation puis envoi).
 * → { status: "dispatched", phases: ["prepare", "send"], digest_date, task_id }
 */
const triggerRun = async (data = {}, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/run`, cleanParams(data), { signal });
  return response.data;
};

/**
 * GET /api/admin/sending/sends — historique des envois.
 * @param {Object} params status ("queued"|"sending"|"sent"|"failed"|"cancelled"|"skipped_empty"),
 *   send_type ("manual" | "v1"), limit (1-100, defaut 20), offset (>= 0)
 */
const getSends = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/sends`, { params: cleanParams(params), signal });
  return response.data;
};

/** GET /api/admin/sending/sends/{send_id} — detail d'un envoi (offres incluses). */
const getSendDetail = async (sendId, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/sends/${encodeURIComponent(sendId)}`, { signal });
  return response.data;
};

/**
 * POST /api/admin/sending/trigger → 201 — mise en file d'envois pour un segment.
 * @param {Object} data { subscriber_id?, filiere_code?, date_override? } — tous optionnels :
 *   sans filtre, tous les abonnes ACTIFS. 404 si aucun abonne correspondant.
 * → liste des EmailDigestRead crees (ceux qui n'existaient pas deja pour la date).
 */
const triggerSegmentSend = async (data = {}, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/trigger`, cleanParams(data), { signal });
  return response.data;
};

/**
 * GET /api/admin/sending/stats — params : period_days (1-365, defaut 30).
 * → { period_days, total_sent, total_failed, total_skipped, success_rate }
 */
const getSendingStats = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/stats`, { params: cleanParams(params), signal });
  return response.data;
};

/**
 * GET /api/admin/sending/tier-stats — distribution des paliers de matching T0-T5.
 * @param {Object} params period_days (1-365, defaut 7)
 * → { period_days, since, until, tier_distribution, match_kind_distribution }
 */
const getTierStats = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/tier-stats`, { params: cleanParams(params), signal });
  return response.data;
};

/**
 * POST /api/admin/sending/preview — apercu HTML du digest SANS envoi.
 * Les parametres passent en query string (pas de corps JSON) :
 * subscriber_id est requis, offer_ids (repete) est facultatif — sans lui, le
 * rendu contient les 5 premieres offres liees aux filieres de l'abonne.
 * @param {Object} params { subscriber_id, offer_ids?: string[] }
 * → { preview: "<html>...", message }
 */
const previewDigest = async (params, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/preview`, null, {
    params: cleanParams(params),
    signal,
  });
  return response.data;
};

export {
  triggerPrepare,
  triggerSend,
  triggerRun,
  getSends,
  getSendDetail,
  triggerSegmentSend,
  getSendingStats,
  getTierStats,
  previewDigest,
};

export default {
  triggerPrepare,
  triggerSend,
  triggerRun,
  getSends,
  getSendDetail,
  triggerSegmentSend,
  getSendingStats,
  getTierStats,
  previewDigest,
};
