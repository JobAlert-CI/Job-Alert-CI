
import { FeedOffreCard } from "@/components/shared"
import { useRecentOffers } from "../../../features/home.tools"
import { OfferSkeleton } from "./Skeletons"
import { EmptyOffers } from "./EmptyOffers"

/* Liste simple des offres récentes de la home, servie depuis le cache.
   Ne pas confondre avec le flux filtré/paginé /offres :
   → Pages/Offres/sections/OffersFeed.jsx (audit Pilier 7 : comparaison
   faite, aucune logique commune → pas de fusion, noms distincts). */

const FeedList = ({ children }) => (
  <ul className="flex flex-col gap-2.5" role="list">
    {children}
  </ul>
)

/**
 * Se sert directement dans le cache (même queryKey que Hero / RecentOffers)
 * → aucune prop transmise. Early returns : un état = un rendu.
 */
export const RecentOffersFeed = () => {
  const { data: offers, isPending, isError, refetch } = useRecentOffers()

  if (isPending) {
    return (
      <FeedList>
        {Array.from({ length: 5 }).map((_, index) => (
          <OfferSkeleton key={`offer-skeleton-${index}`} />
        ))}
      </FeedList>
    )
  }

  if (isError) {
    return (
      <FeedList>
        <EmptyOffers onRetryOffers={refetch} />
      </FeedList>
    )
  }

  return (
    <FeedList>
      {offers.map((offre, index) => (
        <FeedOffreCard key={offre.id} offre={offre} index={index} />
      ))}
    </FeedList>
  )
}
