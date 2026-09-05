import { Navigate, useLocation } from "react-router-dom"
import { ShieldAlert } from "lucide-react"
import { useAdminAuth } from "@/contexts/AdminAuth.context"
import { roleAutorise } from "@/features/admin-auth.tools"
import { Spinner } from "@/components/ui/spinner"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"

/* ─────────────────────────────────────────────────────────────────────
   Guard d'authentification / de rôles pour les routes /admin/*.

   - Sans session valide → redirection vers /admin/connexion en
     conservant la destination (state.from) pour un retour après login.
   - Rôle insuffisant → écran 403 explicite (jamais un crash ni une
     page blanche). Les rôles reflètent require_roles côté serveur.
   ───────────────────────────────────────────────────────────────────── */

/** Écran de charge initial (session en cours de vérification). */
export const AdminChargement = () => (
  <div
    role="status"
    aria-label="Vérification de la session administrateur"
    className="grid min-h-svh w-full place-items-center bg-background"
  >
    <div className="flex flex-col items-center gap-3">
      <Spinner className="size-6 text-primary" />
      <p className="text-sm text-muted-foreground">Vérification de votre session…</p>
    </div>
  </div>
)

/** Écran 403 : rôle authentifié mais non autorisé pour cette page. */
export const AdminAccesRefuse = ({ roles = [] }) => (
  <Empty className="min-h-svh">
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <ShieldAlert />
      </EmptyMedia>
      <EmptyTitle>Accès refusé</EmptyTitle>
      <EmptyDescription>
        Votre rôle ne permet pas d'accéder à cette page du back-office.
        {roles.length > 0 && (
          <>
            {" "}
            Rôles autorisés : <strong>{roles.join(", ")}</strong>.
          </>
        )}
      </EmptyDescription>
    </EmptyHeader>
  </Empty>
)

/**
 * Protège une page admin : <RequireAdmin roles={[...]}>...</RequireAdmin>
 * - `roles` omis = tous les rôles authentifiés (ex. dashboard, tous rôles)
 * - `roles` fourni = l'un d'eux doit correspondre au rôle du profil
 */
export const RequireAdmin = ({ roles, children }) => {
  const { status, role } = useAdminAuth()
  const location = useLocation()

  if (status === "loading") return <AdminChargement />
  if (status === "unauthenticated") {
    return (
      <Navigate
        to="/admin/connexion"
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  }
  if (!roleAutorise(role, roles)) return <AdminAccesRefuse roles={roles} />
  return children
}

export default RequireAdmin
