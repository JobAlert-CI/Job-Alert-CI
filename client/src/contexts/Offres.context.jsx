import {
  createContext, useCallback, useContext, useMemo,
} from "react"
import { useUrlFilters } from "@/hooks/use-url-filters"
import { SORTS } from "@/lib/referentiels"
import { CONFIG_FILTRES } from "@/tools/offres.tools"


const OffresContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useOffresFilters = () => {
  const ctx = useContext(OffresContext)
  if (!ctx) throw new Error("useOffresFilters doit être utilisé sous <OffresFiltersProvider>")
  return ctx
}

export const OffresFiltersProvider = ({ children }) => {
  const { filters, valeurs, toggle, setScalar, setPeriod, reset } =
    useUrlFilters(CONFIG_FILTRES)

  const sort = SORTS.some((s) => s.k === valeurs.sort) ? valeurs.sort : "recent"
  const view = valeurs.view === "grid" ? "grid" : "list"
  const locationId = valeurs.location || null

  const setSort = useCallback((k) => setScalar("sort", k), [setScalar])
  const setView = useCallback((v) => setScalar("view", v), [setScalar])
  const setLocation = useCallback((id) => setScalar("location", id ?? ""), [setScalar])
  const resetTout = useCallback(() => reset(), [reset])

  const activeCount = useMemo(
    () =>
      filters.filieres.size + filters.sources.size + filters.contrats.size +
      filters.experiences.size + filters.niveaux.size +
      (locationId ? 1 : 0) +
      (filters.period.start || filters.period.end ? 1 : 0),
    [filters, locationId]
  )

  /* Valeur mémoïsée : les consommateurs ne re-rendent que sur un
     changement réel des filtres commités. */
  const value = useMemo(
    () => ({
      filters, valeurs, toggle, setScalar, setPeriod, reset,
      sort, view, locationId,
      setSort, setView, setLocation, resetTout,
      activeCount,
    }),
    [filters, valeurs, toggle, setScalar, setPeriod, reset, sort, view, locationId,
     setSort, setView, setLocation, resetTout, activeCount]
  )

  return <OffresContext.Provider value={value}>{children}</OffresContext.Provider>
}