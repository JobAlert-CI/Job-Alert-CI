import axios from "axios"

/**
 * Client HTTP admin (S2).
 * - baseURL : /api/admin (les modules d'API appellent des chemins relatifs)
 * - header Authorization: Bearer <access_token> injecté automatiquement
 * - 401 → POST /auth/refresh → rejeu de la requête initiale
 * - 403 → erreur marquée `isForbidden` ("Accès refusé pour ce rôle")
 */

const TOKEN_KEY = "admin_access_token"
const REFRESH_KEY = "admin_refresh_token"
const ADMIN_USER_KEY = "admin_current_user"

const API_ROOT = import.meta.env.VITE_API_URL || ""

export const buildUrl = (path) => `${API_ROOT}/api/admin${path}`

const adminApi = axios.create({
  baseURL: `${API_ROOT}/api/admin`,
  withCredentials: true,
  timeout: 15000,
})

/* ─── Accès direct au storage (utilisé par le store de session) ─── */
export const tokenStorage = {
  get access() {
    return localStorage.getItem(TOKEN_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  save({ access_token, refresh_token }) {
    if (access_token) localStorage.setItem(TOKEN_KEY, access_token)
    if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token)
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(ADMIN_USER_KEY)
  },
}

/* Injection automatique du token d'accès */
adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/* File d'attente : une seule tentative de refresh à la fois */
let refreshPromise = null

const refreshTokens = async () => {
  const refreshToken = localStorage.getItem(REFRESH_KEY)
  if (!refreshToken) throw new Error("no_refresh_token")

  // Requête volontairement hors instance (pas d'intercepteur, pas de boucle)
  const { data } = await axios.post(buildUrl("/auth/refresh"), {
    refresh_token: refreshToken,
  })

  localStorage.setItem(TOKEN_KEY, data.access_token)
  if (data.refresh_token) {
    localStorage.setItem(REFRESH_KEY, data.refresh_token)
  }
  return data.access_token
}

adminApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {}
    const status = error.response?.status

    // Session expirée : refresh puis rejeu (une seule fois par requête)
    if (status === 401 && !originalRequest._retry && !String(originalRequest.url || "").includes("/auth/")) {
      originalRequest._retry = true
      try {
        refreshPromise = refreshPromise || refreshTokens()
        const newToken = await refreshPromise
        refreshPromise = null
        originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${newToken}` }
        return adminApi(originalRequest)
      } catch {
        refreshPromise = null
        tokenStorage.clear()
        error.isSessionExpired = true
        // Notifie le store de session (écouteur posé par AdminAuth.context)
        window.dispatchEvent(new CustomEvent("admin:session-expired"))
        return Promise.reject(error)
      }
    }

    // Rôle insuffisant : marqué pour affichage dédié côté pages
    if (status === 403) {
      error.isForbidden = true
      error.message = "Accès refusé pour ce rôle"
    }

    return Promise.reject(error)
  }
)

/** Extrait un message d'erreur lisible depuis une erreur axios. */
export const extractErrorMessage = (error, fallback = "Une erreur est survenue") => {
  const detail = error?.response?.data?.detail
  if (typeof detail === "string") return detail
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg)
  if (error?.isForbidden) return "Accès refusé pour ce rôle"
  return fallback
}

export { TOKEN_KEY, REFRESH_KEY, ADMIN_USER_KEY }
export default adminApi
