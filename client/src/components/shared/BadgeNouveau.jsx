
import { cn } from "@/lib/utils"

const BadgeNouveau = ({ label = "Nouveau", variant = "soft", className }) => {
  if (variant === "solid") {
    return (
      <span className={cn("hidden shrink-0 rounded-full bg-brand-orange px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-on-primary sm:inline", className)}>
        {label}
      </span>
    )
  }
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-orange/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#B45309]", className)}>
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-orange opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-brand-orange" />
      </span>
      {label}
    </span>
  )
}
export default BadgeNouveau