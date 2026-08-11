// src/pages/offres/detail/index.jsx
import Seo from "@/components/seo/Seo"
import { offreSeo as buildOffreSeo } from "@/lib/seo"
import { OffreDetailProvider, useOffreDetail } from "@/contexts/DetailsOffre.context"
import {
  OffreError, OffreIntrouvable, OffreLoading,
} from "./components/OffreStates"
import HeroOffre from "./sections/HeroOffre"
import CorpsOffre from "./sections/CorpsOffre"
import OffresSimilaires from "./sections/OffresSimilaires"
import BandeCloture from "./sections/BandeCloture"

/** SEO alimenté par le cache — prêt dès que l'offre et la filière sont résolues. */
const OffreDetailSeo = () => {
  const { offre, meta, detail, similaires } = useOffreDetail()
  if (!offre || !meta) return null
  return <Seo {...buildOffreSeo({ offre, meta, detail, relatedOffers: similaires })} />
}

const OffrePage = () => {
  const { id, isPending, notFound, hasError, errorMessage, retry } = useOffreDetail()

  if (isPending) return <OffreLoading />

  /* 404 réelle ≠ erreur réseau : deux états, deux SEO distincts. */
  if (notFound) {
    return (
      <>
        <Seo
          title="Offre introuvable | JobAlert CI"
          description="L'offre demandée est introuvable. Retournez à la liste des offres d'emploi sur JobAlert CI."
          path="/offres"
          noindex
        />
        <OffreIntrouvable id={id} />
      </>
    )
  }

  if (hasError) {
    return (
      <>
        <Seo
          title="Erreur de chargement | JobAlert CI"
          description="L'offre n'a pas pu être chargée. Réessayez ou consultez la liste des offres d'emploi sur JobAlert CI."
          path="/offres"
          noindex
        />
        <OffreError message={errorMessage} onRetry={retry} />
      </>
    )
  }

  return (
    <>
      <OffreDetailSeo />
      <main>
        <HeroOffre />
        <CorpsOffre />
        <OffresSimilaires />
        <BandeCloture />
      </main>
    </>
  )
}

/**
 * Page détail d'une offre — orchestrateur pur.
 * Toutes les données transitent par le cache TanStack Query et le contexte :
 * aucun fetch manuel, aucune prop relayée entre sections.
 */
const DetailsOffre = () => (
  <OffreDetailProvider>
    <OffrePage />
  </OffreDetailProvider>
)

export default DetailsOffre