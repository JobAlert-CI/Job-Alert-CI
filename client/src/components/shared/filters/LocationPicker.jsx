// src/pages/offres/components/OffresFilterGroups.jsx
import { useState } from "react"
import { MapPin, Search, X, } from "lucide-react"
import { CheckRow } from "@/components/shared"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const LocationPicker = ({
  locations = [],
  value = null,
  onChange,
  isLoading = false,
  className,
}) => {
  const [q, setQ] = useState("")
  const needle = q.trim().toLowerCase()
  const results = (needle
    ? locations.filter((l) => `${l.label} ${l.city}`.toLowerCase().includes(needle))
    : locations
  ).slice(0, 60)

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ville, région, télétravail…"
          aria-label="Rechercher une localisation"
          className="h-9 w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest pl-8 pr-7 text-[13px] outline-none transition-all placeholder:text-muted-foreground/70 focus:border-brand-navy/50 focus:ring-2 focus:ring-brand-navy/10"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Effacer la recherche de localisation"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      {value && (
        <button
          type="button"
          onClick={() => onChange?.(null)}
          className="self-start rounded-sm text-[11px] font-bold text-brand-orange transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Effacer la localisation
        </button>
      )}
      <div className="max-h-64 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="space-y-1.5 py-1" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-full rounded-md" />)}
          </div>
        ) : results.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            {locations.length === 0
              ? "Localisations indisponibles pour le moment."
              : "Aucune localisation ne correspond."}
          </p>
        ) : (
          results.map((l) => (
            <CheckRow
              key={l.id}
              checked={value === l.id}
              onToggle={() => onChange?.(value === l.id ? null : l.id)}
              label={l.label || l.city || "—"}
              lead={<MapPin className={cn("size-3.5 shrink-0", value === l.id ? "text-brand-orange" : "text-muted-foreground")} aria-hidden />}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default LocationPicker