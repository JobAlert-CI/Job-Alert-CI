// src/pages/conseils/detail/index.jsx
import Seo from "@/components/seo/Seo"
import { conseilSeo } from "@/lib/seo"
import { formatApiError } from "@/api/errors"
import { BarreProgression, SommaireFlottant } from "@/components/shared"
import { ConseilDetailProvider, useConseilDetail } from "@/contexts/DetailsConseil.context"
import { estErreur404 } from "@/tools/conseil-detail.tools"
import {
  ConseilIntrouvable, DetailSkeleton, ErreurDetail,
} from "./components/Etats"
import EnTeteArticle from "./components/EnTeteArticle"
import CorpsArticle from "./components/CorpsArticle"
import ContinuerLecture from "./components/ContinuerLecture"

/** SEO alimenté par le cache — prêt dès que l'article est résolu. */
const ConseilDetailSeo = () => {
  const { slug, article, cat, contenu } = useConseilDetail()
  const seo =
    article && cat && contenu
      ? conseilSeo({ article, cat, contenu })
      : conseilSeo({ slug: slug || "conseil" })
  return <Seo {...seo} />
}

const ConseilPage = () => {
  const { slug, article, contenu, hue, articleQuery } = useConseilDetail()

  /* Chargement délégué : seul l'article bloque le rendu ;
     les similaires vivent leur vie dans la sidebar et la grille. */
  if (articleQuery.isPending) {
    return (
      <>
        <ConseilDetailSeo />
        <DetailSkeleton />
      </>
    )
  }

  /* 404 réelle ≠ erreur réseau : deux états distincts */
  if (articleQuery.isError) {
    return (
      <>
        <ConseilDetailSeo />
        <main>
          {estErreur404(articleQuery.error) ? (
            <ConseilIntrouvable slug={slug} />
          ) : (
            <ErreurDetail
              slug={slug}
              detail={formatApiError(articleQuery.error)}
              onRetry={() => articleQuery.refetch()}
            />
          )}
        </main>
      </>
    )
  }

  if (!article || !contenu) {
    return (
      <>
        <ConseilDetailSeo />
        <main>
          <ConseilIntrouvable slug={slug} />
        </main>
      </>
    )
  }

  return (
    <>
      <ConseilDetailSeo />
      <BarreProgression hex={hue.hex} />
      <main>
        <EnTeteArticle />
        <CorpsArticle />
        <ContinuerLecture />
        {contenu.sections.length > 0 && (
          <SommaireFlottant
            sections={contenu.sections.map((s) => ({ id: s.id, titre: s.titre }))}
            lecture={article.lecture}
          />
        )}
      </main>
    </>
  )
}

/**
 * Page détail d'un conseil — orchestrateur pur.
 * Toutes les données transitent par le cache TanStack Query et le contexte :
 * aucun fetch manuel, aucune prop relayée entre sections.
 */
const DetailsConseil = () => (
  <ConseilDetailProvider>
    <ConseilPage />
  </ConseilDetailProvider>
)

export default DetailsConseil