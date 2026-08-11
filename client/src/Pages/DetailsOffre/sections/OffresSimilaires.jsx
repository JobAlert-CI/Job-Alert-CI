// src/pages/offres/detail/sections/OffresSimilaires.jsx
import { ArrowRight } from "lucide-react"
import { CtaLink, OfferCard, SectionHeading } from "@/components/shared"
import { OfferCardSkeleton } from "@/components/shared/SkeletonsOffres"
import { useOffreDetail } from "@/contexts/DetailsOffre.context"

/* Offres similaires — même filière (OfferCard partagée).
   Les données viennent du contexte (requête parallèle au détail). */
const OffresSimilaires = () => {
  const { meta, hue, similaires, similairesQuery } = useOffreDetail()
  const { isPending, isError } = similairesQuery

  return (
    <section
      className="bg-surface-container-lowest py-20 max-md:py-16"
      aria-label={`Offres similaires — ${meta.label}`}
    >
      <div className="mx-auto max-w-7xl px-12 max-md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="Même filière"
            title={
              <>
                D'autres offres <span className="text-brand-orange">{meta.label}</span>{" "}
                vous attendent.
              </>
            }
            sub="Découvrez d'autres opportunités dans la même filière."
          />
          {/* CTA desktop en base, masqué sous md */}
          <CtaLink
            to={`/filieres/${meta.code}`}
            variant="outline"
            size="md"
            iconRight={ArrowRight}
            className="inline-flex max-md:hidden"
          >
            Toute la filière
          </CtaLink>
        </div>

        {isPending ? (
          /* Corrigé : squelettes pendant le chargement (avant : « aucune offre »
             s'affichait tant que la requête n'était pas terminée). */
          <>
            <span className="sr-only" role="status">
              Chargement des offres similaires…
            </span>
            <div aria-hidden="true" className="mt-10 grid grid-cols-3 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <OfferCardSkeleton key={i} view="grid" />
              ))}
            </div>
          </>
        ) : isError ? (
          <p className="mt-10 text-center text-sm text-muted-foreground" role="status">
            Les offres similaires sont momentanément indisponibles.
          </p>
        ) : similaires.length > 0 ? (
          <div className="mt-10 grid grid-cols-3 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
            {similaires.map((o, i) => (
              <OfferCard key={o.uid} offre={o} index={i} view="grid" hue={hue} showFiliereChip={false} />
            ))}
          </div>
        ) : (
          <p className="mt-10 text-center text-sm text-muted-foreground" role="status">
            Aucune offre similaire trouvée pour le moment.
          </p>
        )}

        {/* CTA mobile uniquement */}
        <div className="mt-8 hidden text-center max-md:block">
          <CtaLink to={`/filieres/${meta.code}`} variant="outline" size="md" iconRight={ArrowRight}>
            Toute la filière {meta.label}
          </CtaLink>
        </div>
      </div>
    </section>
  )
}

export default OffresSimilaires