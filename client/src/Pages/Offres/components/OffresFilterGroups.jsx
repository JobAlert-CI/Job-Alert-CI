// src/pages/offres/components/OffresFilterGroups.jsx
import {
  Briefcase, CalendarDays, GraduationCap, Layers, MapPin,
  Sparkles, Zap,
} from "lucide-react"
import { CheckRow, MiniCalendar, SourceLogo } from "@/components/shared"
import { Skeleton } from "@/components/ui/skeleton"
import { HUES, BRAND_HUE } from "@/lib/hues"
import { cn } from "@/lib/utils"
import { useOfferCountsQuery, useOfferReferentialsQuery } from "@/tools/offres.tools"
import { useOffresFilters } from "@/contexts/Offres.context"
import LocationPicker from "@/components/shared/filters/LocationPicker"


/* ─────────────── Sélecteur de localisation (réutilisé par la barre desktop) ─────────────── */

/* ─────────────── Structure locale ─────────────── */
const Group = ({ icon: Icon, title, children }) => (
  <div className="border-b border-outline-variant/40 py-4 first:pt-0 last:border-0">
    <p className="mb-2 flex items-center gap-2 font-heading text-[13px] font-extrabold text-brand-navy">
      <Icon className="size-3.5 text-brand-orange" aria-hidden />
      {title}
    </p>
    {children}
  </div>
)

const OptionsSkeleton = ({ rows = 4 }) => (
  <div className="space-y-1.5" aria-hidden="true">
    {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-8 w-full rounded-md" />)}
  </div>
)

/* ─────────────── Tous les groupes — 100 % autonome ─────────────── */
const OffresFilterGroups = () => {
  const { data: refs, isPending } = useOfferReferentialsQuery()
  const { data: counts } = useOfferCountsQuery()
  const { filters, toggle, setPeriod, setLocation, locationId } = useOffresFilters()

  const {
    filieres = [], sources = [], contrats = [],
    experiences = [], niveaux = [], locations = [],
  } = refs ?? {}

  return (
    <div className="flex flex-col">
      <Group icon={Sparkles} title="Filière">
        {isPending && filieres.length === 0 ? <OptionsSkeleton rows={5} /> : filieres.map((f) => (
          <CheckRow
            key={f.code}
            checked={filters.filieres.has(f.code)}
            onToggle={() => toggle("filieres", f.code)}
            label={f.label}
            count={counts.filieres?.[f.code] ?? 0}
            lead={<span className={cn("size-2 shrink-0 rounded-full", (HUES[f.hue] ?? BRAND_HUE).dot)} aria-hidden />}
          />
        ))}
      </Group>

      <Group icon={MapPin} title="Localisation">
        <LocationPicker
          locations={locations}
          value={locationId}
          onChange={setLocation}
          isLoading={isPending && locations.length === 0}
        />
      </Group>

      <Group icon={Layers} title="Sources">
        {isPending && sources.length === 0 ? <OptionsSkeleton /> : sources.map((s) => (
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
        {isPending && contrats.length === 0 ? <OptionsSkeleton /> : contrats.map((c) => (
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
        {isPending && experiences.length === 0 ? <OptionsSkeleton rows={3} /> : experiences.map((x) => (
          <CheckRow
            key={x.code}
            checked={filters.experiences.has(x.code)}
            onToggle={() => toggle("experiences", x.code)}
            label={x.label}
          />
        ))}
      </Group>

      <Group icon={GraduationCap} title="Niveau d'études">
        {isPending && niveaux.length === 0 ? <OptionsSkeleton rows={3} /> : niveaux.map((n) => (
          <CheckRow
            key={n.code}
            checked={filters.niveaux.has(n.code)}
            onToggle={() => toggle("niveaux", n.code)}
            label={n.label}
          />
        ))}
      </Group>

      <Group icon={CalendarDays} title="Période de publication">
        <MiniCalendar range={filters.period} onChange={setPeriod} hue={BRAND_HUE} />
      </Group>
    </div>
  )
}

export default OffresFilterGroups