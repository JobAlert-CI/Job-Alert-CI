import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getAdmins, createAdmin, updateAdmin, updateAdminRole, toggleAdminStatus, deleteAdmin,
} from "@/api/admin/admins"
import { formatApiError } from "@/api/errors"

/* ─────────────────────────────────────────────────────────────────────
   Page Gestion des administrateurs (/admin/administrateurs) — hooks
   TanStack (cycle 15, doc v3 §15).

   super_admin uniquement. Quatre garde-fous serveur (400) contre
   l'auto-sabotage : le front les grise sur sa propre ligne.
   - PUT is_active=false sur soi  - PATCH /role sur soi
   - PATCH /status sur soi        - DELETE sur soi

   Cycle 15 — vocabulaire vérifié :
   - q : recherche ilike email + nom complet (ajouté ce cycle) ;
   - POST sans password → mot de passe TEMPORAIRE renvoyé UNE seule
     fois (201, `temporary_password`) + must_change_password=true,
     changement obligatoire à la première connexion (PUT /me/password
     remet le flag à false) ;
   - DELETE préserve les entrées du journal (FK SET NULL) : le log de
     suppression consigne email/nom/rôle de l'admin supprimé.

   Cache : liste petite et sensible → staleTime 60 s ; invalidation
   après chaque mutation, y compris la session ["admin","auth"] quand
   un admin modifie SON propre compte (le /me du layout en dépend).
   ───────────────────────────────────────────────────────────────────── */

export const adminAdministrateursKeys = {
  root: ["admin", "administrateurs"],
}

/** Message d'erreur lisible — via formatApiError (422 FastAPI = tableau, jamais un objet brut dans React ; bug latent documenté cycle 15). */
export const messageErreurAdmin = (err) => formatApiError(err) || "Action impossible"

const useInvalidateAdministrateurs = () => {
  const queryClient = useQueryClient()
  return (adminIdModifie) => {
    queryClient.invalidateQueries({ queryKey: adminAdministrateursKeys.root })
    // Si l'admin connecté modifie son propre profil, la session (/me)
    // doit être rafraîchie (nom affiché dans le layout).
    if (adminIdModifie) {
      queryClient.invalidateQueries({ queryKey: ["admin", "auth"] })
    }
  }
}

/** Liste filtrée (q, role, is_active, pagination offset). */
export const useAdminAdministrateursQuery = (params) =>
  useQuery({
    queryKey: [...adminAdministrateursKeys.root, params],
    queryFn: ({ signal }) => getAdmins(params, { signal }),
    staleTime: 60 * 1000,
    retry: 1,
  })

/** Création — sans password : le serveur renvoie `temporary_password`. */
export const useCreateAdministrateur = () => {
  const invalidate = useInvalidateAdministrateurs()
  return useMutation({ mutationFn: (data) => createAdmin(data), onSuccess: invalidate })
}

/** Édition (email, nom, is_active — auto-désactivation bloquée serveur). */
export const useUpdateAdministrateur = () => {
  const invalidate = useInvalidateAdministrateurs()
  return useMutation({
    mutationFn: ({ id, data }) => updateAdmin(id, data),
    onSuccess: (_data, variables) => invalidate(variables?.moiMeme ? variables.id : null),
  })
}

/** Changement de rôle (retrait de son propre super_admin bloqué serveur). */
export const useChangerRoleAdministrateur = () => {
  const invalidate = useInvalidateAdministrateurs()
  return useMutation({
    mutationFn: ({ id, role }) => updateAdminRole(id, role),
    onSuccess: (_data, variables) => invalidate(variables?.moiMeme ? variables.id : null),
  })
}

/** Bascule active/inactive rapide (sans corps — refusé sur soi). */
export const useBasculeStatutAdministrateur = () => {
  const invalidate = useInvalidateAdministrateurs()
  return useMutation({
    mutationFn: (id) => toggleAdminStatus(id),
    onSuccess: () => invalidate(null),
  })
}

/** Suppression définitive — le journal d'activité est PRÉSERVÉ (SET NULL). */
export const useSupprimerAdministrateur = () => {
  const invalidate = useInvalidateAdministrateurs()
  return useMutation({ mutationFn: (id) => deleteAdmin(id), onSuccess: invalidate })
}
