import adminApi from "./adminAxios"
import { INITIAL_FILIERES, INITIAL_SOURCES } from "./mockData"
import { addMockLog } from "./adminLogs.api"

let localSources = [...INITIAL_SOURCES]
let localFilieres = [...INITIAL_FILIERES]

/* ─── Sources de Scraping ─── */
export const fetchAdminSources = async () => {
  try {
    const res = await adminApi.get("/api/admin/referentials/sources")
    return res.data
  } catch {
    return localSources
  }
}

export const createSource = async (data) => {
  try {
    const res = await adminApi.post("/api/admin/referentials/sources", data)
    return res.data
  } catch {
    const newSource = {
      id: `src-${Date.now()}`,
      status: "active",
      total_offers: 0,
      created_at: new Date().toISOString(),
      logo: "/LogoSource/novojob.svg",
      ...data,
    }
    localSources = [...localSources, newSource]
    addMockLog({
      module: "sources",
      type: "audit",
      niveau: "info",
      action: "creation",
      message: `Création de la source : ${newSource.name}`,
      details: { id: newSource.id, name: newSource.name },
    })
    return newSource
  }
}

export const updateSource = async (id, data) => {
  try {
    const res = await adminApi.put(`/api/admin/referentials/sources/${id}`, data)
    return res.data
  } catch {
    localSources = localSources.map((s) => (s.id === id ? { ...s, ...data } : s))
    const updated = localSources.find((s) => s.id === id)
    addMockLog({
      module: "sources",
      type: "audit",
      niveau: "info",
      action: "modification",
      message: `Mise à jour de la source : ${updated?.name || id}`,
      details: { id, updates: data },
    })
    return updated
  }
}

export const updateSourceStatus = async (id, status) => {
  try {
    const res = await adminApi.patch(`/api/admin/referentials/sources/${id}/status`, { status })
    return res.data
  } catch {
    localSources = localSources.map((s) => (s.id === id ? { ...s, status } : s))
    addMockLog({
      module: "sources",
      type: "audit",
      niveau: status === "disabled" ? "warning" : "info",
      action: "modification",
      message: `Statut de la source (${id}) modifié -> ${status}`,
      details: { id, status },
    })
    return localSources.find((s) => s.id === id)
  }
}

export const deleteSource = async (id) => {
  try {
    await adminApi.delete(`/api/admin/referentials/sources/${id}`)
  } catch {
    const target = localSources.find((s) => s.id === id)
    localSources = localSources.filter((s) => s.id !== id)
    addMockLog({
      module: "sources",
      type: "audit",
      niveau: "warning",
      action: "suppression",
      message: `Suppression de la source : ${target?.name || id}`,
      details: { id },
    })
  }
}

/* ─── Filières Métiers ─── */
export const fetchAdminFilieres = async () => {
  try {
    const res = await adminApi.get("/api/admin/referentials/filieres")
    return res.data
  } catch {
    return localFilieres
  }
}

export const createFiliere = async (data) => {
  try {
    const res = await adminApi.post("/api/admin/referentials/filieres", data)
    return res.data
  } catch {
    const newFiliere = {
      id: `fil-${Date.now()}`,
      slug: data.slug || data.label?.toLowerCase().replace(/\s+/g, "-"),
      total_offers: 0,
      is_active: true,
      specialties: data.specialties || [],
      keywords: data.keywords || [],
      sort_order: localFilieres.length + 1,
      ...data,
    }
    localFilieres = [...localFilieres, newFiliere]
    addMockLog({
      module: "filieres",
      type: "audit",
      niveau: "info",
      action: "creation",
      message: `Création de la filière : ${newFiliere.label}`,
      details: { id: newFiliere.id, label: newFiliere.label },
    })
    return newFiliere
  }
}

export const updateFiliere = async (id, data) => {
  try {
    const res = await adminApi.put(`/api/admin/referentials/filieres/${id}`, data)
    return res.data
  } catch {
    localFilieres = localFilieres.map((f) => (f.id === id ? { ...f, ...data } : f))
    const updated = localFilieres.find((f) => f.id === id)
    addMockLog({
      module: "filieres",
      type: "audit",
      niveau: "info",
      action: "modification",
      message: `Mise à jour de la filière : ${updated?.label || id}`,
      details: { id, updates: data },
    })
    return updated
  }
}

export const updateFiliereKeywords = async (id, keywords) => {
  try {
    const res = await adminApi.put(`/api/admin/referentials/filieres/${id}/keywords`, { keywords })
    return res.data
  } catch {
    localFilieres = localFilieres.map((f) => (f.id === id ? { ...f, keywords } : f))
    addMockLog({
      module: "filieres",
      type: "audit",
      niveau: "info",
      action: "modification",
      message: `Mise à jour des mots-clés pour la filière (${id}) (${keywords.length} mots-clés)`,
      details: { id, count: keywords.length },
    })
    return { message: "Mots-clés mis à jour", count: keywords.length }
  }
}

export const deleteFiliere = async (id) => {
  try {
    await adminApi.delete(`/api/admin/referentials/filieres/${id}`)
  } catch {
    const target = localFilieres.find((f) => f.id === id)
    localFilieres = localFilieres.filter((f) => f.id !== id)
    addMockLog({
      module: "filieres",
      type: "audit",
      niveau: "warning",
      action: "suppression",
      message: `Suppression de la filière : ${target?.label || id}`,
      details: { id },
    })
  }
}
