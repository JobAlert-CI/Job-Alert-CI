import adminApi from "./adminAxios"
import { INITIAL_ADMINS } from "./mockData"

/**
 * API administrateurs (super_admin) —
 * GET/POST /admins · GET/PUT /{id} · PATCH /{id}/role · PATCH /{id}/status · DELETE /{id}.
 */

let localAdmins = [...INITIAL_ADMINS]

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms))

export const fetchAdmins = async ({ role, is_active, limit = 50, offset = 0 } = {}) => {
  try {
    const { data } = await adminApi.get("/admins", {
      params: { role: role || undefined, is_active, limit, offset },
    })
    return data
  } catch (error) {
    if (error?.response) throw error
    await delay()
    let list = [...localAdmins]
    if (role) list = list.filter((a) => a.role === role)
    if (typeof is_active === "boolean") list = list.filter((a) => a.is_active === is_active)
    return list.slice(offset, offset + limit)
  }
}

export const getAdminById = async (adminId) => {
  try {
    const { data } = await adminApi.get(`/admins/${adminId}`)
    return data
  } catch (error) {
    if (error?.response) throw error
    await delay()
    const found = localAdmins.find((a) => a.id === adminId)
    if (!found) {
      const notFound = new Error("Administrateur introuvable")
      notFound.isNotFound = true
      throw notFound
    }
    return found
  }
}

export const createAdmin = async ({ email, password, full_name, role }) => {
  const { data } = await adminApi.post("/admins", { email, password, full_name, role })
  return data
}

export const updateAdmin = async (adminId, payload) => {
  const { data } = await adminApi.put(`/admins/${adminId}`, payload)
  return data
}

/** PATCH /{id}/role — changement de rôle (sélecteur 4 rôles). */
export const updateAdminRole = async (adminId, role) => {
  const { data } = await adminApi.patch(`/admins/${adminId}/role`, { role })
  return data
}

/** PATCH /{id}/status — active/désactive le compte. */
export const toggleAdminStatus = async (adminId) => {
  const { data } = await adminApi.patch(`/admins/${adminId}/status`)
  return data
}

/** DELETE /{id} — suppression physique (jamais sur soi-même). */
export const deleteAdmin = async (adminId) => {
  await adminApi.delete(`/admins/${adminId}`)
}
