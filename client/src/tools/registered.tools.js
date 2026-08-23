import { useQuery } from "@tanstack/react-query"
import { getFilieres } from "@/api/public/filieres"
import {
  getContractTypes,
  getExperienceLevels,
  getLocations,
} from "@/api/public/referentials"
import { getOffers } from "@/api/public/offers"
import { settled } from "@/lib/query-helpers"
import { adaptFilieres } from "@/tools/filieres.tools"
import { adaptOffers } from "@/lib/offers-adapter"
import { CONTRATS, EXPERIENCES, FILIERES_META } from "@/lib/referentiels"
import { ALL_OFFRES } from "@/data/offres"

export const DEFAULT_VILLES = [
  "Abidjan",
  "Bouaké",
  "San Pédro",
  "Yamoussoukro",
  "Korhogo",
  "Autre / Télétravail",
]

export const registeredKeys = {
  referentials: ["registered", "referentials"],
  offers: ["registered", "offers", { limit: 100, sort: "recent" }],
}

const FALLBACK_REFERENTIALS = {
  filieres: adaptFilieres(FILIERES_META),
  contrats: CONTRATS.map((c) => ({ code: c, label: c })),
  experiences: EXPERIENCES.map((x) => ({ code: x, label: x })),
  locations: DEFAULT_VILLES.map((v) => ({ code: v, label: v, city: v })),
  villes: DEFAULT_VILLES,
}

/**
 * Charge tous les référentiels requis pour l'inscription depuis le backend
 * et les met en cache TanStack Query pendant 15 minutes.
 */
export const fetchRegisteredReferentials = async () => {
  const [filieresRes, contractsRes, experiencesRes, locationsRes] =
    await Promise.allSettled([
      getFilieres(),
      getContractTypes(),
      getExperienceLevels(),
      getLocations(),
    ])

  const rawFilieres = settled(filieresRes, FILIERES_META)
  const filieres = adaptFilieres(rawFilieres)

  const rawContracts = settled(contractsRes, null)
  const contrats = rawContracts && Array.isArray(rawContracts) && rawContracts.length > 0
    ? rawContracts
        .filter((c) => c.is_active !== false)
        .map((c) => ({ code: c.code || c.label, label: c.label || c.code }))
    : FALLBACK_REFERENTIALS.contrats

  const rawExperiences = settled(experiencesRes, null)
  const experiences = rawExperiences && Array.isArray(rawExperiences) && rawExperiences.length > 0
    ? rawExperiences
        .filter((x) => x.is_active !== false)
        .map((x) => ({ code: x.code || x.label, label: x.label || x.code }))
    : FALLBACK_REFERENTIALS.experiences

  const rawLocations = settled(locationsRes, null)
  let locations = []
  let villes = []

  if (rawLocations && Array.isArray(rawLocations) && rawLocations.length > 0) {
    locations = rawLocations
      .filter((l) => l.is_active !== false)
      .map((l) => ({
        id: l.id,
        code: l.code || l.city || l.label,
        label: l.label || l.city,
        city: l.city || l.label,
      }))
    villes = Array.from(new Set(locations.map((l) => l.label || l.city).filter(Boolean)))
  } else {
    locations = FALLBACK_REFERENTIALS.locations
    villes = FALLBACK_REFERENTIALS.villes
  }

  return {
    filieres: filieres.length > 0 ? filieres : FALLBACK_REFERENTIALS.filieres,
    contrats,
    experiences,
    locations,
    villes: villes.length > 0 ? villes : DEFAULT_VILLES,
  }
}

/**
 * Hook TanStack Query pour les référentiels d'inscription
 */
export const useRegisteredReferentials = () =>
  useQuery({
    queryKey: registeredKeys.referentials,
    queryFn: fetchRegisteredReferentials,
    staleTime: 15 * 60 * 1000, // 15 min
    gcTime: 30 * 60 * 1000,
    placeholderData: FALLBACK_REFERENTIALS,
  })

/**
 * Hook TanStack Query pour les offres du récapitulatif
 */
export const useRegisteredOffers = () =>
  useQuery({
    queryKey: registeredKeys.offers,
    queryFn: async ({ signal }) => {
      try {
        const raw = await getOffers({ limit: 100, sort: "recent" }, { signal })
        const adapted = adaptOffers(raw)
        return adapted && adapted.length > 0 ? adapted : ALL_OFFRES
      } catch {
        return ALL_OFFRES
      }
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: ALL_OFFRES,
  })
