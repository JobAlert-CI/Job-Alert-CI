import adminApi from "./adminAxios"
import { INITIAL_SOURCES } from "./mockData"

/**
 * API sources (super_admin) —
 * GET/POST /referentials/sources · PUT /{id} · PATCH /{id}/status · DELETE /{id}.
 * Statuts : active / paused / error / disabled.
 */

let localSources = [...INITIAL_SOURCES]

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms))

const toApiShape = (s) => ({
  id: s.id,
  code: s.code,
  name: s.name,
  slug: s.code,
  base_url: s.base_url,
  logo_path: s.logo,
  color_hex: null,
  status: s.status,
  priority: s.priority,
  supports_scraping: true,
  anti_scraping_level: s.anti_scraping_level ?? 0,
  default_scan_time: s.schedule_time ?? null,
  description: null,
  is_primary: false,
})

export const fetchSources = async () => {
  try {
    const { data } = await adminApi.get("/referentials/sources")
    return data
  } catch (error) {
    if (error?.response && error.response.status !== 502 && error.response.status !== 503 && error.response.status !== 504 && error.response.status !== 404) {
      throw error
    }
    await delay()
    return localSources.map(toApiShape)
  }
}

export const createSource = async (payload) => {
  const { data } = await adminApi.post("/referentials/sources", payload)
  return data
}

export const updateSource = async (sourceId, payload) => {
  const { data } = await adminApi.put(`/referentials/sources/${sourceId}`, payload)
  return data
}

export const updateSourceStatus = async (sourceId, status) => {
  const { data } = await adminApi.patch(`/referentials/sources/${sourceId}/status`, { status })
  return data
}

export const deleteSource = async (sourceId) => {
  await adminApi.delete(`/referentials/sources/${sourceId}`)
}
