import { createContext, useContext, useMemo } from "react"
import { useUrlFilters } from "@/hooks/use-url-filters"

/* ─────────────────────────────────────────────────────────────────────
   Contexte de filtres de la page Santé du système.
   Onglet + filtres des événements dans l'URL (pattern FiltresIaAdmin) :
   atterrissage partageable, état conservé entre changements d'onglet.
   ⚠️ setScalar/setScalars matchent sur la CLÉ du scalaire, jamais sur
   le nom du param URL — sinon no-op silencieux (bug pagination).
───────────────────────────────────────────────────────────────────── */

const TAILLE_PAGE_EVENEMENTS = 50
const FENETRES_VALIDES = [1, 7, 30, 90]

const CONFIG_FILTRES_SYSTEME = {
  scalars: [
    { key: "onglet", param: "onglet", defaut: "sante" },
    { key: "source", param: "evt_source", defaut: "" },
    { key: "severity", param: "evt_severite", defaut: "" },
    { key: "days", param: "evt_fenetre", defaut: "7" },
    { key: "page", param: "evt_page", defaut: "1" },
  ],
}

const FiltresSystemeContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useFiltresSysteme = () => {
  const ctx = useContext(FiltresSystemeContext)
  if (!ctx) {
    throw new Error("useFiltresSysteme doit être utilisé sous <FiltresSystemeProvider>")
  }
  return ctx
}

const _page = (valeur) => Math.max(1, parseInt(valeur, 10) || 1)
const _days = (valeur) => (FENETRES_VALIDES.includes(Number(valeur)) ? Number(valeur) : 7)

export const FiltresSystemeProvider = ({ children }) => {
  const { valeurs, setScalar, setScalars } = useUrlFilters(CONFIG_FILTRES_SYSTEME)

  const valeur = useMemo(
    () => ({
      onglet: ["sante", "evenements", "planification"].includes(valeurs.onglet) ? valeurs.onglet : "sante",
      setOnglet: (v) => setScalar("onglet", v),

      /* Filtres de l'onglet Événements */
      source: valeurs.source,
      severity: valeurs.severity,
      days: _days(valeurs.days),
      page: _page(valeurs.page),

      /* Miroir strict des Query params serveur (limit 50, offset paginé). */
      paramsEvenements: {
        source: valeurs.source || undefined,
        severity: valeurs.severity || undefined,
        days: _days(valeurs.days),
        limit: TAILLE_PAGE_EVENEMENTS,
        offset: (_page(valeurs.page) - 1) * TAILLE_PAGE_EVENEMENTS,
      },

      /* Tout changement de filtre repart à la page 1 — écriture groupée
         (setScalars) pour éviter que le second setSearchParams n'écrase
         le premier. */
      setSource: (v) => setScalars({ source: v, page: "1" }),
      setSeverity: (v) => setScalars({ severity: v, page: "1" }),
      setDays: (v) => setScalars({ days: String(v), page: "1" }),
      setPage: (v) => setScalar("page", String(v)),
      reinitialiserEvenements: () => setScalars({ source: "", severity: "", days: "7", page: "1" }),
    }),
    [valeurs, setScalar, setScalars]
  )

  return <FiltresSystemeContext.Provider value={valeur}>{children}</FiltresSystemeContext.Provider>
}