import { cn } from "cn"

/* ─────────────────────────────────────────────────────────────────────
   Compteur de caractères avec signal visuel d'approche de la limite :
   gris → orange (#B45309, AA sur fond clair) → rouge à saturation.
   Utilisé par le dialog de déclenchement (index.jsx) et le dialog
   d'annotation des notes (DetailRun.jsx).
───────────────────────────────────────────────────────────────────── */
const CompteurCaracteres = ({ valeur, max, id }) => {
  const restant = max - valeur
  const classe =
    restant <= 0
      ? "font-semibold text-destructive"
      : restant <= 100
        ? "font-medium text-[#B45309]"
        : "text-muted-foreground"

  return (
    <p
      id={id}
      aria-live="polite"
      className={cn("text-right text-[10px] tabular-nums transition-colors duration-200", classe)}
    >
      {valeur}/{max}
    </p>
  )
}

export default CompteurCaracteres