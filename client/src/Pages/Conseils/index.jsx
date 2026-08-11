// src/pages/conseils/index.jsx
import Seo from "@/components/seo/Seo"
import { conseilsSeo } from "@/lib/seo"
import {
  useArticlesQuery, useCategoriesQuery, useFeaturedQuery, estErreur404
} from "@/tools/conseils.tools"
import { PageErreur } from "./components/Etats"
import HeroConseils from "./sections/HeroConseils"
import ConseilDuJour from "./components/ConseilDuJour"
import Bibliotheque from "./sections/Bibliotheque"
import BandeDonnees from "./sections/BandeDonnees"

/** SEO alimenté par le cache — mêmes clés que les sections, zéro fetch dupliqué. */
const ConseilsSeo = () => {
  const { data: articles } = useArticlesQuery()
  const { data: categories } = useCategoriesQuery()
  const { data: featured } = useFeaturedQuery()

  return (
    <Seo
      {...conseilsSeo({
        total: articles.length,
        categories: categories.length ? categories : [],
        featuredArticles: featured.length ? featured : articles.slice(0, 3),
      })}
    />
  )
}

/**
 * Orchestrateur pur : aucun fetch manuel, aucune prop relayée.
 * Chaque section se sert dans le cache TanStack Query et gère
 * elle-même son chargement / erreur / vide.
 */
const Conseils = () => {
  const articles = useArticlesQuery()
  const featured = useFeaturedQuery()

  /* Erreur fatale : la bibliothèque ne peut pas s'afficher du tout */
  if (articles.isError && !estErreur404(articles.error) && (!articles.data || articles.data.length === 0)) {
    return (
      <>
        <Seo {...conseilsSeo({ total: 0, categories: [], featuredArticles: [] })} />
        <main>
          <PageErreur
            onRetry={() => {
              articles.refetch()
              featured.refetch()
            }}
          />
        </main>
      </>
    )
  }

  return (
    <>
      <ConseilsSeo />
      <main>
        <HeroConseils />
        <ConseilDuJour />
        <Bibliotheque />
        <BandeDonnees />
      </main>
    </>
  )
}

export default Conseils