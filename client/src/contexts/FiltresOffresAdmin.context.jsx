import { createContext, useContext, useMemo } from "react"
import { useUrlFilters } from "@/hooks/use-url-filters"

/* ─────────────────────────────────────────────────────────────────────
   Contexte de filtres de la liste offres admin.

   Réutilise le hook standard du repo (use-url-filters — URL source de
   vérité, écriture en replace) : même mécanique que la page publique
   /offres, zéro duplication.

   Params miroirs des query params serveur (api/admin/offers.js) :
     q, status, origin, visible_site, filiere_id, source_id + page.

   La réponse /offers est une liste PLATE (pas de total) : la
   pagination "suivante" est déduite de la longueur reçue (si len ==
   limit, il existe probablement une page suivante — heuristique
   honnête, documentée ici).
   ───────────────────────────────────────────────────────────────────── */

const PAGE_TAILLE = 20

const CONFIG_FILTRES_OFFRES_ADMIN = {
  scalars: [
    { key: "query", param: "q", defaut: "" },
    { key: "status", param: "status", defaut: "" },
    { key: "origin", param: "origin", defaut: "" },
    { key: "visible", param: "visible_site", defaut: "" },
    { key: "filiereId", param: "filiere_id", defaut: "" },
    { key: "sourceId", param: "source_id", defaut: "" },
    { key: "page", param: "page", defaut: "1" },
  ],
}

const FiltresOffresContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useFiltresOffresAdmin = () => {
  const ctx = useContext(FiltresOffresContext)
  if (!ctx) throw new Error("useFiltresOffresAdmin doit être utilisé sous <FiltresOffresAdminProvider>")
  return ctx
}

export const FiltresOffresAdminProvider = ({ children }) => {
  const { valeurs, setScalar, reset } = useUrlFilters(CONFIG_FILTRES_OFFRES_ADMIN)

  const valeur = useMemo(() => {
    const page = Math.max(1, parseInt(valeurs.page, 10) || 1)
    return {
      query: valeurs.query,
      status: valeurs.status,
      origin: valeurs.origin,
      visible: valeurs.visible,
      filiereId: valeurs.filiereId,
      sourceId: valeurs.sourceId,
      page,
      pageTaille: PAGE_TAILLE,
      // Params exacts attendus par GET /api/admin/offers (cleanParams
      // côté API retire les vides).
      paramsApi: {
        q: valeurs.query || undefined,
        status: valeurs.status || undefined,
        origin: valeurs.origin || undefined,
        visible_site: valeurs.visible || undefined,
        filiere_id: valeurs.filiereId || undefined,
        source_id: valeurs.sourceId || undefined,
        limit: PAGE_TAILLE,
        offset: (page - 1) * PAGE_TAILLE,
      },
      // setScalar BRUT (pattern Conseils.context) : le hook de recherche
      // debounced l'appelle setScalar(cle, valeur) — un wrapper
      // monorange écrirait la CLE comme valeur (bug « q=query »).
      setQuery: setScalar,
      setStatus: (v) => setScalar("status", v),
      setOrigin: (v) => setScalar("origin", v),
      setVisible: (v) => setScalar("visible", v),
      setFiliereId: (v) => setScalar("filiereId", v),
      setSourceId: (v) => setScalar("sourceId", v),
      setPage: (v) => setScalar("page", v),
      reinitialiser: reset,
    }
  }, [valeurs, setScalar, reset])

  return <FiltresOffresContext.Provider value={valeur}>{children}</FiltresOffresContext.Provider>
}
