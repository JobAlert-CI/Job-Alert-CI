import { createContext, useContext, useMemo } from "react"
import { useUrlFilters } from "@/hooks/use-url-filters"

/* ─────────────────────────────────────────────────────────────────────
   Contexte de filtres de la page Normalisation IA (cycle 19).
   Pagination : listes plates sans total → pages par liste
   (heuristique len == limit, pattern PaginationListe).
   ⚠️ setScalar/setScalars matchent sur la CLÉ du scalaire, jamais sur
   le nom du param URL — sinon no-op silencieux (bug pagination).
───────────────────────────────────────────────────────────────────── */

const TAILLE_PAGE_JOBS = 20
const TAILLE_PAGE_ALERTES = 20
const TAILLE_PAGE_SUGGESTIONS = 20

const CONFIG_FILTRES_IA_ADMIN = {
  scalars: [
    { key: "onglet", param: "onglet", defaut: "pilotage" },
    { key: "severite", param: "severite", defaut: "" },
    { key: "inclureAcquittees", param: "acquittees", defaut: "" },
    { key: "statutSuggestion", param: "statut_suggestion", defaut: "" },
    { key: "pageJobs", param: "page_jobs", defaut: "1" },
    { key: "pageAlertes", param: "page_alertes", defaut: "1" },
    { key: "pageSuggestions", param: "page_suggestions", defaut: "1" },
  ],
}

const FiltresIaContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useFiltresIaAdmin = () => {
  const ctx = useContext(FiltresIaContext)
  if (!ctx) {
    throw new Error("useFiltresIaAdmin doit être utilisé sous <FiltresIaAdminProvider>")
  }
  return ctx
}

const _page = (valeur) => Math.max(1, parseInt(valeur, 10) || 1)

export const FiltresIaAdminProvider = ({ children }) => {
  const { valeurs, setScalar, setScalars } = useUrlFilters(CONFIG_FILTRES_IA_ADMIN)

  const valeur = useMemo(
    () => ({
      onglet: ["pilotage", "statistiques"].includes(valeurs.onglet) ? valeurs.onglet : "pilotage",
      severite: valeurs.severite,
      inclureAcquittees: valeurs.inclureAcquittees === "1",
      statutSuggestion: ["pending", "approved", "rejected"].includes(valeurs.statutSuggestion)
        ? valeurs.statutSuggestion
        : "",
      pageJobs: _page(valeurs.pageJobs),
      pageAlertes: _page(valeurs.pageAlertes),
      pageSuggestions: _page(valeurs.pageSuggestions),

      paramsJobs: {
        limit: TAILLE_PAGE_JOBS,
        offset: (_page(valeurs.pageJobs) - 1) * TAILLE_PAGE_JOBS,
      },
      paramsAlertes: {
        include_acknowledged: valeurs.inclureAcquittees === "1" || undefined,
        severity: valeurs.severite || undefined,
        limit: TAILLE_PAGE_ALERTES,
        offset: (_page(valeurs.pageAlertes) - 1) * TAILLE_PAGE_ALERTES,
      },
      paramsSuggestions: {
        status_filter: undefined, // calculé par le consommateur selon statutSuggestion
        limit: TAILLE_PAGE_SUGGESTIONS,
        offset: (_page(valeurs.pageSuggestions) - 1) * TAILLE_PAGE_SUGGESTIONS,
      },

      setScalar,   // BRUT (piège « q=query » documenté)
      setOnglet: (v) => setScalar("onglet", v),

      /* Setters : on passe la CLÉ du scalaire. Les setters multi-params
         utilisent setScalars (une seule écriture URL) pour éviter que le
         second setSearchParams n'écrase le premier. */
      setSeverite: (v) => setScalars({ severite: v, pageAlertes: "1" }),
      setInclureAcquittees: (v) => setScalars({ inclureAcquittees: v ? "1" : "", pageAlertes: "1" }),
      setStatutSuggestion: (v) => setScalars({ statutSuggestion: v, pageSuggestions: "1" }),

      setPageJobs: (v) => setScalar("pageJobs", String(v)),
      setPageAlertes: (v) => setScalar("pageAlertes", String(v)),
      setPageSuggestions: (v) => setScalar("pageSuggestions", String(v)),

      reinitialiserAlertes: () => setScalars({ severite: "", inclureAcquittees: "", pageAlertes: "1" }),
    }),
    [valeurs, setScalar, setScalars]
  )

  return <FiltresIaContext.Provider value={valeur}>{children}</FiltresIaContext.Provider>
}