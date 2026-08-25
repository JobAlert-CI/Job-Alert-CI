
import { AnimatePresence, motion } from "framer-motion"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const CheckRow = ({ checked, onToggle, label, count, lead }) => (
  <button
    onClick={onToggle}
    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-container-low"
  >
    <span className={cn(
      "grid size-4.5 shrink-0 place-items-center rounded-[5px] border transition-all duration-200",
      checked ? "border-brand-navy bg-brand-navy" : "border-outline-variant bg-card"
    )}>
      <AnimatePresence>
        {checked && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.15 }}>
            <Check className="size-3 text-white" strokeWidth={3.5} />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
    {lead}
    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-on-surface">{label}</span>
    {count != null && <span className="text-[11px] font-semibold text-muted-foreground">{count}</span>}
  </button>
)
export default CheckRow