
import { cn } from "@/lib/utils"

/** Cadre des visuels d'étape : horaire fantôme + décalage navy + carte blanche. */
const VisualFrame = ({ time, children, className, bodyClassName }) => (
  <div className={cn("relative", className)}>
    {time && (
      <span className="pointer-events-none absolute -top-9 right-0 select-none font-heading text-7xl font-black leading-none text-brand-navy/6 sm:text-8xl" aria-hidden>
        {time}
      </span>
    )}
    <div className="absolute inset-0 translate-x-3 translate-y-4 rotate-1 rounded-xl bg-brand-navy/6" aria-hidden />
    <div className={cn("relative rounded-xl border border-outline-variant/40 bg-card p-5 shadow-[0_20px_40px_-16px_rgba(15,45,77,0.18)]", bodyClassName)}>
      {children}
    </div>
  </div>
)
export default VisualFrame