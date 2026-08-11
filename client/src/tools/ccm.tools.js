import { queryClient } from "@/lib/queryClient"
import { getSources } from "@/api/public/sources"
import { useQuery } from "@tanstack/react-query"

/* ═══ Console "run quotidien" — machine à états ════════════════════
 * Le tick avance toutes les 1,7 s ; à partir du tick 4,
 * le récapitulatif est considéré comme "envoyé".
 */
export const PIPELINE_TICK_INTERVAL_MS = 1700
export const PIPELINE_TICK_COUNT = 6
export const PIPELINE_DELIVERED_AT = 4
export const SEND_TIME_LABEL = "08h00:02"

/* Positions des chips flottants autour de la console (desktop-first). */
export const CHIP_POSITIONS = [
  { cls: "-left-6 top-8 max-md:-left-3", dur: 4.4, delay: 0 },
  { cls: "-right-5 top-24 max-md:-right-2", dur: 5.2, delay: 0.8 },
  { cls: "-left-7 bottom-28 max-md:-left-2", dur: 4.8, delay: 1.4 },
  { cls: "-right-4 bottom-10 max-md:-right-2", dur: 5.6, delay: 0.4 },
]

/* ═══ Tracé serpentin de la section "Sous le capot" ════════════════ */
export const TRACE_VIEWBOX = { width: 1000, height: 2400 }

export const TRACE_PATH =
  "M 520 -120 " +
  "C 700 60, 848 150, 836 320 " +
  "C 824 490, 606 428, 452 528 " +
  "C 268 645, 146 748, 184 932 " +
  "C 218 1098, 432 1012, 622 1120 " +
  "C 818 1230, 874 1338, 824 1508 " +
  "C 772 1690, 542 1612, 390 1728 " +
  "C 212 1862, 140 1970, 210 2110 " +
  "C 292 2272, 512 2330, 498 2520"


// src/pages/comment-ca-marche/ccm.animations.js
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

// src/pages/comment-ca-marche/ccm.utils.js
/** Statut d'affichage d'une source (pastille + libellé). */
export const getSourceStatus = (source) => {
  if (!source)
    return { status: "unknown", label: "Inconnu", color: "text-gray-500" }
  if (source.status !== "active")
    return { status: "inactive", label: "Inactif", color: "text-error" }
  if (source.stats?.last_scrape_status === "failed")
    return { status: "error", label: "Erreur", color: "text-error" }
  return { status: "active", label: "Actif", color: "text-emerald-600" }
}

export const getActiveSources = (sources) =>
  Array.isArray(sources)
    ? sources.filter((source) => source.status === "active")
    : []

export const getTotalNewOffers = (sources) =>
  Array.isArray(sources)
    ? sources.reduce((acc, source) => acc + (source.stats?.new_offers ?? 0), 0)
    : 0

/** "Mardi 12 août" — date du jour en français, première lettre majuscule. */
export const formatDateFr = () => {
  const date = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
  return date.charAt(0).toUpperCase() + date.slice(1)
}


/** Clés centralisées du domaine "sources" (réutilisables par /sources). */
export const sourcesKeys = {
  all: ["sources"],
  list: ["sources", "list"],
}

/**
 * Les 4 sources scrapées + leurs stats du jour.
 * Chaque composant de la page appelle ce hook : TanStack déduplique
 * la requête et sert tout le monde depuis le même cache → 1 seul appel réseau.
 */
export const useSources = () =>
  useQuery({
    queryKey: sourcesKeys.list,
    queryFn: getSources,
    staleTime: 10 * 60 * 1000, // les sources bougent rarement dans la journée
  })



/**
 * À utiliser comme loader de route pour chauffer le cache avant le rendu :
 * { path: "/comment-ca-marche", element: <HowItWorks />, loader: prefetchHowItWorks }
 */
export const prefetchHowItWorks = () => {
  queryClient.prefetchQuery({ queryKey: sourcesKeys.list, queryFn: getSources })
  return null
}