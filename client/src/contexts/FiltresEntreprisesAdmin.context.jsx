import { createContext, useContext, useMemo } from "react"
import { useUrlFilters } from "@/hooks/use-url-filters"

/* ─────────────────────────────────────────────────────────────────────
   Contexte de filtres de la liste entreprises admin.

   Réutilise le hook standard du repo (URL = source de vérité, écriture
   replace) — même mécanique que la page publique /offres et que le
   contexte filtres Offres admin.

   Params miroirs du serveur (api/admin/companies.js) : q (recherche
   nom, max 120). La pagination offset/limit est gérée en état local
   page (l'API renvoie une liste plate sans total).

   Le tri est LOCAL (pas de paramètre serveur de tri sur la liste) :
   exposé ici pour rester hors du rendu.
   ───────────────────────────────────────────────────────────────────── */

const PAGE_TAILLE = 50

const CONFIG_FILTRES_ENTREPRISES_ADMIN = {
  scalars: [
    { key: "query", param: "q", defaut: "" },
    { key: "page", param: "page", defaut: "1" },
  ],
}

const FiltresEntreprisesContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useFiltresEntreprisesAdmin = () => {
  const ctx = useContext(FiltresEntreprisesContext)
  if (!ctx) {
    throw new Error("useFiltresEntreprisesAdmin doit être utilisé sous <FiltresEntreprisesAdminProvider>")
  }
  return ctx
}

export const FiltresEntreprisesAdminProvider = ({ children }) => {
  const { valeurs, setScalar, reset } = useUrlFilters(CONFIG_FILTRES_ENTREPRISES_ADMIN)

  const valeur = useMemo(() => {
    const page = Math.max(1, parseInt(valeurs.page, 10) || 1)
    return {
      query: valeurs.query,
      page,
      pageTaille: PAGE_TAILLE,
      // Params exacts attendus par GET /api/admin/companies.
      paramsApi: {
        q: valeurs.query || undefined,
        limit: PAGE_TAILLE,
        offset: (page - 1) * PAGE_TAILLE,
      },
      // setScalar BRUT (pattern Conseils.context) : le hook de recherche
      // debounced l'appelle setScalar(cle, valeur) — un wrapper
      // monorange écrirait la CLE comme valeur (bug « q=query »).
      setQuery: setScalar,
      setPage: (v) => setScalar("page", v),
      reinitialiser: () => reset(),
    }
  }, [valeurs, setScalar, reset])

  return <FiltresEntreprisesContext.Provider value={valeur}>{children}</FiltresEntreprisesContext.Provider>
}
