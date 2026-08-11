import { startOfDay } from "./dates"

/* ════════════════════════════════════════════════════════════════════
  ADAPTATEUR API → UI
  Le backend expose JobOfferRead (snake_case, relations imbriquées).
  Les composants (OfferCard, Ticker, feed) attendent la forme « offre ».
  Tout est défensif : une relation manquante ne casse jamais le rendu.
════════════════════════════════════════════════════════════════════ */

const safeDate = (value) => {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Nombre de jours écoulés depuis une date ISO (0 = aujourd'hui). */
export const daysSince = (value) => {
  const d = safeDate(value)
  if (!d) return 0
  const diff = startOfDay(new Date()).getTime() - startOfDay(d).getTime()
  return Math.max(0, Math.round(diff / 86_400_000))
}

export const adaptOffer = (raw) => {
  if (!raw || typeof raw !== "object") return null

  const publishedAt = raw.published_at ?? raw.first_seen_at ?? raw.collected_at ?? null

  return {
    /* Identité */
    id: raw.id || raw.slug,
    uid: raw.id,

    /* Contenu */
    titre: raw.title ?? "Offre sans titre",
    entreprise: raw.company?.name ?? "Entreprise non précisée",
    ville: raw.location?.label || raw.location_raw || "",
    lien: raw.canonical_url || raw.source_url || null,

    /* Référentiels (labels affichés, codes pour les filtres) */
    source: raw.source?.code ?? raw.source?.name ?? "",
    sourceLabel: raw.source?.name ?? raw.source?.code ?? "",
    filiere: raw.primary_filiere?.code ?? null,
    filiereLabel: raw.primary_filiere?.label ?? null,
    filiereHue: raw.primary_filiere?.hue ?? null,
    specialite: raw.specialty?.label ?? null,
    contrat: raw.contract_type?.label ?? null,
    contratCode: raw.contract_type?.code ?? null,
    experience: raw.experience_level?.label ?? null,
    experienceCode: raw.experience_level?.code ?? null,
    niveau: raw.education_level?.label ?? null,
    niveauCode: raw.education_level?.code ?? null,
    locationId: raw.location?.id ?? null,

    /* Dates */
    publishedAt,
    jours: daysSince(publishedAt),
    isNouveau: daysSince(raw.first_seen_at ?? publishedAt) === 0,
  }
}

export const adaptOffers = (list) =>
  (Array.isArray(list) ? list : []).map(adaptOffer).filter(Boolean)

/** Dé-doublonnage par uid — protège la pagination contre les doublons. */
export const mergeOffers = (previous, incoming) => {
  const seen = new Set(previous.map((o) => o.uid))
  const merged = [...previous]
  incoming.forEach((o) => {
    if (o.uid && seen.has(o.uid)) return
    if (o.uid) seen.add(o.uid)
    merged.push(o)
  })
  return merged
}

/* Sérialisation d'une date locale → ISO (filtres de période côté API) */
export const toIsoStart = (date) => {
  if (!date) return null
  const d = startOfDay(date)
  return d.toISOString()
}

export const toIsoEnd = (date) => {
  if (!date) return null
  const d = startOfDay(date)
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}
