import { createContext, useContext, useState, useCallback } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react"

const ToastContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }
  return context
}

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback(({ title, message, type = "info", duration = 4000 }) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    setToasts((prev) => [...prev, { id, title, message, type }])

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    }
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = {
    success: (title, message) => addToast({ title, message, type: "success" }),
    error: (title, message) => addToast({ title, message, type: "error" }),
    warning: (title, message) => addToast({ title, message, type: "warning" }),
    info: (title, message) => addToast({ title, message, type: "info" }),
  }

  const icons = {
    success: <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
    error: <AlertCircle className="size-4 text-rose-600 dark:text-rose-400 shrink-0" />,
    warning: <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />,
    info: <Info className="size-4 text-sky-600 dark:text-sky-400 shrink-0" />,
  }

  const borderColors = {
    success: "border-emerald-500/30 bg-emerald-500/5",
    error: "border-rose-500/30 bg-rose-500/5",
    warning: "border-amber-500/30 bg-amber-500/5",
    info: "border-sky-500/30 bg-sky-500/5",
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 15, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-lg backdrop-blur-md bg-white/95 dark:bg-zinc-900/95 ${borderColors[t.type]}`}
            >
              {icons[t.type]}
              <div className="flex-1 min-w-0">
                {t.title && (
                  <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
                    {t.title}
                  </h4>
                )}
                {t.message && (
                  <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed break-words">
                    {t.message}
                  </p>
                )}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors p-0.5"
              >
                <X className="size-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
