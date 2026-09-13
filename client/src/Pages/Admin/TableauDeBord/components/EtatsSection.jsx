import { AlertTriangle, Inbox, SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"

/* ─────────────────────────────────────────────────────────────────────
   États standards d'une section admin : erreur, vide, aucun résultat,
   skeleton de carte compteur — harmonisés avec <Skeleton/> (Audit :
   un seul système de chargement sur toute la page).
───────────────────────────────────────────────────────────────────── */

/** Erreur de chargement d'une section (action de retry incluse). */
export const SectionErreur = ({ onRetry, message = "Chargement impossible." }) => (
  <div
    role="alert"
    className="flex flex-col items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-8 text-center"
  >
    <span className="flex size-9 items-center justify-center rounded-full bg-destructive/10">
      <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
    </span>
    <p className="text-sm font-medium text-destructive">{message}</p>
    {onRetry && (
      <Button variant="outline" size="sm" onClick={onRetry}>
        Réessayer
      </Button>
    )}
  </div>
)

/** Aucune donnée du tout (≠ recherche sans résultat). */
export const SectionVide = ({ message = "Aucune donnée pour le moment." }) => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
      <EmptyTitle>Rien à afficher</EmptyTitle>
      <EmptyDescription>{message}</EmptyDescription>
    </EmptyHeader>
  </Empty>
)

/** Recherche/filtre sans résultat — formulation distincte du vide. */
export const SectionAucunResultat = ({ message = "Aucun résultat ne correspond aux critères." }) => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon"><SearchX /></EmptyMedia>
      <EmptyTitle>Aucun résultat</EmptyTitle>
      <EmptyDescription>{message}</EmptyDescription>
    </EmptyHeader>
  </Empty>
)

/** Skeleton d'une carte compteur — même géométrie que CarteCompteur. */
export const SkeletonCarte = () => (
  <div className="flex min-h-26 flex-col gap-2.5 rounded-xl border border-border bg-card p-4">
    <div className="flex items-start justify-between gap-2">
      <Skeleton className="h-2.5 w-20" />
      <Skeleton className="size-7 rounded-lg" />
    </div>
    <Skeleton className="h-8 w-16" />
  </div>
)