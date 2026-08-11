// src/pages/conseils/conseils.context.jsx
import {
  createContext, useCallback, useContext, useDeferredValue,
  useEffect, useMemo, useState,
} from "react"
import { useUrlFilters } from "@/hooks/use-url-filters"
import { useRechercheDebouncee } from "@/hooks/use-recherche-debouncee"
import { 
  CONFIG_FILTRES, MODES_TRI, PAR_PAGE,
  filtrerEtTrierArticles, normaliser,
  useArticlesQuery, useCategoriesQuery
} from "@/tools/conseils.tools"

/* ════════════════════════════════════════════════════════════════════
   ÉTAT DE LA BIBLIOTHÈQUE — filtres URL + recherche + pagination.
   La sidebar (Plus lus / Séries / Alerte) ne consomme PAS ce contexte :
   la frappe clavier ne la re-rend jamais.
════════════════════════════════════════════════════════════════════ */
const BibliothequeContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useBibliotheque = () => {
  const ctx = useContext(BibliothequeContext)
  if (!ctx) throw new Error("useBibliotheque doit être utilisé sous <BibliothequeProvider>")
  return ctx
}


export const BibliothequeProvider = ({ children }) => {
  const { valeurs, setScalar, reset } = useUrlFilters(CONFIG_FILTRES)
  const {
    data: articles,
    isPending: articlesPending,
    isError: articlesError,
    refetch: refetchArticles,
  } = useArticlesQuery()
  const { data: categories } = useCategoriesQuery()

  /* Catégories dédupliquées pour les chips */
  const categoriesPourFiltres = useMemo(() => {
    const base = Array.isArray(categories) ? categories : []
    return base.filter((cat, i, arr) => arr.findIndex((x) => x.code === cat.code) === i)
  }, [categories])

  /* Valeurs commitées, validées contre les données réelles */
  const cat =
    valeurs.cat === "tous" || categoriesPourFiltres.some((c) => c.code === valeurs.cat)
      ? valeurs.cat
      : "tous"
  const sort = MODES_TRI.some((m) => m.k === valeurs.sort) ? valeurs.sort : "recents"
  const setCat = useCallback((code) => setScalar("cat", code), [setScalar])
  const setSort = useCallback((k) => setScalar("sort", k), [setScalar])

  /* Recherche : saisie instantanée → URL debouncée */
  const { valeurLocale: queryLocale, setValeurLocale: setQueryLocale } =
    useRechercheDebouncee({ valeurUrl: valeurs.query, setScalar })

  /* Le filtrage utilise une valeur DIFFÉRÉE : le champ reste fluide
     même sur de grosses listes (React n'attend pas le re-rend de la grille). */
  const rechercheNormee = useMemo(() => normaliser(queryLocale), [queryLocale])
  const rechercheDifferee = useDeferredValue(rechercheNormee)

  const [page, setPage] = useState(1)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1)
  }, [cat, sort, rechercheNormee])

  const chipsDefs = useMemo(
    () => [
      { code: "tous", label: "Tous", icon: null, count: articles.length },
      ...categoriesPourFiltres.map((c) => ({
        ...c,
        count: articles.filter((a) => a.category?.code === c.code).length,
      })),
    ],
    [articles, categoriesPourFiltres]
  )

  const filtered = useMemo(
    () => filtrerEtTrierArticles(articles, cat, rechercheDifferee, sort),
    [articles, cat, rechercheDifferee, sort]
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAR_PAGE))
  const pageCourante = Math.min(page, totalPages)
  const depart = (pageCourante - 1) * PAR_PAGE
  const visibles = useMemo(
    () => filtered.slice(depart, depart + PAR_PAGE),
    [filtered, depart]
  )

  const activeCount =
    (cat !== "tous" ? 1 : 0) +
    (sort !== "recents" ? 1 : 0) +
    (queryLocale.trim() ? 1 : 0)

  const resetFiltres = useCallback(() => {
    reset()
    setQueryLocale("")
  }, [reset, setQueryLocale])

  const value = useMemo(
    () => ({
      articles, articlesPending, articlesError, refetchArticles,
      categoriesPourFiltres, chipsDefs,
      cat, setCat, sort, setSort,
      queryLocale, setQueryLocale, rechercheNormee,
      filtered, visibles,
      page: pageCourante, setPage, totalPages, depart,
      activeCount, resetFiltres,
    }),
    [articles, articlesPending, articlesError, refetchArticles,
     categoriesPourFiltres, chipsDefs, cat, setCat, sort, setSort,
     queryLocale, setQueryLocale, rechercheNormee, filtered, visibles,
     pageCourante, totalPages, depart, activeCount, resetFiltres]
  )

  return (
    <BibliothequeContext.Provider value={value}>
      {children}
    </BibliothequeContext.Provider>
  )
}