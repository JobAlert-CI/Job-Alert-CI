// src/pages/filieres/detail/components/FiliereFilterGroups.jsx
import { Briefcase, CalendarDays, GraduationCap, Layers, MapPin, Zap } from "lucide-react"
import { MiniCalendar } from "@/components/shared"
import { BRAND_HUE } from "@/lib/hues"
import LocationPicker from "@/components/shared/filters/LocationPicker"
import {
  ContratOptions, ExperienceOptions, NiveauOptions, SourceOptions,
} from "@/components/shared/filters/FilterOptions"
import { useFiliereDetail } from "@/contexts/DetailsFiliere.context"

const Group = ({ icon: Icon, title, children }) => (
  <div className="border-b border-outline-variant/40 py-4 first:pt-0 last:border-0">
    <p className="mb-2 flex items-center gap-2 font-heading text-[13px] font-extrabold text-brand-navy">
      <Icon className="size-3.5 text-brand-orange" aria-hidden />
      {title}
    </p>
    {children}
  </div>
)

/* Groupes du tiroir mobile — autonomes via contexte + composants partagés.
   (La filière courante n'est pas un filtre : elle est remplacée par la localisation.) */
const FiliereFilterGroups = () => {
  const { refs, referentialsQuery, filters, toggle, setPeriod, setLocation, locationId, counts } =
    useFiliereDetail()
  const refsPending = referentialsQuery.isPending

  return (
    <div className="flex flex-col">
      <Group icon={MapPin} title="Localisation">
        <LocationPicker
          locations={refs.locations}
          value={locationId}
          onChange={setLocation}
          isLoading={refsPending && refs.locations.length === 0}
        />
      </Group>

      <Group icon={Layers} title="Sources">
        <SourceOptions filters={filters} toggle={toggle} counts={counts.sources} />
      </Group>

      <Group icon={Briefcase} title="Contrat">
        <ContratOptions filters={filters} toggle={toggle} counts={counts.contrats} />
      </Group>

      <Group icon={Zap} title="Expérience">
        <ExperienceOptions filters={filters} toggle={toggle} />
      </Group>

      <Group icon={GraduationCap} title="Niveau d'études">
        <NiveauOptions filters={filters} toggle={toggle} />
      </Group>

      <Group icon={CalendarDays} title="Période de publication">
        <MiniCalendar range={filters.period} onChange={setPeriod} hue={BRAND_HUE} />
      </Group>
    </div>
  )
}

export default FiliereFilterGroups