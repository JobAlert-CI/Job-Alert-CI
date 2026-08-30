import adminApi from "./adminAxios"
import { INITIAL_OFFERS } from "./mockData"

/**
 * API offres (super_admin + gestionnaire_offres).
 * GET /offers (filtres q, filiere_id, source_id, status, visible_site, origin) ·
 * POST /offers · GET/PUT /{id} · PATCH /{id}/visibility · PATCH /{id}/status ·
 * DELETE /{id} (soft) · POST /bulk-status.
 *
 * ⚠ Les référentiels se soumettent par **code** (filiere_code, contract_type_code…), jamais par UUID.
 */

let localOffers = [...INITIAL_OFFERS].map((o) => ({
  ...o,
  origin: "scraping",
  company: { id: `co-${o.id}`, name: o.company, normalized_name: o.company?.toLowerCase() },
  source: { id: o.source, code: o.source?.toLowerCase(), name: o.source },
  primary_filiere: { id: o.filiere, code: o.filiere, label: o.filiere },
  contract_type: { id: o.contract_type, code: o.contract_type, label: o.contract_type },
  detail: null,
}))

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms))

export const fetchAdminOffers = async (params = {}) => {
  try {
    const { data } = await adminApi.get("/offers", { params })
    return data
  } catch (error) {
    if (error?.response && error.response.status !== 502 && error.response.status !== 503 && error.response.status !== 504 && error.response.status !== 404) {
      throw error
    }
    await delay()
    let list = [...localOffers]
    if (params.q) {
      const q = params.q.toLowerCase()
      list = list.filter((o) => o.title?.toLowerCase().includes(q) || o.company?.name?.toLowerCase().includes(q))
    }
    if (params.status) list = list.filter((o) => o.status === params.status)
    if (params.filiere_id) list = list.filter((o) => o.primary_filiere?.code === params.filiere_id || o.primary_filiere?.id === params.filiere_id)
    if (params.source_id) list = list.filter((o) => o.source?.code === params.source_id || o.source?.id === params.source_id)
    if (typeof params.visible_site === "boolean" || params.visible_site === "true" || params.visible_site === "false") {
      const wanted =
        typeof params.visible_site === "boolean" ? params.visible_site : params.visible_site === "true"
      list = list.filter((o) => o.visible_site === wanted)
    }
    if (params.origin) list = list.filter((o) => o.origin === params.origin)
    return list.slice(params.offset || 0, (params.offset || 0) + (params.limit || 20))
  }
}

export const getOfferById = async (offerId) => {
  try {
    const { data } = await adminApi.get(`/offers/${offerId}`)
    return data
  } catch (error) {
    if (error?.response) throw error
    await delay()
    return localOffers.find((o) => o.id === offerId) || null
  }
}

/** Création manuelle — référentiels par code. */
export const createOffer = async (payload) => {
  const { data } = await adminApi.post("/offers", payload)
  return data
}

export const updateOffer = async (offerId, payload) => {
  const { data } = await adminApi.put(`/offers/${offerId}`, payload)
  return data
}

export const updateOfferVisibility = async (offerId, visibleSite) => {
  const { data } = await adminApi.patch(`/offers/${offerId}/visibility`, { visible_site: visibleSite })
  return data
}

export const updateOfferStatus = async (offerId, status) => {
  const { data } = await adminApi.patch(`/offers/${offerId}/status`, { status })
  return data
}

/** Suppression logique (soft delete). */
export const deleteOffer = async (offerId) => {
  await adminApi.delete(`/offers/${offerId}`)
}

/** Changement de statut en masse. */
export const bulkUpdateStatus = async (offerIds, status) => {
  const { data } = await adminApi.post("/offers/bulk-status", { offer_ids: offerIds, status })
  return data
}
