// src/components/ReuOffres/FilterOptions.jsx
import { memo } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckRow, SourceLogo } from "@/components/shared"
import { useReferentialsQuery } from "@/lib/referentiels-query"

/* Groupes d'options mémoïsés et AGNOSTIQUES de la page : ils reçoivent
   filters/toggle/counts en contrat présentationnel (un seul niveau,
   pas de drilling). Réutilisés par /offres et /filieres/:code. */

export const OptionsSkeleton = ({ rows = 3 }) => (
  <div className="space-y-1.5" aria-hidden="true">
    {Array.from({ length: rows }, (_, i) => (
      <Skeleton key={`option-skeleton-${i}`} className="h-8 w-full rounded-md" />
    ))}
  </div>
)

export const SourceOptions = memo(function SourceOptions({ filters, toggle, counts = {} }) {
  const { data: refs, isPending } = useReferentialsQuery()
  if (isPending && refs.sources.length === 0) return <OptionsSkeleton />
  return refs.sources.map((s) => (
    <CheckRow
      key={s.code}
      checked={filters.sources.has(s.code)}
      onToggle={() => toggle("sources", s.code)}
      label={s.label}
      count={counts[s.code] ?? 0}
      lead={<SourceLogo code={s.code} className="size-5 rounded text-[8px]" />}
    />
  ))
})

export const ContratOptions = memo(function ContratOptions({ filters, toggle, counts = {} }) {
  const { data: refs } = useReferentialsQuery()
  return refs.contrats.map((c) => (
    <CheckRow
      key={c.code}
      checked={filters.contrats.has(c.code)}
      onToggle={() => toggle("contrats", c.code)}
      label={c.label}
      count={counts[c.code] ?? 0}
    />
  ))
})

export const ExperienceOptions = memo(function ExperienceOptions({ filters, toggle }) {
  const { data: refs } = useReferentialsQuery()
  return refs.experiences.map((x) => (
    <CheckRow
      key={x.code}
      checked={filters.experiences.has(x.code)}
      onToggle={() => toggle("experiences", x.code)}
      label={x.label}
    />
  ))
})

export const NiveauOptions = memo(function NiveauOptions({ filters, toggle }) {
  const { data: refs } = useReferentialsQuery()
  return refs.niveaux.map((n) => (
    <CheckRow
      key={n.code}
      checked={filters.niveaux.has(n.code)}
      onToggle={() => toggle("niveaux", n.code)}
      label={n.label}
    />
  ))
})