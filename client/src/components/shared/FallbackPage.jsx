// Fallback de chargement pour les routes en lazy-loading (Cf. Audit.md P1-13).
import { Loader2 } from "lucide-react"

const FallbackPage = () => (
  <div
    role="status"
    aria-live="polite"
    className="flex min-h-[60vh] w-full items-center justify-center bg-background"
  >
    <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
    <span className="sr-only">Chargement de la page…</span>
  </div>
)

export default FallbackPage
