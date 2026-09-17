import { Skeleton } from "@/components/ui/skeleton"


const BlocSkel = ({ className, delay = 0 }) => (
  <Skeleton className={className} style={delay ? { animationDelay: `${delay}ms` } : undefined} />
)

export default BlocSkel