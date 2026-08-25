
import { Building2 } from "lucide-react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import LogoEntreprise from "./LogoEntreprise"

const CompanyHover = ({ offre, totalOffres }) => (
  <HoverCard openDelay={200}>
    <HoverCardTrigger>
      <button className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <Building2 className="size-3.5" />
        <span className="font-medium">{offre.entreprise}</span>
      </button>
    </HoverCardTrigger>
    <HoverCardContent align="start" className="w-64">
      <div className="flex gap-3">
        {/* Logo avec fallback initiales navy (Cf. Audit.md Pilier 6) */}
        <LogoEntreprise
          entreprise={offre.entreprise}
          logoUrl={offre.logoUrl}
          className="size-10"
        />
        <div>
          <p className="font-heading text-sm font-semibold">{offre.entreprise}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Recrute via {offre.sourceLabel || offre.source}</p>
          {totalOffres != null && (
            <p className="text-xs text-muted-foreground">{totalOffres} offre(s) active(s) sur JobAlert CI</p>
          )}
        </div>
      </div>
    </HoverCardContent>
  </HoverCard>
)
export default CompanyHover
