import { Filter as FilterIcon, Radar, Send } from "lucide-react"
import getFiliereTheme from "@/lib/filiere-theme"
import { adaptOffer } from "@/lib/offers-adapter"
import { toIsoEnd, toIsoStart } from "@/lib/offers-adapter"
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { getFiliereOffers, getFilieres, getFilieresBySlug } from "@/api/public/filieres"
import { isNotFoundError } from "@/lib/query-helpers"

export const PAGE_SIZE = 12

/** Filtres ↔ URL : /filieres/tech-dev?src=linkedin&spec=tech-dev-pilotage&tri=az */
export const CONFIG_FILTRES = {
  sets: [
    { key: "sources", param: "src" },
    { key: "contrats", param: "ct" },
    { key: "experiences", param: "exp" },
    { key: "niveaux", param: "niv" },
    { key: "specialites", param: "spec" },
  ],
  scalars: [
    { key: "sort", param: "tri", defaut: "recent" },
    { key: "view", param: "vue", defaut: "list" },
    { key: "query", param: "q", defaut: "" },
    { key: "location", param: "loc", defaut: "" },
  ],
  period: { debut: "du", fin: "au" },
}

/** Pipeline du récap (RecapCard, décoratif). */
export const PIPELINE_RECAP = [
  { icon: Radar, t: "06h02", l: "Collecte" },
  { icon: FilterIcon, t: "07h15", l: "Filtrage" },
  { icon: Send, t: "08h00", l: "Envoi" },
]

export const AVATARS_ABONNES = [
  { init: "AK", cls: "bg-sky-600" },
  { init: "MC", cls: "bg-emerald-600" },
  { init: "SD", cls: "bg-fuchsia-600" },
  { init: "YK", cls: "bg-amber-600" },
]

export const ALERTE_REASSURANCES = [
  "Gratuit pour toujours",
  "1 email par jour à 8h00",
  "Désinscription en 1 clic",
]


/* Adaptateur API → UI (filière) — identique à l'original, défensif. */
export const adaptFiliere = (raw) => {
  if (!raw || typeof raw !== "object") return null
  const theme = getFiliereTheme(raw.code)
  const stats = raw.stats || {}
  const activeSpecialties = (raw.specialties || []).filter((s) => s.is_active !== false)
  return {
    id: raw.id,
    code: raw.code,
    slug: raw.slug || raw.code,
    label: raw.label || raw.code,
    tagline: raw.tagline || "",
    desc: raw.description || "",
    icon: theme.icon,
    hue: raw.hue || theme.hue,
    actives: Number(stats.active_offers ?? 0),
    nouvelles: Number(stats.new_offers ?? 0),
    abonnes: Number(stats.subscribers ?? 0),
    keywords: activeSpecialties.map((s) => (s.label || "").toLowerCase()).filter(Boolean),
    specialites: activeSpecialties.map((s) => ({ id: s.id, code: s.code, label: s.label })),
  }
}

/**
 * Offres d'une filière : adaptateur standard + CODE de spécialité.
 * Corrigé : adaptOffer n'expose que le LABEL de la spécialité, or les
 * filtres (URL `spec=`) portent sur des codes → la comparaison échouait
 * systématiquement et masquait toutes les offres.
 */
export const adaptFiliereOffers = (list) =>
  (Array.isArray(list) ? list : [])
    .map((raw) => {
      const offre = adaptOffer(raw)
      return offre ? { ...offre, specialiteCode: raw?.specialty?.code ?? null } : null
    })
    .filter(Boolean)


/** Résout un CODE de référentiel en ID (le backend attend des ids). */
const resolveId = (list = [], code) => list.find((item) => item.code === code)?.id

/**
 * ═══ CORRECTION DE LA LOGIQUE DE FILTRAGE ═══
 * Le backend n'accepte qu'UN id par axe. L'ancien code envoyait le
 * PREMIER id de chaque multi-sélection : les autres sélections ne
 * remontaient jamais, puis le filtre client écartait tout → seule la
 * première sélection fonctionnait. Désormais :
 *   · 0 sélection   → pas de paramètre
 *   · 1 sélection   → l'id résolu proprement (code → id, plus de mélange)
 *   · ≥2 sélections → pas de paramètre serveur : on charge la filière
 *     complète et le filtre client applique la multi-sélection.
 */
export const buildApiParams = ({ meta, refs, filters, sort, locationId, query, period }) => {
  const q = (query ?? "").trim()

  const singleId = (set, list) => {
    if (set.size !== 1) return undefined
    return resolveId(list, [...set][0])
  }

  let specialiteId
  if (filters.specialites.size === 1 && meta) {
    const code = [...filters.specialites][0]
    specialiteId = meta.specialites.find((s) => s.code === code)?.id
  }

  return {
    sort,
    specialite_id: specialiteId,
    source_id: singleId(filters.sources, refs.sources),
    contract_type_id: singleId(filters.contrats, refs.contrats),
    experience_level_id: singleId(filters.experiences, refs.experiences),
    education_level_id: singleId(filters.niveaux, refs.niveaux),
    location_id: locationId || undefined,
    q: q.length >= 2 ? q : undefined,
    published_since: toIsoStart(period.start),
    published_until: toIsoEnd(period.end),
  }
}

/**
 * Filtrage client DÉFENSIF — garantit la multi-sélection quel que soit
 * le paramétrage serveur, et compare les CODES entre eux (corrigé).
 */
export const filterOffers = (offers, { filters, query, locationId }) => {
  const q = (query ?? "").trim().toLowerCase()
  return offers.filter((o) => {
    if (q && !(o.titre.toLowerCase().includes(q) || o.entreprise.toLowerCase().includes(q))) return false
    if (filters.sources.size && !filters.sources.has(o.source)) return false
    if (filters.contrats.size && !filters.contrats.has(o.contratCode)) return false
    if (filters.experiences.size && !filters.experiences.has(o.experienceCode)) return false
    if (filters.niveaux.size && !filters.niveaux.has(o.niveauCode)) return false
    if (filters.specialites.size && !filters.specialites.has(o.specialiteCode)) return false
    if (locationId && o.locationId !== locationId) return false
    return true
  })
}

/** Compteurs par option, scopés aux offres CHARGÉES de la filière (clés = codes). */
export const buildScopedCounts = (offers = []) => {
  const counts = { sources: {}, contrats: {}, experiences: {}, niveaux: {}, specialites: {} }
  offers.forEach((o) => {
    if (o.source) counts.sources[o.source] = (counts.sources[o.source] ?? 0) + 1
    if (o.contratCode) counts.contrats[o.contratCode] = (counts.contrats[o.contratCode] ?? 0) + 1
    if (o.experienceCode) counts.experiences[o.experienceCode] = (counts.experiences[o.experienceCode] ?? 0) + 1
    if (o.niveauCode) counts.niveaux[o.niveauCode] = (counts.niveaux[o.niveauCode] ?? 0) + 1
    if (o.specialiteCode) counts.specialites[o.specialiteCode] = (counts.specialites[o.specialiteCode] ?? 0) + 1
  })
  return counts
}


export const filiereKeys = {
  root: ["filieres"],
  detail: (slug) => ["filieres", "detail", slug],
  feed: (slug, params) => ["filieres", "offres", slug, params],
  /** Même clé que la page /filieres → liste déjà en cache = rendu instantané. */
  liste: ["filieres", "liste"],
}

/* ─────────────── Détail de la filière ───────────────
   Une 404 est définitive : aucune relance (retry conditionnel). */
export const useFiliereQuery = (slug) =>
  useQuery({
    queryKey: filiereKeys.detail(slug),
    queryFn: ({ signal }) => getFilieresBySlug(slug, { signal }),
    enabled: Boolean(slug),
    staleTime: 10 * 60 * 1000,
    retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 2,
  })

/* ─────────────── Flux paginé de la filière ───────────────
   · keepPreviousData → l'ancienne liste reste affichée au changement de filtres
   · signal → annulation des requêtes obsolètes
   (si votre wrapper n'accepte pas le 3e argument, retirez `{ signal }`) */
export const useFiliereFeedQuery = (slug, params) =>
  useInfiniteQuery({
    queryKey: filiereKeys.feed(slug, params),
    queryFn: ({ pageParam, signal }) =>
      getFiliereOffers(
        slug,
        { ...params, limit: PAGE_SIZE, offset: pageParam * PAGE_SIZE },
        { signal }
      ),
    enabled: Boolean(slug),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      Array.isArray(lastPage) && lastPage.length === PAGE_SIZE
        ? allPages.length
        : undefined,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })

/* ─────────────── Liste des filières (« Autres filières ») ─────────────── */
export const useFilieresListeQuery = () =>
  useQuery({
    queryKey: filiereKeys.liste,
    queryFn: getFilieres,
    staleTime: 10 * 60 * 1000,
    placeholderData: [],
  })