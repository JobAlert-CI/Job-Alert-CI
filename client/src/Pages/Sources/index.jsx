// src/pages/sources/index.jsx
import Seo from "@/components/seo/Seo"
import { sourcesSeo } from "@/lib/seo"
import { formatApiError } from "@/api/errors"
import { SourcesProvider, useSourcesContext } from "@/contexts/Sources.context"
import {
  AucuneSource,
  BandeauErreurPartielle,
  ErreurSources, HeroSkeleton, SourcesSkeleton,
} from "./components/Etats"
import HeroSources from "./components/HeroSources"
import TickerSources from "./components/TickerSources"
import SectionSources from "./components/SectionSources"
import SectionMethode from "./components/SectionMethode"
import BandeauDedup from "./components/BandeauDedup"
import CtaFinal from "./components/CtaFinal"

const SourcesPage = () => {
  const {
    statut, nbSources, erreur, erreurs, retry,
  } = useSourcesContext()

  /* 1️⃣ Chargement — TOUJOURS testé en premier */
  if (statut === "loading") {
    return (
      <>
        <Seo {...sourcesSeo({ total: 0 })} />
        <main aria-busy="true">
          <HeroSkeleton />
          <SourcesSkeleton />
        </main>
      </>
    )
  }

  /* 2️⃣ Erreur réelle et définitive */
  if (statut === "error") {
    return (
      <>
        <Seo {...sourcesSeo({ total: 0 })} />
        <main>
          <ErreurSources
            detail={formatApiError(erreur)}
            onRetry={retry}
          />
        </main>
      </>
    )
  }

  /* 3️⃣ API répond mais aucune source active */
  if (statut === "empty") {
    return (
      <>
        <Seo {...sourcesSeo({ total: 0 })} />
        <main>
          <AucuneSource onRetry={retry} />
        </main>
      </>
    )
  }

  /* 4️⃣ Prêt — les erreurs partielles (stats, global) sont signalées
        par un bandeau sans bloquer l'affichage. */
  return (
    <>
      <Seo {...sourcesSeo({ total: nbSources })} />
      <main>
        <HeroSources />
        {Object.keys(erreurs).length > 0 && (
          <BandeauErreurPartielle erreurs={erreurs} onRetry={retry} />
        )}
        <TickerSources />
        <SectionSources />
        <SectionMethode />
        <BandeauDedup />
        <CtaFinal />
      </main>
    </>
  )
}

const Sources = () => (
  <SourcesProvider>
    <SourcesPage />
  </SourcesProvider>
)

export default Sources