import adminApi from "./axiosAdmin";
import { cleanParams } from "../utils";

/* Statistiques abonnés : mêmes rôles que le router subscribers
   (super_admin + gestionnaire_utilisateurs). Créés au cycle 7 pour
   les compteurs/charts de la page Abonnés (doc v3 §7). */

const API_URL = "/api/admin/subscribers/stats";

/**
 * GET /api/admin/subscribers/stats/overview
 * → { total, by_status: {active, unsubscribed, bouncing, paused,
 *    pending, deleted}, by_source: {…}, without_filiere }
 */
const getSubscribersOverview = async ({ signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/overview`, { signal });
  return response.data;
};

/**
 * GET /api/admin/subscribers/stats/subscriptions-by-day?days=30
 * → [{ day: "2026-09-04", count: 3 }] (jours sans inscription omis).
 */
const getSubscriptionsByDay = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/subscriptions-by-day`, {
    params: cleanParams(params),
    signal,
  });
  return response.data;
};

/**
 * GET /api/admin/subscribers/stats/top-filieres?limit=10
 * → [{ filiere_id, code, label, subscribers_count }]
 */
const getTopFilieres = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/top-filieres`, {
    params: cleanParams(params),
    signal,
  });
  return response.data;
};

/**
 * GET /api/admin/subscribers/stats/growth?days=90
 * → [{ day, cumulative_count }] — cumul part du total historique.
 */
const getSubscribersGrowth = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/growth`, {
    params: cleanParams(params),
    signal,
  });
  return response.data;
};

/**
 * GET /api/admin/subscribers/stats/by-city?limit=10
 * → [{ city: "Abidjan" | "Non renseignee", count }]
 */
const getSubscribersByCity = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/by-city`, {
    params: cleanParams(params),
    signal,
  });
  return response.data;
};

/**
 * GET /api/admin/subscribers/stats/top-contract-types?limit=10
 * → [{ contract_type_id, code, label, subscribers_count }]
 */
const getTopContractTypes = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/top-contract-types`, {
    params: cleanParams(params),
    signal,
  });
  return response.data;
};

/**
 * GET /api/admin/subscribers/stats/sends-by-day?days=30
 * → [{ day, sent, failed, skipped_empty, queued }]
 */
const getSendsByDay = async (params = {}, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/sends-by-day`, {
    params: cleanParams(params),
    signal,
  });
  return response.data;
};

/**
 * GET /api/admin/subscribers/stats/matching-offers-count/{subscriber_id}
 * → { total, by_filiere: [{ filiere_id, active_offers_count }] }
 * Nombre d'offres actives correspondant aux filières de l'abonné —
 * réponse au cas support « pourquoi je ne reçois rien ? ».
 */
const getMatchingOffersCount = async (subscriberId, { signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/matching-offers-count/${encodeURIComponent(subscriberId)}`, { signal });
  return response.data;
};

export {
  getSubscribersOverview,
  getSubscriptionsByDay,
  getTopFilieres,
  getSubscribersGrowth,
  getSubscribersByCity,
  getTopContractTypes,
  getSendsByDay,
  getMatchingOffersCount,
};

export default {
  getSubscribersOverview,
  getSubscriptionsByDay,
  getTopFilieres,
  getSubscribersGrowth,
  getSubscribersByCity,
  getTopContractTypes,
  getSendsByDay,
  getMatchingOffersCount,
};
