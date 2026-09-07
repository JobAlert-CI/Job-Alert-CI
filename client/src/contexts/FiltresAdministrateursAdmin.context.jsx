import { createContext, useContext, useMemo } from "react"
import { useUrlFilters } from "@/hooks/use-url-filters"

/* ─────────────────────────────────────────────────────────────────────
   Contexte de filtres de la liste administrateurs admin (cycle 15).

   Params miroirs du serveur (api/admin/admins.js, cycle 15) : q (email
   ou nom), role, is_active. Pagination offset en état page — liste plate
   sans total. `actif` (actifs|inactifs) est converti en is_active bool
   cote paramsApi : l'URL reste lisible, l'API recoit son vocabulaire.
   ───────────────────────────────────────────────────────────────────── */

const PAGE_TAILLE = 50

const CONFIG_FILTRES_ADMINISTRATEURS_ADMIN = {
  scalars: [
    { key: "query", param: "q", defaut: "" },
    { key: "role", param: "role", defaut: "" },
    { key: "actif", param: "actif", defaut: "" },       // "" | "actifs" | "inactifs"
    { key: "page", param: "page", defaut: "1" },
  ],
}

const FiltresAdministrateursContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useFiltresAdministrateursAdmin = () => {
  const ctx = useContext(FiltresAdministrateursContext)
  if (!ctx) {
    throw new Error("useFiltresAdministrateursAdmin doit être utilisé sous <FiltresAdministrateursAdminProvider>")
  }
  return ctx
}

export const FiltresAdministrateursAdminProvider = ({ children }) => {
  const { valeurs, setScalar, reset } = useUrlFilters(CONFIG_FILTRES_ADMINISTRATEURS_ADMIN)

  const valeur = useMemo(() => {
    const page = Math.max(1, parseInt(valeurs.page, 10) || 1)
    return {
      query: valeurs.query,
      role: valeurs.role,
      actif: valeurs.actif,
      page,
      pageTaille: PAGE_TAILLE,
      paramsApi: {
        q: valeurs.query || undefined,
        role: valeurs.role || undefined,
        is_active: valeurs.actif ? valeurs.actif === "actifs" : undefined,
        limit: PAGE_TAILLE,
        offset: (page - 1) * PAGE_TAILLE,
      },
      // setScalar BRUT pour le hook de recherche debounced (pattern repo,
      // piège « q=query » documenté dans le skill).
      setQuery: setScalar,
      setRole: (v) => setScalar("role", v),
      setActif: (v) => setScalar("actif", v),
      setPage: (v) => setScalar("page", v),
      reinitialiser: () => reset(),
    }
  }, [valeurs, setScalar, reset])

  return <FiltresAdministrateursContext.Provider value={valeur}>{children}</FiltresAdministrateursContext.Provider>
}
