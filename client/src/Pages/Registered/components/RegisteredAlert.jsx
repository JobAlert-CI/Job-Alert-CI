import { AlertCircle, X } from "lucide-react"
import { useRegistered } from "@/contexts/Registered.context"

export const RegisteredAlert = () => {
  const { apiError, clearError } = useRegistered()

  if (!apiError) return null

  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 transition-all">
      <AlertCircle className="size-5 shrink-0 text-red-600 mt-0.5" />
      <div className="flex-1 text-sm">
        <p className="font-semibold text-red-900">Attention</p>
        <p className="mt-0.5 text-red-700">{apiError}</p>
      </div>
      <button
        type="button"
        onClick={clearError}
        className="shrink-0 rounded-md p-1 text-red-500 hover:bg-red-100 hover:text-red-800 transition-colors"
        aria-label="Fermer le message"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

export default RegisteredAlert
