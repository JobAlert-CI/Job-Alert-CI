import adminApi from "./adminAxios"
import { INITIAL_ADMINS, INITIAL_SUBSCRIBERS } from "./mockData"
import { addMockLog } from "./adminLogs.api"

let localAdmins = [...INITIAL_ADMINS]
let localSubscribers = [...INITIAL_SUBSCRIBERS]

export const ALL_PERMISSIONS = [
  { id: "manage_offers", label: "Gestion des offres", description: "Créer, modifier, désactiver et supprimer les offres d'emploi" },
  { id: "manage_sources", label: "Gestion des sources", description: "Activer, désactiver, configurer et ajouter des sources de scraping" },
  { id: "manage_filieres", label: "Gestion des filières", description: "Modifier les filières métiers, spécialités et mots-clés de matching" },
  { id: "trigger_scrape", label: "Lancement des scrapes", description: "Déclencher manuellement une collecte et ajuster les fréquences" },
  { id: "manage_logs", label: "Consultation des logs", description: "Accéder aux journaux d'audit et événements techniques" },
  { id: "manage_users", label: "Gestion des utilisateurs & rôles", description: "Promouvoir des utilisateurs et attribuer des permissions (Super Admin)" },
]

export const fetchSubscribers = async (params = {}) => {
  try {
    const res = await adminApi.get("/api/admin/subscribers", { params })
    return res.data
  } catch {
    let list = [...localSubscribers]
    if (params.q) {
      const q = params.q.toLowerCase()
      list = list.filter(
        (s) => s.email.toLowerCase().includes(q) || s.full_name?.toLowerCase().includes(q)
      )
    }
    if (params.status) {
      list = list.filter((s) => s.status === params.status)
    }
    return list
  }
}

export const fetchAdmins = async (params = {}) => {
  try {
    const res = await adminApi.get("/api/admin/admins", { params })
    return res.data
  } catch {
    let list = [...localAdmins]
    if (params.role) list = list.filter((a) => a.role === params.role)
    if (params.is_active !== undefined) list = list.filter((a) => a.is_active === params.is_active)
    return list
  }
}

export const promoteUserToAdmin = async ({
  subscriberId,
  role = "superviseur",
  permissions = ["manage_offers", "manage_logs"],
  full_name,
  email,
}) => {
  try {
    const res = await adminApi.post("/api/admin/admins", {
      email,
      full_name,
      role,
      password: "TempPassword123!",
    })
    return res.data
  } catch {
    const sub = localSubscribers.find((s) => s.id === subscriberId)
    const newAdmin = {
      id: `adm-${Date.now()}`,
      full_name: full_name || sub?.full_name || "Nouvel Administrateur",
      email: email || sub?.email || "user@jobalert.ci",
      role,
      is_active: true,
      created_at: new Date().toISOString(),
      last_login_at: null,
      permissions: role === "super_admin" ? ALL_PERMISSIONS.map((p) => p.id) : permissions,
    }

    localAdmins = [newAdmin, ...localAdmins]

    addMockLog({
      module: "admin",
      type: "audit",
      niveau: "info",
      action: "creation",
      message: `Promotion de l'utilisateur ${newAdmin.full_name} au rôle ${role}.`,
      details: { admin_id: newAdmin.id, role, permissions: newAdmin.permissions },
    })

    return newAdmin
  }
}

export const updateAdminPermissions = async (adminId, { role, permissions, is_active, full_name }) => {
  try {
    const res = await adminApi.put(`/api/admin/admins/${adminId}`, {
      role,
      is_active,
      full_name,
    })
    return res.data
  } catch {
    localAdmins = localAdmins.map((a) => {
      if (a.id === adminId) {
        return {
          ...a,
          ...(role ? { role } : {}),
          ...(permissions ? { permissions } : {}),
          ...(is_active !== undefined ? { is_active } : {}),
          ...(full_name ? { full_name } : {}),
        }
      }
      return a
    })

    const updated = localAdmins.find((a) => a.id === adminId)

    addMockLog({
      module: "admin",
      type: "audit",
      niveau: "info",
      action: "modification",
      message: `Mise à jour des pouvoirs de ${updated?.full_name || adminId}.`,
      details: { adminId, role, permissions, is_active },
    })

    return updated
  }
}

export const deleteAdmin = async (adminId) => {
  try {
    await adminApi.delete(`/api/admin/admins/${adminId}`)
  } catch {
    const target = localAdmins.find((a) => a.id === adminId)
    localAdmins = localAdmins.filter((a) => a.id !== adminId)
    addMockLog({
      module: "admin",
      type: "audit",
      niveau: "warning",
      action: "suppression",
      message: `Suppression du compte admin : ${target?.full_name || adminId}`,
      details: { adminId },
    })
  }
}

export const updateSubscriberStatus = async (subscriberId, status) => {
  try {
    const res = await adminApi.patch(`/api/admin/subscribers/${subscriberId}/status`, { status })
    return res.data
  } catch {
    localSubscribers = localSubscribers.map((s) =>
      s.id === subscriberId ? { ...s, status } : s
    )
    return localSubscribers.find((s) => s.id === subscriberId)
  }
}
