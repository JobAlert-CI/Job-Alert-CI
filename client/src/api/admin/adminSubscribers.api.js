import adminApi from "./adminAxios"
import { INITIAL_SUBSCRIBERS, INITIAL_FILIERES } from "./mockData"

/**
 * API abonnés (super_admin + gestionnaire_utilisateurs).
 * GET /subscribers (filtres q, status, filiere_id) · GET/PUT /{id} ·
 * PATCH /{id}/status · GET /{id}/sends · POST /{id}/send ·
 * DELETE /{id} = anonymisation RGPD.
 *
 * Statuts API : active, unsubscribed, bouncing (alias), paused, pending, deleted.
 */

let localSubscribers = [...INITIAL_SUBSCRIBERS]

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms))

const toApiShape = (s) => ({
  id: s.id,
  email: s.email,
  full_name: s.full_name,
  city: null,
  status: s.status,
  timezone: "Africa/Abidjan",
  wants_career_tips: true,
  admin_notes: null,
  source: "site",
  subscribed_at: s.subscribed_at,
  filiere_links: (s.filieres || []).map((label, i) => {
    const filiere = INITIAL_FILIERES.find((f) => f.label === label)
    return { id: `${s.id}-fl-${i}`, filiere_id: filiere?.slug || label, priority: i + 1 }
  }),
})

export const fetchSubscribers = async ({ q, status, filiere_id, limit = 20, offset = 0 } = {}) => {
  try {
    const { data } = await adminApi.get("/subscribers", {
      params: { q: q || undefined, status: status || undefined, filiere_id: filiere_id || undefined, limit, offset },
    })
    return data
  } catch (error) {
    if (error?.response && error.response.status !== 502 && error.response.status !== 503 && error.response.status !== 504 && error.response.status !== 404) {
      throw error
    }
    await delay()
    let list = localSubscribers.map(toApiShape)
    if (q) {
      const needle = q.toLowerCase()
      list = list.filter((s) => s.email.toLowerCase().includes(needle) || s.full_name?.toLowerCase().includes(needle))
    }
    if (status) list = list.filter((s) => s.status === status)
    if (filiere_id) list = list.filter((s) => s.filiere_links.some((l) => l.filiere_id === filiere_id))
    return list.slice(offset, offset + limit)
  }
}

export const getSubscriberById = async (subscriberId) => {
  try {
    const { data } = await adminApi.get(`/subscribers/${subscriberId}`)
    return data
  } catch (error) {
    if (error?.response) throw error
    await delay()
    const found = localSubscribers.find((s) => s.id === subscriberId)
    if (!found) {
      const notFound = new Error("Abonné introuvable")
      notFound.isNotFound = true
      throw notFound
    }
    return toApiShape(found)
  }
}

/** Édition fiche : nom, ville, notes internes, préférence conseils. */
export const updateSubscriber = async (subscriberId, payload) => {
  const { data } = await adminApi.put(`/subscribers/${subscriberId}`, payload)
  return data
}

export const updateSubscriberStatus = async (subscriberId, status, reason) => {
  const { data } = await adminApi.patch(`/subscribers/${subscriberId}/status`, { status, reason })
  return data
}

/** Historique des envois (digests quotidiens + personnalisés). */
export const fetchSubscriberSends = async (subscriberId, limit = 20) => {
  try {
    const { data } = await adminApi.get(`/subscribers/${subscriberId}/sends`, { params: { limit } })
    return data
  } catch (error) {
    if (error?.response) throw error
    await delay()
    return [
      {
        id: "dig-demo-1",
        subscriber_id: subscriberId,
        digest_date: "2026-08-22",
        status: "sent",
        subject: "Vos offres du jour",
        offer_count: 8,
        sent_at: "2026-08-22T08:00:05Z",
      },
      {
        id: "dig-demo-2",
        subscriber_id: subscriberId,
        digest_date: "2026-08-21",
        status: "sent",
        subject: "Vos offres du jour",
        offer_count: 6,
        sent_at: "2026-08-21T08:00:03Z",
      },
    ]
  }
}

/** Envoi personnalisé : offer_ids[] + sujet optionnel. */
export const sendCustomEmail = async (subscriberId, offerIds, subject) => {
  const { data } = await adminApi.post(`/subscribers/${subscriberId}/send`, {
    offer_ids: offerIds,
    subject: subject || undefined,
  })
  return data
}

/** Suppression = anonymisation RGPD (pas de suppression physique). */
export const anonymizeSubscriber = async (subscriberId) => {
  await adminApi.delete(`/subscribers/${subscriberId}`)
}
