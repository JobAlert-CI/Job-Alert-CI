// src/Pages/Conseils/components/SkeletonsConseils.jsx
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton" 

/* Chaque zone possède son propre squelette : le chargement est délégué. */

export const HeroSkeleton = () => ( 
  <section className="relative overflow-hidden hero-gradient">
    <div className="relative z-10 mx-auto max-w-7xl px-12 pb-16 pt-10 max-md:px-6 max-md:pb-14 max-md:pt-8">
      <Skeleton className="h-4 w-40" />
      <div className="mt-8 grid grid-cols-[1.05fr_0.95fr] items-center gap-16 max-lg:grid-cols-1 max-lg:gap-14">
        <div className="space-y-5">
          <Skeleton className="h-7 w-64 rounded-full" />
          <Skeleton className="h-14 w-full max-w-xl" />
          <Skeleton className="h-14 w-full max-w-lg" />
          <Skeleton className="h-5 w-full max-w-xl" />
          <div className="flex flex-row gap-3 max-sm:flex-col">
            <Skeleton className="h-12 w-64 rounded-full" />
            <Skeleton className="h-12 w-52 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-8">
            <Skeleton className="h-14 w-20" />
            <Skeleton className="h-14 w-20" />
            <Skeleton className="h-14 w-20" />
          </div>
        </div>
        <Skeleton className="h-112 w-full rounded-2xl" />
      </div>
    </div>
  </section>
)

export const CompteursSkeleton = () => ( 
  <>
    {[0, 1, 2].map((i) => (
      <div key={`compteur-skeleton-${i}`}>
        <Skeleton className="h-9 w-16" />
        <Skeleton className="mt-1.5 h-3 w-24" />
      </div>
    ))}
  </>
)

export const ConseilDuJourSkeleton = () => ( 
  <section className="border-y border-outline-variant/40 bg-surface-container-lowest">
    <div className="mx-auto flex max-w-7xl flex-row items-center justify-between gap-4 px-12 py-5 max-md:flex-col max-md:items-start max-md:px-6">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-10 w-full max-w-xl" />
      <Skeleton className="h-5 w-28" />
    </div>
  </section>
)

export const GrilleSkeleton = () => ( 
  <div>
    <div className="mb-8 space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-10 w-full max-w-lg" />
      <Skeleton className="h-4 w-full max-w-2xl" />
    </div>
    <Skeleton className="mb-6 h-28 w-full rounded-xl" />
    <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-8 max-lg:grid-cols-1">
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={`article-skeleton-${i}`} className="h-56 rounded-xl" />
        ))}
      </div>
      <div className="space-y-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
    </div>
  </div>
)

export const ListeSkeleton = ({ rows = 4, className }) => ( 
  <div className={cn("space-y-2", className)} aria-hidden>
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={`ligne-skeleton-${i}`} className="h-10 w-full" />
    ))}
  </div>
)