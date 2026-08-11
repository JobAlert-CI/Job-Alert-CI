// src/lib/navigation-data.js
import { useQuery } from "@tanstack/react-query"
import {
  Building2, Calculator, Code2, FileText, GraduationCap, Handshake,
  HardHat, Megaphone, ShieldCheck, Sprout, Stethoscope, Truck,
  Users, UtensilsCrossed,
} from "lucide-react"
import { getFilieres } from "@/api/public/filieres"
import { getArticlesPopular } from "@/api/public/articles"
import { getGlobalSats, getOfferSatsBySource } from "@/api/public/stats"
import getFiliereTheme from "@/lib/filiere-theme"
import { getSources } from "@/api/public/sources"   // ← import à ajouter


/* ════════════════════════════════════════════════════════════════════
   CLÉS DE CACHE PARTAGÉES
   Préfixe "navigation" pour isoler des caches de pages (qui ont un
   staleTime plus court). Les pages peuvent consommer ces mêmes clés
   si elles ont besoin de filières/articles top — une seule requête part.
════════════════════════════════════════════════════════════════════ */
export const navKeys = {
  root: ["navigation"],
  filieres: ["navigation", "filieres"],
  topArticles: ["navigation", "top-articles"],
  overview: ["navigation", "overview"],
  sources: ["navigation", "sources-stats"],
  sourcesList: ["navigation", "sources-list"],
}

/* ════════════════════════════════════════════════════════════════════
   MAP DES ICÔNES LUCIDE ← icon_name (API)
   Le backend renvoie des strings ("code", "truck", "users"...) ;
   on les mappe aux composants Lucide déjà importés dans le Header.
════════════════════════════════════════════════════════════════════ */
const ICON_MAP = {
  code: Code2,
  megaphone: Megaphone,
  handshake: Handshake,
  calculator: Calculator,
  users: Users,
  "hard-hat": HardHat,
  truck: Truck,
  stethoscope: Stethoscope,
  "building-2": Building2,
  "graduation-cap": GraduationCap,
  "utensils-crossed": UtensilsCrossed,
  sprout: Sprout,
  "shield-check": ShieldCheck,
  "file-text": FileText,
}

const iconFromName = (name) => ICON_MAP[name] ?? FileText

/* ════════════════════════════════════════════════════════════════════
   ADAPTATEURS — API → shape attendue par Header/Footer (purs)
════════════════════════════════════════════════════════════════════ */
export const adaptFiliereNav = (raw) => {
  if (!raw || typeof raw !== "object") return null
  const theme = getFiliereTheme(raw.code)
  const stats = raw.stats || {}
  return {
    code: raw.code,
    slug: raw.slug || raw.code,
    label: raw.label || raw.code,
    to: `/filieres/${raw.code}`,
    icon: iconFromName(raw.icon_name) ?? theme.icon,
    hue: raw.hue ?? theme.hue,
    count: Number(stats.active_offers ?? 0),
    nouveaux: Number(stats.new_offers ?? 0),
    abonnes: Number(stats.subscribers ?? 0),
    is_active: raw.is_active !== false,
    sort_order: Number(raw.sort_order ?? 99),
  }
}

export const adaptFilieresNav = (list) =>
  (Array.isArray(list) ? list : [])
    .map(adaptFiliereNav)
    .filter((f) => f && f.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || b.count - a.count)

export const adaptArticleNav = (a) => {
  if (!a?.slug) return null
  return {
    slug: a.slug,
    titre: a.title?.trim() || "Conseil",
    extrait: a.excerpt?.trim() || "",
    vus: Number(a.view_count ?? 0),
    lecture: Math.max(1, Math.round(Number(a.reading_minutes) || 5)),
    cat: a.category?.code || a.category_id || "marche",
    catLabel: a.category?.label || "Conseil",
    catHue: a.category?.hue || "sky",
  }
}

/* ════════════════════════════════════════════════════════════════════
   HOOK PARTAGÉ — 1 seul appel, consommé par Header + Footer + pages
   · staleTime 10 min → navigation entre pages sans re-fetch
   · placeholderData → rendu immédiat, jamais d'écran blanc
   · enabled: true (toujours actif, le Header/Footer sont globaux)
════════════════════════════════════════════════════════════════════ */
export const useNavigationData = () => {
  const filieres = useQuery({
    queryKey: navKeys.filieres,
    queryFn: getFilieres,
    staleTime: 10 * 60 * 1000,
    placeholderData: [],
    select: adaptFilieresNav,
  })

  const topArticles = useQuery({
    queryKey: navKeys.topArticles,
    queryFn: () => getArticlesPopular({ limit: 9 }),
    staleTime: 10 * 60 * 1000,
    placeholderData: [],
    select: (data) => (Array.isArray(data) ? data.map(adaptArticleNav).filter(Boolean) : []),
  })

  const overview = useQuery({
    queryKey: navKeys.overview,
    queryFn: getGlobalSats,
    staleTime: 5 * 60 * 1000,
    placeholderData: {
      active_offers: 0,
      new_today: 0,
      subscribers: 0,
      sources: 4,
    },
  })

  const sources = useQuery({
    queryKey: navKeys.sources,
    queryFn: () => getOfferSatsBySource({ new_since_days: 1 }),
    staleTime: 5 * 60 * 1000,
    placeholderData: [],
  })

  /* Dérivés mémoïsés — recalculés uniquement quand les données changent */
  const totalActives = (filieres.data || []).reduce((s, f) => s + f.count, 0)
  const nouveauxCeMatin = overview.data?.new_today ?? 0

  /* Top 6 filières populaires pour le Footer (triées par offres actives) */
  const filieresPopulaires = (filieres.data || [])
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  const sourcesList = useQuery({
    queryKey: navKeys.sourcesList,
    queryFn: getSources,
    staleTime: 15 * 60 * 1000,
    placeholderData: [],
    select: (data) =>
      (Array.isArray(data) ? data : [])
        .filter((s) => s.status === "active")
        .map((s) => ({
          code: s.code,
          name: s.name ?? s.code,
          slug: s.slug ?? s.code,
          base_url: s.base_url,
          color_hex: s.color_hex,
          is_primary: !!s.is_primary,
        }))
        .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0)),
  })

  return {
    filieres: filieres.data || [],
    filieresPopulaires,
    topArticles: topArticles.data || [],
    overview: overview.data,
    sources: sources.data || [],
    sourcesList: sourcesList.data || [],
    totalActives,
    nouveauxCeMatin,
    isLoading: filieres.isPending && (filieres.data?.length ?? 0) === 0,
    hasError: filieres.isError && (filieres.data?.length ?? 0) === 0,
    refetch: () => {
      filieres.refetch()
      topArticles.refetch()
      overview.refetch()
      sources.refetch()
      sourcesList.refetch()
    },
  }
}