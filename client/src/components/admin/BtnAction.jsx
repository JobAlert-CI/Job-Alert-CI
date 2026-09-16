import { forwardRef } from "react"
import { Slot } from "@radix-ui/react-slot"
import { Loader2 } from "lucide-react"
import { cn } from "cn"

/* ─────────────────────────────────────────────────────────────────────
  BtnAction — bouton d'action réutilisable (CTA et actions admin).

  Props :
    • size       : "xs" | "sm" | "md" (défaut) | "lg" | "xl" | "xxl"
    • variant     : "primary" (orange/navy, AA) | "navy" | "secondary" | "outline" | "ghost" | "danger"
    • chargement   : spinner + désactivation + aria-busy
    • pleineLargeur: w-full (formulaires, dialogues)
    • asChild      : rendu polymorphe (ex. <Link>) en conservant le style
    • onClick     : onClick (l'API d'origine est conservée)

  Contrastes (Audit Lot 2, index.css) :
    • orange #F5A623 + blanc = 2.03:1 ❌ → primary utilise le navy (6.3:1 ✓)
    • le hover assombrit (#D18E0F) au lieu de brightness-110 qui éclairait une couleur déjà trop claire (perte de contraste + effet "lavé").
    • Micro-interactions GPU-friendly (translate/scale) coupées si prefers-reduced-motion. Le focus visible est géré par le CSS global.
───────────────────────────────────────────────────────────────────── */

const TAILLES = {
  xs:  "h-7  gap-1   px-2.5 text-[11px] rounded-md",
  sm:  "h-8  gap-1.5 px-3.5 text-xs     rounded-md",
  md:  "h-10 gap-2   px-6   text-sm     rounded-md",
  lg:  "h-11 gap-2   px-7   text-sm     rounded-lg",
  xl:  "h-12 gap-2.5 px-8   text-base   rounded-lg",
  xxl: "h-14 gap-3   px-10  text-base   rounded-xl",
}

const TAILLES_SPINNER = {
  xs: "size-3", sm: "size-3.5", md: "size-4", lg: "size-4", xl: "size-5", xxl: "size-5",
}

const VARIANTS = {
  /* CTA : orange + texte navy (6.3:1 AA) + élévation navy au survol. */
  primary: cn(
    "bg-brand-orange text-brand-navy font-bold shadow-soft",
    "hover:bg-[#D18E0F] hover:shadow-hover hover:-translate-y-0.5",
    "active:translate-y-0 active:scale-[0.98]"
  ),
  /* Surface navy de la marque (sidebar, actions fortes secondaires). */
  navy: cn(
    "bg-brand-navy text-white shadow-soft",
    "hover:bg-[#1A3D5C] hover:shadow-hover hover:-translate-y-0.5",
    "active:translate-y-0 active:scale-[0.98]"
  ),
  /* Secondary action : navy tint du design system. */
  secondary: cn(
    "bg-secondary text-secondary-foreground",
    "hover:bg-secondary/70 hover:-translate-y-0.5",
    "active:translate-y-0 active:scale-[0.98]"
  ),
  /* Bordure fine (règle « interlays » : bord 1px plutôt qu'ombre). */
  outline:
    "border border-border bg-transparent text-brand-navy hover:border-brand-navy/30 hover:bg-accent hover:text-accent-foreground",
  /* Action discrète (toolbars, liens d'action). */
  ghost: "text-brand-navy hover:bg-accent hover:text-accent-foreground",
  /* Actions destructives. */
  danger: cn(
    "bg-destructive text-white shadow-soft",
    "hover:bg-destructive/90 hover:shadow-hover hover:-translate-y-0.5",
    "active:translate-y-0 active:scale-[0.98]"
  ),
}

/**
 * BtnAction
 *
 * @param {object} props
 * @param {string} props.size "xs" | "sm" | "md" (défaut) | "lg" | "xl" | "xxl" 
 * @param {string} props.variant "primary" (orange/navy, AA) | "navy" | "secondary" | "outline" | "ghost" | "danger"
 * @param {boolean} props.chargement
 * @param {boolean} props.pleineLargeur
 * @param {boolean} props.asChild
 * @param {function} props.onClick
 * @param {string} props.className
 */

const BtnAction = forwardRef(
  (
    {
      onClick,
      children,
      size = "md",
      variant = "primary",
      type = "button",
      disabled = false,
      chargement = false,
      pleineLargeur = false,
      asChild = false,
      className,
      ...props
    },
    ref
  ) => {
    const inactif = disabled || chargement
    /* asChild → Slot : les props/className sont fusionnées sur l'enfant
       (ex. <Link to="...">) qui reçoit le style du bouton. */
    const Comp = asChild ? Slot : "button"

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        onClick={onClick}
        disabled={asChild ? undefined : inactif}
        aria-busy={chargement || undefined}
        className={cn(
          "group inline-flex cursor-pointer select-none items-center justify-center whitespace-nowrap font-bold rounded-md!",
          "transition-all duration-300 ease-out [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          "motion-reduce:transform-none motion-reduce:transition-none",
          TAILLES[size] ?? TAILLES.md,
          VARIANTS[variant] ?? VARIANTS.primary,
          pleineLargeur && "w-full",
          inactif && "pointer-events-none opacity-50 shadow-none",
          className
        )}
        {...props}
      >
        {chargement && (
          <Loader2
            className={cn("animate-spin motion-reduce:animate-none", TAILLES_SPINNER[size] ?? "size-4")}
            aria-hidden="true"
          />
        )}
        {children}
      </Comp>
    )
  }
)

BtnAction.displayName = "BtnAction"

export default BtnAction