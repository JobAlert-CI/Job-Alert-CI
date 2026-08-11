// src/pages/conseils/detail/conseil-detail.context.jsx
import { createContext, useContext, useEffect, useMemo } from "react"
import { useParams } from "react-router-dom"
import {
  CATEGORIE_DEFAUT, useArticleQuery, useArticlesSimilarQuery, useTrackArticleView,
  adaptArticleDetail, adaptArticlesSimilaires, adaptContenu, normaliserHue,
} from "@/tools/conseil-detail.tools"

/* ════════════════════════════════════════════════════════════════════
   CONTEXTE DE PAGE — chaque bloc lit l'article, le contenu, la
   catégorie et les suggestions ici : zéro prop relayée.
   Avant : EnTeteArticle → CarteBrief, CorpsArticle → MemeTheme/MiniAlerte,
   related/relatedStatut/copied/onCopy passés partout.
════════════════════════════════════════════════════════════════════ */
const ConseilDetailContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useConseilDetail = () => {
  const ctx = useContext(ConseilDetailContext)
  if (!ctx) throw new Error("useConseilDetail doit être utilisé sous <ConseilDetailProvider>")
  return ctx
}

export const ConseilDetailProvider = ({ children }) => {
  const { slug } = useParams()

  /* Deux requêtes indépendantes et PARALLÈLES :
     l'article n'attend pas les similaires (et inversement). */
  const articleQuery = useArticleQuery(slug)
  const similarQuery = useArticlesSimilarQuery(slug)

  /* Adaptations mémoïsées */
  const article = useMemo(() => adaptArticleDetail(articleQuery.data), [articleQuery.data])
  const contenu = useMemo(
    () => (article ? adaptContenu(articleQuery.data, article) : null),
    [articleQuery.data, article]
  )
  const cat = article?.category ?? CATEGORIE_DEFAUT
  const hue = useMemo(() => normaliserHue(cat), [cat])

  const similar = useMemo(
    () => adaptArticlesSimilaires(similarQuery.data, article?.cat),
    [similarQuery.data, article?.cat]
  )

  /* Vue comptée une seule fois, uniquement quand l'article est affichable */
  useTrackArticleView(slug, Boolean(article))

  /* Retour en haut à chaque changement de slug */
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" })
    }
  }, [slug])

  const value = useMemo(
    () => ({ slug, article, contenu, cat, hue, similar, articleQuery, similarQuery }),
    [slug, article, contenu, cat, hue, similar, articleQuery, similarQuery]
  )

  return (
    <ConseilDetailContext.Provider value={value}>
      {children}
    </ConseilDetailContext.Provider>
  )
}