import adminApi from "./axiosAdmin";
import { cleanParams } from "../utils";

/* Gestion des offres : super_admin + gestionnaire_offres. */

const API_URL = "/api/admin/offers";

/**
 * GET /api/admin/offers — liste complete (y compris masquees/archivees).
 * @param {Object} params q (titre, max 120), filiere_id, source_id,
 *   status ("active"|"expired"|"filled"|"archived"|"en_relecture"|"duplicate"|"brut"),
 *   visible_site (bool), origin ("scraping"|"manuel"|"import"),
 *   limit (1-100, defaut 20), offset (>= 0)
 */
const getOffers = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(API_URL, { params: cleanParams(params), signal });
  return response.data;
};

/** GET /api/admin/offers/{offer_id} — detail complet admin (y compris masque/archive). */
const getOfferById = async (offerId, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/${encodeURIComponent(offerId)}`, { signal });
  return response.data;
};

/**
 * POST /api/admin/offers → 201 — ajout manuel (origin=manuel).
 * @param {Object} data champs OfferCreate (title, company_name, source_code,
 *   filiere_code, location_label, contract_type_code, published_at, intro, missions...)
 */
const createOffer = async (data, { signal } = {}) => {
  const response = await adminApi.post(API_URL, data, { signal });
  return response.data;
};

/** PUT /api/admin/offers/{offer_id} — edition (champs modifiables uniquement). */
const updateOffer = async (offerId, data, { signal } = {}) => {
  const response = await adminApi.put(`${API_URL}/${encodeURIComponent(offerId)}`, data, { signal });
  return response.data;
};

/** PATCH /api/admin/offers/{offer_id}/visibility — body { visible_site: bool }. */
const updateVisibility = async (offerId, visibleSite, { signal } = {}) => {
  const response = await adminApi.patch(`${API_URL}/${encodeURIComponent(offerId)}/visibility`, {
    visible_site: visibleSite,
  }, { signal });
  return response.data;
};

/**
 * PATCH /api/admin/offers/{offer_id}/status — body { status } (enum JobOfferStatus).
 * Valeurs : active | expired | filled | archived | en_relecture | duplicate | brut.
 */
const updateStatus = async (offerId, status, { signal } = {}) => {
  const response = await adminApi.patch(`${API_URL}/${encodeURIComponent(offerId)}/status`, { status }, { signal });
  return response.data;
};

/** DELETE /api/admin/offers/{offer_id} → 204 — suppression logique (soft delete). */
const deleteOffer = async (offerId, { signal } = {}) => {
  await adminApi.delete(`${API_URL}/${encodeURIComponent(offerId)}`, { signal });
  return true;
};

/**
 * POST /api/admin/offers/bulk-status — body { offer_ids: string[] (max 500), status }.
 * → { message: "N offres mises a jour" }
 */
const bulkUpdateStatus = async (offerIds, status, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/bulk-status`, { offer_ids: offerIds, status }, { signal });
  return response.data;
};

/* ─── Doublons proches ───────────────────────────────────────────────── */

/**
 * GET /api/admin/offers/duplicates/candidates — paires suspectes.
 * @param {Object} params { company_id?, min_similarity: 1-100 (defaut 80) }
 * Le header X-Scan-Truncated: true signale un scan tronque (base volumineuse).
 */
const getDuplicateCandidates = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/duplicates/candidates`, {
    params: cleanParams(params),
    signal,
  });
  return response.data;
};

/**
 * POST /api/admin/offers/{offer_b_id}/mark-duplicate
 * body { duplicate_of_id, duplicate_reason? } — marque B comme doublon de A
 * (cycles et a==b refuses par le serveur).
 */
const markDuplicate = async (offerBId, data, { signal } = {}) => {
  const response = await adminApi.post(
    `${API_URL}/${encodeURIComponent(offerBId)}/mark-duplicate`,
    data,
    { signal },
  );
  return response.data;
};

/**
 * POST /api/admin/offers/duplicates/reject — body { offer_a_id, offer_b_id, reason? }.
 * Indique explicitement que la paire n'est PAS un doublon.
 */
const rejectDuplicate = async (data, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/duplicates/reject`, data, { signal });
  return response.data;
};

/* ─── Import en masse ────────────────────────────────────────────────── */

/**
 * POST /api/admin/offers/import (multipart/form-data) — fichier CSV ou JSON.
 * Bornes serveur : 5 Mo max, extensions .csv/.json, MIME csv/json/octet-stream.
 * → { message, created, ignored, errors[] }
 * @param {File} file fichier CSV (.DictReader) ou JSON (liste ou { offers: [...] })
 */
const importOffers = async (file, { signal } = {}) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await adminApi.post(`${API_URL}/import`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    signal,
  });
  return response.data;
};

export {
  getOffers,
  getOfferById,
  createOffer,
  updateOffer,
  updateVisibility,
  updateStatus,
  deleteOffer,
  bulkUpdateStatus,
  getDuplicateCandidates,
  markDuplicate,
  rejectDuplicate,
  importOffers,
};

export default {
  getOffers,
  getOfferById,
  createOffer,
  updateOffer,
  updateVisibility,
  updateStatus,
  deleteOffer,
  bulkUpdateStatus,
  getDuplicateCandidates,
  markDuplicate,
  rejectDuplicate,
  importOffers,
};
