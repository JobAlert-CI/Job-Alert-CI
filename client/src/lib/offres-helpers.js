// src/lib/offres-helpers.js
import { fmtDay, sameDay } from "@/lib/dates"

/** Label d'un code dans une liste de référentiel (repli = le code). */
export const labelOf = (list = [], code) =>
  list.find((item) => item.code === code)?.label || code

/** Libellé du filtre période (bouton + chip). */
export const getPeriodLabel = (period) => {
  const { start, end } = period ?? {}
  if (start && end) return sameDay(start, end) ? fmtDay(start) : `${fmtDay(start)} → ${fmtDay(end)}`
  if (start) return `Depuis le ${fmtDay(start)}`
  return "Période"
}

/** Libellé du filtre localisation (bouton + chip). */
export const getLocationLabel = (locations = [], locationId) => {
  if (!locationId) return "Localisation"
  const loc = locations.find((l) => l.id === locationId)
  return loc?.label || loc?.city || "Localisation"
}

/** Nombre d'offres par entreprise — Map en O(n) (avant : filter par carte → O(n²)). */
export const buildEntrepriseCounts = (offers = []) => {
  const counts = new Map()
  offers.forEach((offre) => {
    if (!offre.entreprise) return
    counts.set(offre.entreprise, (counts.get(offre.entreprise) ?? 0) + 1)
  })
  return counts
}

/** Feed groupé jour par jour — compteurs précalculés, O(n) (avant : O(n²)). */
export const buildFeedItems = (offers = [], sort) => {
  if (sort !== "recent") return offers.map((o) => ({ type: "offre", o }))
  const dayCounts = new Map()
  offers.forEach((o) => dayCounts.set(o.jours, (dayCounts.get(o.jours) ?? 0) + 1))
  const items = []
  let lastDay = null
  offers.forEach((o) => {
    if (o.jours !== lastDay) {
      items.push({ type: "header", jours: o.jours, count: dayCounts.get(o.jours) })
      lastDay = o.jours
    }
    items.push({ type: "offre", o })
  })
  return items
}