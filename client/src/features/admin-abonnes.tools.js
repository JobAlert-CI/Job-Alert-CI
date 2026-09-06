import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getSubscribers, getSubscriber, getSubscriberSends,
  updateSubscriber, updateSubscriberStatus, deleteSubscriber,
} from "@/api/admin/subscribers"
import { isCanceledError } from "@/api/errors"

/* ─────────────────────────────────────────────────────────────────────
   Gestion des abonnés : hooks TanStack (liste, détail, mutations).

   Router /api/admin/subscribers : super_admin + gestionnaire_utilisateurs.

   ⚠ VOCABULAIRE API ≠ base (doc v3 §7 + STATUS_ALIASES serveur) :
   le filtre/affichage utilise TOUJOURS les valeurs API
   active | unsubscribed | bouncing | paused | pending | deleted
   — la base stocke bounced, le serveur traduit. Jamais "bounced"
   côté frontend.

   Shapes réelles (vérifiées API live 2026-09-05) :
   - GET /subscribers?q&status&filiere_id&limit&offset → liste plate :
     { id, email, full_name, city, status, timezone, source,
       wants_career_tips, filiere_links: [{ id, filiere_id,
       priority, created_at, updated_at }], contract_preferences,
       subscribed_at, created_at, updated_at }
   - GET /{id} → même shape (détail complet).
   - GET /{id}/sends → EmailDigestRead[] triés récent→ancien :
     { id, status, subject, offer_count, offer_links, digest_date,
       scheduled_for, sent_at, skipped_reason, template_version, … }
   - PUT /{id} → SubscriberAdminUpdate TOUT optionnel :
     full_name, city, admin_notes, wants_career_tips.
     (Ne touche JAMAIS aux filières — choix du candidat, doc v3 §8.)
   - PATCH /{id}/status { status, reason? } → alias traduits serveur
     (bouncing→BOUNCED) ; unsubscribed enregistre raison + date.
   - DELETE /{id} → anonymisation RGPD : email remplacé par
     deleted_{id}@anonymized.local, nom/notes effacés, statut deleted.
     L'historique d'envois RESTE intact (doc v3 §8).
   ───────────────────────────────────────────────────────────────────── */

export const STATUTS_ABONNE = [
  { valeur: "active", libelle: "Actif" },
  { valeur: "unsubscribed", libelle: "Désinscrit" },
  { valeur: "bouncing", libelle: "En rebond" },
  { valeur: "paused", libelle: "En pause" },
  { valeur: "pending", libelle: "En attente" },
  { valeur: "deleted", libelle: "Supprimé (anonymisé)" },
]

export const adminSubscribersKeys = {
  root: ["admin", "subscribers"],
  liste: (params) => ["admin", "subscribers", "liste", params],
  detail: (id) => ["admin", "subscribers", "detail", id],
  sends: (id, params) => ["admin", "subscribers", "sends", id, params],
}

/* ─── Liste (filtres serveur, pagination heuristique) ───────────────── */

export const useAdminSubscribersQuery = (params) =>
  useQuery({
    queryKey: adminSubscribersKeys.liste(params),
    queryFn: ({ signal }) => getSubscribers(params, { signal }),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    retry: 1,
  })

/* ─── Détail + historique d'envois ──────────────────────────────────── */

export const useAdminSubscriberDetailQuery = (subscriberId, { enabled = true } = {}) =>
  useQuery({
    queryKey: adminSubscribersKeys.detail(subscriberId),
    queryFn: ({ signal }) => getSubscriber(subscriberId, { signal }),
    enabled: !!subscriberId && enabled,
    staleTime: 60 * 1000,
  })

export const useAdminSubscriberSendsQuery = (subscriberId, params = { limit: 50 }) =>
  useQuery({
    queryKey: adminSubscribersKeys.sends(subscriberId, params),
    queryFn: ({ signal }) => getSubscriberSends(subscriberId, params, { signal }),
    enabled: !!subscriberId,
    staleTime: 30 * 1000,
  })

/* ─── Mutations ─────────────────────────────────────────────────────── */

/** Édition administrative — PUT /{id} (nom, ville, notes, conseils). */
export const useModifierAbonne = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ subscriberId, data }) => updateSubscriber(subscriberId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminSubscribersKeys.root })
    },
  })
}

/**
 * Changement de statut — PATCH /{id}/status { status, reason? }.
 * `reason` utilisé pour unsubscribed (motif de désinscription).
 */
export const useChangerStatutAbonne = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ subscriberId, status, raison }) =>
      updateSubscriberStatus(subscriberId, status, raison ?? null),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminSubscribersKeys.root }),
  })
}

/**
 * Anonymisation RGPD — DELETE /{id} → 204.
 * L'UI DOIT dire « anonymiser » (email/nom/notes effacés, historique
 * conservé), jamais « supprimer définitivement » (doc v3 §8).
 */
export const useAnonymiserAbonne = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (subscriberId) => deleteSubscriber(subscriberId),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminSubscribersKeys.root }),
  })
}

/** Erreur mutation formatée (annulations ignorées). */
export const messageErreurAbonne = (err) =>
  isCanceledError(err) ? null : formatErr(err)

function formatErr(err) {
  const detail = err?.response?.data?.detail
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) return detail.map((d) => d?.msg).join(", ")
  return err?.response?.data?.message || err?.message || "Une erreur est survenue."
}
