import { AlertTriangle, Inbox, SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"

/* ─────────────────────────────────────────────────────────────────────
   États standards d'une section admin : erreur, vide (aucune donnée),
   aucun résultat (filtre/recherche sans hit ≠ vide par absence).
   Adapatés au contexte (skeleton métier séparé par section, cf.
   prompt §4 "États") — pas de composant générique monolithique.
   ───────────────────────────────────────────────────────────────────── */

/** Erreur de chargement d'une section (action de retry incluse). */
export const SectionErreur = ({ onRetry, message = "Chargement impossible." }) => (
  <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
    <AlertTriangle className="size-5 text-destructive" aria-hidden />
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

/** Skeleton d'une carte compteur (largeur dédiée, pas un bloc générique). */
export const SkeletonCarte = () => (
  <div className="rounded-xl border border-border bg-card p-4">
    <div className="h-3 w-24 animate-pulse rounded bg-muted" />
    <div className="mt-3 h-8 w-16 animate-pulse rounded bg-muted" />
  </div>
)
