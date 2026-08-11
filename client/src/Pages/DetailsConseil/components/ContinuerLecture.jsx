// src/pages/conseils/detail/components/ContinuerLecture.jsx
import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react"
import { CarteArticle, CtaLink, SectionHeading } from "@/components/shared"
import { useConseilDetail } from "@/contexts/DetailsConseil.context"
import { EtatVide, Skel } from "./Etats"

/* Grille « similaires » — consomme le contexte, gère ses propres états. */
const ContinuerLecture = () => {
  const { cat, similar, similarQuery } = useConseilDetail()

  return (
    <section className="bg-surface-container-lowest py-20 max-md:py-16">
      <div className="mx-auto max-w-7xl px-12 max-md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="Continuer la lecture"
            title={
              <>
                D'autres conseils{" "}
                <span className="text-brand-orange">{cat.label}</span> vous attendent.
              </>
            }
          />
          {/* CTA visible en base (desktop), masqué sous md */}
          <CtaLink
            to="/conseils"
            variant="outline"
            size="md"
            iconRight={ArrowRight}
            className="inline-flex max-md:hidden"
          >
            Toute la bibliothèque
          </CtaLink>
        </div>

        <div className="mt-10">
          {similarQuery.isPending ? (
            /* Desktop-first : 3 colonnes en base, repli 2 puis 1 */
            <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1" aria-hidden="true">
              {[0, 1, 2].map((i) => <Skel key={`similaire-skel-${i}`} className="h-56 rounded-xl" />)}
            </div>
          ) : similarQuery.isError ? (
            <EtatVide
              icon={AlertTriangle}
              title="Suggestions indisponibles"
              description="Nous n'arrivons pas à charger les conseils similaires pour le moment."
              action={
                <div className="flex flex-row flex-wrap items-center justify-center gap-3 max-sm:flex-col">
                  <button
                    type="button"
                    onClick={() => similarQuery.refetch()}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <RefreshCw className="size-4" aria-hidden />
                    Réessayer
                  </button>
                  <CtaLink to="/conseils" variant="outline" size="md" iconRight={ArrowRight}>
                    Voir la bibliothèque
                  </CtaLink>
                </div>
              }
            />
          ) : similar.length === 0 ? (
            <EtatVide
              title="Pas encore de conseils similaires"
              description="D'autres contenus sont en préparation. En attendant, explorez la bibliothèque complète."
              action={
                <CtaLink to="/conseils" variant="outline" size="md" iconRight={ArrowRight}>
                  Voir la bibliothèque
                </CtaLink>
              }
            />
          ) : (
            <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
              {similar.map((x, i) => (
                <CarteArticle key={x.slug} a={x} index={i} />
              ))}
            </div>
          )}
        </div>

        {/* CTA mobile uniquement */}
        <div className="mt-8 hidden text-center max-md:block">
          <CtaLink to="/conseils" variant="outline" size="md" iconRight={ArrowRight}>
            Toute la bibliothèque
          </CtaLink>
        </div>
      </div>
    </section>
  )
}

export default ContinuerLecture