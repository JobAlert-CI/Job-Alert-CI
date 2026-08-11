// src/pages/home/components/Skeletons.jsx
import { Skeleton } from "@/components/ui/skeleton"

export const OfferSkeleton = () => (
  <li className="rounded-xl border border-outline-variant/40 bg-white p-5">
    <div className="flex items-start gap-4">
      <Skeleton className="size-12 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2.5">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-8 w-24 shrink-0 rounded-full" />
    </div>
  </li>
)

export const RepartitionSkeleton = () => (
  <div className="mt-5 flex flex-1 flex-col">
    <Skeleton className="h-12 w-24 rounded-md bg-white/20" />
    <Skeleton className="mt-3 h-3 w-44 rounded-full bg-white/20" />
    <div className="mt-6 space-y-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index}>
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3 w-2/3 rounded-full bg-white/20" />
            <Skeleton className="h-3 w-6 rounded-full bg-white/15" />
          </div>
          <Skeleton className="mt-2 h-1.5 w-full rounded-full bg-white/15" />
        </div>
      ))}
    </div>
  </div>
)