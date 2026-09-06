import { createContext, useContext, useMemo } from "react"
import { useUrlFilters } from "@/hooks/use-url-filters"

/* ─────────────────────────────────────────────────────────────────────
   Contexte de filtres de la liste abonnés admin.

   Params miroirs du serveur (api/admin/subscribers.js) : q (email ou
   nom), status (VOCABULAIRE API : bouncing, pas bounced), filiere_id.
   Pagination offset en état page — liste plate sans total.
   ───────────────────────────────────────────────────────────────────── */

const PAGE_TAILLE = 20

const CONFIG_FILTRES_ABONNES_ADMIN = {
  scalars: [
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

export const FiltresAbonnesAdminProvider = ({ children }) => {
  const { valeurs, setScalar, reset } = useUrlFilters(CONFIG_FILTRES_ABONNES_ADMIN)

  const valeur = useMemo(() => {
    const page = Math.max(1, parseInt(valeurs.page, 10) || 1)
    return {
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
      // setScalar BRUT pour le hook de recherche debounced (pattern repo).
      setQuery: setScalar,
      setStatus: (v) => setScalar("status", v),
      setFiliereId: (v) => setScalar("filiereId", v),
      setPage: (v) => setScalar("page", v),
      reinitialiser: () => reset(),
    }
  }, [valeurs, setScalar, reset])

  return <FiltresAbonnesContext.Provider value={valeur}>{children}</FiltresAbonnesContext.Provider>
}
