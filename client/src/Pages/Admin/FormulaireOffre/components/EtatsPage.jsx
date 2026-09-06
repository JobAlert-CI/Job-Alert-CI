import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

/* États de la page formulaire (erreur de chargement de l'offre). */
export const SectionErreur = ({ onRetry, message = "Chargement impossible." }) => (
  <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
    <AlertTriangle className="size-5 text-destructive" aria-hidden />
    <p className="text-sm font-medium text-destructive">{message}</p>
    {onRetry && (
      <Button variant="outline" size="sm" onClick={onRetry}>
        Réessayer
      </Button>
    )}
  </div>
)
