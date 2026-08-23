import { motion } from "framer-motion"
import { Check, CheckCircle2, SlidersHorizontal, Briefcase, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRegistered } from "@/contexts/Registered.context"

const ETAPES_CONFIG = [
  { id: "identite", label: "Identité", icon: User },
  { id: "preferences", label: "Préférences", icon: SlidersHorizontal },
  { id: "profil", label: "Profil", icon: Briefcase, optionnel: true },
  { id: "validation", label: "Validation", icon: CheckCircle2 },
]

export const Stepper = () => {
  const { step, goToStep } = useRegistered()

  return (
    <div className="relative px-1 select-none">
      {/* Ligne d'arrière-plan */}
      <div className="absolute left-5.5 right-5.5 top-5.5 h-0.5 rounded bg-outline-variant/40" aria-hidden />
      
      {/* Ligne de progression dynamique */}
      <motion.div
        className="absolute left-5.5 top-4.5 h-0.5 rounded bg-brand-orange"
        initial={false}
        animate={{ width: `calc((100% - 44px) * ${step / (ETAPES_CONFIG.length - 1)})` }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden
      />

      <div className="relative flex justify-between">
        {ETAPES_CONFIG.map((e, i) => {
          const done = i < step
          const active = i === step
          const isClickable = done

          return (
            <div
              key={e.id}
              onClick={() => isClickable && goToStep(i)}
              className={cn(
                "flex flex-col items-center gap-1.5 transition-opacity",
                isClickable ? "cursor-pointer group hover:opacity-90" : "cursor-default"
              )}
            >
              <motion.span
                initial={false}
                animate={active ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                transition={{ duration: 0.35 }}
                className={cn(
                  "grid size-9 place-items-center rounded-full border-2 font-heading text-sm font-bold transition-all duration-300",
                  done && "border-brand-navy bg-brand-navy text-white group-hover:ring-2 group-hover:ring-brand-navy/30",
                  active && "border-brand-orange bg-brand-orange/10 text-brand-orange ring-4 ring-brand-orange/15 shadow-sm",
                  !done && !active && "border-outline-variant/60 bg-white text-muted-foreground"
                )}
                title={isClickable ? `Revenir à l'étape ${e.label}` : undefined}
              >
                {done ? <Check className="size-4" strokeWidth={3} /> : <e.icon className="size-4" />}
              </motion.span>
              <span
                className={cn(
                  "whitespace-nowrap text-[8px] md:text-[10px] font-bold uppercase tracking-wider transition-colors",
                  active ? "text-brand-orange" : done ? "text-brand-navy" : "text-muted-foreground"
                )}
              >
                {e.label}
                {e.optionnel && (
                  <span className="ml-1 font-medium normal-case text-muted-foreground/70">(opt.)</span>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Stepper
