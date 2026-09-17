import { TableCell, TableRow } from "@/components/ui/table"
import BlocSkel from "./BlocSkel"


/* Ligne desktop : 6 cellules aux largeurs des vraies colonnes. */
const SkeletonLigneContact = ({ delay = 0 }) => (
  <TableRow className="hover:bg-transparent">
    <TableCell><BlocSkel className="h-3.5 w-24" delay={delay} /></TableCell>
    <TableCell>
      <div className="flex flex-col gap-1.5 py-0.5">
        <BlocSkel className="h-3.5 w-28" delay={delay} />
        <BlocSkel className="h-2.5 w-36" delay={delay} />
      </div>
    </TableCell>
    <TableCell><BlocSkel className="h-3.5 w-40" delay={delay} /></TableCell>
    <TableCell><BlocSkel className="h-5 w-20 rounded-full" delay={delay} /></TableCell>
    <TableCell><BlocSkel className="h-8 w-36 rounded-md" delay={delay} /></TableCell>
    <TableCell>
      <div className="flex justify-end"><BlocSkel className="size-7 rounded-md" delay={delay} /></div>
    </TableCell>
  </TableRow>
)

/* Carte mobile : miroir de CarteMessageMobile. */
const SkeletonCarteContactMobile = ({ delay = 0 }) => (
  <div className="rounded-xl border border-border bg-card p-4 shadow-soft" aria-hidden="true">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1 space-y-1.5">
        <BlocSkel className="h-2.5 w-32" delay={delay} />
        <BlocSkel className="h-3.5 w-28" delay={delay} />
        <BlocSkel className="h-2.5 w-44" delay={delay} />
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <BlocSkel className="h-5 w-20 rounded-full" delay={delay} />
        <BlocSkel className="size-7 rounded-md" delay={delay} />
      </div>
    </div>
    <BlocSkel className="mt-2 h-3 w-3/4" delay={delay} />
    <div className="mt-3 border-t border-border pt-2">
      <BlocSkel className="h-8 w-full rounded-md" delay={delay} />
    </div>
  </div>
)

export { SkeletonLigneContact, SkeletonCarteContactMobile }