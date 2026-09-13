import { createContext, useContext, useMemo } from "react"
import { useUrlFilters } from "@/hooks/use-url-filters"

/* ─────────────────────────────────────────────────────────────────────
   Contexte de filtres de la page Abonnés.
   DEUX onglets (même décision que la page IA) :
   - Pilotage      : filtres + sélection + table + anonymisation ;
   - Statistiques  : compteurs/KPI + charts.
   L'onglet vit dans l'URL (pattern LogsPage) pour un atterrissage
   partageable.
   Params miroirs du serveur : q (email/nom), status (VOCABULAIRE API :
   bouncing, pas bounced), filiere_id. Pagination offset — liste plate
   sans total.
   ⚠️ setScalar/setScalars matchent sur la CLÉ du scalaire, jamais sur
   le nom du param URL — sinon no-op silencieux (bug pagination).
───────────────────────────────────────────────────────────────────── */

const PAGE_TAILLE = 20

const CONFIG_FILTRES_ABONNES_ADMIN = {
  scalars: [
    { key: "onglet", param: "onglet", defaut: "pilotage" },
    { key: "query", param: "q", defaut: "" },
    { key: "status", param: "status", defaut: "" },
    { key: "filiereId", param: "filiere_id", defaut: "" },
    { key: "page", param: "page", defaut: "1" },
  ],
}

const FiltresAbonnesContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useFiltresAbonnesAdmin = () => {
  const ctx = useContext(FiltresAbonnesContext)
  if (!ctx) {
    throw new Error("useFiltresAbonnesAdmin doit être utilisé sous <FiltresAbonnesAdminProvider>")
  }
  return ctx
}

const _page = (valeur) => Math.max(1, parseInt(valeur, 10) || 1)

export const FiltresAbonnesAdminProvider = ({ children }) => {
  const { valeurs, setScalar, setScalars, reset } = useUrlFilters(CONFIG_FILTRES_ABONNES_ADMIN)

  const valeur = useMemo(() => {
    const page = _page(valeurs.page)
    return {
      /* Onglet courant + bascule */
      onglet: ["pilotage", "statistiques"].includes(valeurs.onglet) ? valeurs.onglet : "pilotage",
      setOnglet: (v) => setScalar("onglet", v),

      /* Filtres Pilotage */
      query: valeurs.query,
      status: valeurs.status,
      filiereId: valeurs.filiereId,
      page,
      pageTaille: PAGE_TAILLE,
      paramsApi: {
        q: valeurs.query || undefined,
        status: valeurs.status || undefined,
        filiere_id: valeurs.filiereId || undefined,
        limit: PAGE_TAILLE,
        offset: (page - 1) * PAGE_TAILLE,
      },
      /* setScalar BRUT pour le hook de recherche debounced (pattern repo). */
      setQuery: setScalar,
      /* Filtres multi-params : setScalars (une seule écriture URL) pour
         éviter que le second setSearchParams n'écrase le premier. */
      setStatus: (v) => setScalars({ status: v, page: "1" }),
      setFiliereId: (v) => setScalars({ filiereId: v, page: "1" }),
      setPage: (v) => setScalar("page", String(v)),
      reinitialiser: () => reset(),
    }
  }, [valeurs, setScalar, setScalars, reset])

  return <FiltresAbonnesContext.Provider value={valeur}>{children}</FiltresAbonnesContext.Provider>
}