import { createContext, useCallback, useContext, useMemo } from "react"
import {
  useAdminSessionQuery,
  useAdminLogoutMutation,
  ADMIN_ROLES,
  getStoredTokens,
} from "@/features/admin-auth.tools"

/* ─────────────────────────────────────────────────────────────────────
   Contexte d'authentification admin.

   Expose l'état de session (status : "loading" | "authenticated" |
   "unauthenticated") et le profil complet de l'admin connecté.
   Un seul provider pour tout le back-office, monté dans App.jsx
   au-dessus des routes /admin/*.

   La révocation de session (refresh refusé serveur) est détectée en
   aval par axiosAdmin → événement "jobalert:admin-session-revoquee"
   (écouté par AdminLayout) : le contexte n'a pas à la porter.
   Les constantes (SESSION_REVOQUEE_MESSAGE, roleAutorise) vivent dans
   features/admin-auth.tools.js (pattern du repo : le contexte
   n'exporte que le hook et le provider).
   ───────────────────────────────────────────────────────────────────── */

const AdminAuthContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error("useAdminAuth doit être utilisé sous <AdminAuthProvider>")
  return ctx
}

export const AdminAuthProvider = ({ children }) => {
  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useAdminSessionQuery()

  const logoutMutation = useAdminLogoutMutation()

  const status = useMemo(() => {
    // localStorage est la source immédiate : sans token, pas de session
    // possible, même si /me est encore en vol (refresh au boot).
    if (!getStoredTokens()?.access_token) return "unauthenticated"
    if (isLoading) return "loading"
    // 401 persistant après refresh KO : l'intercepteur a purgé les tokens.
    if (error) return "unauthenticated"
    if (profile) return "authenticated"
    return "loading"
  }, [profile, isLoading, error])

  const logout = useCallback(() => logoutMutation.mutateAsync(), [logoutMutation])

  const value = useMemo(
    () => ({
      status,
      profile,
      error,
      refetch,
      logout,
      role: profile?.role ?? null,
      isSuperAdmin: profile?.role === ADMIN_ROLES.SUPER_ADMIN,
    }),
    [status, profile, error, refetch, logout]
  )

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}
