import { cn, getInitials } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export const SourceLogo = ({ code, className = "size-7" }) => {
  return (
    <span className={cn("flex items-center justify-center rounded-md bg-brand-navy/10 font-heading text-[11px] font-extrabold text-brand-navy", className)}>
      {getInitials(code)}
    </span>
  )
}

export const ChipSource = ({ source, title, tooltip, className, logoClassName = "size-6" }) => (
  <Tooltip>
    <TooltipTrigger >
      <span className={cn(
        "inline-flex cursor-default items-center gap-1.5 rounded-full border border-outline-variant/50 bg-surface-container-low/60 px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant",
        className
      )}>
        <SourceLogo code={source} className={logoClassName} />
        {title ?? source}
      </span>
    </TooltipTrigger>
    <TooltipContent side="top">{tooltip ?? `Collectée sur ${title ?? source} ce matin`}</TooltipContent>
  </Tooltip>
)