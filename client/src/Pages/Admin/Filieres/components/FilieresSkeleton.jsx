import { cn } from "cn"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"


const Bloc = ({ className, delay = 0 }) => (
  <Skeleton className={className} style={delay ? { animationDelay: `${delay}ms` } : undefined} />
)

const FilieresSkeleton = ({ nbLignes = 8 }) => {
  const lignes = Array.from({ length: nbLignes }, (_, i) => i)
  return (
    <div role="status" aria-label="Chargement des filières">
      {/* Mobile : Select de tri + cartes */}
      <div className="px-4 pt-3 md:hidden" aria-hidden="true">
        <Skeleton className="h-8 w-full" />
      </div>
      <ul className="flex flex-col gap-3 px-4 py-3 md:hidden" aria-hidden="true">
        {lignes.map((i) => (
          <li key={i}><SkeletonCarteFiliereMobile delay={i * 70} /></li>
        ))}
      </ul>

      {/* Desktop : table avec en-tête */}
      <div className="hidden overflow-x-auto scrollbar-thin md:block">
        <Table aria-hidden="true">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8" />
              <TableHead><Bloc className="h-3 w-14" /></TableHead>
              <TableHead className="hidden md:table-cell"><Bloc className="h-3 w-12" /></TableHead>
              <TableHead className="text-right"><Bloc className="ml-auto h-3 w-16" /></TableHead>
              <TableHead className="text-right"><Bloc className="ml-auto h-3 w-12" /></TableHead>
              <TableHead className="text-right"><Bloc className="ml-auto h-3 w-14" /></TableHead>
              <TableHead className="hidden text-right lg:table-cell"><Bloc className="ml-auto h-3 w-18" /></TableHead>
              <TableHead className="hidden text-right lg:table-cell"><Bloc className="ml-auto h-3 w-12" /></TableHead>
              <TableHead className="hidden md:table-cell"><Bloc className="h-3 w-12" /></TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((i) => <SkeletonLigneFiliere key={i} delay={i * 70} />)}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/* Carte mobile : miroir exact de CarteFiliereMobile. */
export const SkeletonCarteFiliereMobile = ({ delay = 0 }) => (
  <div className="rounded-xl border border-border bg-card p-4 shadow-soft" aria-hidden="true">
    {/* En-tête : pastille + libellé + code·ordre / badge + menu */}
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          <Bloc className="size-2.5 shrink-0 rounded-full" delay={delay} />
          <Bloc className="h-4 w-32" delay={delay} />
        </div>
        <Bloc className="h-2.5 w-24" delay={delay} />
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Bloc className="h-5 w-16 rounded-full" delay={delay} />
        <Bloc className="size-7 rounded-md" delay={delay} />
      </div>
    </div>
    {/* Grille 2×2 : mots-clés / offres / abonnés / spécialités */}
    <div className="mt-3 grid grid-cols-2 gap-2">
      {[
        { dt: "w-16", dd: "w-8" },
        { dt: "w-10", dd: "w-8" },
        { dt: "w-12", dd: "w-8" },
        { dt: "w-16", dd: "w-10" },
      ].map(({ dt, dd }, k) => (
        <div key={k} className="rounded-lg bg-muted/40 px-2 py-1.5">
          <Bloc className={cn("h-2", dt)} delay={delay} />
          <Bloc className={cn("mt-1 h-3.5", dd)} delay={delay} />
        </div>
      ))}
    </div>
    {/* Bouton d'expansion pleine largeur */}
    <Bloc className="mt-3 h-8 w-full rounded-md" delay={delay} />
  </div>
)

/* Ligne desktop : 10 cellules aux largeurs des vraies colonnes,
   mêmes classes responsives (Code masqué < md, Spé/Ordre < lg). */

export const SkeletonLigneFiliere = ({ delay = 0 }) => (
  <TableRow className="hover:bg-transparent">
    <TableCell className="w-8"><Bloc className="size-6 rounded-md" delay={delay} /></TableCell>
    <TableCell>
      <div className="flex items-center gap-2">
        <Bloc className="size-2.5 rounded-full" delay={delay} />
        <Bloc className="h-4 w-40" delay={delay} />
      </div>
    </TableCell>
    <TableCell className="hidden md:table-cell"><Bloc className="h-3 w-16" delay={delay} /></TableCell>
    <TableCell className="text-right"><Bloc className="ml-auto h-3.5 w-8" delay={delay} /></TableCell>
    <TableCell className="text-right"><Bloc className="ml-auto h-3.5 w-8" delay={delay} /></TableCell>
    <TableCell className="text-right"><Bloc className="ml-auto h-3.5 w-8" delay={delay} /></TableCell>
    <TableCell className="hidden text-right lg:table-cell"><Bloc className="ml-auto h-3.5 w-8" delay={delay} /></TableCell>
    <TableCell className="hidden text-right lg:table-cell"><Bloc className="ml-auto h-3.5 w-8" delay={delay} /></TableCell>
    <TableCell><Bloc className="h-5 w-16 rounded-full" delay={delay} /></TableCell>
    <TableCell><Bloc className="size-7 rounded-md" delay={delay} /></TableCell>
  </TableRow>
)

export default FilieresSkeleton