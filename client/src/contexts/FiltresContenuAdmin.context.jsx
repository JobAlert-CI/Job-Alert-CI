import { createContext, useContext, useMemo } from "react"
import { useUrlFilters } from "@/hooks/use-url-filters"

/* ─────────────────────────────────────────────────────────────────────
   Contexte de filtres de la page Gestion du contenu (cycle 14).
   L'onglet actif est synchronisé dans l'URL (param `onglet`) — même
   pattern que la page Normalisation IA (FiltresIaAdmin) : deep-link
   possible, état conservé au rechargement / partage de lien.
   ───────────────────────────────────────────────────────────────────── */
const CONFIG_FILTRES_CONTENU_ADMIN = {
  scalars: [
    { key: "onglet", param: "onglet", defaut: "articles" },
  ],
}

const FiltresContenuContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useFiltresContenuAdmin = () => {
  const ctx = useContext(FiltresContenuContext)
  if (!ctx) {
    throw new Error("useFiltresContenuAdmin doit être utilisé sous <FiltresContenuAdminProvider>")
  }
  return ctx
}

export const FiltresContenuAdminProvider = ({ children }) => {
  const { valeurs, setScalar } = useUrlFilters(CONFIG_FILTRES_CONTENU_ADMIN)

  const valeur = useMemo(
    () => ({
      onglet: ["articles", "categories", "series", "conseils", "pages"].includes(valeurs.onglet)
        ? valeurs.onglet
        : "articles",
      setOnglet: (v) => setScalar("onglet", v),
    }),
    [valeurs, setScalar]
  )

  return <FiltresContenuContext.Provider value={valeur}>{children}</FiltresContenuContext.Provider>
}