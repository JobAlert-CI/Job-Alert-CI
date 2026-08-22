import { createContext, useContext, useEffect, useState } from "react"
import { getAdminProfile, loginAdmin, logoutAdmin } from "@/api/admin/adminAuth.api"
import { ADMIN_USER_KEY, TOKEN_KEY } from "@/api/admin/adminAxios"
import { INITIAL_ADMINS } from "@/api/admin/mockData"
import { ALL_PERMISSIONS } from "@/api/admin/adminUsers.api"

const AdminAuthContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext)
  if (!context) {
    throw new Error("useAdminAuth doit être utilisé sous <AdminAuthProvider>")
  }
  return context
}

export const AdminAuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem(ADMIN_USER_KEY)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return null
      }
    }
    // En développement, si un token existe, initialiser avec le super admin par défaut
    if (localStorage.getItem(TOKEN_KEY)) {
      return INITIAL_ADMINS[0]
    }
    return null
  })

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem(TOKEN_KEY)
      if (token) {
        try {
          const profile = await getAdminProfile()
          setUser(profile)
        } catch {
          // Si le token est invalide
          if (!import.meta.env.DEV) {
            setUser(null)
          }
        }
      }
      setLoading(false)
    }
    initAuth()
  }, [])

  const login = async ({ email, password }) => {
    setLoading(true)
    try {
      const res = await loginAdmin({ email, password })
      const profile = await getAdminProfile()
      const authUser = {
        ...profile,
        role: res.role || profile.role || "super_admin",
      }
      setUser(authUser)
      localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(authUser))
      return authUser
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    await logoutAdmin()
    setUser(null)
  }

  // Vérification granulaire des permissions
  const hasPermission = (permissionId) => {
    if (!user) return false
    // Le Super Admin a tous les pouvoirs par défaut
    if (user.role === "super_admin" || user.role === "admin") return true
    if (Array.isArray(user.permissions)) {
      return user.permissions.includes(permissionId)
    }
    return false
  }

  const isSuperAdmin = Boolean(user && (user.role === "super_admin" || user.role === "admin"))

  // Raccourci pour basculer facilement de rôle en développement
  const switchRole = (targetRole) => {
    if (!import.meta.env.DEV) return
    const template = INITIAL_ADMINS.find((a) => a.role === targetRole) || INITIAL_ADMINS[0]
    const updated = {
      ...template,
      permissions:
        targetRole === "super_admin"
          ? ALL_PERMISSIONS.map((p) => p.id)
          : targetRole === "superviseur"
          ? ["manage_offers", "manage_sources", "trigger_scrape", "manage_logs"]
          : ["manage_offers", "manage_logs"],
    }
    setUser(updated)
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(updated))
    localStorage.setItem(TOKEN_KEY, `mock-token-${targetRole}`)
  }

  const value = {
    user,
    role: user?.role || "super_admin",
    permissions: user?.permissions || [],
    isAuthenticated: Boolean(user),
    isSuperAdmin,
    hasPermission,
    login,
    logout,
    switchRole,
    loading,
  }

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}
