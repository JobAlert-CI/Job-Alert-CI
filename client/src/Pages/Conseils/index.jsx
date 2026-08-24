// src/Pages/Conseils/index.jsx
import Seo from "@/components/seo/Seo"
import { conseilsSeo } from "@/lib/seo"
import { isNotFoundError } from "@/lib/query-helpers"
import { ErrorBoundary } from "react-error-boundary"
import {
  useArticlesQuery, useCategoriesQuery, useFeaturedQuery
} from "@/tools/conseils.tools"
import { PageErreur } from "./components/Etats"
import HeroConseils from "./sections/HeroConseils"
import ConseilDuJour from "./components/ConseilDuJour"
import Bibliotheque from "./sections/Bibliotheque"
import BandeDonnees from "./sections/BandeDonnees"

const SectionFallback = ({ error, resetErrorBoundary }) => (
  <div role="alert" className="p-8 text-center bg-destructive/5 border border-destructive/20 rounded-xl m-4">
    <p className="text-destructive font-bold">Une erreur est survenue dans cette section.</p>
    <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
    <button onClick={resetErrorBoundary} className="mt-4 px-4 py-2 bg-brand-navy text-white rounded-lg text-sm font-bold">
      Réessayer
    </button>
  </div>
)

/** SEO alimenté par le cache — mêmes clés que les sections, zéro fetch dupliqué. */
const ConseilsSeo = () => {
  const { data: articles } = useArticlesQuery()
  const { data: categories } = useCategoriesQuery()
  const { data: featured } = useFeaturedQuery()
  return (
    <Seo
      {...conseilsSeo({
        total: articles?.length ?? 0,
        categories: categories?.length ? categories : [],
        featuredArticles: featured?.length ? featured : articles?.slice(0, 3) ?? [],
      })}
    />
  )
}

const Conseils = () => {
  const articles = useArticlesQuery()
  const featured = useFeaturedQuery()
  
  /* Erreur fatale : la bibliothèque ne peut pas s'afficher du tout */
  if (articles.isError && !isNotFoundError(articles.error) && (!articles.data || articles.data.length === 0)) {
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
        <ErrorBoundary FallbackComponent={SectionFallback}>
          <HeroConseils />
        </ErrorBoundary>
        
        <ErrorBoundary FallbackComponent={SectionFallback}>
          <ConseilDuJour />
        </ErrorBoundary>
        
        <ErrorBoundary FallbackComponent={SectionFallback}>
          <Bibliotheque />
        </ErrorBoundary>
        
        <ErrorBoundary FallbackComponent={SectionFallback}>
          <BandeDonnees />
        </ErrorBoundary>
      </main>
    </>
  )
}
export default Conseils