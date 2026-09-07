import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getSubscribers, getSubscriber, getSubscriberSends,
  updateSubscriber, updateSubscriberStatus, deleteSubscriber, sendCustomEmail,
} from "@/api/admin/subscribers"
import {
  getSubscribersOverview, getSubscriptionsByDay, getTopFilieres,
  getSubscribersGrowth, getSubscribersByCity, getTopContractTypes, getSendsByDay,
  getMatchingOffersCount,
} from "@/api/admin/subscriber-stats"
import { getTransactionalEmails } from "@/api/admin/system"
import { previewDigest } from "@/api/admin/sending"
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
  stats: {
    overview: ["admin", "subscribers", "stats", "overview"],
    byDay: (params) => ["admin", "subscribers", "stats", "by-day", params],
    topFilieres: (params) => ["admin", "subscribers", "stats", "top-filieres", params],
    growth: (params) => ["admin", "subscribers", "stats", "growth", params],
    byCity: (params) => ["admin", "subscribers", "stats", "by-city", params],
    topContrats: (params) => ["admin", "subscribers", "stats", "top-contrats", params],
    sendsByDay: (params) => ["admin", "subscribers", "stats", "sends-by-day", params],
  },
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

/**
 * Action groupée — POST /bulk-status { subscriber_ids (max 500), status,
 * reason? }. Refuse "deleted" (422 schema + 400 route : double garde) :
 * l'anonymisation RGPD reste strictement unitaire.
 */
export const useActionGroupeeAbonnes = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ subscriberIds, status, raison }) => {
      const body = { subscriber_ids: subscriberIds, status }
      if (raison) body.reason = raison
      // POST sur /subscribers/bulk-status via le module existant.
      return import("@/api/admin/subscribers").then((m) =>
        m.default.updateSubscribersBulkStatus(body)
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: adminSubscribersKeys.root }),
  })
}

/* ─── Stats & charts (router /subscribers/stats, cycle 7) ──────────── */

/** Vue d'ensemble : total, by_status (API), by_source, without_filiere. */
export const useStatsAbonnesOverview = () =>
  useQuery({
    queryKey: adminSubscribersKeys.stats.overview,
    queryFn: ({ signal }) => getSubscribersOverview({ signal }),
    staleTime: 60 * 1000,
    retry: 1,
  })

/** Inscriptions par jour — jours sans inscription omis (axe complété côté UI). */
export const useStatsInscriptionsParJour = (params = { days: 30 }) =>
  useQuery({
    queryKey: adminSubscribersKeys.stats.byDay(params),
    queryFn: ({ signal }) => getSubscriptionsByDay(params, { signal }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

/** Filières les plus choisies (par liens, 1-3 par abonné). */
export const useStatsTopFilieres = (params = { limit: 10 }) =>
  useQuery({
    queryKey: adminSubscribersKeys.stats.topFilieres(params),
    queryFn: ({ signal }) => getTopFilieres(params, { signal }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

/** Croissance cumulée — part du total historique avant la fenêtre. */
export const useStatsCroissance = (params = { days: 90 }) =>
  useQuery({
    queryKey: adminSubscribersKeys.stats.growth(params),
    queryFn: ({ signal }) => getSubscribersGrowth(params, { signal }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

/** Répartition par ville (« Non renseignee » regroupé). */
export const useStatsParVille = (params = { limit: 10 }) =>
  useQuery({
    queryKey: adminSubscribersKeys.stats.byCity(params),
    queryFn: ({ signal }) => getSubscribersByCity(params, { signal }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

/** Types de contrat préférés. */
export const useStatsTopContrats = (params = { limit: 10 }) =>
  useQuery({
    queryKey: adminSubscribersKeys.stats.topContrats(params),
    queryFn: ({ signal }) => getTopContractTypes(params, { signal }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

/** Digests par jour ventilés sent/failed/skipped/queued. */
export const useStatsEnvoisParJour = (params = { days: 30 }) =>
  useQuery({
    queryKey: adminSubscribersKeys.stats.sendsByDay(params),
    queryFn: ({ signal }) => getSendsByDay(params, { signal }),
    staleTime: 60 * 1000,
    retry: 1,
  })

/**
 * Emails transactionnels d'un abonné — GET /transactional-emails
 * ?subscriber_id={id} (même route que la page 16/cycle 17, filtrée).
 * Vocabulaires API : purpose (confirm_email…) et status (queued/sent/
 * failed) — cf. TransactionalEmailEventRead.
 */
export const useAdminAbonneEmailsTx = (subscriberId, params = { limit: 50 }) =>
  useQuery({
    queryKey: ["admin", "transactional-emails", "abonne", subscriberId, params],
    queryFn: ({ signal }) => getTransactionalEmails({ ...params, subscriber_id: subscriberId }, { signal }),
    enabled: !!subscriberId,
    staleTime: 60 * 1000,
    retry: 1,
  })

/**
 * Offres actives correspondant aux filières de l'abonné —
 * GET /stats/matching-offers-count/{id} → { total, by_filiere }.
 * Cas support : digest vide + total 0 = pas d'offres sur ses filières,
 * pas un bug d'envoi.
 */
export const useCompteOffresActivesFiliere = (subscriberId) =>
  useQuery({
    queryKey: ["admin", "subscribers", "stats", "matching-offers", subscriberId],
    queryFn: ({ signal }) => getMatchingOffersCount(subscriberId, { signal }),
    enabled: !!subscriberId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

/**
 * Envoi personnalisé — POST /subscribers/{id}/send
 * { offer_ids (min 1), subject? (max 255, défaut serveur
 * « Sélection personnalisée JobAlert CI ») } → 201 EmailDigest queued.
 * ⚠ Mise en FILE, pas envoyé : le worker asynchrone traite le digest
 * — le message UI doit dire « en file d'attente » (doc v3 §9).
 * Refuse 400 si des IDs sont introuvables (détail dans la réponse).
 */
export const useEnvoyerSelection = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ subscriberId, offerIds, sujet }) =>
      sendCustomEmail(subscriberId, {
        offer_ids: offerIds,
        ...(sujet ? { subject: sujet } : {}),
      }),
    onSuccess: () => {
      // Invalide détail + sends (le digest queued apparaît dans
      // l'historique) + liste abonnés.
      qc.invalidateQueries({ queryKey: adminSubscribersKeys.root })
    },
  })
}

/**
 * Aperçu du digest SANS envoi — POST /sending/preview
 * ?subscriber_id=&offer_ids=... → { preview: { subscriber_name,
 * subscriber_email, offer_titles, offer_count, subject_preview,
 * html_snippet }, message }.
 * Sans offer_ids : les 5 premières offres des filières de l'abonné
 * (cascade auto — doc v3 §9).
 * `actif` contrôle le déclenchement : la query ne part qu'à l'ouverture
 * de l'aperçu (et re-part quand le mode change via la clé du hook).
 */
export const useApercuDigest = (subscriberId, offerIds = [], { actif = true } = {}) =>
  useQuery({
    queryKey: ["admin", "sending", "preview", subscriberId, offerIds],
    queryFn: ({ signal }) => {
      const params = { subscriber_id: subscriberId }
      if (offerIds.length) params.offer_ids = offerIds
      return previewDigest(params, { signal })
    },
    enabled: !!subscriberId && actif,
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  })

/** Erreur mutation formatée (annulations ignorées). */
export const messageErreurAbonne = (err) =>
  isCanceledError(err) ? null : formatErr(err)

function formatErr(err) {
  const detail = err?.response?.data?.detail
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) return detail.map((d) => d?.msg).join(", ")
  return err?.response?.data?.message || err?.message || "Une erreur est survenue."
}
