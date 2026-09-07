import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getAdmins, createAdmin, updateAdmin, updateAdminRole, toggleAdminStatus, deleteAdmin,
} from "@/api/admin/admins"

/* ─────────────────────────────────────────────────────────────────────
   Page Gestion des administrateurs (/admin/administrateurs) — hooks.

   super_admin uniquement. Page la plus sensible du back-office :
   QUATRE garde-fous serveur anti auto-sabotage (vérifiés admins.py,
   tous → 400) :
   1. PUT /{id} is_active=false sur SOI-MÊME interdit ;
   2. PATCH /{id}/role retirant son propre super_admin interdit ;
   3. PATCH /{id}/status sur SOI-MÊME interdit ;
   4. DELETE sur SOI-MÊME interdit.
   Le FRONT grille visuellement ces actions sur sa propre ligne (doc
   v3 §15 point d'attention : griser plutôt que laisser récolter le 400)
   — les hooks servent le comportement, la page décide du grisé.

   Vocabulaire rôles (Literal serveur) : super_admin,
   gestionnaire_offres, gestionnaire_utilisateurs, moderateur.

   Cache : liste courte quasi statique → staleTime 5 min ;
   invalidation après mutation, y compris le profil d'authentification
   (AdminAuthContext garde le rôle courant en cache : si JE change mon
   propre nom/email, la sidebar doit suivre).
   ───────────────────────────────────────────────────────────────────── */

export const adminAdminsKeys = {
  root: ["admin", "admins"],
}

/** Erreur → message lisible (400 garde-fous serveur = phrases claires). */
export const messageErreurAdmins = (err) =>
  err?.response?.data?.detail || err?.message || "Action impossible"

const useInvalidateAdmins = () => {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: adminAdminsKeys.root })
    // Le profil admin courant (AdminAuthContext) peut bouger si on
    // édite son propre compte (nom/email) — la sidebar suit.
    queryClient.invalidateQueries({ queryKey: ["admin", "auth", "profile"] })
  }
}

export const useAdminAdminsQuery = (params = {}) =>
  useQuery({
    queryKey: [...adminAdminsKeys.root, params],
    queryFn: ({ signal }) => getAdmins(params, { signal }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

export const useCreateAdmin = () => {
  const invalidate = useInvalidateAdmins()
  return useMutation({ mutationFn: (data) => createAdmin(data), onSuccess: invalidate })
}

/** Édition email/nom/statut — auto-désactivation refusée serveur (400). */
export const useUpdateAdmin = () => {
  const invalidate = useInvalidateAdmins()
  return useMutation({
    mutationFn: ({ id, data }) => updateAdmin(id, data),
    onSuccess: invalidate,
  })
}

/** Changement de rôle — retrait de son propre super_admin refusé serveur (400). */
export const useChangerRoleAdmin = () => {
  const invalidate = useInvalidateAdmins()
  return useMutation({
    mutationFn: ({ id, role }) => updateAdminRole(id, role),
    onSuccess: invalidate,
  })
}

/** Bascule active/inactive rapide (sans corps) — sur soi-même refusé serveur (400). */
export const useBasculerStatutAdmin = () => {
  const invalidate = useInvalidateAdmins()
  return useMutation({
    mutationFn: (id) => toggleAdminStatus(id),
    onSuccess: invalidate,
  })
}

export const useSupprimerAdmin = () => {
  const invalidate = useInvalidateAdmins()
  return useMutation({ mutationFn: (id) => deleteAdmin(id), onSuccess: invalidate })
}
