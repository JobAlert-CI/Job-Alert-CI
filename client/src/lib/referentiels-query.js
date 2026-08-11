// src/lib/referentiels-query.js
import { useQuery } from "@tanstack/react-query"
import { formatApiError } from "@/api/errors"
import {
  getContractTypes, getEducationLevels, getExperienceLevels,
  getFilieres, getLocations, getSources,
} from "@/api/public/referentials"
import { CONTRATS, EXPERIENCES, FILIERES_META, NIVEAUX, SOURCES } from "@/lib/referentiels"
import { settled } from "@/lib/query-helpers"

/* ═══ SOURCE UNIQUE DE VÉRITÉ pour les référentiels de filtres.
   /offres et /filieres/:code partagent la même clé → un seul fetch,
   un seul cache, repli local identique partout. ═══ */
export const referentialsKey = ["offres", "referentials"]

const FALLBACK_REF = {
  filieres: FILIERES_META.map((f) => ({ code: f.code, label: f.label, hue: f.hue })),
  sources: SOURCES.map((s) => ({ code: s.code, label: s.code })),
  contrats: CONTRATS.map((c) => ({ code: c, label: c })),
  experiences: EXPERIENCES.map((x) => ({ code: x, label: x })),
  niveaux: NIVEAUX.map((n) => ({ code: n, label: n })),
  locations: [],
}

const loadReferentials = async () => {
  const results = await Promise.allSettled([
    getFilieres(),
    getSources(),
    getContractTypes(),
    getExperienceLevels(),
    getEducationLevels(),
    getLocations(),
  ])
  const failed = results.filter((r) => r.status === "rejected")
  return {
    filieres: settled(results[0], FALLBACK_REF.filieres).map((f) => ({
      code: f.code, label: f.label ?? f.code, hue: f.hue ?? null, id: f.id ?? null,
    })),
    sources: settled(results[1], FALLBACK_REF.sources).map((s) => ({
      code: s.code, label: s.name ?? s.code, id: s.id ?? null,
    })),
    contrats: settled(results[2], FALLBACK_REF.contrats).map((c) => ({ code: c.code, label: c.label ?? c.code })),
    experiences: settled(results[3], FALLBACK_REF.experiences).map((x) => ({ code: x.code, label: x.label ?? x.code })),
    niveaux: settled(results[4], FALLBACK_REF.niveaux).map((n) => ({ code: n.code, label: n.label ?? n.code })),
    locations: settled(results[5], FALLBACK_REF.locations).map((l) => ({
      id: l.id, label: l.label ?? l.city, city: l.city ?? "", isRemote: !!l.is_remote,
    })),
    isFallback: failed.length === results.length,
    error: failed.length ? formatApiError(failed[0].reason) : null,
  }
}

export const useReferentialsQuery = () =>
  useQuery({
    queryKey: referentialsKey,
    queryFn: loadReferentials,
    staleTime: 15 * 60 * 1000,
    placeholderData: { ...FALLBACK_REF, isFallback: false, error: null },
  })