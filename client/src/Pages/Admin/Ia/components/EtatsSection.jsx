import { AlertTriangle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

/* ─────────────────────────────────────────────────────────────────────
   États section de la page IA (pattern LogsPage/Scraping).
   ───────────────────────────────────────────────────────────────────── */

export const SectionErreur = ({ onRetry, message = "Chargement impossible." }) => (
  <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
    <AlertTriangle className="size-8 text-destructive" aria-hidden />
    <div>
      <p className="text-sm font-semibold">{message}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Vérifiez que l'API est joignable, puis réessayez.
      </p>
    </div>
    {onRetry && (
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCcw aria-hidden /> Réessayer
      </Button>
    )}
  </div>
)

export const SectionVide = ({ message }) => (
  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
    <p className="text-sm text-muted-foreground">{message}</p>
  </div>
)

export const SectionAucunResultat = ({ onReset, message }) => (
  <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
    <p className="text-sm text-muted-foreground">{message}</p>
    {onReset && (
      <Button variant="ghost" size="sm" onClick={onReset}>
        <RotateCcw aria-hidden /> Réinitialiser les filtres
      </Button>
    )}
  </div>
)
