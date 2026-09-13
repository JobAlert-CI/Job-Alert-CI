import { createContext, useContext, useEffect, useMemo, useRef } from "react"
import { useUrlFilters } from "@/hooks/use-url-filters"

/* ─────────────────────────────────────────────────────────────────────
Contexte de filtres du journal d'activité (cycle 16).
Params miroirs du serveur (api/admin/logs.js) : admin_id, action,
target_table. Pagination offset en état page — le total est servi
(/audit renvoie {items, total}), la page affiche « X sur N ».
Pas de paramètre q : l'endpoint n'expose pas de recherche texte.
───────────────────────────────────────────────────────────────────── */
const PAGE_TAILLE = 50

const CONFIG_FILTRES_JOURNAL_ADMIN = {
  scalars: [
    { key: "admin", param: "admin_id", defaut: "" },
    { key: "action", param: "action", defaut: "" },
    { key: "table", param: "target_table", defaut: "" },
    { key: "debut", param: "date_debut", defaut: "" },
    { key: "fin", param: "date_fin", defaut: "" },
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

  /* Reset RÉACTIF de la page : dès que la signature des filtres
     change, retour à la page 1 — sans jamais doubler les setScalar
     dans un même handler (source du bug de filtres « morts »). */
  const signatureFiltres = `${valeurs.admin}|${valeurs.action}|${valeurs.table}|${valeurs.debut}|${valeurs.fin}`
  const signaturePrecedente = useRef(signatureFiltres)
  useEffect(() => {
    if (signaturePrecedente.current !== signatureFiltres) {
      signaturePrecedente.current = signatureFiltres
      if (valeurs.page !== "1") setScalar("page", "1")
    }
  }, [signatureFiltres, valeurs.page, setScalar])

  const valeur = useMemo(() => {
    const page = Math.max(1, parseInt(valeurs.page, 10) || 1)
    return {
      admin: valeurs.admin,
      action: valeurs.action,
      table: valeurs.table,
      // Audit 4, A.7 : plage de dates optionnelle (AAAA-MM-JJ, bornes
      // inclusives côté serveur ; 400 explicite si malformée).
      debut: valeurs.debut,
      fin: valeurs.fin,
      page,
      pageTaille: PAGE_TAILLE,
      paramsApi: {
        admin_id: valeurs.admin || undefined,
        action: valeurs.action || undefined,
        target_table: valeurs.table || undefined,
        date_debut: valeurs.debut || undefined,
        date_fin: valeurs.fin || undefined,
        limit: PAGE_TAILLE,
        offset: (page - 1) * PAGE_TAILLE,
      },
      /* UN seul setScalar par setter — la remise à 1 de la page est
         gérée par l'effet ci-dessus. */
      setAdmin: (v) => setScalar("admin", v),
      setAction: (v) => setScalar("action", v),
      setTable: (v) => setScalar("table", v),
      setDebut: (v) => setScalar("debut", v),
      setFin: (v) => setScalar("fin", v),
      setPage: (v) => setScalar("page", v),
      reinitialiser: () => reset(),
    }
  }, [valeurs, setScalar, reset])

  return <FiltresJournalContext.Provider value={valeur}>{children}</FiltresJournalContext.Provider>
}