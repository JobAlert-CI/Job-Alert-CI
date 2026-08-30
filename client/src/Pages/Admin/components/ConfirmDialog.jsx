import { AlertTriangle, Loader2 } from "lucide-react"

/**
 * ConfirmDialog (S6) — modale de confirmation générique.
 * `tone="danger"` pour les suppressions, `message` supporte du contenu RGPD explicite.
 */
export const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title = "Confirmer l'action",
  message,
  confirmText = "Confirmer",
  cancelText = "Annuler",
  tone = "primary",
  loading = false,
  children,
}) => {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      onClick={loading ? undefined : onClose}
    >
      <div className="adm-card w-full max-w-md p-6 shadow-hover" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
              tone === "danger" ? "bg-error-container text-on-error-container" : "bg-secondary text-secondary-foreground"
            }`}
          >
            <AlertTriangle className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-heading text-base font-bold">{title}</h3>
            {message && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{message}</p>}
            {children}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="adm-btn-outline" disabled={loading} onClick={onClose}>
            {cancelText}
          </button>
          <button type="button" className={tone === "danger" ? "adm-btn-danger" : "adm-btn-primary"} disabled={loading} onClick={onConfirm}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
