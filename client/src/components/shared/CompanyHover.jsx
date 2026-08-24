
import { Building2 } from "lucide-react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"

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
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-navy font-heading text-xs font-extrabold text-white">
          {offre.entreprise.split(" ").map((w) => w[0]).slice(0, 2).join("")}
        </span>
        <div>
          <p className="font-heading text-sm font-semibold">{offre.entreprise}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Recrute via {offre.source}</p>
          {totalOffres != null && (
            <p className="text-xs text-muted-foreground">{totalOffres} offre(s) active(s) sur JobAlert CI</p>
          )}
        </div>
      </div>
    </HoverCardContent>
  </HoverCard>
)
export default CompanyHover