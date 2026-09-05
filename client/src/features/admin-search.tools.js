import { useQuery } from "@tanstack/react-query"
import { globalSearch } from "@/api/admin/dashboard"

/* ─────────────────────────────────────────────────────────────────────
   Recherche transverse admin (offres / abonnés / entreprises).

   GET /api/admin/search?q=...&per_type_limit=10 → réponse groupée :
   { query, per_type_limit, offers[], subscribers[], companies[] }
   (cf. fixture adminDashboard.globalSearch — moderateur exclu côté
   serveur : require_roles super_admin, gestionnaire_offres,
   gestionnaire_utilisateurs).
   ───────────────────────────────────────────────────────────────────── */

export const SEARCH_PER_TYPE_LIMIT = 10

export const adminSearchKeys = {
  root: ["admin", "search"],
  query: (q) => ["admin", "search", q],
}

/**
 * Recherche debouncée par l'appelant (350 ms, pattern
 * use-recherche-debouncee côté pages). Résultats plafonnés par type.
 * enabled: false tant que q est vide — la barre de recherche ne doit
 * jamais déclencher d'appel avec une string vide (400 serveur).
 */
export const useAdminGlobalSearchQuery = (q, { enabled = true } = {}) =>
  useQuery({
    queryKey: adminSearchKeys.query(q || ""),
    queryFn: ({ signal }) => globalSearch({ q, per_type_limit: SEARCH_PER_TYPE_LIMIT }, { signal }),
    enabled: enabled && !!q?.trim(),
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev, // évite le flash "aucun résultat" entre saisies
    retry: false,
  })
