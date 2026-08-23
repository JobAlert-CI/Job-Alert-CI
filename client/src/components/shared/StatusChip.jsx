
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const TONES = {
  emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700",
  orange:  "border-brand-orange/30 bg-brand-orange/10 text-[#B45309]",
  navy:    "border-brand-navy/20 bg-brand-navy/5 text-brand-navy",
}
const DOTS = { emerald: "bg-emerald-500", orange: "bg-brand-orange", navy: "bg-brand-navy" }

/** Badge « statut vivant » avec pastille ping + tooltip optionnel. */
const StatusChip = ({ children, tooltip, tone = "emerald", ping = true, className }) => (
  <Tooltip>
    <TooltipTrigger >
      <span className={cn(
        "inline-flex cursor-default items-center gap-2.5 rounded-full border py-1.5 pl-2.5 pr-4 text-xs font-semibold",
        TONES[tone],
        className
      )}>
        <span className="relative flex size-2">
          {ping && <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-75", DOTS[tone])} />}
          <span className={cn("relative inline-flex size-2 rounded-full", DOTS[tone])} />
        </span>
        {children}
      </span>
    </TooltipTrigger>
    {tooltip && <TooltipContent side="bottom" className="max-w-62.5 text-center">{tooltip}</TooltipContent>}
  </Tooltip>
)
export default StatusChip