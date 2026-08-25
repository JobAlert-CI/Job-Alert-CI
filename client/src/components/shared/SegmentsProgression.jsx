
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

/**
 * tone="dark"  → sur fond navy (CarteUne)
 * tone="light" → sur fond clair (ConseilDuJour)
 */
const SegmentsProgression = ({ count, idx, progression, onSelect, labels, tone = "dark", className }) => (
  <div className={cn("flex gap-1.5", className)}>
    {Array.from({ length: count }, (_, i) => (
      <button
        key={i}
        onClick={() => onSelect?.(i)}
        aria-label={labels?.[i] ?? `Élément ${i + 1} sur ${count}`}
        aria-current={i === idx}
        className="-my-1 flex flex-1 py-2.5"
      >
        <span className={cn(
          "block h-1 w-full overflow-hidden rounded-full transition-colors duration-300",
          tone === "dark" ? "bg-card/15 hover:bg-card/30" : "bg-outline-variant/50 hover:bg-outline-variant"
        )}>
          {i === idx && (
            <motion.span className="block h-full origin-left rounded-full bg-brand-orange" style={{ scaleX: progression }} />
          )}
        </span>
      </button>
    ))}
  </div>
)
export default SegmentsProgression