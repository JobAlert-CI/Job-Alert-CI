import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/* ════════════════════════════════════════════════════════════════════
  SQUELETTES — même gabarit que <OfferCard> pour éviter tout saut de mise en page
════════════════════════════════════════════════════════════════════ */

export const OfferCardSkeleton = ({ view = "list" }) => {
  if (view === "grid") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-outline-variant/40 bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="size-8 rounded-lg" />
        </div>
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-2/5" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-20 rounded-md" />
          <Skeleton className="h-5 w-16 rounded-md" />
        </div>
        <Skeleton className="mt-2 h-8 w-32 rounded-md" />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-outline-variant/40 bg-white p-5 shadow-soft">
      <div className="flex gap-4">
        <Skeleton className="hidden size-14 rounded-lg sm:block" />
        <div className="flex-1 space-y-2.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Skeleton className="h-5 w-24 rounded-md" />
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
        </div>
        <div className="hidden flex-col items-end gap-2 sm:flex">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </div>
    </div>
  )
}

export const OffersSkeletonList = ({ view = "list", count = 6, className }) => (
  <div className={cn(view === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-3", className)}>
    {Array.from({ length: count }, (_, i) => (
      <OfferCardSkeleton key={i} view={view} />
    ))}
  </div>
)

/* Compteurs du héro pendant le chargement des stats */
export const StatSkeleton = () => (
  <div className="space-y-1.5">
    <Skeleton className="h-8 w-16" />
    <Skeleton className="h-3 w-24" />
  </div>
)

export default OffersSkeletonList
