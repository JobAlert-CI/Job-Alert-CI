import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { getAdminProfile, loginAdmin, logoutAdmin } from "@/api/admin/adminAuth.api"
import { tokenStorage } from "@/api/admin/adminAxios"
import { ADMIN_ROLES, ROLE_PAGES } from "@/api/admin/types"

/**
 * Store de session admin (S3).
 * - access_token + refresh_token gérés par tokenStorage (cf. adminAxios)
 * - profil résolu via GET /auth/me
 * - logout → POST /auth/logout puis purge locale
 * - écoute l'événement `admin:session-expired` émis par l'intercepteur 401
 */

const AdminAuthContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext)
  if (!context) {
    throw new Error("useAdminAuth doit être utilisé sous <AdminAuthProvider>")
  }
  return context
}

const cachedUser = () => {
  try {
    const saved = localStorage.getItem("admin_current_user")
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

export const AdminAuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => (tokenStorage.access ? cachedUser() : null))
  const [loading, setLoading] = useState(() => Boolean(tokenStorage.access))

  // Résolution du profil au démarrage si un token existe
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      if (!tokenStorage.access) {
        setLoading(false)
        return
      }
      try {
        const profile = await getAdminProfile()
        if (!cancelled) {
          setUser(profile)
          localStorage.setItem("admin_current_user", JSON.stringify(profile))
        }
      } catch {
        if (!cancelled && !import.meta.env.DEV) {
          tokenStorage.clear()
          setUser(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [])

  // Session expirée côté intercepteur HTTP → retour à l'écran de connexion
  useEffect(() => {
    const onExpired = () => {
      setUser(null)
      localStorage.removeItem("admin_current_user")
      window.location.assign("/admin/connexion?expired=1")
    }
    window.addEventListener("admin:session-expired", onExpired)
    return () => window.removeEventListener("admin:session-expired", onExpired)
  }, [])

  const login = useCallback(async ({ email, password }) => {
    setLoading(true)
    try {
      const tokens = await loginAdmin({ email, password })
      const profile = await getAdminProfile()
      const authUser = {
        ...profile,
        id: profile.id || tokens.admin_id,
        role: profile.role || tokens.role || ADMIN_ROLES.SUPER_ADMIN,
      }
      setUser(authUser)
      localStorage.setItem("admin_current_user", JSON.stringify(authUser))
      return authUser
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await logoutAdmin()
    setUser(null)
  }, [])

  /** @type {(role: import("@/api/admin/types").AdminRole | string) => boolean} */
  const hasRole = useCallback(
    (...roles) => Boolean(user?.is_active !== false && roles.includes(user?.role)),
    [user]
  )

  const canAccessPath = useCallback(
    (path) => (user ? ROLE_PAGES[user.role]?.includes(path) || ROLE_PAGES[user.role] === "*" : false),
    [user]
  )

  const value = useMemo(
    () => ({
      user,
      role: user?.role ?? null,
      isAuthenticated: Boolean(user),
      isSuperAdmin: user?.role === ADMIN_ROLES.SUPER_ADMIN,
      hasRole,
      canAccessPath,
      login,
      logout,
      loading,
    }),
    [user, hasRole, canAccessPath, login, logout, loading]
  )

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}
