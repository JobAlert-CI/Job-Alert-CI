import { useMemo, useState } from "react"
import { Briefcase, CalendarDays, GraduationCap, Layers, MapPin, Search, Sparkles, X, Zap } from "lucide-react"
import { CheckRow, MiniCalendar, SourceLogo } from "@/components/shared"
import { Skeleton } from "@/components/ui/skeleton"
import { HUES, BRAND_HUE } from "@/lib/hues"
import { cn } from "@/lib/utils"

/* ════════════════════════════════════════════════════════════════════
  FILTRES — composants partagés entre la barre desktop et le tiroir mobile.
  Les options viennent des référentiels de l'API (aucune liste figée ici).
════════════════════════════════════════════════════════════════════ */

/* ─────────────── Sélecteur de localisation (choix unique, recherche) ─────────────── */
export const LocationPicker = ({
  locations = [],
  value = null,
  onChange,
  isLoading = false,
  className,
}) => {
  const [q, setQ] = useState("")

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = needle
      ? locations.filter((l) => `${l.label} ${l.city}`.toLowerCase().includes(needle))
      : locations
    return list.slice(0, 60)
  }, [locations, q])

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ville, région, télétravail…"
          aria-label="Rechercher une localisation"
          className="h-9 w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest pl-8 pr-7 text-[13px] outline-none transition-all placeholder:text-muted-foreground/70 focus:border-brand-navy/50 focus:ring-2 focus:ring-brand-navy/10"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            aria-label="Effacer"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-brand-navy"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {value && (
        <button
          onClick={() => onChange?.(null)}
          className="self-start text-[11px] font-bold text-brand-orange transition-colors hover:underline"
        >
          Effacer la localisation
        </button>
      )}

      <div className="max-h-64 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="space-y-1.5 py-1">
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
              lead={<MapPin className={cn("size-3.5 shrink-0", value === l.id ? "text-brand-orange" : "text-muted-foreground")} />}
            />
          ))
        )}
      </div>
    </div>
  )
}

/* ─────────────── Un groupe de cases à cocher ─────────────── */
const Group = ({ icon: Icon, title, children }) => (
  <div className="border-b border-outline-variant/40 py-4 first:pt-0 last:border-0">
    <p className="mb-2 flex items-center gap-2 font-heading text-[13px] font-extrabold text-brand-navy">
      <Icon className="size-3.5 text-brand-orange" />
      {title}
    </p>
    {children}
  </div>
)

const OptionsSkeleton = ({ rows = 4 }) => (
  <div className="space-y-1.5">
    {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-8 w-full rounded-md" />)}
  </div>
)

/* ─────────────── Tous les groupes (tiroir mobile) ─────────────── */
const OffresFilterGroups = ({
  referentials,
  counts = {},
  filters,
  toggle,
  period,
  onPeriod,
  locationId = null,
  onLocation,
  isLoading = false,
}) => {
  const {
    filieres = [], sources = [], contrats = [],
    experiences = [], niveaux = [], locations = [],
  } = referentials ?? {}

  return (
    <div className="flex flex-col">
      <Group icon={Sparkles} title="Filière">
        {isLoading && filieres.length === 0 ? <OptionsSkeleton rows={5} /> : filieres.map((f) => (
          <CheckRow
            key={f.code}
            checked={filters.filieres.has(f.code)}
            onToggle={() => toggle("filieres", f.code)}
            label={f.label}
            count={counts.filieres?.[f.code] ?? 0}
            lead={<span className={cn("size-2 shrink-0 rounded-full", (HUES[f.hue] ?? BRAND_HUE).dot)} />}
          />
        ))}
      </Group>

      <Group icon={MapPin} title="Localisation">
        <LocationPicker
          locations={locations}
          value={locationId}
          onChange={onLocation}
          isLoading={isLoading && locations.length === 0}
        />
      </Group>

      <Group icon={Layers} title="Sources">
        {isLoading && sources.length === 0 ? <OptionsSkeleton /> : sources.map((s) => (
          <CheckRow
            key={s.code}
            checked={filters.sources.has(s.code)}
            onToggle={() => toggle("sources", s.code)}
            label={s.label}
            count={counts.sources?.[s.code] ?? 0}
            lead={<SourceLogo code={s.code} className="size-5 rounded text-[8px]" />}
          />
        ))}
      </Group>

      <Group icon={Briefcase} title="Contrat">
        {isLoading && contrats.length === 0 ? <OptionsSkeleton /> : contrats.map((c) => (
          <CheckRow
            key={c.code}
            checked={filters.contrats.has(c.code)}
            onToggle={() => toggle("contrats", c.code)}
            label={c.label}
            count={counts.contrats?.[c.code] ?? 0}
          />
        ))}
      </Group>

      <Group icon={Zap} title="Expérience">
        {isLoading && experiences.length === 0 ? <OptionsSkeleton rows={3} /> : experiences.map((x) => (
          <CheckRow
            key={x.code}
            checked={filters.experiences.has(x.code)}
            onToggle={() => toggle("experiences", x.code)}
            label={x.label}
          />
        ))}
      </Group>

      <Group icon={GraduationCap} title="Niveau d'études">
        {isLoading && niveaux.length === 0 ? <OptionsSkeleton rows={3} /> : niveaux.map((n) => (
          <CheckRow
            key={n.code}
            checked={filters.niveaux.has(n.code)}
            onToggle={() => toggle("niveaux", n.code)}
            label={n.label}
          />
        ))}
      </Group>

      <Group icon={CalendarDays} title="Période de publication">
        <MiniCalendar range={period ?? filters.period} onChange={onPeriod} hue={BRAND_HUE} />
      </Group>
    </div>
  )
}

export default OffresFilterGroups
