
import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"

const VARIANTS = {
  primary:   "bg-brand-orange text-on-primary shadow-[0_12px_28px_-8px_rgba(245,166,35,0.5)] hover:-translate-y-0.5 hover:brightness-110",
  secondary: "border border-brand-navy/15 bg-card/70 text-brand-navy backdrop-blur-sm hover:border-brand-navy/35 hover:bg-card",
  navy:      "border border-brand-navy bg-brand-navy text-white hover:bg-brand-navy/90",
  outline:   "border border-brand-navy/25 bg-card text-brand-navy shadow-soft hover:-translate-y-0.5 hover:border-brand-navy hover:bg-brand-navy hover:text-white hover:shadow-hover",
}
const SIZES = {
  lg: "gap-2.5 rounded-lg px-7 py-3.5 text-base",
  md: "gap-2 rounded-lg px-5 py-2.5 text-sm",
  sm: "gap-1.5 rounded-md px-4 py-2 text-[13px]",
}

/**
 * Orange « lisible sur fond clair » — #B45309 (amber-700), ratio WCAG 5.02:1 (AA)
 * contre 2.03:1 pour le brand-orange brut (#F5A623) sur blanc. Cf. Audit.md P0-6.
 * Usage : texte/icônes orange sur les surfaces claires (bg-card, background).
 * Sur fond navy, text-brand-orange reste correct (ratio 6.89:1).
 */
export const ORANGE_LISIBLE = "text-[#B45309]"

/** to → route ("/inscription") ou ancre ("#chaine"). */
const CtaLink = ({ to, variant = "primary", size = "lg", icon: Icon, iconRight: IconRight, animateIcon = false, iconRightClassName, children, className, ...rest }) => {
  const isAnchor = typeof to === "string" && to.startsWith("#")
  const Comp = isAnchor ? "a" : Link
  const dest = isAnchor ? { href: to } : { to }
  return (
    <Comp
      {...dest}
      {...rest}
      className={cn("group inline-flex items-center justify-center font-bold transition-all duration-300 active:scale-[0.98]", VARIANTS[variant], SIZES[size], className)}
    >
      {Icon && (
        <Icon className={cn(
          size === "lg" ? "size-5" : "size-4",
          "transition-transform duration-300",
          animateIcon ? "group-hover:rotate-12" : "group-hover:-translate-y-0.5"
        )} />
      )}
      {children}
      {IconRight && (
        <IconRight className={cn("size-4 transition-transform duration-300 group-hover:translate-x-1", iconRightClassName)} />
      )}
    </Comp>
  )
}
export default CtaLink
