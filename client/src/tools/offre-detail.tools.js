import {
  Briefcase, CalendarDays, Fingerprint, GraduationCap,
  Radar, Send, Tag, Zap,
} from "lucide-react"
import { addDays } from "@/lib/dates"
import { useEffect } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { formatApiError } from "@/api/errors"
import {
  getOfferById, getSimilarOffers, incrementeView, saveOffer,
} from "@/api/public/offers"
import { getOfferSats, getOfferSatsBySource } from "@/api/public/stats"

/** Empreinte stable supportant les UUIDs (chaînes de caractères). */
export const fakeHash = (id) => {
  if (!id) return "0000000"
  const str = String(id)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(7, "0").slice(0, 7)
}

/** Initiales d'un nom d'entreprise (avatar). */
export const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()


/**
 * L'API n'expose pas encore le nombre total d'offres par entreprise
 * (schéma v2 — pas d'agrégat par entreprise). Repli à 1 ; à remplacer
 * par une requête dédiée quand l'endpoint existera.
 */
export const ENTREPRISE_TOTAL_FALLBACK = 1

export const ALERTE_REASSURANCES = [
  "Gratuit pour toujours",
  "1 email par jour",
  "Désinscription en 1 clic",
]

/** Chaîne de provenance — l'ADN veille, affichée dès l'ouverture. */
export const buildProvenanceSteps = (offre, meta) => [
  { icon: Radar, t: "06:02", l: `Collectée via ${offre.sourceLabel || offre.source}`, done: true },
  { icon: Fingerprint, t: "06:04", l: "0 doublon · hash unique", done: true },
  { icon: Tag, t: "07:15", l: `Taggée ${meta.label}`, done: true },
  { icon: Send, t: "08:00", l: "Au récap du matin", done: false },
]

/** Métadonnées affichées dans le panneau « Postuler ». */
export const OFFRE_META_ROWS = [
  {
    icon: CalendarDays,
    label: "Publication",
    value: (offre) =>
      addDays(new Date(), -offre.jours).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
  },
  { icon: Briefcase, label: "Contrat", value: (offre) => offre.contrat },
  { icon: GraduationCap, label: "Niveau", value: (offre) => offre.niveau },
  { icon: Zap, label: "Expérience", value: (offre) => offre.experience },
]


/* ════════════════════════════════════════════════════════════════════
   CLÉS DE CACHE — préfixe commun pour pouvoir invalider tout le domaine
   « offre » en une opération (utile quand l'admin ajoutera une offre
   manuellement, cf. doc v2 : offres.origine = 'manuel').
════════════════════════════════════════════════════════════════════ */
export const offreKeys = {
  root: ["offre"],
  detail: (id) => ["offre", "detail", id],
  similaires: (id) => ["offre", "similaires", id],
  collecteJour: ["offre", "collecte-jour"],
}

/** Une 404 est définitive : inutile de la retenter. */
export const isNotFoundError = (error) =>
  error?.response?.status === 404 || error?.status === 404

/* ─────────────── Détail de l'offre ───────────────
   · enabled : pas de requête tant que l'id est absent
   · retry : 2 tentatives pour les erreurs réseau, AUCUNE pour une 404 */
export const useOffreDetailQuery = (id) =>
  useQuery({
    queryKey: offreKeys.detail(id),
    queryFn: ({ signal }) => getOfferById(id, { signal }),
    enabled: Boolean(id),
    staleTime: 10 * 60 * 1000,
    retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 2,
  })

/* ─────────────── Offres similaires — décoratives, jamais bloquantes ─────────────── */
export const useOffresSimilairesQuery = (id) =>
  useQuery({
    queryKey: offreKeys.similaires(id),
    queryFn: ({ signal }) => getSimilarOffers(id, { signal }),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

/* ─────────────── Collecte du jour (MiniCollecte) — un seul aller-retour ─────────────── */
const loadCollecteJour = async () => {
  const [summary, bySource] = await Promise.allSettled([
    getOfferSats(),
    getOfferSatsBySource(),
  ])
  const s = summary.status === "fulfilled" ? summary.value : null
  return {
    total: s?.total_offers ?? 0,
    nouveaux: s?.new_offers ?? 0,
    sources:
      bySource.status === "fulfilled" && Array.isArray(bySource.value)
        ? bySource.value
        : [],
    error: summary.status === "rejected" ? formatApiError(summary.reason) : null,
  }
}

export const useCollecteJourQuery = () =>
  useQuery({
    queryKey: offreKeys.collecteJour,
    queryFn: loadCollecteJour,
    staleTime: 10 * 60 * 1000,
    placeholderData: { total: 0, nouveaux: 0, sources: [], error: null },
  })

/* ─────────────── Sauvegarde — mutation dédiée (optimisme côté contexte) ─────────────── */
export const useSaveOffreMutation = () =>
  useMutation({
    mutationFn: (id) => saveOffer(id),
  })

/* ─────────────── Comptage de vue ───────────────
   Une seule fois par offre et par session : protège du double-mount
   (StrictMode) et des allers-retours via la navigation. */
const trackedViews = new Set()

export const useTrackOffreView = (id, enabled) => {
  useEffect(() => {
    if (!id || !enabled || trackedViews.has(id)) return
    incrementeView(id)
      .then(() => trackedViews.add(id))
      .catch(() => {})
  }, [id, enabled])
}