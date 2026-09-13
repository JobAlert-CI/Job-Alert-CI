/* ─────────────────────────────────────────────────────────────────────
   Sévérité visuelle du niveau anti-scraping (0-5) — partagée entre la
   table (index.jsx) et le dialog d'édition (DialogSource.jsx).
   Vert = protection faible, orange = élevée, rouge = maximale.
   Fichier séparé pour react-refresh/only-export-components.
   ───────────────────────────────────────────────────────────────────── */
export const TEINTES_PROTECTION = [
  { texte: "text-emerald-700", fond: "bg-emerald-500", libelle: "Aucune" },       // 0
  { texte: "text-emerald-700", fond: "bg-emerald-500", libelle: "Faible" },       // 1
  { texte: "text-[#B45309]", fond: "bg-brand-orange", libelle: "Modérée" },       // 2
  { texte: "text-[#B45309]", fond: "bg-brand-orange", libelle: "Élevée" },        // 3
  { texte: "text-destructive", fond: "bg-destructive", libelle: "Très élevée" },  // 4
  { texte: "text-destructive", fond: "bg-destructive", libelle: "Maximale" },     // 5
]

export const teinteProtection = (niveau) =>
  TEINTES_PROTECTION[niveau] ?? TEINTES_PROTECTION[0]