export const HUES = {
  sky: { dot: "bg-sky-500", tile: "bg-sky-500/10 text-sky-600", tileHover: "group-hover:bg-sky-600 group-hover:text-white", solid: "bg-sky-600", glow: "bg-sky-400/20", accent: "text-sky-600", hex: "#0ea5e9" },
  fuchsia: { dot: "bg-fuchsia-500", tile: "bg-fuchsia-500/10 text-fuchsia-600", tileHover: "group-hover:bg-fuchsia-600 group-hover:text-white", solid: "bg-fuchsia-600", glow: "bg-fuchsia-400/20", accent: "text-fuchsia-600", hex: "#d946ef" },
  orange: { dot: "bg-orange-500", tile: "bg-orange-500/10 text-orange-600", tileHover: "group-hover:bg-orange-600 group-hover:text-white", solid: "bg-orange-600", glow: "bg-orange-400/20", accent: "text-orange-600", hex: "#f97316" },
  emerald: { dot: "bg-emerald-500", tile: "bg-emerald-500/10 text-emerald-600", tileHover: "group-hover:bg-emerald-600 group-hover:text-white", solid: "bg-emerald-600", glow: "bg-emerald-400/20", accent: "text-emerald-600", hex: "#10b981" },
  violet: { dot: "bg-violet-500", tile: "bg-violet-500/10 text-violet-600", tileHover: "group-hover:bg-violet-600 group-hover:text-white", solid: "bg-violet-600", glow: "bg-violet-400/20", accent: "text-violet-600", hex: "#8b5cf6" },
  amber: { dot: "bg-amber-500", tile: "bg-amber-500/10 text-amber-600", tileHover: "group-hover:bg-amber-600 group-hover:text-white", solid: "bg-amber-600", glow: "bg-amber-400/20", accent: "text-amber-600", hex: "#f59e0b" },
  cyan: { dot: "bg-cyan-500", tile: "bg-cyan-500/10 text-cyan-600", tileHover: "group-hover:bg-cyan-600 group-hover:text-white", solid: "bg-cyan-600", glow: "bg-cyan-400/20", accent: "text-cyan-600", hex: "#06b6d4" },
  rose: { dot: "bg-rose-500", tile: "bg-rose-500/10 text-rose-600", tileHover: "group-hover:bg-rose-600 group-hover:text-white", solid: "bg-rose-600", glow: "bg-rose-400/20", accent: "text-rose-600", hex: "#f43f5e" },
  blue: { dot: "bg-blue-500", tile: "bg-blue-500/10 text-blue-600", tileHover: "group-hover:bg-blue-600 group-hover:text-white", solid: "bg-blue-600", glow: "bg-blue-400/20", accent: "text-blue-600", hex: "#3b82f6" },
  indigo: { dot: "bg-indigo-500", tile: "bg-indigo-500/10 text-indigo-600", tileHover: "group-hover:bg-indigo-600 group-hover:text-white", solid: "bg-indigo-600", glow: "bg-indigo-400/20", accent: "text-indigo-600", hex: "#6366f1" },
  teal: { dot: "bg-teal-500", tile: "bg-teal-500/10 text-teal-600", tileHover: "group-hover:bg-teal-600 group-hover:text-white", solid: "bg-teal-600", glow: "bg-teal-400/20", accent: "text-teal-600", hex: "#14b8a6" },
  lime: { dot: "bg-lime-500", tile: "bg-lime-500/10 text-lime-600", tileHover: "group-hover:bg-lime-600 group-hover:text-white", solid: "bg-lime-600", glow: "bg-lime-400/20", accent: "text-lime-600", hex: "#84cc16" },
  red: { dot: "bg-red-500", tile: "bg-red-500/10 text-red-600", tileHover: "group-hover:bg-red-600 group-hover:text-white", solid: "bg-red-600", glow: "bg-red-400/20", accent: "text-red-600", hex: "#ef4444" },
  green: { dot: "bg-green-500", tile: "bg-green-500/10 text-green-600", tileHover: "group-hover:bg-green-600 group-hover:text-white", solid: "bg-green-600", glow: "bg-green-400/20", accent: "text-green-600", hex: "#22c55e" },
  slate: { dot: "bg-slate-500", tile: "bg-slate-500/10 text-slate-600", tileHover: "group-hover:bg-slate-600 group-hover:text-white", solid: "bg-slate-600", glow: "bg-slate-400/20", accent: "text-slate-600", hex: "#64748b" },
}

/* Teinte « marque » pour les éléments transverses (calendrier, etc.) */
export const BRAND_HUE = {
  dot: "bg-brand-orange", solid: "bg-brand-orange", accent: "text-brand-orange",
  tile: "bg-brand-orange/10 text-brand-orange", glow: "bg-brand-orange/20", hex: "#F5A623",
}

/* ════════════════════════════════════════════════════════════════════
   PALETTE DEPUIS COLOR_HEX
   Le backend renvoie désormais color_hex (ex: "#425f42") sur les
   filières. Cette fonction construit la même structure que HUES mais
   avec la couleur exacte au lieu d'une teinte prédéfinie.

   Les classes Tailwind référencent des variables CSS (--palette-*),
   posées via `style` : c'est ce qui permet des couleurs dynamiques
   tout en restant compilables par Tailwind (les classes sont littérales).
   Usage : <span className={p.dot} style={p.style} /> — le `style` peut
   être posé sur un parent, les variables héritent aux descendants.
   Hex invalide/manquant → repli sur la palette sky.
   ════════════════════════════════════════════════════════════════════ */

/** Valide et normalise un hex "#RRGGBB" ; retourne null sinon. */
const normaliserHex = (hex) => {
  if (!hex) return null
  const clean = String(hex).trim().replace("#", "")
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null
  return `#${clean.toLowerCase()}`
}

const hexVersRgb = (hex) => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
})

/** Assombrit un hex d'un facteur (0-1) — équivalent visuel de la nuance -600. */
const assombrir = (hex, facteur) => {
  const { r, g, b } = hexVersRgb(hex)
  const canal = (v) => Math.max(0, Math.round(v * (1 - facteur)))
  const to2 = (v) => canal(v).toString(16).padStart(2, "0")
  return `#${to2(r)}${to2(g)}${to2(b)}`
}

const avecAlpha = (hex, alpha) => {
  const { r, g, b } = hexVersRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Palette complète dérivée d'une couleur exacte.
 * Mêmes clés que HUES : dot, tile, tileHover, solid, glow, accent, hex
 * (+ style : variables CSS à propager avec les className).
 */
export const paletteDepuisHex = (hex) => {
  const base = normaliserHex(hex) ?? HUES.sky.hex
  const dark = assombrir(base, 0.25)
  return {
    hex: base,
    style: {
      "--palette-base": base,
      "--palette-dark": dark,
      "--palette-tile": avecAlpha(base, 0.1),
      "--palette-glow": avecAlpha(base, 0.2),
    },
    dot: "bg-[var(--palette-base)]",
    tile: "bg-[var(--palette-tile)] text-[var(--palette-dark)]",
    tileHover: "group-hover:bg-[var(--palette-dark)] group-hover:text-white",
    solid: "bg-[var(--palette-dark)]",
    glow: "bg-[var(--palette-glow)]",
    accent: "text-[var(--palette-dark)]",
  }
}