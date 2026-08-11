// src/pages/conseils/sections/Bibliotheque.jsx
import { SectionHeading } from "@/components/shared"
import {
  useArticlesQuery, useCategoriesQuery, useDailyTipsQuery,
  useFeaturedQuery, usePopularQuery, useSeriesQuery, estErreur404
} from "@/tools/conseils.tools"
import { BibliothequeProvider } from "@/contexts/Conseils.context"
import { BandeauErreurPartielle } from "../components/Etats"
import BarreFiltres from "./BarreFiltres"
import GrilleBibliotheque from "./GrilleBibliotheque"
import { MiniAlerte, PlusLus, SeriesListe } from "../components/Sidebar"

/* Section assemblée : titre → erreurs partielles → filtres → grille + sidebar. */
const Bibliotheque = () => {
  /* Erreurs partielles agrégées — chaque requête vit sa vie, on signale sans bloquer. */
  const articles = useArticlesQuery()
  const categories = useCategoriesQuery()
  const featured = useFeaturedQuery()
  const daily = useDailyTipsQuery()
  const series = useSeriesQuery()
  const popular = usePopularQuery()

  const erreurs = {}
  const blocs = { articles, categories, featured, daily, series, popular }
  Object.entries(blocs).forEach(([cle, q]) => {
    if (q.isError && !estErreur404(q.error)) erreurs[cle] = q.error
  })
  const rechargerTout = () =>
    Object.values(blocs).forEach((q) => q.isError && q.refetch())

  return (
    <BibliothequeProvider>
      <section id="bibliotheque" className="scroll-mt-28 bg-background pt-20 max-md:pt-16">
        <div className="mx-auto max-w-7xl px-12 max-md:px-6">
          <SectionHeading
            eyebrow="La bibliothèque"
            title={
              <>
                Des conseils <span className="text-brand-orange">actionnables</span>, pas de la théorie.
              </>
            }
            sub="Écrits par nos analystes à partir des offres réellement collectées. Lisez, appliquez, postulez."
          />
        </div>
      </section>

      {Object.keys(erreurs).length > 0 && (
        <div className="mx-auto max-w-7xl px-12 pb-6 pt-6 max-md:px-6">
          <BandeauErreurPartielle erreurs={erreurs} onRetry={rechargerTout} />
        </div>
      )}

      <BarreFiltres />

      <section className="bg-background py-12 max-md:py-10">
        <div className="mx-auto max-w-7xl px-12 max-md:px-6">
          {/* Desktop-first : contenu + sidebar en base, empilé en repli */}
          <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-8 max-lg:grid-cols-1">
            <GrilleBibliotheque />
            <aside
              className="sticky top-32 flex flex-col gap-6 self-start max-lg:static"
              aria-label="Suggestions et alerte"
            >
              <PlusLus />
              <SeriesListe />
              <MiniAlerte />
            </aside>
          </div>
        </div>
      </section>
    </BibliothequeProvider>
  )
}

export default Bibliotheque