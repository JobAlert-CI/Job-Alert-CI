export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export const sameDay = (a, b) =>
  !!a && !!b &&
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
export const fmtDay = (d) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
export const publieLabel = (jours) =>
  jours === 0 ? "Aujourd'hui" : jours === 1 ? "Hier" : `Il y a ${jours} j`
export const jourLabel = (jours) => {
  if (jours === 0) return { label: "Aujourd'hui", sub: "collectées à 06:00", ping: true }
  if (jours === 1) return { label: "Hier", sub: "", ping: false }
  const d = addDays(new Date(), -jours)
  const s = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
  return { label: s.charAt(0).toUpperCase() + s.slice(1), sub: "", ping: false }
}
export const todayLong = () => {
  const s = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
export const dateLabel = (jours) => {
  if (jours === 0) return "Aujourd'hui"
  if (jours === 1) return "Hier"
  return addDays(new Date(), -jours).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
}