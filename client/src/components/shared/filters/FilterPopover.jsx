
import { useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import useClickOutside from "@/hooks/use-click-outside"

const FilterPopover = ({ label, icon: Icon, count = 0, open, onToggle, onClose, align = "left", panelClassName, children }) => {
  const ref = useRef(null)
  useClickOutside(ref, onClose)
  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-all duration-200",
          count > 0 || open
            ? "border-brand-navy bg-brand-navy text-white shadow-soft"
            : "border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant hover:border-brand-navy/40 hover:text-brand-navy"
        )}
      >
        {Icon && <Icon className="size-3.5" />}
        {label}
        {count > 0 && (
          <span className={cn(
            "grid size-4 place-items-center rounded-full text-[10px] font-black",
            open ? "bg-card text-brand-navy" : "bg-brand-orange text-on-primary"
          )}>
            {count}
          </span>
        )}
        <ChevronDown className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "absolute top-full z-50 mt-2 w-60 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-2.5 shadow-hover",
              align === "right" ? "right-0" : "left-0",
              panelClassName
            )}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
export default FilterPopover