import axios from "axios"

const TOKEN_KEY = "admin_access_token"
const REFRESH_KEY = "admin_refresh_token"
const ADMIN_USER_KEY = "admin_current_user"

const adminApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  withCredentials: true,
  timeout: 10000,
})

// Injection automatique du token d'accès
adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Intercepteur pour gérer l'expiration du token
adminApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = localStorage.getItem(REFRESH_KEY)
      if (refreshToken) {
        try {
          const res = await axios.post(
            `${import.meta.env.VITE_API_URL || ""}/api/admin/auth/refresh`,
            { refresh_token: refreshToken }
          )
          if (res.data?.access_token) {
            localStorage.setItem(TOKEN_KEY, res.data.access_token)
            if (res.data.refresh_token) {
              localStorage.setItem(REFRESH_KEY, res.data.refresh_token)
            }
            originalRequest.headers.Authorization = `Bearer ${res.data.access_token}`
            return adminApi(originalRequest)
          }
        } catch {
          localStorage.removeItem(TOKEN_KEY)
          localStorage.removeItem(REFRESH_KEY)
          localStorage.removeItem(ADMIN_USER_KEY)
        }
      }
    }
    return Promise.reject(error)
  }
)

export { TOKEN_KEY, REFRESH_KEY, ADMIN_USER_KEY }
export default adminApi
