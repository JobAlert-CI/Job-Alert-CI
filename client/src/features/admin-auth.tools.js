import { useMutation, useQuery } from "@tanstack/react-query"
import { getStoredTokens, clearStoredTokens } from "@/api/admin/axiosAdmin"
import { login as apiLogin, logout as apiLogout, getProfile } from "@/api/admin/auth"
import { queryClient } from "@/lib/queryClient"

/* ─────────────────────────────────────────────────────────────────────
   Session admin : hooks TanStack + constantes de rôles.

   Les valeurs de rôles reflètent EXACTEMENT l'enum serveur
   (`models.admin.AdminRole`) : super_admin, gestionnaire_offres,
   gestionnaire_utilisateurs, moderateur. Ne jamais inventer de valeur.
   Cf. server/api/deps.py::require_roles.
   ───────────────────────────────────────────────────────────────────── */

export const ADMIN_ROLES = {
  SUPER_ADMIN: "super_admin",
  GESTIONNAIRE_OFFRES: "gestionnaire_offres",
  GESTIONNAIRE_UTILISATEURS: "gestionnaire_utilisateurs",
  MODERATEUR: "moderateur",
}

/** Libellés d'affichage des rôles (badges, menus). */
export const ROLE_LABELS = {
  [ADMIN_ROLES.SUPER_ADMIN]: "Super admin",
  [ADMIN_ROLES.GESTIONNAIRE_OFFRES]: "Gestionnaire offres",
  [ADMIN_ROLES.GESTIONNAIRE_UTILISATEURS]: "Gestionnaire utilisateurs",
  [ADMIN_ROLES.MODERATEUR]: "Modérateur",
}

/** Message affiché quand la famille de refresh tokens a été révoquée. */
export const SESSION_REVOQUEE_MESSAGE =
  "Votre session a été fermée pour des raisons de sécurité. Veuillez vous reconnecter."

/** Un rôle satisfait une liste vide (tous rôles) ou une liste qui le contient. */
export const roleAutorise = (role, rolesAutorises) =>
  !rolesAutorises?.length || rolesAutorises.includes(role)

/* ─── Clés de cache ─────────────────────────────────────────────────── */

export const adminAuthKeys = {
  root: ["admin", "auth"],
  session: ["admin", "auth", "session"],
}

/* ─── Session courante ──────────────────────────────────────────────── */

/**
 * Profil admin courant (GET /api/admin/auth/me).
 * La présence d'un couple de tokens en localStorage conditionne la
 * requête : sans token, pas d'appel réseau (état "deconnecte").
 * Si /me renvoie 401 (token expiré + refresh KO), l'intercepteur
 * axiosAdmin a déjà purgé les tokens : on aboutit à unauthenticated.
 */
export const useAdminSessionQuery = () =>
  useQuery({
    queryKey: adminAuthKeys.session,
    queryFn: ({ signal }) => getProfile({ signal }),
    enabled: !!getStoredTokens()?.access_token,
    staleTime: 5 * 60 * 1000,
    retry: false,
    // Sur refus réseau/serveur on garde la valeur par défaut de retry=false
    // pour ne pas bombarder /me pendant une session incertaine.
  })

/* ─── Mutations ─────────────────────────────────────────────────────── */

/**
 * Connexion admin. La réponse login ne contient PAS le profil complet
 * (cf. fixture adminAuth.login : seul le couple token + role) : /me reste
 * la source de vérité, on invalide et laisse la page cible refetcher.
 */
export const useAdminLoginMutation = () =>
  useMutation({
    mutationFn: ({ email, password }) => apiLogin({ email, password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAuthKeys.root })
    },
  })

/**
 * Déconnexion : appel serveur (révocation de la famille de refresh),
 * purge complète du cache TanStack (convention admin du prompt §4) et
 * nettoyage localStorage. `queryClient.clear()` survit aux composants :
 * la navigation vers /admin/connexion se fait dans le composant.
 */
export const useAdminLogoutMutation = () =>
  useMutation({
    mutationFn: () => apiLogout(),
    onMutate: () => {
      // Purge du cache AVANT l'appel réseau : même si le serveur est
      // injoignable, l'état local est déjà cohérent avec une session fermée.
      queryClient.clear()
      clearStoredTokens()
    },
    onSettled: () => {
      // L'appel serveur a pu échouer (réseau) : les tokens sont déjà purgés,
      // rien d'autre à faire ici — la navigation est gérée par le layout.
    },
  })

/** Accès direct (hors React) au couple de tokens pour les guards. */
export { getStoredTokens, clearStoredTokens }
