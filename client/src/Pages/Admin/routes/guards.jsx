import { Navigate, Outlet, useLocation } from "react-router-dom"
import { ShieldAlert } from "lucide-react"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import { roleCanAccess } from "@/api/admin/types"

/**
 * Gardes de route (S5).
 * - RequireAdmin : redirection /admin/connexion si non authentifié (mémorise la cible)
 * - RoleGate / PathGate : 403 → écran dédié « Accès refusé pour ce rôle »
 */

export const ForbiddenScreen = ({ path }) => {
  const { user } = useAdminAuth()
  const location = useLocation()
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-error-container">
        <ShieldAlert className="size-8 text-on-error-container" />
      </div>
      <h1 className="font-heading text-2xl font-bold">Accès refusé pour ce rôle</h1>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        Votre rôle actuel{user?.role ? ` (${user.role})` : ""} ne permet pas d'accéder à la page{" "}
        <code className="rounded bg-surface-container px-1.5 py-0.5 text-xs">{path ?? location.pathname}</code>.
        Contactez un super administrateur si vous pensez qu'il s'agit d'une erreur.
      </p>
    </div>
  )
}


/** Garde globale : session obligatoire pour tout /admin sauf /connexion. */
export const RequireAdmin = () => {
  const { isAuthenticated, loading } = useAdminAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-container-low">
        <div className="flex flex-col items-center gap-3">
          <div className="size-9 animate-spin rounded-full border-2 border-brand-navy border-t-transparent" />
          <span className="text-xs font-semibold text-muted-foreground">Vérification de la session…</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/connexion" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

/** Garde par page : liste blanche de rôles autorisés. */
export const RoleGate = ({ roles = [], children }) => {
  const { role, isAuthenticated } = useAdminAuth()
  const location = useLocation()

  if (!isAuthenticated) return <Navigate to="/admin/connexion" replace state={{ from: location.pathname }} />
  if (!roles.includes(role)) return <ForbiddenScreen path={location.pathname} />
  return children
}

/** Garde par chemin : utilise la matrice ROLE_PAGES (sous-routes incluses). */
export const PathGate = ({ path, children }) => {
  const { role, isAuthenticated } = useAdminAuth()
  const location = useLocation()

  if (!isAuthenticated) return <Navigate to="/admin/connexion" replace state={{ from: location.pathname }} />
  if (!roleCanAccess(role, path)) return <ForbiddenScreen path={path} />
  return children
}
