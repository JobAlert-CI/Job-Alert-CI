
import { Briefcase, CalendarDays, GraduationCap, Layers, Sparkles, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { BRAND_HUE, paletteDepuisHex } from "@/lib/hues"
import {
  CONTRATS, EXPERIENCES, FILIERES_META, NIVEAUX, SOURCES,
} from "@/lib/referentiels"
import { SourceLogo } from "../SourceBadge"
import CheckRow from "./CheckRow"
import FilterGroup from "./FilterGroup"
import MiniCalendar from "./MiniCalendar"

/**
 * groups → sous-ensemble de :
 *   "filieres" | "specialites" | "sources" | "contrats" | "experiences" | "niveaux" | "period"
 * meta + hue → requis uniquement pour "specialites"
 */
const OfferFilterGroups = ({
  filters, toggle, counts, onPeriod,
  groups = ["filieres", "sources", "contrats", "experiences", "niveaux", "period"],
  meta = null,
  hue = BRAND_HUE,
}) => (
  <div className="flex flex-col gap-5">
    {groups.includes("filieres") && (
      <FilterGroup title="Filière métier" icon={Sparkles}>
        <div className="max-h-64 overflow-y-auto pr-1">
          {FILIERES_META.map((f) => {
            const palette = paletteDepuisHex(f.colorHex)
            return (
              <CheckRow
                key={f.code}
                checked={filters.filieres?.has(f.code)}
                onToggle={() => toggle("filieres", f.code)}
                label={f.label}
                count={counts.filieres?.[f.code] || 0}
                lead={<span className={cn("size-2 shrink-0 rounded-full", palette.dot)} style={palette.style} />}
              />
            )
          })}
        </div>
      </FilterGroup>
    )}

    {groups.includes("specialites") && meta && (
      <FilterGroup title="Spécialité" icon={Sparkles}>
        {meta.specialites.map((sp) => (
          <CheckRow
            key={sp}
            checked={filters.specialites?.has(sp)}
            onToggle={() => toggle("specialites", sp)}
            label={sp}
            count={counts.specialites?.[sp] || 0}
            lead={<span className={cn("size-2 shrink-0 rounded-full", hue.dot)} />}
          />
        ))}
      </FilterGroup>
    )}

    {groups.includes("sources") && (
      <FilterGroup title="Source" icon={Layers}>
        {SOURCES.map((s) => (
          <CheckRow
            key={s.code}
            checked={filters.sources?.has(s.code)}
            onToggle={() => toggle("sources", s.code)}
            label={s.code}
            count={counts.sources?.[s.code] || 0}
            lead={<SourceLogo code={s.code} className="size-5" />}
          />
        ))}
      </FilterGroup>
    )}

    {groups.includes("contrats") && (
      <FilterGroup title="Type d'emploi" icon={Briefcase}>
        {CONTRATS.map((c) => (
          <CheckRow key={c} checked={filters.contrats?.has(c)} onToggle={() => toggle("contrats", c)} label={c} count={counts.contrats?.[c] || 0} />
        ))}
      </FilterGroup>
    )}

    {groups.includes("experiences") && (
      <FilterGroup title="Expérience" icon={Zap}>
        {EXPERIENCES.map((x) => (
          <CheckRow key={x} checked={filters.experiences?.has(x)} onToggle={() => toggle("experiences", x)} label={x} count={counts.experiences?.[x] || 0} />
        ))}
      </FilterGroup>
    )}

    {groups.includes("niveaux") && (
      <FilterGroup title="Niveau d'études" icon={GraduationCap}>
        {NIVEAUX.map((n) => (
          <CheckRow key={n} checked={filters.niveaux?.has(n)} onToggle={() => toggle("niveaux", n)} label={n} count={counts.niveaux?.[n] || 0} />
        ))}
      </FilterGroup>
    )}

    {groups.includes("period") && (
      <FilterGroup
        title="Date de publication"
        icon={CalendarDays}
        action={
          (filters.period?.start || filters.period?.end) && (
            <button onClick={() => onPeriod({ start: null, end: null })} className="text-[11px] font-bold text-brand-orange hover:underline">
              Effacer
            </button>
          )
        }
      >
        <MiniCalendar range={filters.period} onChange={onPeriod} hue={hue} />
      </FilterGroup>
    )}
  </div>
)
export default OfferFilterGroups