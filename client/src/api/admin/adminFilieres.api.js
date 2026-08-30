import adminApi from "./adminAxios"
import { INITIAL_FILIERES } from "./mockData"

/**
 * API filières (super_admin) —
 * GET/POST /referentials/filieres · PUT/DELETE /{id} · PUT /{id}/keywords ·
 * GET/POST /{id}/specialites · PUT/DELETE /specialites/{id}.
 */

let localFilieres = [...INITIAL_FILIERES]

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms))
const mockSpecialties = () => []

export const fetchFilieres = async () => {
  try {
    const { data } = await adminApi.get("/referentials/filieres")
    return data
  } catch (error) {
    if (error?.response && error.response.status !== 502 && error.response.status !== 503 && error.response.status !== 504 && error.response.status !== 404) {
      throw error
    }
    await delay()
    return localFilieres.map((f) => ({
      id: f.id,
      code: f.slug,
      label: f.label,
      slug: f.slug,
      hue: null,
      tagline: null,
      description: f.description,
      sort_order: f.sort_order,
      is_active: f.is_active,
      specialties: [],
    }))
  }
}

export const createFiliere = async (payload) => {
  const { data } = await adminApi.post("/referentials/filieres", payload)
  return data
}

export const updateFiliere = async (filiereId, payload) => {
  const { data } = await adminApi.put(`/referentials/filieres/${filiereId}`, payload)
  return data
}

/** Remplacement complet des mots-clés [{ keyword, weight(1-100) }] */
export const updateFiliereKeywords = async (filiereId, keywords) => {
  const { data } = await adminApi.put(`/referentials/filieres/${filiereId}/keywords`, { keywords })
  return data
}

export const deleteFiliere = async (filiereId) => {
  await adminApi.delete(`/referentials/filieres/${filiereId}`)
}

/* ─── Spécialités ─── */

export const fetchSpecialites = async (filiereId) => {
  try {
    const { data } = await adminApi.get(`/referentials/filieres/${filiereId}/specialites`)
    return data
  } catch (error) {
    if (error?.response) throw error
    await delay()
    return mockSpecialties()
  }
}

export const createSpecialite = async (filiereId, payload) => {
  const { data } = await adminApi.post(`/referentials/filieres/${filiereId}/specialites`, payload)
  return data
}

export const updateSpecialite = async (specialiteId, payload) => {
  const { data } = await adminApi.put(`/referentials/specialites/${specialiteId}`, payload)
  return data
}

export const deleteSpecialite = async (specialiteId) => {
  await adminApi.delete(`/referentials/specialites/${specialiteId}`)
}
