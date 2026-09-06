import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getOffers, getOfferById, createOffer, updateOffer,
  updateVisibility, updateStatus, deleteOffer, bulkUpdateStatus,
  getDuplicateCandidates, markDuplicate, rejectDuplicate, importOffers,
} from "@/api/admin/offers"
import { isCanceledError } from "@/api/errors"

/* ─────────────────────────────────────────────────────────────────────
   Gestion des offres : hooks TanStack (liste, filtres, mutations).

   Router /api/admin/offers : super_admin + gestionnaire_offres.

   Shapes réelles (vérifiées API live 2026-09-05) :
   - GET /offers → liste plate d'objets hydratés :
     { id, public_id, title, normalized_title, slug, status, origin,
       visible_site, source_reference, source_url, canonical_url,
       location_raw, salary_raw, published_at, collected_at,
       first_seen_at, last_seen_at, expires_at, application_deadline_at,
       view_count, save_count,
       company: {id, name, normalized_name, slug},
       primary_filiere: {id, code, label, slug, color_hex},
       source: {id, code, name, slug, base_url},
       contract_type: {id, code, label} | null,
       experience_level, education_level, location, specialty, detail }
   - GET /duplicates/candidates → [{ offer_a_id, offer_b_id,
       offer_a_title, offer_b_title, offer_a_company,
       similarity_score, reason }] (header X-Scan-Truncated possible)

   Filtres serveur (JSDoc offers.js) : q (titre), filiere_id,
     source_id, status, visible_site, origin, limit (1-100, def 20),
     offset (>= 0).
   ───────────────────────────────────────────────────────────────────── */

export const STATUTS_OFFRE = [
  { valeur: "active", libelle: "Active" },
  { valeur: "expired", libelle: "Expirée" },
  { valeur: "filled", libelle: "Pourvue" },
  { valeur: "archived", libelle: "Archivée" },
  { valeur: "en_relecture", libelle: "En relecture" },
  { valeur: "duplicate", libelle: "Doublon" },
  { valeur: "brut", libelle: "Brute" },
]

export const ORIGINES_OFFRE = [
  { valeur: "scraping", libelle: "Scraping" },
  { valeur: "manual", libelle: "Manuel" },
  { valeur: "import", libelle: "Import" },
]

/** Colonnes acceptées par l'import CSV/JSON (vérifié dans
 *  api/v1/admin/offers.py::_row_to_payload — la liste de l'UI
 *  documente exactement ces colonnes, pas plus). */
export const COLONNES_IMPORT = [
  { colonne: "title", requis: true, description: "Titre de l'offre" },
  { colonne: "company_name", requis: true, description: "Nom de l'entreprise" },
  { colonne: "source_code", requis: true, description: "Code source (ex. goafrica)" },
  { colonne: "source_url", requis: false, description: "URL de l'offre sur la source" },
  { colonne: "source_reference", requis: false, description: "Référence unique côté source" },
  { colonne: "canonical_url", requis: false, description: "URL canonique" },
  { colonne: "filiere_code", requis: true, description: "Code filière (ex. tech-dev)" },
  { colonne: "location_label", requis: false, description: "Ville (ex. Abidjan)" },
  { colonne: "contract_type_code", requis: false, description: "Code contrat (ex. cdd)" },
  { colonne: "experience_level_code", requis: false, description: "Code expérience (ex. 1-3)" },
  { colonne: "education_level_code", requis: false, description: "Code diplôme (ex. bac-2)" },
  { colonne: "published_at", requis: false, description: "Date publication (ISO)" },
  { colonne: "expires_at", requis: false, description: "Date expiration (ISO)" },
  { colonne: "intro", requis: false, description: "Texte d'intro" },
  { colonne: "missions", requis: false, description: "Missions (texte libre)" },
]

/* ─── Clés de cache ─────────────────────────────────────────────────── */

export const adminOffersKeys = {
  root: ["admin", "offers"],
  liste: (params) => ["admin", "offers", "liste", params],
  doublons: (params) => ["admin", "offers", "doublons", params],
}

/* ─── Liste paginée (filtres serveur, pagination offset) ───────────── */

export const useAdminOffersQuery = (params) =>
  useQuery({
    queryKey: adminOffersKeys.liste(params),
    queryFn: ({ signal }) => getOffers(params, { signal }),
    // Liste de travail quotidienne : 30 s suffisent entre deux visites,
    // les mutations invalident immédiatement.
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    retry: 1,
  })

/**
 * Compteur d'offres brutes (à traiter par la normalisation IA).
 * L'API ne renvoie pas de total : heuristique honnête — limite 100,
 * au-delà on affiche "100+". Un seul appel léger, cache 60 s.
 */
export const useCompteOffresBrutes = () =>
  useQuery({
    queryKey: ["admin", "offers", "compte", "brut"],
    queryFn: async ({ signal }) => {
      const page = await getOffers({ status: "brut", limit: 100 }, { signal })
      return { total: page.length, plafonne: page.length === 100 }
    },
    staleTime: 60 * 1000,
    retry: 1,
    select: (d) => d ?? { total: 0, plafonne: false },
  })

/* ─── Candidats doublons (badge en tête de liste) ───────────────────── */

export const useAdminDoublonsQuery = (params = { min_similarity: 80 }) =>
  useQuery({
    queryKey: adminOffersKeys.doublons(params),
    queryFn: ({ signal }) => getDuplicateCandidates(params, { signal }),
    // Scan coûteux côté serveur : 2 min de fraîcheur, pas de polling.
    staleTime: 2 * 60 * 1000,
    retry: 1,
  })

/* ─── Mutations (avec invalidation automatique) ─────────────────────── */

/**
 * Détail d'une offre pour le formulaire d'édition.
 * GET /{id} → JobOfferRead complet (détail, référentiels hydratés).
 */
export const useAdminOfferDetailQuery = (offerId, { enabled = true } = {}) =>
  useQuery({
    queryKey: ["admin", "offers", "detail", offerId],
    queryFn: ({ signal }) => getOfferById(offerId, { signal }),
    enabled: !!offerId && enabled,
    staleTime: 60 * 1000,
  })

/**
 * Création manuelle — POST /offers (201).
 * ⚠ Dédoublonnage silencieux (services/offers.py::create_offer) : si le
 * hash existe déjà, l'API renvoie L'OFFRE EXISTANTE sans erreur ni
 * distinction d'origin (l'enum serveur est "manual", vérifié API live —
 * le JSDoc offers.js dit "manuel" à tort). Détection fiable : une offre
 * fraîchement créée porte un created_at < 1 min ; une offre existante
 * renvoyée est plus vieille. → estOffreExistante() côté composant.
 */
export const estOffreExistante = (offre) => {
  if (!offre?.created_at) return false
  const ageMs = Date.now() - new Date(offre.created_at).getTime()
  return Number.isFinite(ageMs) && ageMs > 60 * 1000
}

export const useCreerOffre = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => createOffer(data),
    onSuccess: (offre) => {
      qc.invalidateQueries({ queryKey: adminOffersKeys.root })
      return offre
    },
  })
}

/**
 * Édition — PUT /{id} (champs modifiables uniquement).
 * OfferUpdate est TOUT optionnel : on n'envoie que les champs soumis.
 */
export const useModifierOffre = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ offerId, data }) => updateOffer(offerId, data),
    onSuccess: (offre) => {
      qc.invalidateQueries({ queryKey: adminOffersKeys.root })
      qc.invalidateQueries({ queryKey: ["admin", "offers", "detail", offre?.id] })
    },
  })
}

/** Toggle visibilité — PATCH /{id}/visibility, réponse {message, visible_site}. */
export const useModifierVisibilite = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ offerId, visibleSite }) => updateVisibility(offerId, visibleSite),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminOffersKeys.root }),
  })
}

/* ─── Doublons : fusion / rejet (page /admin/offres/doublons) ───────── */

/**
 * Fusionner — POST /{offer_b_id}/mark-duplicate
 * body { duplicate_of_id: A, duplicate_reason? }. Refuse A == B et les
 * cycles de doublons (erreur serveur claire → message à afficher tel
 * quel). Ne change PAS le status de B (is_duplicate=true seulement,
 * vérifié live) : l'offre reste dans la liste mais sort du scan.
 */
export const useMarquerDoublon = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ offerBId, duplicateOfId, raison }) =>
      markDuplicate(offerBId, {
        duplicate_of_id: duplicateOfId,
        ...(raison ? { duplicate_reason: raison } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminOffersKeys.root })
    },
  })
}

/**
 * Rejeter — POST /duplicates/reject body { offer_a_id, offer_b_id, reason? }.
 * Enregistre la paire dans RejectedDuplicatePair : elle ne réapparaîtra
 * plus dans les scans suivants (vérifié : disparaît du scan au refetch).
 */
export const useRejeterDoublon = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ offerAId, offerBId, raison }) =>
      rejectDuplicate({
        offer_a_id: offerAId,
        offer_b_id: offerBId,
        ...(raison ? { reason: raison } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminOffersKeys.root })
    },
  })
}

/** Changement de statut unitaire — PATCH /{id}/status { status }. */
export const useModifierStatut = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ offerId, status }) => updateStatus(offerId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminOffersKeys.root }),
  })
}

/** Archivage (soft delete) — DELETE /{id} → 204. */
export const useArchiverOffre = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (offerId) => deleteOffer(offerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminOffersKeys.root }),
  })
}

/** Action groupée — POST /bulk-status { offer_ids (max 500), status }. */
export const useActionGroupee = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ offerIds, status }) => bulkUpdateStatus(offerIds, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminOffersKeys.root }),
  })
}

/** Import CSV/JSON — POST /import (multipart) → {message, created, ignored, errors[]}. */
export const useImportOffres = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file) => importOffers(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminOffersKeys.root }),
  })
}

/** Erreur mutation formatée (annulations ignorées — pas un message UI). */
export const messageErreurMutation = (err) =>
  isCanceledError(err) ? null : formatErr(err)

function formatErr(err) {
  const detail = err?.response?.data?.detail
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) return detail.map((d) => d?.msg).join(", ")
  return err?.response?.data?.message || err?.message || "Une erreur est survenue."
}
