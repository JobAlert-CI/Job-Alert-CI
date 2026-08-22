import adminApi from "./adminAxios"
import { INITIAL_OFFERS } from "./mockData"
import { addMockLog } from "./adminLogs.api"

let localOffers = [...INITIAL_OFFERS]

export const fetchAdminOffers = async (params = {}) => {
  try {
    const res = await adminApi.get("/api/admin/offers", { params })
    return res.data
  } catch {
    let list = [...localOffers]
    if (params.q) {
      const q = params.q.toLowerCase()
      list = list.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.company?.toLowerCase().includes(q) ||
          o.location?.toLowerCase().includes(q)
      )
    }
    if (params.status) {
      list = list.filter((o) => o.status === params.status)
    }
    if (params.filiere) {
      list = list.filter((o) => o.filiere === params.filiere)
    }
    if (params.source) {
      list = list.filter((o) => o.source?.toLowerCase().includes(params.source.toLowerCase()))
    }
    if (params.visible_site !== undefined && params.visible_site !== "") {
      list = list.filter((o) => o.visible_site === (params.visible_site === true || params.visible_site === "true"))
    }
    return list
  }
}

export const createOffer = async (data) => {
  try {
    const res = await adminApi.post("/api/admin/offers", data)
    return res.data
  } catch {
    const newOffer = {
      id: `off-${Date.now()}`,
      created_at: new Date().toISOString(),
      status: "active",
      visible_site: true,
      ...data,
    }
    localOffers = [newOffer, ...localOffers]
    addMockLog({
      module: "offres",
      type: "audit",
      niveau: "info",
      action: "creation",
      message: `Création manuelle de l'offre : ${newOffer.title}`,
      details: { offerId: newOffer.id, title: newOffer.title },
    })
    return newOffer
  }
}

export const updateOffer = async (id, data) => {
  try {
    const res = await adminApi.put(`/api/admin/offers/${id}`, data)
    return res.data
  } catch {
    localOffers = localOffers.map((o) => (o.id === id ? { ...o, ...data } : o))
    const updated = localOffers.find((o) => o.id === id)
    addMockLog({
      module: "offres",
      type: "audit",
      niveau: "info",
      action: "modification",
      message: `Mise à jour de l'offre : ${updated?.title || id}`,
      details: { id, updates: data },
    })
    return updated
  }
}

export const updateOfferStatus = async (id, status) => {
  try {
    const res = await adminApi.patch(`/api/admin/offers/${id}/status`, { status })
    return res.data
  } catch {
    localOffers = localOffers.map((o) => (o.id === id ? { ...o, status } : o))
    addMockLog({
      module: "offres",
      type: "audit",
      niveau: status === "archived" ? "warning" : "info",
      action: "modification",
      message: `Changement de statut pour l'offre (${id}) -> ${status}`,
      details: { id, status },
    })
    return localOffers.find((o) => o.id === id)
  }
}

export const updateOfferVisibility = async (id, visible_site) => {
  try {
    const res = await adminApi.patch(`/api/admin/offers/${id}/visibility`, { visible_site })
    return res.data
  } catch {
    localOffers = localOffers.map((o) => (o.id === id ? { ...o, visible_site } : o))
    addMockLog({
      module: "offres",
      type: "audit",
      niveau: "info",
      action: "modification",
      message: `Visibilité modifiée pour l'offre (${id}) -> ${visible_site ? "Publique" : "Masquée"}`,
      details: { id, visible_site },
    })
    return localOffers.find((o) => o.id === id)
  }
}

export const deleteOffer = async (id) => {
  try {
    await adminApi.delete(`/api/admin/offers/${id}`)
  } catch {
    const target = localOffers.find((o) => o.id === id)
    localOffers = localOffers.filter((o) => o.id !== id)
    addMockLog({
      module: "offres",
      type: "audit",
      niveau: "warning",
      action: "suppression",
      message: `Suppression définitive de l'offre : ${target?.title || id}`,
      details: { id },
    })
  }
}
