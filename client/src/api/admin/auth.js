import { adminApi, clearStoredTokens, getStoredTokens, setStoredTokens } from "./axiosAdmin";

const API_URL = "/api/admin/auth";

/**
 * POST /api/admin/auth/login → 200 TokenRead
 * @param {Object} data { email, password } — rate-limit 10 essais/min par IP
 *   + 10 echecs/15 min par email cote serveur.
 * Persiste le couple access/refresh dans localStorage.
 */
const login = async (data, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/login`, data, { signal });
  setStoredTokens(response.data);
  return response.data;
};

/**
 * POST /api/admin/auth/refresh → 200 TokenRead
 * Rotation explicite (utile hors interception 401, ex: rafraichissement
 * au chargement de l'app). Le refresh token est a usage unique.
 */
const refresh = async (refreshToken, { signal } = {}) => {
  const body = { refresh_token: refreshToken };
  const response = await adminApi.post(`${API_URL}/refresh`, body, { signal });
  setStoredTokens(response.data);
  return response.data;
};

/**
 * POST /api/admin/auth/logout (Bearer requis)
 * Revoque la famille de refresh tokens cote serveur puis purge le cache
 * local — l'access token JWT reste valide jusqu'a expiration (sans etat).
 */
const logout = async ({ signal } = {}) => {
  try {
    await adminApi.post(`${API_URL}/logout`, null, { signal });
  } finally {
    clearStoredTokens();
  }
  return { message: "Deconnexion reussie" };
};

/** GET /api/admin/auth/me (Bearer requis) → AdminRead */
const getProfile = async ({ signal } = {}) => {
  const response = await adminApi.get(`${API_URL}/me`, { signal });
  return response.data;
};

/**
 * PUT /api/admin/auth/me/password (Bearer requis) — body { current_password, new_password (>= 8) }.
 * Invalide toutes les sessions existantes apres changement.
 */
const changePassword = async (data, { signal } = {}) => {
  const response = await adminApi.put(`${API_URL}/me/password`, data, { signal });
  return response.data;
};

/**
 * POST /api/admin/auth/forgot-password — body { email }.
 * Reponse neutre (anti-enumeration), rate-limit 3/min par IP.
 */
const forgotPassword = async (email, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/forgot-password`, { email }, { signal });
  return response.data;
};

/**
 * POST /api/admin/auth/reset-password — body { token (>= 20), new_password (8-128) }.
 * Token a usage unique, TTL 60 min. Rate-limit 5/min par IP.
 */
const resetPassword = async (data, { signal } = {}) => {
  const response = await adminApi.post(`${API_URL}/reset-password`, data, { signal });
  return response.data;
};

export {
  login,
  refresh,
  logout,
  getProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  // Reexports pratiques pour les pages d'auth admin :
  getStoredTokens,
  clearStoredTokens,
};

export default {
  login,
  refresh,
  logout,
  getProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  getStoredTokens,
  clearStoredTokens,
};
