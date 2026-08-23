import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getImgSource } from "@/utils/utilsSource"

export const SourceLogo = ({ code, className = "size-6" }) => {
  return (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded", className)}>
      <img src={getImgSource(code)} alt={code} className="size-full object-contain" />
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