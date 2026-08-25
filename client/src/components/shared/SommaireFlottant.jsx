
import { useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { List, X } from "lucide-react"
import { cn } from "@/lib/utils"
import useClickOutside from "@/hooks/use-click-outside"
import Sommaire from "./Sommaire"

/**
 * Bouton flottant mobile (bas-gauche) ouvrant un popover sommaire.
 * Se referme au clic extérieur et après navigation vers une section.
 * Le scroll-spy du Sommaire continue de suivre la lecture, popover ouvert.
 */
const SommaireFlottant = ({ sections, lecture }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false))

  return (
    <div ref={ref} className="fixed bottom-12 right-5 z-40 lg:hidden">
      {/* Popover — ancré au-dessus du bouton */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-full right-0 z-50 mb-3 w-75"
          >
            <div className="max-h-[62vh] overflow-y-auto rounded-xl border border-outline-variant/50 bg-card shadow-hover">
              <div className="h-1 w-full bg-brand-orange" aria-hidden />
              <Sommaire
                sections={sections}
                lecture={lecture}
                onNavigate={() => setOpen(false)}
                className="rounded-none border-0 shadow-none"
              />
            </div>
            {/* Caret pointant vers le bouton */}
            <span
              className="absolute -bottom-1.5 left-6 size-3 rotate-45 border-b border-r border-outline-variant/50 bg-card"
              aria-hidden
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bouton déclencheur */}
      <motion.button
        onClick={() => setOpen((o) => !o)}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.94 }}
        transition={{ delay: 0.35, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        aria-expanded={open}
        aria-label={open ? "Fermer le sommaire" : "Ouvrir le sommaire"}
        className={cn(
          "inline-flex h-12 items-center gap-2.5 rounded-full px-5 text-sm font-bold text-white shadow-hover transition-colors duration-300",
          open ? "bg-brand-orange" : "bg-brand-navy hover:bg-brand-orange"
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={open ? "x" : "list"}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="grid size-4.5 place-items-center"
          >
            {open ? <X className="size-4.5" /> : <List className="size-4.5" />}
          </motion.span>
        </AnimatePresence>
        {open ? "Fermer" : "Sommaire"}
      </motion.button>
    </div>
  )
}
export default SommaireFlottant