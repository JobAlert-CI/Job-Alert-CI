// src/pages/home/components/OffersFeed.jsx
import { FeedOffreCard } from "@/components/shared"
import { useRecentOffers } from "../../../tools/home.tools"
import { OfferSkeleton } from "./Skeletons"
import { EmptyOffers } from "./EmptyOffers"

const FeedList = ({ children }) => (
  <ul className="flex flex-col gap-2.5" role="list">
    {children}
  </ul>
)

/**
 * Se sert directement dans le cache (même queryKey que Hero / RecentOffers)
 * → aucune prop transmise. Early returns : un état = un rendu.
 */
export const OffersFeed = () => {
  const { data: offers, isPending, isError, refetch } = useRecentOffers()

  if (isPending) {
    return (
      <FeedList>
        {Array.from({ length: 5 }).map((_, index) => (
          <OfferSkeleton key={index} />
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