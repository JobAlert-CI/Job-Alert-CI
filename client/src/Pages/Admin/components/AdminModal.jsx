import { useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"

export const AdminModal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = "md",
  footer,
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) onClose()
    }
    if (isOpen) {
      document.body.style.overflow = "hidden"
      window.addEventListener("keydown", handleKeyDown)
    }
    return () => {
      document.body.style.overflow = "unset"
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, onClose])

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-[95vw] sm:max-w-6xl",
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={`relative z-10 w-full ${sizeClasses[size]} overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest dark:bg-zinc-900 shadow-2xl transition-all`}
          >
            {/* Header */}
            {(title || subtitle) && (
              <div className="flex items-start justify-between border-b border-outline-variant/20 px-6 py-4.5 bg-surface-container-low/40 dark:bg-zinc-800/40">
                <div>
                  {title && (
                    <h3 className="text-base font-semibold text-on-surface dark:text-zinc-100">
                      {title}
                    </h3>
                  )}
                  {subtitle && (
                    <p className="mt-0.5 text-xs text-on-surface-variant dark:text-zinc-400">
                      {subtitle}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-zinc-800 hover:text-on-surface transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}

            {/* Body */}
            <div className="max-h-[75vh] overflow-y-auto p-6 text-sm text-on-surface dark:text-zinc-200">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-2.5 border-t border-outline-variant/20 px-6 py-3.5 bg-surface-container-low/50 dark:bg-zinc-800/50">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
