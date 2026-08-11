// src/pages/sources/sources.constants.js
import {
  Activity, Fingerprint, Radar, ShieldCheck,
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { getSources } from "@/api/public/sources"
import { getGlobalSats, getOfferSatsBySource } from "@/api/public/stats"

/* ════════════════════════════════════════════════════════════════════
   POSITIONS RADAR — coordonnées en % pour sources 1..N.
   Au-delà de 6 sources, les positions se répètent (grille polaire).
════════════════════════════════════════════════════════════════════ */
export const POSITIONS_RADAR = [
  { x: 68, y: 18 },
  { x: 82, y: 55 },
  { x: 24, y: 76 },
  { x: 16, y: 30 },
  { x: 50, y: 88 },
  { x: 78, y: 85 },
  { x: 30, y: 50 },
  { x: 60, y: 40 },
]

/* ════════════════════════════════════════════════════════════════════
   PRINCIPES DE MÉTHODE — statiques, sans données dynamiques.
════════════════════════════════════════════════════════════════════ */
export const PRINCIPES = [
  {
    icon: Radar,
    titre: "Un scraper par source, isolé",
    texte:
      "Chaque source a son propre scraper. Si l'une tombe en panne ou change de structure, les autres continuent de tourner normalement. Chaque échec est journalisé avec horodatage.",
  },
  {
    icon: ShieldCheck,
    titre: "Lecture respectueuse",
    texte:
      "Délais entre les requêtes, respect des conditions d'utilisation. Les sources les plus protégées bénéficient de délais renforcés et d'un plan de repli si l'accès venait à être bloqué.",
  },
  {
    icon: Fingerprint,
    titre: "Dédoublonnage par empreinte",
    texte:
      "Chaque offre reçoit un hash unique calculé depuis son lien. La même annonce repérée sur deux sources ? Une seule version est conservée — vous ne la recevez jamais deux fois.",
  },
  {
    icon: Activity,
    titre: "Structure surveillée chaque jour",
    texte:
      "Si un site change de mise en page, une alerte part immédiatement et un correctif est appliqué. Votre flux ne s'arrête jamais, même quand les sites évoluent.",
  },
]

/* ════════════════════════════════════════════════════════════════════
   ANIMATIONS — réutilisables par tous les composants de la page.
════════════════════════════════════════════════════════════════════ */
export const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
}

export const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
}

// src/pages/sources/sources.adapter.js
import { HUES } from "@/lib/hues"

/* ════════════════════════════════════════════════════════════════════
   COULEURS — conversion hex → clé HUE du design system.
   Le backend renvoie color_hex ; on l'utilise tel quel et on calcule
   la clé HUE la plus proche par distance RGB.
════════════════════════════════════════════════════════════════════ */
const hexToRgb = (hex) => {
  if (!hex) return null
  const clean = String(hex).replace("#", "")
  if (clean.length !== 6) return null
  const n = parseInt(clean, 16)
  if (!Number.isFinite(n)) return null
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

const distanceRgb = (a, b) => {
  if (!a || !b) return Infinity
  return (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2
}

/** Trouve la HUE la plus proche d'un hex (fallback : "sky"). */
export const hueDepuisHex = (hex) => {
  const rgb = hexToRgb(hex)
  if (!rgb) return "sky"
  let meilleur = "sky"
  let distanceMin = Infinity
  Object.entries(HUES).forEach(([key, valeur]) => {
    const rgbHue = hexToRgb(valeur.hex)
    const d = distanceRgb(rgb, rgbHue)
    if (d < distanceMin) {
      distanceMin = d
      meilleur = key
    }
  })
  return meilleur
}

/* ════════════════════════════════════════════════════════════════════
   TAGS — dérivés purs depuis les métadonnées API.
   Plus d'heuristiques manuelles sur le texte ; on lit les flags.
════════════════════════════════════════════════════════════════════ */
export const construireTags = (source) => {
  const tags = []
  if (source.is_primary) tags.push("Source principale")
  if (source.supports_scraping === false) tags.push("Lecture manuelle")
  if ((source.anti_scraping_level ?? 0) >= 3) tags.push("Anti-scraping fort")
  if ((source.anti_scraping_level ?? 0) === 0 && source.supports_scraping !== false) {
    tags.push("Accès libre")
  }
  const desc = String(source.description || "").toLowerCase()
  if (desc.includes("panafricain") || desc.includes("africa") || desc.includes("africain")) {
    tags.push("Panafricain")
  }
  if (desc.includes("local") || desc.includes("ivoirien")) {
    tags.push("100 % Côte d'Ivoire")
  }
  return tags.length > 0 ? tags : ["Offres d'emploi"]
}

export const construireType = (source) => {
  const name = String(source.name || source.code || "").toLowerCase()
  if (name.includes("linkedin")) return "Réseau professionnel"
  if (source.is_primary) return "Site emploi · source principale"
  return "Site emploi partenaire"
}

/* ════════════════════════════════════════════════════════════════════
   SOURCE — API → shape UI.
   Défensif : chaque champ manquant a un repli, jamais de crash.
════════════════════════════════════════════════════════════════════ */
const nombre = (valeur, defaut = 0) => {
  const n = Number(valeur)
  return Number.isFinite(n) ? n : defaut
}

export const adaptSource = (raw, statsParSource = {}) => {
  if (!raw || typeof raw !== "object") return null
  const hex = raw.color_hex || "#0F2D4D"
  const hue = hueDepuisHex(hex)
  const stats = statsParSource[raw.code] ?? raw.stats ?? {}

  return {
    // Identité
    code: raw.name || raw.code,
    slug: raw.slug || raw.code,
    rawCode: raw.code,
    type: construireType(raw),
    hue,
    hex,
    logoPath: raw.logo_path,
    url: raw.base_url,
    jobsUrl: raw.jobs_url,
    shortCode: raw.short_code || String(raw.code || "").slice(0, 2).toUpperCase(),
    // Timing
    passage: raw.default_scan_time || "06:00",
    duree: raw.last_scrape_duration ?? null,
    // Rôle
    principal: Boolean(raw.is_primary),
    prudent: (raw.anti_scraping_level ?? 0) >= 3,
    supportsScraping: raw.supports_scraping !== false,
    // Contenu
    description: raw.description || "Source partenaire de JobAlert CI.",
    note: raw.notes || "Source opérationnelle.",
    tags: construireTags(raw),
    // Stats
    total: nombre(stats.total_offers ?? stats.active_offers, 0),
    nouveaux: nombre(stats.new_offers, 0),
    // Métadonnées brutes
    status: raw.status,
    priority: Number(raw.priority ?? 99),
  }
}

/**
 * Adaptation de la liste complète avec tri :
 * - sources principales d'abord
 * - puis par priorité croissante (1 = le plus prioritaire)
 */
export const adaptSources = (sourcesApi = [], statsParSourceList = []) => {
  const statsMap = new Map(
    (Array.isArray(statsParSourceList) ? statsParSourceList : []).map((s) => [
      s?.code,
      s,
    ])
  )
  return (Array.isArray(sourcesApi) ? sourcesApi : [])
    .filter((s) => s?.code && s.status !== "inactive")
    .sort(
      (a, b) =>
        (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) ||
        (a.priority ?? 99) - (b.priority ?? 99)
    )
    .map((s) => adaptSource(s, Object.fromEntries(statsMap)))
    .filter(Boolean)
}


/* ════════════════════════════════════════════════════════════════════
   CLÉS DE CACHE — préfixe commun.
════════════════════════════════════════════════════════════════════ */
// src/pages/sources/sources.queries.js

export const sourcesKeys = {
  root: ["sources"],
  list: ["sources", "list"],
  stats: ["sources", "stats-by-source"],
  global: ["sources", "global"],
}

/** Une 404 est définitive : inutile de la retenter. */
export const estErreur404 = (erreur) =>
  erreur?.response?.status === 404 || erreur?.status === 404

/* ─────────────── Liste des sources ───────────────
   GARDE-FOU : le queryFn doit toujours résoudre un tableau.
   En TanStack Query v5, un queryFn qui résout `undefined`
   passe la requête immédiatement en erreur. */
export const useSourcesListQuery = () =>
  useQuery({
    queryKey: sourcesKeys.list,
    queryFn: async () => {
      const data = await getSources()
      return Array.isArray(data) ? data : []
    },
    staleTime: 10 * 60 * 1000,
    retry: (failureCount, error) => !estErreur404(error) && failureCount < 2,
  })

/* ─────────────── Stats par source (décoratives) ───────────────
   Un échec ici ne doit JAMAIS bloquer la page. */
export const useSourcesStatsQuery = () =>
  useQuery({
    queryKey: sourcesKeys.stats,
    queryFn: async () => {
      const data = await getOfferSatsBySource()
      return Array.isArray(data) ? data : []
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  })

/* ─────────────── Stats globales ─────────────── */
export const useGlobalStatsQuery = () =>
  useQuery({
    queryKey: sourcesKeys.global,
    queryFn: async () => {
      const data = await getGlobalSats()
      return data && typeof data === "object" ? data : {}
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  })