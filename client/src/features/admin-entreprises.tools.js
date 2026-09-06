import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getCompanies, getTopRecruiters, updateCompany, deleteCompany, mergeCompanies,
} from "@/api/admin/companies"
import { isCanceledError } from "@/api/errors"

/* ─────────────────────────────────────────────────────────────────────
   Gestion des entreprises : hooks TanStack (liste, top, mutations).

   Router /api/admin/companies : super_admin UNIQUEMENT (les entreprises
   impactent l'affichage public — accès restreint en profondeur).

   Shapes réelles (vérifiées API live 2026-09-05) :
   - GET /companies?q&limit&offset → liste plate de CompanyAdminRead :
     { id, name, normalized_name, slug, website_url, logo_url,
       description, primary_filiere_id, active_offers_count,
       created_at, updated_at } — PAS de total (pagination heuristique).
   - GET /companies/top-recruiters?limit → même shape, tri serveur par
     active_offers_count décroissant (une requête SQL agrégée).
   - PUT /companies/{id} — CompanyUpdate TOUT optionnel (name,
     normalized_name, slug, website_url, logo_url, description,
     primary_filiere_id).
   - DELETE /companies/{id} → 204 soft delete.
   - POST /{target}/merge/{source} → { message, offers_reassigned, … } :
     réattribue TOUTES les offres de source vers target puis soft-delete
     la source. Fort impact silencieux → confirmation AVANT avec compte
     d'offres affiché (doc v3 §6), jamais seulement après.
   ───────────────────────────────────────────────────────────────────── */

export const adminCompaniesKeys = {
  root: ["admin", "companies"],
  liste: (params) => ["admin", "companies", "liste", params],
  top: (params) => ["admin", "companies", "top", params],
}

/* ─── Liste (recherche + pagination heuristique) ────────────────────── */

export const useAdminCompaniesQuery = (params) =>
  useQuery({
    queryKey: adminCompaniesKeys.liste(params),
    queryFn: ({ signal }) => getCompanies(params, { signal }),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    retry: 1,
  })

/* ─── Top recruteurs (agregat SQL, tri serveur) ─────────────────────── */

export const useAdminTopRecruteursQuery = (params = { limit: 10 }) =>
  useQuery({
    queryKey: adminCompaniesKeys.top(params),
    queryFn: ({ signal }) => getTopRecruiters(params, { signal }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

/* ─── Mutations ─────────────────────────────────────────────────────── */

/** Édition fiche — PUT /{id}, champs fournis uniquement. */
export const useModifierEntreprise = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ companyId, data }) => updateCompany(companyId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminCompaniesKeys.root }),
  })
}

/** Soft delete — DELETE /{id} → 204. */
export const useSupprimerEntreprise = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (companyId) => deleteCompany(companyId),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminCompaniesKeys.root }),
  })
}

/**
 * Fusion — POST /{target}/merge/{source}.
 * Réponse { message, offers_reassigned } : le nombre d'offres
 * réattribuées est journalisé en audit. L'UI DOIT afficher ce compte
 * dans la confirmation AVANT l'action (doc v3 §6).
 */
export const useFusionnerEntreprises = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ targetId, sourceId }) => mergeCompanies(targetId, sourceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminCompaniesKeys.root }),
  })
}

/** Erreur mutation formatée (annulations ignorées). */
export const messageErreurCompany = (err) =>
  isCanceledError(err) ? null : formatErr(err)

function formatErr(err) {
  const detail = err?.response?.data?.detail
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) return detail.map((d) => d?.msg).join(", ")
  return err?.response?.data?.message || err?.message || "Une erreur est survenue."
}
