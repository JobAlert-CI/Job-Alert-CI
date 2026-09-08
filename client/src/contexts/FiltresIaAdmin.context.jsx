import { createContext, useContext, useMemo } from "react"
import { useUrlFilters } from "@/hooks/use-url-filters"

/* ─────────────────────────────────────────────────────────────────────
   Contexte de filtres de la page Normalisation IA (cycle 19).

   DEUX onglets (décision utilisateur : stats à part) :
   - Pilotage : queue + run + jobs + clés + alertes + suggestions ;
   - Statistiques : compteurs IA1-IA6 + charts C1-C5 (GET /stats).

   L'onglet vit dans l'URL (pattern LogsPage cycle 17) pour un
   atterrissage partageable. Pagination : listes plates sans total →
   pages par liste (heuristique len == limit, pattern PaginationListe).
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
  const { valeurs, setScalar } = useUrlFilters(CONFIG_FILTRES_IA_ADMIN)

  const valeur = useMemo(
    () => ({
      onglet: ["pilotage", "stats"].includes(valeurs.onglet) ? valeurs.onglet : "pilotage",
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
      setScalar, // BRUT (piège « q=query » documenté)
      setOnglet: (v) => setScalar("onglet", v),
      setSeverite: (v) => { setScalar("severite", v); setScalar("page_alertes", "1") },
      setInclureAcquittees: (v) => { setScalar("acquittees", v ? "1" : ""); setScalar("page_alertes", "1") },
      setStatutSuggestion: (v) => { setScalar("statut_suggestion", v); setScalar("page_suggestions", "1") },
      setPageJobs: (v) => setScalar("page_jobs", v),
      setPageAlertes: (v) => setScalar("page_alertes", v),
      setPageSuggestions: (v) => setScalar("page_suggestions", v),
      reinitialiserAlertes: () => {
        setScalar("severite", ""); setScalar("acquittees", ""); setScalar("page_alertes", "1")
      },
    }),
    [valeurs, setScalar]
  )

  return <FiltresIaContext.Provider value={valeur}>{children}</FiltresIaContext.Provider>
}
