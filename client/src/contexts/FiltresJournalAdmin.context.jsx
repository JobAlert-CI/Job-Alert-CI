import { createContext, useContext, useMemo } from "react"
import { useUrlFilters } from "@/hooks/use-url-filters"

/* ─────────────────────────────────────────────────────────────────────
   Contexte de filtres du journal d'activité (cycle 16).

   Params miroirs du serveur (api/admin/logs.js) : admin_id, action,
   target_table. Pagination offset en état page — MAIS le total est
   désormais servi (/audit renvoie {items, total}), donc la page peut
   afficher « X sur N » et calculer le nombre de pages.

   Pas de paramètre q : l'endpoint n'expose pas de recherche texte
   (action/admin/table sont les 3 seuls filtres serveur).
   ───────────────────────────────────────────────────────────────────── */

const PAGE_TAILLE = 50

const CONFIG_FILTRES_JOURNAL_ADMIN = {
  scalars: [
    { key: "admin", param: "admin_id", defaut: "" },
    { key: "action", param: "action", defaut: "" },
    { key: "table", param: "target_table", defaut: "" },
    { key: "page", param: "page", defaut: "1" },
  ],
}

const FiltresJournalContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useFiltresJournalAdmin = () => {
  const ctx = useContext(FiltresJournalContext)
  if (!ctx) {
    throw new Error("useFiltresJournalAdmin doit être utilisé sous <FiltresJournalAdminProvider>")
  }
  return ctx
}

export const FiltresJournalAdminProvider = ({ children }) => {
  const { valeurs, setScalar, reset } = useUrlFilters(CONFIG_FILTRES_JOURNAL_ADMIN)

  const valeur = useMemo(() => {
    const page = Math.max(1, parseInt(valeurs.page, 10) || 1)
    return {
      admin: valeurs.admin,
      action: valeurs.action,
      table: valeurs.table,
      page,
      pageTaille: PAGE_TAILLE,
      paramsApi: {
        admin_id: valeurs.admin || undefined,
        action: valeurs.action || undefined,
        target_table: valeurs.table || undefined,
        limit: PAGE_TAILLE,
        offset: (page - 1) * PAGE_TAILLE,
      },
      setAdmin: (v) => { setScalar("admin", v); setScalar("page", "1") },
      setAction: (v) => { setScalar("action", v); setScalar("page", "1") },
      setTable: (v) => { setScalar("table", v); setScalar("page", "1") },
      setPage: (v) => setScalar("page", v),
      reinitialiser: () => reset(),
    }
  }, [valeurs, setScalar, reset])

  return <FiltresJournalContext.Provider value={valeur}>{children}</FiltresJournalContext.Provider>
}
