import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

/* ─────────────────────────────────────────────────────────────────────
   Skeleton fidèle à la mise en page finale : un bloc par carte de
   section, avec des formes de champs. Remplace le Spinner centré pour
   éviter un « layout shift » brutal à l'arrivée des données.
───────────────────────────────────────────────────────────────────── */
const SqueletteBloc = ({ champs = 4 }) => (
  <Card>
    <CardHeader className="pb-3">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-3.5 w-64" />
    </CardHeader>
    <CardContent className="grid gap-4 sm:grid-cols-2">
      {[...Array(champs)].map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      ))}
    </CardContent>
  </Card>
)

const FormulaireSkeleton = () => (
  <div className="flex flex-col gap-6" aria-busy="true" aria-label="Chargement du formulaire">
    <div className="flex items-center gap-3">
      <Skeleton className="size-9 rounded-lg" />
      <Skeleton className="h-7 w-56" />
    </div>
    <SqueletteBloc champs={5} />
    <SqueletteBloc champs={4} />
    <SqueletteBloc champs={3} />
    <SqueletteBloc champs={1} />
    <Skeleton className="h-16 w-full rounded-xl" />
  </div>
)

export default FormulaireSkeleton