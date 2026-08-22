import { AlertTriangle, AlertCircle, Info } from "lucide-react"
import { AdminModal } from "./AdminModal"
import { Button } from "@/components/ui/button"

export const AdminConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirmer l'action",
  message = "Êtes-vous sûr de vouloir effectuer cette action ?",
  confirmText = "Confirmer",
  cancelText = "Annuler",
  variant = "danger", // 'danger' | 'warning' | 'primary'
  loading = false,
}) => {
  const iconConfig = {
    danger: {
      icon: <AlertCircle className="size-6 text-rose-600 dark:text-rose-400" />,
      bg: "bg-rose-500/10 border-rose-500/20",
      confirmVariant: "destructive",
    },
    warning: {
      icon: <AlertTriangle className="size-6 text-amber-600 dark:text-amber-400" />,
      bg: "bg-amber-500/10 border-amber-500/20",
      confirmVariant: "secondary",
    },
    primary: {
      icon: <Info className="size-6 text-brand-navy dark:text-sky-400" />,
      bg: "bg-brand-navy/10 border-brand-navy/20",
      confirmVariant: "default",
    },
  }

  const { icon, bg, confirmVariant } = iconConfig[variant] || iconConfig.primary

  return (
    <AdminModal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="flex flex-col items-center text-center p-2">
        <div className={`grid size-12 place-items-center rounded-2xl border ${bg} mb-3.5`}>
          {icon}
        </div>
        <h3 className="text-base font-semibold text-on-surface dark:text-zinc-100">
          {title}
        </h3>
        <p className="mt-2 text-xs text-on-surface-variant dark:text-zinc-400 leading-relaxed max-w-sm">
          {message}
        </p>
        <div className="mt-6 flex w-full items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            size="default"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 font-semibold"
          >
            {loading ? "Traitement..." : confirmText}
          </Button>
        </div>
      </div>
    </AdminModal>
  )
}
