import { TableCell, TableRow } from "@/components/ui/table"
import BlocSkel from "./BlocSkel"

/* Ligne desktop : 6 cellules aux largeurs des vraies colonnes. */
const SkeletonLigneEmail = ({ delay = 0 }) => (
  <TableRow className="hover:bg-transparent">
    <TableCell><BlocSkel className="h-3.5 w-24" delay={delay} /></TableCell>
    <TableCell>
      <div className="flex flex-col gap-1.5 py-0.5">
        <BlocSkel className="h-3.5 w-44" delay={delay} />
        <BlocSkel className="h-2.5 w-24" delay={delay} />
      </div>
    </TableCell>
    <TableCell><BlocSkel className="h-3.5 w-28" delay={delay} /></TableCell>
    <TableCell><BlocSkel className="h-5 w-16 rounded-full" delay={delay} /></TableCell>
    <TableCell className="hidden lg:table-cell"><BlocSkel className="ml-auto h-3.5 w-8" delay={delay} /></TableCell>
    <TableCell>
      <div className="flex justify-end"><BlocSkel className="size-7 rounded-md" delay={delay} /></div>
    </TableCell>
  </TableRow>
)

/* Carte mobile : miroir de CarteEmailMobile. */
const SkeletonCarteEmailMobile = ({ delay = 0 }) => (
  <div className="rounded-xl border border-border bg-card p-4 shadow-soft" aria-hidden="true">
    <div className="flex items-start justify-between gap-2">
      <BlocSkel className="h-2.5 w-32" delay={delay} />
      <div className="flex shrink-0 items-center gap-1.5">
        <BlocSkel className="h-5 w-20 rounded-full" delay={delay} />
        <BlocSkel className="size-7 rounded-md" delay={delay} />
      </div>
    </div>
    <div className="mt-2 space-y-1.5">
      <BlocSkel className="h-3.5 w-48" delay={delay} />
      <BlocSkel className="h-2.5 w-24" delay={delay} />
    </div>
    <BlocSkel className="mt-1.5 h-3 w-32" delay={delay} />
    <div className="mt-2.5 flex justify-between border-t border-border pt-2">
      <BlocSkel className="h-2.5 w-20" delay={delay} />
    </div>
  </div>
)

export { SkeletonLigneEmail, SkeletonCarteEmailMobile }