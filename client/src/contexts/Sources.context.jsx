// src/pages/sources/sources.context.jsx
import { createContext, useContext, useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  adaptSources,
  sourcesKeys,
  useGlobalStatsQuery,
  useSourcesListQuery,
  useSourcesStatsQuery,
} from "@/tools/sources.tools"

const SourcesContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useSourcesContext = () => {
  const ctx = useContext(SourcesContext)
  if (!ctx) throw new Error("useSourcesContext doit être utilisé sous <SourcesProvider>")
  return ctx
}

export const SourcesProvider = ({ children }) => {
  const queryClient = useQueryClient()

  const sourcesQuery = useSourcesListQuery()
  const statsQuery = useSourcesStatsQuery()
  const globalQuery = useGlobalStatsQuery()

  /* Données adaptées, mémoïsées */
  // const parSource = useMemo(
  //   () => (statsQuery.data ?? []).map(adaptSourceStats).filter(Boolean),
  //   [statsQuery.data]
  // )

  const sources = useMemo(
    () => adaptSources(sourcesQuery.data ?? [], statsQuery.data ?? []),
    [sourcesQuery.data, statsQuery.data]
  )

  const totalNouveaux = useMemo(
    () => sources.reduce((sum, s) => sum + (s.nouveaux ?? 0), 0),
    [sources]
  )
  const totalActives = useMemo(
    () => sources.reduce((sum, s) => sum + (s.total ?? 0), 0),
    [sources]
  )

  /**
   * STATUT — ordre de priorité garanti :
   *
   * 1. "loading" : aucune donnée ET requête pas terminée.
   *    ⚠️ On teste aussi `isFetching` : quand une ERREUR EN CACHE est
   *    rejouée, TanStack repasse en fetch pour retenter — pendant ce
   *    temps `isError` est déjà true. Sans ce test, l'écran d'erreur
   *    flashait au lieu des skeletons.
   * 2. "error"  : échec réel et définitif, sans donnée à afficher.
   * 3. "empty"  : requête réussie mais liste vide.
   * 4. "ready".
   */
  const statut = useMemo(() => {
    const aucuneDonnee = sources.length === 0
    if (aucuneDonnee && (sourcesQuery.isPending || sourcesQuery.isFetching)) {
      return "loading"
    }
    if (aucuneDonnee && sourcesQuery.isError) return "error"
    if (aucuneDonnee) return "empty"
    return "ready"
  }, [
    sources.length,
    sourcesQuery.isPending,
    sourcesQuery.isFetching,
    sourcesQuery.isError,
  ])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const retry = () =>
    queryClient.invalidateQueries({ queryKey: sourcesKeys.root })

  const value = useMemo(
    () => ({
      statut,
      sources,
      // parSource,
      totalNouveaux,
      totalActives,
      nbSources: sources.length,
      globalStats: globalQuery.data ?? {},
      erreur: sourcesQuery.isError ? sourcesQuery.error : null,
      erreurs: {
        ...(sourcesQuery.isError ? { sources: sourcesQuery.error } : {}),
        ...(statsQuery.isError ? { stats: statsQuery.error } : {}),
        ...(globalQuery.isError ? { global: globalQuery.error } : {}),
      },
      retry,
      /* accès directs si un composant en a besoin */
      sourcesQuery,
      statsQuery,
      globalQuery,
    }),
    [statut, sources, totalNouveaux, totalActives, globalQuery, sourcesQuery, statsQuery, retry]
  )

  return <SourcesContext.Provider value={value}>{children}</SourcesContext.Provider>
}